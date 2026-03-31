"""
FastAPI Backend — Autonomous Structural Intelligence System
Exposes:
  POST /api/parse          → Stage 1+2: parse image, reconstruct geometry
  POST /api/analyse        → Stage 4+5: material tradeoff + explainability
  POST /api/pipeline       → Full pipeline in one call (primary endpoint)
  GET  /api/health         → Health check
  POST /api/fallback       → Manual coordinate input (fallback clause)
"""

import os
import json
import math
import logging
import traceback
import hashlib
import asyncio
from uuid import uuid4
from pathlib import Path
from datetime import datetime
from typing import Optional

import numpy as np
import cv2
from dotenv import load_dotenv
from fastapi import FastAPI, File, UploadFile, HTTPException, Body, Form, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Load backend/.env before importing pipeline modules that read env at import-time
load_dotenv(Path(__file__).resolve().parent / ".env")

from pipeline.parser import parse_floor_plan, build_manual_result
from pipeline.geometry import reconstruct_geometry
from pipeline.material import analyse_materials
from pipeline.explainer import generate_report
from pipeline.validator import verify_generated_model

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
UPLOADS_DIR = Path(__file__).resolve().parent / "data" / "uploads"
DRAW_HISTORY_DIR = Path(__file__).resolve().parent / "data" / "draw_history"
DRAW_HISTORY_INDEX = DRAW_HISTORY_DIR / "index.json"
CONVERSION_HISTORY_DIR = Path(__file__).resolve().parent / "data" / "conversion_history"
CONVERSION_HISTORY_INDEX = CONVERSION_HISTORY_DIR / "index.json"
PIPELINE_JOBS = {}
PIPELINE_LOCK = asyncio.Lock()
DRAW_HISTORY_LOCK = asyncio.Lock()
CONVERSION_HISTORY_LOCK = asyncio.Lock()
DEFAULT_FRONTEND_ORIGINS = {
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "https://recraft3d.vercel.app",
}


def _parse_cors_origins():
    origins = set(DEFAULT_FRONTEND_ORIGINS)

    for env_name in ("FRONTEND_URL", "FRONTEND_URLS"):
        raw_value = os.getenv(env_name, "")
        for origin in raw_value.split(","):
            cleaned = origin.strip().rstrip("/")
            if cleaned:
                origins.add(cleaned)

    return sorted(origins)

# ── Numpy JSON Fix ────────────────────────────────────────────────────────────

class NumpyEncoder(json.JSONEncoder):
    """Converts numpy types to native Python types for JSON serialization."""
    def default(self, obj):
        if isinstance(obj, np.integer):
            return int(obj)
        if isinstance(obj, np.floating):
            return float(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        if isinstance(obj, np.bool_):
            return bool(obj)
        return super().default(obj)

def to_json_safe(data):
    """Recursively convert all numpy types in a dict to JSON-safe Python types."""
    return json.loads(json.dumps(data, cls=NumpyEncoder))


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Autonomous Structural Intelligence System",
    description="Floor Plan Parser · 3D Generator · Material Optimiser",
    version="1.0.0"
)

CORS_ALLOWED_ORIGINS = _parse_cors_origins()
logger.info("CORS allowed origins: %s", ", ".join(CORS_ALLOWED_ORIGINS))

# CORS — allow local dev plus the deployed Vercel frontend.
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOWED_ORIGINS,
    allow_origin_regex=r"https://(?:recraft3d|recraft3d-[a-z0-9-]+)\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def _upsert_job(job_id: str, **fields):
    async with PIPELINE_LOCK:
        job = PIPELINE_JOBS.setdefault(job_id, {
            "events": [],
            "sockets": [],
            "result": None,
            "error": None,
        })
        job.update(fields)
        return job


