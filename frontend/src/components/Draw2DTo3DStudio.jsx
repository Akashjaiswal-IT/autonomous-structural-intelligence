import React, { useEffect, useMemo, useState } from 'react';

import ThreeViewer from './ThreeViewer.jsx';

const DRAW_WIDTH_M = 12;
const DRAW_DEPTH_M = 8;
const SNAP_TOLERANCE_M = 0.2;
const HIT_TOLERANCE_M = 0.24;
const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

function roundToCm(value) {
  return Math.round(value * 100) / 100;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function withAxisSnap(previousPoint, x, z) {
  if (!previousPoint) return { x, z };
  return {
    x: Math.abs(x - previousPoint.x) <= SNAP_TOLERANCE_M ? previousPoint.x : x,
    z: Math.abs(z - previousPoint.z) <= SNAP_TOLERANCE_M ? previousPoint.z : z,
  };
}

function detectLoadBearing(pointA, pointB, bounds) {
  const tolerance = 0.15;
  const onOuterX =
    (Math.abs(pointA.x - bounds.minX) < tolerance && Math.abs(pointB.x - bounds.minX) < tolerance)
    || (Math.abs(pointA.x - bounds.maxX) < tolerance && Math.abs(pointB.x - bounds.maxX) < tolerance);
  const onOuterZ =
    (Math.abs(pointA.z - bounds.minZ) < tolerance && Math.abs(pointB.z - bounds.minZ) < tolerance)
    || (Math.abs(pointA.z - bounds.maxZ) < tolerance && Math.abs(pointB.z - bounds.maxZ) < tolerance);
  return onOuterX || onOuterZ;
}

function deriveSegments(points, isClosed, deletedSegmentSet = new Set()) {
  const segments = [];
  for (let i = 1; i < points.length; i += 1) {
    const key = `${i - 1}-${i}`;
    if (!deletedSegmentSet.has(key)) {
      segments.push({ key, start: points[i - 1], end: points[i] });
    }
  }
  if (isClosed && points.length >= 3) {
    const key = `${points.length - 1}-0`;
    if (!deletedSegmentSet.has(key)) {
      segments.push({ key, start: points[points.length - 1], end: points[0] });
    }
  }
  return segments;
}

function projectPointOnSegment(point, start, end) {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const lengthSq = dx * dx + dz * dz;
  if (lengthSq <= 1e-6) {
    return { t: 0, x: start.x, z: start.z, distance: Math.hypot(point.x - start.x, point.z - start.z) };
  }
  const t = clamp(((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSq, 0, 1);
  const x = start.x + t * dx;
  const z = start.z + t * dz;
  return { t, x, z, distance: Math.hypot(point.x - x, point.z - z) };
}

function findNearestSegment(point, segments) {
  if (!point || !segments.length) return null;
  let best = null;
  for (const segment of segments) {
    const projected = projectPointOnSegment(point, segment.start, segment.end);
    if (!best || projected.distance < best.distance) {
      best = { ...segment, ...projected };
    }
  }
  return best;
}

function buildThreeJsData(points, isClosed, deletedSegmentSet, openings) {
  if (points.length < 2) return null;

  const segments = deriveSegments(points, isClosed, deletedSegmentSet);
  if (!segments.length) return null;

  const xs = points.map((point) => point.x);
  const zs = points.map((point) => point.z);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const bounds = { minX, maxX, minZ, maxZ };
  const segmentLookup = new Map(segments.map((segment) => [segment.key, segment]));

  const walls = segments.map((segment, index) => {
    const dx = segment.end.x - segment.start.x;
    const dz = segment.end.z - segment.start.z;
    const length = Math.max(0.25, Math.hypot(dx, dz));
    const rotationY = Math.atan2(dz, dx);
    const loadBearing = detectLoadBearing(segment.start, segment.end, bounds);

    return {
      id: `draw-wall-${index + 1}`,
      load_bearing: loadBearing,
      orientation: Math.abs(dx) >= Math.abs(dz) ? 'horizontal' : 'vertical',
      position: {
        x: roundToCm((segment.start.x + segment.end.x) / 2 - centerX),
        y: 1.5,
        z: roundToCm((segment.start.z + segment.end.z) / 2 - centerZ),
      },
      dimensions: {
        width: roundToCm(length),
        height: 3,
        depth: 0.14,
      },
      rotation_y: rotationY,
    };
  });

  const windows = [];
  const doors = [];
  openings.forEach((opening, index) => {
    const segment = segmentLookup.get(opening.segmentKey);
    if (!segment) return;
    const dx = segment.end.x - segment.start.x;
    const dz = segment.end.z - segment.start.z;
    const t = clamp(opening.t, 0.1, 0.9);
    const rotationY = Math.atan2(dz, dx);
    const center = {
      x: segment.start.x + dx * t - centerX,
      z: segment.start.z + dz * t - centerZ,
    };

    if (opening.type === 'window') {
      windows.push({
        id: `draw-window-${index + 1}`,
        orientation: 'horizontal',
        position: { x: roundToCm(center.x), y: 1.2, z: roundToCm(center.z) },
        dimensions: {
          width: 1.2,
          height: 1.2,
          depth: 0.16,
        },
        rotation_y: rotationY,
      });
      return;
    }

    doors.push({
      id: `draw-door-${index + 1}`,
      orientation: 'horizontal',
      position: { x: roundToCm(center.x), y: 1.05, z: roundToCm(center.z) },
      dimensions: {
        width: 1,
        height: 2.1,
        depth: 0.18,
      },
      rotation_y: rotationY,
    });
  });

  const closedLoop = isClosed && deletedSegmentSet.size === 0;
  const floorWidth = Math.max(6, roundToCm(maxX - minX + 2));
  const floorDepth = Math.max(6, roundToCm(maxZ - minZ + 2));

  return {
    walls,
    rooms: closedLoop
      ? [
          {
            id: 'draw-room-1',
            label: 'DESIGNED SPACE',
            centroid_3d: { x: 0, y: 0, z: 0 },
          },
        ]
      : [],
    labels: closedLoop
      ? [
          {
            id: 'draw-label-1',
            text: 'DESIGNED SPACE',
            position: { x: 0, y: 0, z: 0 },
          },
        ]
      : [],
    doors,
    windows,
    floor_dimensions: {
      width_m: floorWidth,
      depth_m: floorDepth,
    },
  };
}

export default function Draw2DTo3DStudio() {
  const [points, setPoints] = useState([]);
  const [isClosed, setIsClosed] = useState(false);
  const [threeData, setThreeData] = useState(null);
  const [showThreePanel, setShowThreePanel] = useState(false);
  const [mode, setMode] = useState('add-line');
  const [hoverPoint, setHoverPoint] = useState(null);
  const [deletedSegments, setDeletedSegments] = useState([]);
  const [openings, setOpenings] = useState([]);
  const [historyItems, setHistoryItems] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [historySaving, setHistorySaving] = useState(false);
  const [activeHistoryId, setActiveHistoryId] = useState(null);

  const deletedSegmentSet = useMemo(() => new Set(deletedSegments), [deletedSegments]);
  const segments = useMemo(
    () => deriveSegments(points, isClosed, deletedSegmentSet),
    [points, isClosed, deletedSegmentSet],
  );
  const openingCount = openings.length;
  const windowCount = openings.filter((opening) => opening.type === 'window').length;
  const doorCount = openingCount - windowCount;

  const toSvgCoords = (point) => ({
    x: (point.x / DRAW_WIDTH_M) * 1000,
    y: (point.z / DRAW_DEPTH_M) * 680,
  });

  const toModelCoords = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: ((event.clientX - rect.left) / rect.width) * DRAW_WIDTH_M,
      z: ((event.clientY - rect.top) / rect.height) * DRAW_DEPTH_M,
    };
  };

  const previewPoint = useMemo(() => {
    if (!hoverPoint || !points.length || isClosed || mode !== 'add-line') return null;
    return withAxisSnap(points[points.length - 1], hoverPoint.x, hoverPoint.z);
  }, [hoverPoint, points, isClosed, mode]);

  const hoverSegment = useMemo(() => {
    if (!hoverPoint || mode === 'add-line') return null;
    const nearest = findNearestSegment(hoverPoint, segments);
    if (!nearest || nearest.distance > HIT_TOLERANCE_M) return null;
    return nearest;
  }, [hoverPoint, mode, segments]);

  const handleMouseMove = (event) => {
    const modelPoint = toModelCoords(event);
    if (modelPoint) setHoverPoint(modelPoint);
  };

  const handleMouseLeave = () => {
    setHoverPoint(null);
  };

  const handleCanvasClick = (event) => {
    const modelPoint = toModelCoords(event);
    if (!modelPoint) return;

    if (mode === 'add-line') {
      if (isClosed) return;
      const previous = points[points.length - 1];
      const snapped = withAxisSnap(previous, modelPoint.x, modelPoint.z);

      if (points.length >= 2) {
        const first = points[0];
        const closeToFirst =
          Math.abs(snapped.x - first.x) <= SNAP_TOLERANCE_M
          && Math.abs(snapped.z - first.z) <= SNAP_TOLERANCE_M;
        if (closeToFirst) {
          setIsClosed(true);
          return;
        }
      }

      setPoints((current) => [...current, { x: roundToCm(snapped.x), z: roundToCm(snapped.z) }]);
      setDeletedSegments([]);
      setOpenings([]);
      setShowThreePanel(false);
      return;
    }

    const nearest = findNearestSegment(modelPoint, segments);
    if (!nearest || nearest.distance > HIT_TOLERANCE_M) return;

    if (mode === 'delete-line') {
      setDeletedSegments((current) => (current.includes(nearest.key) ? current : [...current, nearest.key]));
      setOpenings((current) => current.filter((opening) => opening.segmentKey !== nearest.key));
      setShowThreePanel(false);
      return;
    }

    const openingType = mode === 'add-window' ? 'window' : 'door';
    setOpenings((current) => [
      ...current,
      {
        id: `${openingType}-${crypto.randomUUID()}`,
        type: openingType,
        segmentKey: nearest.key,
        t: clamp(nearest.t, 0.15, 0.85),
      },
    ]);
    setShowThreePanel(false);
  };

  const handleUndo = () => {
    setPoints((current) => current.slice(0, -1));
    setIsClosed(false);
    setDeletedSegments([]);
    setOpenings([]);
    setShowThreePanel(false);
  };

  const handleClear = () => {
    setPoints([]);
    setIsClosed(false);
    setDeletedSegments([]);
    setOpenings([]);
    setThreeData(null);
    setShowThreePanel(false);
  };

  const handleCloseRoom = () => {
    if (points.length >= 3) {
      setIsClosed(true);
      setShowThreePanel(false);
    }
  };

  const handleConvert = () => {
    const converted = buildThreeJsData(points, isClosed, deletedSegmentSet, openings);
    setThreeData(converted);
    setShowThreePanel(Boolean(converted));
    if (converted) {
      void saveHistoryEntry(converted);
    }
  };

  const saveHistoryEntry = async (converted) => {
    const walls = converted?.walls?.length || 0;
    const rooms = converted?.rooms?.length || 0;
    const title = `2D→3D · ${walls} walls · ${rooms} rooms`;
    setHistorySaving(true);
    try {
      const response = await fetch(`${BACKEND_BASE_URL}/api/draw-history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          three_js: converted,
          editor: {
            points,
            isClosed,
            deletedSegments,
            openings,
          },
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to save conversion history');
      }
      const payload = await response.json();
      const item = payload?.item;
      if (item?.id) {
        setHistoryItems((current) => [
          {
            id: item.id,
            title: item.title,
            created_at: item.created_at,
            stats: item.stats,
          },
          ...current.filter((entry) => entry.id !== item.id),
        ].slice(0, 25));
        setActiveHistoryId(item.id);
      }
      setHistoryError('');
    } catch (error) {
      setHistoryError(error?.message || 'Could not save history');
    } finally {
      setHistorySaving(false);
    }
  };

  const loadHistoryList = async () => {
    setHistoryLoading(true);
    try {
      const response = await fetch(`${BACKEND_BASE_URL}/api/draw-history?limit=25`);
      if (!response.ok) {
        throw new Error('Failed to load history');
      }
      const payload = await response.json();
      setHistoryItems(payload?.items || []);
      setHistoryError('');
    } catch (error) {
      setHistoryError(error?.message || 'Could not load history');
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    void loadHistoryList();
  }, []);

  const handleLoadHistory = async (entryId) => {
    setActiveHistoryId(entryId);
    try {
      const response = await fetch(`${BACKEND_BASE_URL}/api/draw-history/${entryId}`);
      if (!response.ok) {
        throw new Error('Failed to load selected history');
      }
      const payload = await response.json();
      const editor = payload?.editor || {};
      const restoredPoints = Array.isArray(editor.points) ? editor.points : [];
      const restoredOpenings = Array.isArray(editor.openings) ? editor.openings : [];
      const restoredDeleted = Array.isArray(editor.deletedSegments) ? editor.deletedSegments : [];

      setPoints(restoredPoints);
      setIsClosed(Boolean(editor.isClosed));
      setDeletedSegments(restoredDeleted);
      setOpenings(restoredOpenings);
      setThreeData(payload?.three_js || null);
      setShowThreePanel(Boolean(payload?.three_js));
      setHistoryError('');
    } catch (error) {
      setHistoryError(error?.message || 'Could not load selected history');
    }
  };

  const handleRenameHistory = async (item) => {
    const nextTitle = window.prompt('Rename conversion', item.title || 'Saved Conversion');
    if (!nextTitle || !nextTitle.trim()) return;
    try {
      const response = await fetch(`${BACKEND_BASE_URL}/api/draw-history/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: nextTitle.trim() }),
      });
      if (!response.ok) {
        throw new Error('Failed to rename history item');
      }
      const payload = await response.json();
      const updated = payload?.item;
      if (!updated?.id) return;
      setHistoryItems((current) => current.map((entry) => (
        entry.id === updated.id ? { ...entry, title: updated.title } : entry
      )));
      setHistoryError('');
    } catch (error) {
      setHistoryError(error?.message || 'Could not rename history entry');
    }
  };

  const handleDeleteHistory = async (item) => {
    const confirmed = window.confirm(`Delete "${item.title || 'Saved Conversion'}"?`);
    if (!confirmed) return;
    try {
      const response = await fetch(`${BACKEND_BASE_URL}/api/draw-history/${item.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete history item');
      }
      setHistoryItems((current) => current.filter((entry) => entry.id !== item.id));
      if (activeHistoryId === item.id) {
        setActiveHistoryId(null);
      }
      setHistoryError('');
    } catch (error) {
      setHistoryError(error?.message || 'Could not delete history entry');
    }
  };

  const modeButtons = [
    { key: 'add-line', label: 'ADD LINE' },
    { key: 'delete-line', label: 'DELETE LINE' },
    { key: 'add-door', label: 'ADD DOOR' },
    { key: 'add-window', label: 'ADD WINDOW' },
  ];

  return (
    <div style={{ width: 'min(1260px, 94vw)', margin: '0 auto' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: '1rem',
          alignItems: 'stretch',
        }}
      >
        <section
          style={{
            border: '1px solid rgba(0,255,255,0.18)',
            background: 'rgba(3,10,20,0.62)',
            borderRadius: '6px',
            padding: '1rem',
            minHeight: '520px',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.8rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.8rem' }}>
            <div>
              <div style={{ color: '#00ffff', fontSize: '0.72rem', letterSpacing: '2.2px' }}>2D DRAWING SECTION</div>
              <div style={{ color: 'rgba(180,230,255,0.6)', fontSize: '0.62rem', marginTop: '0.3rem', letterSpacing: '1.3px' }}>
                Draw walls, place doors and windows, then convert.
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={handleUndo}
                disabled={!points.length}
                style={{
                  background: 'none',
                  border: '1px solid rgba(0,255,255,0.24)',
                  color: 'rgba(180,240,255,0.8)',
                  padding: '0.35rem 0.65rem',
                  fontSize: '0.6rem',
                  letterSpacing: '1.5px',
                  cursor: points.length ? 'pointer' : 'not-allowed',
                  opacity: points.length ? 1 : 0.4,
                  fontFamily: "'Courier New', monospace",
                }}
              >
                UNDO
              </button>
              <button
                type="button"
                onClick={handleClear}
                disabled={!points.length}
                style={{
                  background: 'none',
                  border: '1px solid rgba(255,120,120,0.35)',
                  color: 'rgba(255,170,170,0.85)',
                  padding: '0.35rem 0.65rem',
                  fontSize: '0.6rem',
                  letterSpacing: '1.5px',
                  cursor: points.length ? 'pointer' : 'not-allowed',
                  opacity: points.length ? 1 : 0.4,
                  fontFamily: "'Courier New', monospace",
                }}
              >
                CLEAR
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
            {modeButtons.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setMode(item.key)}
                style={{
                  background: mode === item.key ? 'rgba(0,255,255,0.16)' : 'none',
                  border: '1px solid rgba(0,255,255,0.24)',
                  color: mode === item.key ? '#00ffff' : 'rgba(160,230,255,0.75)',
                  padding: '0.35rem 0.7rem',
                  fontSize: '0.58rem',
                  letterSpacing: '1.5px',
                  cursor: 'pointer',
                  fontFamily: "'Courier New', monospace",
                }}
              >
                {item.label}
              </button>
            ))}
          </div>

          <svg
            viewBox="0 0 1000 680"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onClick={handleCanvasClick}
            style={{
              width: '100%',
              flex: 1,
              border: '1px solid rgba(0,255,255,0.2)',
              borderRadius: '4px',
              background: 'linear-gradient(180deg, rgba(0,45,70,0.25) 0%, rgba(0,24,42,0.5) 100%)',
              cursor: mode === 'add-line' ? (isClosed ? 'default' : 'crosshair') : 'pointer',
            }}
          >
            {Array.from({ length: 16 }, (_, index) => (
              <line
                key={`v-${index}`}
                x1={(index / 15) * 1000}
                y1="0"
                x2={(index / 15) * 1000}
                y2="680"
                stroke="rgba(0,255,255,0.1)"
                strokeWidth="1"
              />
            ))}
            {Array.from({ length: 12 }, (_, index) => (
              <line
                key={`h-${index}`}
                x1="0"
                y1={(index / 11) * 680}
                x2="1000"
                y2={(index / 11) * 680}
                stroke="rgba(0,255,255,0.1)"
                strokeWidth="1"
              />
            ))}

            {isClosed && points.length >= 3 && deletedSegments.length === 0 ? (
              <polygon
                points={points.map((point) => {
                  const svgPoint = toSvgCoords(point);
                  return `${svgPoint.x},${svgPoint.y}`;
                }).join(' ')}
                fill="rgba(0,255,255,0.1)"
                stroke="rgba(0,255,255,0.42)"
                strokeWidth="2"
              />
            ) : null}

            {segments.map((segment) => {
              const from = toSvgCoords(segment.start);
              const to = toSvgCoords(segment.end);
              const isHover = hoverSegment?.key === segment.key;
              const accentColor = mode === 'delete-line' ? '#ff9f9f' : '#00ffff';
              return (
                <line
                  key={segment.key}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={isHover ? accentColor : '#58efff'}
                  strokeWidth={isHover ? 5 : 3}
                  strokeLinecap="round"
                  opacity={0.96}
                />
              );
            })}

            {previewPoint && points.length ? (
              <line
                x1={toSvgCoords(points[points.length - 1]).x}
                y1={toSvgCoords(points[points.length - 1]).y}
                x2={toSvgCoords(previewPoint).x}
                y2={toSvgCoords(previewPoint).y}
                stroke="rgba(120,240,255,0.85)"
                strokeWidth="2.5"
                strokeDasharray="8 8"
                strokeLinecap="round"
              />
            ) : null}

            {openings.map((opening) => {
              const segment = segments.find((item) => item.key === opening.segmentKey);
              if (!segment) return null;
              const projected = projectPointOnSegment(
                {
                  x: segment.start.x + (segment.end.x - segment.start.x) * opening.t,
                  z: segment.start.z + (segment.end.z - segment.start.z) * opening.t,
                },
                segment.start,
                segment.end,
              );
              const point = toSvgCoords({ x: projected.x, z: projected.z });
              const color = opening.type === 'door' ? '#ffb86a' : '#b6ff4d';
              return (
                <g key={opening.id}>
                  <circle cx={point.x} cy={point.y} r="7" fill={color} opacity="0.92" />
                  <text
                    x={point.x}
                    y={point.y + 3}
                    fill="#031019"
                    fontSize="8"
                    textAnchor="middle"
                    style={{ fontFamily: "'Courier New', monospace", fontWeight: 'bold' }}
                  >
                    {opening.type === 'door' ? 'D' : 'W'}
                  </text>
                </g>
              );
            })}

            {points.map((point, index) => {
              const svgPoint = toSvgCoords(point);
              const isOrigin = index === 0;
              return (
                <circle
                  key={`point-${index}`}
                  cx={svgPoint.x}
                  cy={svgPoint.y}
                  r={isOrigin ? 7 : 5}
                  fill={isOrigin ? '#b6ff4d' : '#00ffff'}
                  opacity={0.95}
                />
              );
            })}
          </svg>

          <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleCloseRoom}
              disabled={points.length < 3 || isClosed}
              style={{
                background: 'none',
                border: '1px solid rgba(0,255,255,0.24)',
                color: 'rgba(180,240,255,0.8)',
                padding: '0.5rem 0.9rem',
                fontSize: '0.65rem',
                letterSpacing: '1.8px',
                cursor: points.length >= 3 && !isClosed ? 'pointer' : 'not-allowed',
                opacity: points.length >= 3 && !isClosed ? 1 : 0.45,
                fontFamily: "'Courier New', monospace",
              }}
            >
              CLOSE ROOM
            </button>
            <button
              type="button"
              onClick={handleConvert}
              disabled={segments.length < 1}
              style={{
                background: '#00ffff',
                border: 'none',
                color: '#031019',
                padding: '0.5rem 1rem',
                fontSize: '0.65rem',
                letterSpacing: '1.8px',
                fontWeight: 'bold',
                cursor: segments.length >= 1 ? 'pointer' : 'not-allowed',
                opacity: segments.length >= 1 ? 1 : 0.45,
                fontFamily: "'Courier New', monospace",
                borderRadius: '2px',
              }}
            >
              CONVERT TO 3D
            </button>
            <span style={{ color: 'rgba(120,220,255,0.6)', fontSize: '0.6rem', letterSpacing: '1.2px' }}>
              {points.length} points · {segments.length} walls · {doorCount} doors · {windowCount} windows
            </span>
          </div>
        </section>

        <section
          style={{
            border: '1px solid rgba(0,255,255,0.18)',
            background: 'rgba(3,10,20,0.62)',
            borderRadius: '6px',
            minHeight: '520px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div style={{ borderBottom: '1px solid rgba(0,255,255,0.14)', padding: '1rem 1rem 0.75rem' }}>
            <div style={{ color: '#00ffff', fontSize: '0.72rem', letterSpacing: '2.2px' }}>3D OUTPUT PANEL</div>
            <div style={{ color: 'rgba(180,230,255,0.6)', fontSize: '0.62rem', marginTop: '0.3rem', letterSpacing: '1.3px' }}>
              Generated from your 2D drawing.
            </div>
          </div>

          <div
            style={{
              flex: 1,
              transition: 'opacity 0.45s ease, transform 0.45s ease',
              opacity: showThreePanel && threeData ? 1 : 0.7,
              transform: showThreePanel && threeData ? 'translateY(0)' : 'translateY(12px)',
            }}
          >
            {showThreePanel && threeData ? (
              <ThreeViewer threeJsData={threeData} />
            ) : (
              <div
                style={{
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'rgba(0,255,255,0.35)',
                  fontSize: '0.72rem',
                  letterSpacing: '2px',
                  textAlign: 'center',
                  padding: '1rem',
                }}
              >
                DRAW A 2D PLAN AND CLICK CONVERT TO 3D
              </div>
            )}
          </div>

          <div style={{ borderTop: '1px solid rgba(0,255,255,0.14)', padding: '0.7rem 0.9rem', maxHeight: '220px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
              <div style={{ color: '#00ffff', fontSize: '0.62rem', letterSpacing: '1.8px' }}>CONVERSION HISTORY</div>
              <button
                type="button"
                onClick={() => { void loadHistoryList(); }}
                style={{
                  background: 'none',
                  border: '1px solid rgba(0,255,255,0.24)',
                  color: 'rgba(150,230,255,0.85)',
                  fontSize: '0.52rem',
                  letterSpacing: '1.3px',
                  padding: '0.22rem 0.45rem',
                  fontFamily: "'Courier New', monospace",
                  cursor: 'pointer',
                }}
              >
                REFRESH
              </button>
            </div>
            {historySaving ? (
              <div style={{ color: 'rgba(0,255,255,0.45)', fontSize: '0.55rem', letterSpacing: '1.2px', marginBottom: '0.4rem' }}>
                SAVING CURRENT CONVERSION...
              </div>
            ) : null}
            {historyLoading ? (
              <div style={{ color: 'rgba(0,255,255,0.45)', fontSize: '0.55rem', letterSpacing: '1.2px' }}>
                LOADING HISTORY...
              </div>
            ) : null}
            {historyError ? (
              <div style={{ color: 'rgba(255,160,160,0.85)', fontSize: '0.55rem', letterSpacing: '1.1px', marginBottom: '0.45rem' }}>
                {historyError}
              </div>
            ) : null}
            {!historyLoading && historyItems.length === 0 ? (
              <div style={{ color: 'rgba(0,255,255,0.35)', fontSize: '0.55rem', letterSpacing: '1.1px' }}>
                NO SAVED CONVERSIONS YET.
              </div>
            ) : null}
            {historyItems.map((item) => (
              <div
                key={item.id}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: activeHistoryId === item.id ? 'rgba(0,255,255,0.14)' : 'rgba(0,255,255,0.04)',
                  border: '1px solid rgba(0,255,255,0.18)',
                  color: 'rgba(180,240,255,0.9)',
                  padding: '0.42rem 0.5rem',
                  marginBottom: '0.35rem',
                  fontFamily: "'Courier New', monospace",
                }}
              >
                <button
                  type="button"
                  onClick={() => { void handleLoadHistory(item.id); }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: 'transparent',
                    border: 'none',
                    color: 'inherit',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  <div style={{ fontSize: '0.56rem', letterSpacing: '1px' }}>{item.title || 'Saved Conversion'}</div>
                  <div style={{ color: 'rgba(120,220,255,0.62)', fontSize: '0.5rem', letterSpacing: '1px', marginTop: '0.18rem' }}>
                    {(item.created_at || '').replace('T', ' ').replace('Z', '')} ·
                    {' '}W:{item?.stats?.walls ?? 0} · D:{item?.stats?.doors ?? 0} · Win:{item?.stats?.windows ?? 0}
                  </div>
                </button>
                <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.38rem' }}>
                  <button
                    type="button"
                    onClick={() => { void handleRenameHistory(item); }}
                    style={{
                      background: 'none',
                      border: '1px solid rgba(0,255,255,0.2)',
                      color: 'rgba(150,235,255,0.9)',
                      fontSize: '0.5rem',
                      padding: '0.2rem 0.35rem',
                      letterSpacing: '1px',
                      cursor: 'pointer',
                      fontFamily: "'Courier New', monospace",
                    }}
                  >
                    RENAME
                  </button>
                  <button
                    type="button"
                    onClick={() => { void handleDeleteHistory(item); }}
                    style={{
                      background: 'none',
                      border: '1px solid rgba(255,140,140,0.35)',
                      color: 'rgba(255,180,180,0.9)',
                      fontSize: '0.5rem',
                      padding: '0.2rem 0.35rem',
                      letterSpacing: '1px',
                      cursor: 'pointer',
                      fontFamily: "'Courier New', monospace",
                    }}
                  >
                    DELETE
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
