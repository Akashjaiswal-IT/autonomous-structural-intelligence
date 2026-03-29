"""
Model verification utilities.
- Re-check window candidates using a relaxed detector after 3D generation
- Flag likely-missing openings so the UI/backend can surface review warnings
"""

import logging

import cv2

from pipeline.parser import _detect_windows

logger = logging.getLogger(__name__)


def verify_generated_model(image, parse_result: dict, three_payload: dict) -> dict:
    if image is None:
        return _empty_verification()

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    relaxed_windows = _detect_windows(
        gray,
        parse_result.get("labels", []),
        image.shape,
        relaxed=True,
    )
    parsed_windows = [
        opening for opening in parse_result.get("openings", [])
        if opening.get("type") == "window"
    ]

    unmatched_relaxed = []
    for candidate in relaxed_windows:
        if not any(_openings_match(candidate, existing) for existing in parsed_windows):
            unmatched_relaxed.append(candidate)

    three_labels = three_payload.get("labels", []) if three_payload else []
    issues = []
    if unmatched_relaxed:
        issues.append(
            f"Verifier found {len(unmatched_relaxed)} additional window candidate(s) that are not in the current 3D model."
        )
    if parse_result.get("labels") and len(three_labels) < len(parse_result.get("labels", [])):
        issues.append("Some OCR room labels did not make it into the 3D payload.")

    confidence = "high"
    if unmatched_relaxed:
        confidence = "review"
    elif len(parsed_windows) == 0:
        confidence = "medium"

    summary = (
        "Model cross-check passed."
        if not issues
        else "Model cross-check found elements worth reviewing."
    )

    return {
        "summary": summary,
        "confidence": confidence,
        "issues": issues,
        "counts": {
            "parsed_windows": len(parsed_windows),
            "verified_window_candidates": len(relaxed_windows),
            "unmatched_window_candidates": len(unmatched_relaxed),
            "doors": len([opening for opening in parse_result.get("openings", []) if opening.get("type") == "door"]),
            "labels": len(parse_result.get("labels", [])),
        },
        "missing_window_candidates": [
            {
                "id": candidate.get("id"),
                "edge": candidate.get("edge"),
                "center": candidate.get("center"),
                "bbox": candidate.get("bbox"),
            }
            for candidate in unmatched_relaxed
        ],
    }


def _openings_match(a: dict, b: dict) -> bool:
    ac = a.get("center", {})
    bc = b.get("center", {})
    if not ac or not bc:
        return False
    return abs(ac["x"] - bc["x"]) <= 28 and abs(ac["y"] - bc["y"]) <= 28


def _empty_verification() -> dict:
    return {
        "summary": "Verification unavailable.",
        "confidence": "low",
        "issues": [],
        "counts": {
            "parsed_windows": 0,
            "verified_window_candidates": 0,
            "unmatched_window_candidates": 0,
            "doors": 0,
            "labels": 0,
        },
        "missing_window_candidates": [],
    }