async def _append_job_event(job_id: str, event: dict):
    async with PIPELINE_LOCK:
        job = PIPELINE_JOBS.setdefault(job_id, {
            "events": [],
            "sockets": [],
            "result": None,
            "error": None,
        })
        job["events"].append(event)
        sockets = list(job["sockets"])

    stale = []
    for websocket in sockets:
        try:
            await websocket.send_json(event)
        except Exception:
            stale.append(websocket)

    if stale:
        async with PIPELINE_LOCK:
            job = PIPELINE_JOBS.get(job_id)
            if job:
                job["sockets"] = [socket for socket in job["sockets"] if socket not in stale]


async def _send_progress(
    job_id: str,
    stage: str,
    progress: int,
    message: str,
    status: str = "progress",
    extra: Optional[dict] = None,
):
    event = {
        "type": "pipeline_progress",
        "job_id": job_id,
        "status": status,
        "stage": stage,
        "progress": progress,
        "message": message,
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }
    if extra:
        event.update(extra)
    await _append_job_event(job_id, event)


@app.websocket("/ws/pipeline/{job_id}")
async def pipeline_progress_socket(websocket: WebSocket, job_id: str):
    await websocket.accept()
    async with PIPELINE_LOCK:
        job = PIPELINE_JOBS.setdefault(job_id, {
            "events": [],
            "sockets": [],
            "result": None,
            "error": None,
        })
        job["sockets"].append(websocket)
        replay_events = list(job["events"])

    try:
        for event in replay_events:
            await websocket.send_json(event)

        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        async with PIPELINE_LOCK:
            job = PIPELINE_JOBS.get(job_id)
            if job:
                job["sockets"] = [socket for socket in job["sockets"] if socket is not websocket]


# ── Health Check ──────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok", "pipeline": "ready"}


# ── Full Pipeline (primary endpoint) ─────────────────────────────────────────

@app.post("/api/pipeline")
async def run_pipeline(
    file: UploadFile = File(...),
    job_id: Optional[str] = Form(default=None),
):
    """
    Main endpoint. Upload a floor plan image.
    Returns: walls, rooms, 3D data, material recommendations, explanations.
    """
    try:
        job_id = job_id or str(uuid4())
        await _upsert_job(job_id)
        await _send_progress(job_id, "upload_received", 5, "Upload received. Validating image.")

        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            await _send_progress(job_id, "failed", 100, "Invalid image file.", status="error")
            raise HTTPException(status_code=400, detail="Invalid image file")

        logger.info(f"Pipeline started: {file.filename}, size={img.shape}")

        # Stage 1+2: Parse + Geometry
        await _send_progress(job_id, "parsing", 20, "Parsing floor plan and detecting walls.")
        parse_result = parse_floor_plan(img)

        await _send_progress(job_id, "geometry", 45, "Reconstructing geometry and room layout.")
        geometry_result = reconstruct_geometry(parse_result)

        # Stage 4: Material analysis
        await _send_progress(job_id, "materials", 65, "Analysing structural materials.")
        material_result = analyse_materials(geometry_result)

        # Stage 5: Explainability
        await _send_progress(job_id, "report", 82, "Generating explainability report.")
        report = generate_report(material_result, geometry_result)

        # Build 3D-ready payload for Three.js
        await _send_progress(job_id, "three_js", 92, "Building 3D payload and verification data.")
        three_payload = _build_three_payload(
            geometry_result,
            parse_result.get("openings", []),
            parse_result.get("labels", []),
        )
        verification = verify_generated_model(img, parse_result, three_payload)

        payload = {
            "success": True,
            "job_id": job_id,
            "fallback_used": geometry_result.get("fallback_used", False),
            "parse": {
                "stats": parse_result.get("stats", {}),
                "image_size": parse_result.get("image_size", {}),
                "scale_px_to_m": parse_result.get("scale_px_to_m", 0.05),
                "openings": parse_result.get("openings", []),
            },
            "geometry": {
                "stats": geometry_result.get("stats", {}),
                "walls": geometry_result.get("walls", []),
                "rooms": geometry_result.get("rooms", []),
                "boundary": geometry_result.get("boundary", {}),
                "structural_concerns": geometry_result.get("structural_concerns", []),
            },
            "three_js": three_payload,
            "verification": verification,
            "materials": material_result,
            "report": report,
        }
        payload["storage"] = _persist_analysis(file.filename, contents, payload)
        await _append_conversion_history({
            "id": f"upload_{payload['storage']['analysis_id']}",
            "type": "upload",
            "created_at": datetime.utcnow().isoformat() + "Z",
            "title": f"Upload · {file.filename or 'floor-plan'}",
            "stats": _draw_stats_from_three_payload(three_payload),
            "analysis_id": payload["storage"]["analysis_id"],
            "analysis_path": payload["storage"]["analysis_path"],
        })
        await _upsert_job(job_id, result=payload, error=None)
        await _send_progress(
            job_id,
            "complete",
            100,
            "Pipeline complete.",
            status="complete",
            extra={
                "fallback_used": payload["fallback_used"],
                "analysis_id": payload["storage"]["analysis_id"],
            },
        )

        return JSONResponse(to_json_safe(payload))

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Pipeline error: {traceback.format_exc()}")
        if job_id:
            await _upsert_job(job_id, error=str(e))
            await _send_progress(job_id, "failed", 100, f"Pipeline failed: {str(e)}", status="error")
        raise HTTPException(status_code=500, detail=f"Pipeline failed: {str(e)}")


# ── Stage 1+2 Only ────────────────────────────────────────────────────────────

@app.post("/api/parse")
async def parse_only(file: UploadFile = File(...)):
    """Parse floor plan image — returns walls, rooms, junctions."""
    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            raise HTTPException(status_code=400, detail="Invalid image")

        parse_result = parse_floor_plan(img)
        geometry_result = reconstruct_geometry(parse_result)

        payload = {
            "success": True,
            "parse": parse_result,
            "geometry": geometry_result,
            "three_js": _build_three_payload(
                geometry_result,
                parse_result.get("openings", []),
                parse_result.get("labels", []),
            ),
        }

        return JSONResponse(to_json_safe(payload))

    except Exception as e:
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


# ── Fallback: Manual Coordinates ──────────────────────────────────────────────

@app.post("/api/fallback")
async def manual_input(data: dict = Body(...)):
    """
    Fallback clause: team manually defines wall coordinates.
    Disclosed during demo as per hackathon rules.

    Body format:
    {
      "walls": [{"x1":0,"y1":0,"x2":500,"y2":0,"orientation":"horizontal"}, ...],
      "image_size": {"width": 800, "height": 600},
      "disclose_fallback": true
    }
    """
    try:
        walls = data.get("walls", [])
        image_size = data.get("image_size", {"width": 800, "height": 600})

        if not walls:
            raise HTTPException(
                status_code=400,
                detail="Provide at least one wall in 'walls' array"
            )

        parse_result = build_manual_result(walls, image_size)
        geometry_result = reconstruct_geometry(parse_result)
        material_result = analyse_materials(geometry_result)
        report = generate_report(material_result, geometry_result)
        three_payload = _build_three_payload(geometry_result)
        verification = {
            "summary": "Verification skipped for manual fallback input.",
            "confidence": "medium",
            "issues": [],
            "counts": {"parsed_windows": 0, "verified_window_candidates": 0, "unmatched_window_candidates": 0, "doors": 0, "labels": 0},
            "missing_window_candidates": [],
        }

        payload = {
            "success": True,
            "fallback_used": True,
            "fallback_disclosed": data.get("disclose_fallback", True),
            "geometry": {
                "stats": geometry_result.get("stats", {}),
                "walls": geometry_result.get("walls", []),
                "rooms": geometry_result.get("rooms", []),
                "boundary": geometry_result.get("boundary", {}),
            },
            "three_js": three_payload,
            "verification": verification,
            "materials": material_result,
            "report": report,
        }

        return JSONResponse(to_json_safe(payload))

    except HTTPException:
        raise
    except Exception as e:
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


# ── Draw 2D→3D History ───────────────────────────────────────────────────────

@app.get("/api/conversion-history")
async def list_conversion_history(limit: int = Query(default=30, ge=1, le=200)):
    async with CONVERSION_HISTORY_LOCK:
        items = _load_conversion_history_index()
    return {"success": True, "items": items[:limit]}


@app.get("/api/conversion-history/{entry_id}")
async def get_conversion_history_entry(entry_id: str):
    async with CONVERSION_HISTORY_LOCK:
        items = _load_conversion_history_index()
        found = next((item for item in items if item.get("id") == entry_id), None)
    if not found:
        raise HTTPException(status_code=404, detail="History entry not found")

    entry_type = found.get("type")
    if entry_type == "upload":
        analysis_path = found.get("analysis_path")
        if not analysis_path:
            raise HTTPException(status_code=404, detail="Upload analysis path missing")
        path = Path(analysis_path)
        if not path.exists():
            raise HTTPException(status_code=404, detail="Upload analysis file not found")
        payload = json.loads(path.read_text(encoding="utf-8"))
        return JSONResponse(to_json_safe({
            "success": True,
            "type": "upload",
            "history": found,
            "analysis": payload,
        }))

    if entry_type == "draw":
        draw_id = found.get("draw_entry_id")
        if not draw_id:
            raise HTTPException(status_code=404, detail="Draw history id missing")
        draw_path = DRAW_HISTORY_DIR / f"{draw_id}.json"
        if not draw_path.exists():
            raise HTTPException(status_code=404, detail="Draw history file not found")
        payload = json.loads(draw_path.read_text(encoding="utf-8"))
        return JSONResponse(to_json_safe({
            "success": True,
            "type": "draw",
            "history": found,
            "analysis": payload,
        }))

    raise HTTPException(status_code=404, detail="Unsupported history entry type")


@app.get("/api/draw-history")
async def list_draw_history(limit: int = Query(default=20, ge=1, le=100)):
    async with DRAW_HISTORY_LOCK:
        entries = _load_draw_history_index()
    return {"success": True, "items": entries[:limit]}


@app.get("/api/draw-history/{entry_id}")
async def get_draw_history_entry(entry_id: str):
    entry_path = DRAW_HISTORY_DIR / f"{entry_id}.json"
    if not entry_path.exists():
        raise HTTPException(status_code=404, detail="History entry not found")
    try:
        payload = json.loads(entry_path.read_text(encoding="utf-8"))
        return JSONResponse(to_json_safe(payload))
    except Exception as exc:
        logger.error(f"Failed to read history entry {entry_id}: {exc}")
        raise HTTPException(status_code=500, detail="Failed to read history entry")


@app.patch("/api/draw-history/{entry_id}")
async def update_draw_history_entry(entry_id: str, data: dict = Body(...)):
    new_title = str(data.get("title") or "").strip()
    if not new_title:
        raise HTTPException(status_code=400, detail="Field 'title' is required")

    entry_path = DRAW_HISTORY_DIR / f"{entry_id}.json"
    if not entry_path.exists():
        raise HTTPException(status_code=404, detail="History entry not found")

    async with DRAW_HISTORY_LOCK:
        try:
            payload = json.loads(entry_path.read_text(encoding="utf-8"))
            payload["title"] = new_title[:120]
            entry_path.write_text(json.dumps(to_json_safe(payload), indent=2), encoding="utf-8")

            index = _load_draw_history_index()
            for item in index:
                if item.get("id") == entry_id:
                    item["title"] = payload["title"]
                    break
            _write_draw_history_index(index)

            conversion_index = _load_conversion_history_index()
            for item in conversion_index:
                if item.get("id") == f"draw_{entry_id}":
                    item["title"] = payload["title"]
                    break
            _write_conversion_history_index(conversion_index)
            return {"success": True, "item": payload}
        except HTTPException:
            raise
        except Exception as exc:
            logger.error(f"Failed to update history entry {entry_id}: {exc}")
            raise HTTPException(status_code=500, detail="Failed to update history entry")


@app.delete("/api/draw-history/{entry_id}")
async def delete_draw_history_entry(entry_id: str):
    entry_path = DRAW_HISTORY_DIR / f"{entry_id}.json"

    async with DRAW_HISTORY_LOCK:
        if not entry_path.exists():
            raise HTTPException(status_code=404, detail="History entry not found")
        try:
            entry_path.unlink(missing_ok=True)
            index = _load_draw_history_index()
            index = [item for item in index if item.get("id") != entry_id]
            _write_draw_history_index(index)

            conversion_index = _load_conversion_history_index()
            conversion_index = [item for item in conversion_index if item.get("id") != f"draw_{entry_id}"]
            _write_conversion_history_index(conversion_index)
            return {"success": True, "deleted_id": entry_id}
        except Exception as exc:
            logger.error(f"Failed to delete history entry {entry_id}: {exc}")
            raise HTTPException(status_code=500, detail="Failed to delete history entry")


@app.post("/api/draw-history")
async def create_draw_history_entry(data: dict = Body(...)):
    three_js = data.get("three_js")
    editor = data.get("editor")
    if not isinstance(three_js, dict):
        raise HTTPException(status_code=400, detail="Field 'three_js' must be an object")
    if not isinstance(editor, dict):
        raise HTTPException(status_code=400, detail="Field 'editor' must be an object")

    timestamp = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    entry_id = f"{timestamp}_{uuid4().hex[:10]}"
    created_at = datetime.utcnow().isoformat() + "Z"
    title = str(data.get("title") or f"Draw Conversion {created_at[:19]}")

    stats = _draw_stats_from_three_payload(three_js)
    record = {
        "id": entry_id,
        "title": title[:120],
        "created_at": created_at,
        "stats": stats,
        "three_js": three_js,
        "editor": editor,
    }

    async with DRAW_HISTORY_LOCK:
        DRAW_HISTORY_DIR.mkdir(parents=True, exist_ok=True)
        entry_path = DRAW_HISTORY_DIR / f"{entry_id}.json"
        entry_path.write_text(json.dumps(to_json_safe(record), indent=2), encoding="utf-8")

        index = _load_draw_history_index()
        index.insert(0, {
            "id": entry_id,
            "title": record["title"],
            "created_at": created_at,
            "stats": stats,
        })
        index = index[:300]
        _write_draw_history_index(index)

    await _append_conversion_history({
        "id": f"draw_{entry_id}",
        "type": "draw",
        "draw_entry_id": entry_id,
        "created_at": created_at,
        "title": record["title"],
        "stats": stats,
    })

    return {"success": True, "item": record}


# ── Three.js Payload Builder ──────────────────────────────────────────────────

def _build_three_payload(
    geometry_result: dict,
    openings: Optional[list] = None,
    labels: Optional[list] = None,
) -> dict:
    """
    Convert geometry to Three.js-ready format.
    Coordinates scaled to meters and centered at origin.
    """
    walls = geometry_result.get("walls", [])
    rooms = geometry_result.get("rooms", [])
    boundary = geometry_result.get("boundary", {})
    scale = geometry_result.get("scale_px_to_m", 0.05)

    openings = openings or []
    labels = labels or []

    if not walls:
        return {"walls": [], "rooms": [], "labels": [], "doors": [], "windows": [], "floor_dimensions": {}}

    # Center offset — move building to origin
    center_x = (boundary.get("min_x", 0) + boundary.get("max_x", 0)) / 2
    center_y = (boundary.get("min_y", 0) + boundary.get("max_y", 0)) / 2

    three_walls = []
    for wall in walls:
        x1_m = (wall["x1"] - center_x) * scale
        y1_m = (wall["y1"] - center_y) * scale
        x2_m = (wall["x2"] - center_x) * scale
        y2_m = (wall["y2"] - center_y) * scale

        length_m = wall.get("length_m", wall["length_px"] * scale)

        pos_x = (x1_m + x2_m) / 2
        pos_z = (y1_m + y2_m) / 2

        rotation_y = 0.0 if wall["orientation"] == "horizontal" else math.pi / 2

        three_walls.append({
            "id": wall.get("id", "wall"),
            "position": {
                "x": round(float(pos_x), 3),
                "y": 1.5,
                "z": round(float(pos_z), 3),
            },
            "rotation_y": rotation_y,
            "dimensions": {
                "width": round(float(length_m), 3),
                "height": 3.0,
                "depth": 0.3,
            },
            "load_bearing": bool(wall.get("load_bearing", False)),
            "color": "#8B4513" if wall.get("load_bearing") else "#D2B48C",
            "orientation": wall.get("orientation"),
            "span_class": wall.get("span_class", "short"),
        })

    floor_w_m = round(float(boundary.get("width_px", 0)) * scale, 2)
    floor_d_m = round(float(boundary.get("height_px", 0)) * scale, 2)

    three_rooms = []
    for room in rooms:
        cx_m = round((float(room["centroid"]["x"]) - center_x) * scale, 3)
        cz_m = round((float(room["centroid"]["y"]) - center_y) * scale, 3)
        three_rooms.append({
            "id": room.get("id"),
            "label": room.get("label", "Room"),
            "centroid_3d": {"x": cx_m, "y": 0.1, "z": cz_m},
            "area_m2": float(room.get("area_m2", 0)),
        })

    three_doors = []
    three_windows = []
    for opening in openings:
        arc = opening.get("door_arc")
        if opening.get("type") == "door" and arc:
            hinge_x = round((float(arc["hinge"]["x"]) - center_x) * scale, 3)
            hinge_z = round((float(arc["hinge"]["y"]) - center_y) * scale, 3)
            leaf_x = round((float(arc["leaf_end"]["x"]) - center_x) * scale, 3)
            leaf_z = round((float(arc["leaf_end"]["y"]) - center_y) * scale, 3)
            three_doors.append({
                "id": opening.get("id", f"door_{len(three_doors)}"),
                "hinge": {"x": hinge_x, "y": 0.03, "z": hinge_z},
                "leaf_end": {"x": leaf_x, "y": 0.03, "z": leaf_z},
                "radius_m": round(float(arc["radius_px"]) * scale, 3),
                "start_angle_rad": round(math.radians(float(arc["start_angle_deg"])), 6),
                "end_angle_rad": round(math.radians(float(arc["end_angle_deg"])), 6),
            })
        elif opening.get("type") == "window":
            cx = opening.get("center", {}).get("x", (opening["x1"] + opening["x2"]) / 2)
            cy = opening.get("center", {}).get("y", (opening["y1"] + opening["y2"]) / 2)
            width_m = max(abs(opening["x2"] - opening["x1"]), abs(opening["y2"] - opening["y1"])) * scale
            thickness_m = max(min(abs(opening["x2"] - opening["x1"]), abs(opening["y2"] - opening["y1"])) * scale, 0.08)
            three_windows.append({
                "id": opening.get("id", f"window_{len(three_windows)}"),
                "position": {
                    "x": round((float(cx) - center_x) * scale, 3),
                    "y": 1.45,
                    "z": round((float(cy) - center_y) * scale, 3),
                },
                "orientation": opening.get("orientation"),
                "dimensions": {
                    "width": round(float(width_m), 3),
                    "height": 1.2,
                    "depth": round(float(thickness_m), 3),
                },
                "edge": opening.get("edge"),
            })

    three_labels = []
    for region in labels:
        cx_m = round((float(region["center"]["x"]) - center_x) * scale, 3)
        cz_m = round((float(region["center"]["y"]) - center_y) * scale, 3)
        three_labels.append({
            "id": f"label_{len(three_labels)}",
            "text": region.get("text", ""),
            "position": {"x": cx_m, "y": 0.03, "z": cz_m},
        })

    return {
        "walls": three_walls,
        "rooms": three_rooms,
        "labels": three_labels,
        "doors": three_doors,
        "windows": three_windows,
        "floor_dimensions": {
            "width_m": floor_w_m,
            "depth_m": floor_d_m,
            "height_m": 3.0,
        },
        "scale_used": float(scale),
    }


def _persist_analysis(filename: str, contents: bytes, payload: dict) -> dict:
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    analysis_id = _build_analysis_id(filename, contents)
    run_dir = UPLOADS_DIR / analysis_id
    run_dir.mkdir(parents=True, exist_ok=True)

    safe_name = _safe_filename(filename or "upload.png")
    image_path = run_dir / safe_name
    json_path = run_dir / "analysis.json"
    meta_path = run_dir / "meta.json"

    image_path.write_bytes(contents)
    json_path.write_text(json.dumps(to_json_safe(payload), indent=2), encoding="utf-8")
    meta_path.write_text(json.dumps({
        "analysis_id": analysis_id,
        "original_filename": filename,
        "saved_at": datetime.utcnow().isoformat() + "Z",
        "sha256": hashlib.sha256(contents).hexdigest(),
    }, indent=2), encoding="utf-8")

    return {
        "analysis_id": analysis_id,
        "saved": True,
        "image_path": str(image_path),
        "analysis_path": str(json_path),
    }


def _build_analysis_id(filename: str, contents: bytes) -> str:
    timestamp = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    digest = hashlib.sha256(contents).hexdigest()[:10]
    stem = Path(filename or "upload").stem
    return f"{timestamp}_{_safe_slug(stem)}_{digest}"


def _safe_filename(filename: str) -> str:
    path = Path(filename or "upload.png")
    return f"{_safe_slug(path.stem)}{path.suffix or '.png'}"


def _safe_slug(value: str) -> str:
    slug = "".join(ch.lower() if ch.isalnum() else "-" for ch in value).strip("-")
    return "-".join(part for part in slug.split("-") if part) or "upload"


def _load_draw_history_index() -> list:
    if not DRAW_HISTORY_INDEX.exists():
        return []
    try:
        data = json.loads(DRAW_HISTORY_INDEX.read_text(encoding="utf-8"))
        if isinstance(data, list):
            return data
    except Exception as exc:
        logger.error(f"Failed to load draw history index: {exc}")
    return []


def _write_draw_history_index(index: list) -> None:
    DRAW_HISTORY_DIR.mkdir(parents=True, exist_ok=True)
    DRAW_HISTORY_INDEX.write_text(json.dumps(to_json_safe(index), indent=2), encoding="utf-8")


def _load_conversion_history_index() -> list:
    if not CONVERSION_HISTORY_INDEX.exists():
        return []
    try:
        data = json.loads(CONVERSION_HISTORY_INDEX.read_text(encoding="utf-8"))
        if isinstance(data, list):
            return data
    except Exception as exc:
        logger.error(f"Failed to load conversion history index: {exc}")
    return []


def _write_conversion_history_index(index: list) -> None:
    CONVERSION_HISTORY_DIR.mkdir(parents=True, exist_ok=True)
    CONVERSION_HISTORY_INDEX.write_text(json.dumps(to_json_safe(index), indent=2), encoding="utf-8")


async def _append_conversion_history(entry: dict) -> None:
    async with CONVERSION_HISTORY_LOCK:
        index = _load_conversion_history_index()
        index = [item for item in index if item.get("id") != entry.get("id")]
        index.insert(0, entry)
        index = index[:500]
        _write_conversion_history_index(index)


def _draw_stats_from_three_payload(three_js: dict) -> dict:
    walls = len(three_js.get("walls", []) or [])
    doors = len(three_js.get("doors", []) or [])
    windows = len(three_js.get("windows", []) or [])
    rooms = len(three_js.get("rooms", []) or [])
    return {
        "walls": walls,
        "doors": doors,
        "windows": windows,
        "rooms": rooms,
    }


# ── Run ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
