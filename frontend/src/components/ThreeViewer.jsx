import React, { useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Edges, Grid, Line, OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';

// Wall mesh palette: structural walls red/orange, partitions white
function Wall({ wall, strictness = 0 }) {
  const { position, dimensions, load_bearing, rotation_y } = wall;
  const color = load_bearing ? '#ff6b2c' : '#f8f8f6';
  const opacity = load_bearing ? 0.32 : 0.2;
  const edgeColor = load_bearing ? '#ff944d' : '#ffffff';
  const hideEdgesAtHighStrictness = strictness >= 0.82 && !load_bearing;

  return (
    <group position={[position.x, position.y, position.z]} rotation={[0, rotation_y || 0, 0]}>
      <mesh>
        <boxGeometry args={[dimensions.width, dimensions.height, dimensions.depth]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={opacity}
          depthWrite={true}
          side={THREE.DoubleSide}
        />
        {!hideEdgesAtHighStrictness && <Edges scale={1} threshold={15} color={edgeColor} />}
      </mesh>
    </group>
  );
}

// Floating room label
function RoomLabel({ label }) {
  return (
    <Text
      position={[label.position.x, 0.035, label.position.z]}
      rotation={[-Math.PI / 2, 0, 0]}
      fontSize={0.28}
      color="#0b1b26"
      anchorX="center"
      anchorY="middle"
      font={undefined}
      outlineWidth={0.01}
      outlineColor="#f7f1db"
      opacity={0.85}
    >
      {label.text}
    </Text>
  );
}

function DoorSwing({ door }) {
  const curve = new THREE.EllipseCurve(
    door.hinge.x,
    door.hinge.z,
    door.radius_m,
    door.radius_m,
    door.start_angle_rad,
    door.end_angle_rad,
    false,
    0
  );

  const arcPoints = curve
    .getPoints(24)
    .map((point) => [point.x, 0.04, point.y]);

  const leafPoints = [
    [door.hinge.x, 0.04, door.hinge.z],
    [door.leaf_end.x, 0.04, door.leaf_end.z],
  ];
  const sweepMid = [
    (door.hinge.x + door.leaf_end.x) / 2,
    0.04,
    (door.hinge.z + door.leaf_end.z) / 2,
  ];

  return (
    <>
      <Line points={arcPoints} color="#00ffff" lineWidth={1.4} transparent opacity={0.95} />
      <Line points={leafPoints} color="#00ffff" lineWidth={1.4} transparent opacity={0.75} />
      <mesh position={sweepMid}>
        <sphereGeometry args={[0.08, 12, 12]} />
        <meshStandardMaterial color="#00ffff" emissive="#00ffff" emissiveIntensity={0.45} />
      </mesh>
    </>
  );
}

function DoorMarker({ door }) {
  const { position, dimensions, rotation_y = 0 } = door;
  const width = Math.max(Number(dimensions?.width || 0), 0.12);
  const height = Math.max(Number(dimensions?.height || 0), 0.2);
  const depth = Math.max(Number(dimensions?.depth || 0), 0.12);

  return (
    <group position={[position.x, position.y, position.z]} rotation={[0, rotation_y, 0]}>
      <mesh>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color="#ffb86a" emissive="#ff8e3c" emissiveIntensity={0.3} transparent opacity={0.55} />
        <Edges scale={1} threshold={15} color="#ffd7a6" />
      </mesh>
    </group>
  );
}

function WindowMarker({ window }) {
  const { position, orientation, dimensions, rotation_y = 0 } = window;
  const computedWidth = Math.max(Number(dimensions?.width || 0), 0.12);
  const computedDepth = Math.max(Number(dimensions?.depth || 0), 0.12);
  const width = orientation === 'vertical' ? computedDepth : computedWidth;
  const depth = orientation === 'vertical' ? computedWidth : computedDepth;
  const height = Math.max(Number(dimensions?.height || 0), 0.2);

  return (
    <group position={[position.x, position.y, position.z]} rotation={[0, rotation_y, 0]}>
      <mesh>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color="#b6ff4d" emissive="#89ff00" emissiveIntensity={0.35} transparent opacity={0.5} />
        <Edges scale={1} threshold={15} color="#e7ffb0" />
      </mesh>
    </group>
  );
}

// Floor slab
function FloorSlab({ width, depth }) {
  return (
    <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[width, depth]} />
      <meshStandardMaterial color="#00ffff" transparent opacity={0.04} side={THREE.DoubleSide} />
    </mesh>
  );
}

// Scene content
function Scene({ threeJsData, strictness = 0 }) {
  const { walls = [], rooms = [], labels = [], doors = [], windows = [], floor_dimensions = {} } = threeJsData;
  const { width_m = 10, depth_m = 10 } = floor_dimensions;
  const visibleLabels = labels.length
    ? labels
    : rooms.map((room) => ({
        id: room.id,
        text: room.label,
        position: room.centroid_3d,
      }));

  return (
    <>
      <color attach="background" args={['#030a14']} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 15, 10]} intensity={1.5} color="#ccffff" />
      <pointLight position={[0, 8, 0]} intensity={0.4} color="#00ffff" />

      {walls.map((wall) => <Wall key={wall.id} wall={wall} strictness={strictness} />)}
      {windows.map((window) => <WindowMarker key={window.id} window={window} />)}
      {visibleLabels.map((label) => <RoomLabel key={label.id} label={label} />)}
      {doors.map((door) => (
        door?.position && door?.dimensions
          ? <DoorMarker key={door.id} door={door} />
          : <DoorSwing key={door.id} door={door} />
      ))}

      <FloorSlab width={width_m} depth={depth_m} />

      <Grid
        position={[0, -0.05, 0]}
        args={[40, 40]}
        sectionColor="#00ffff"
        cellColor="#004444"
        sectionThickness={1.2}
        cellThickness={0.4}
        fadeDistance={30}
      />

      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={3}
        maxDistance={200}
      />
    </>
  );
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function dedupeWallsByStrictness(walls, strictness) {
  if (!Array.isArray(walls) || walls.length < 2) {
    return { walls: walls || [], removed: 0, removedOverlap: 0, removedConfidence: 0 };
  }

  const level = clamp01(strictness);
  const axisDistanceToleranceM = 0.02 + level * 0.18;
  const minOverlapRatio = 0.92 - level * 0.24;
  const minLengthSimilarity = 0.86 - level * 0.28;
  const maxCenterGapM = 0.03 + level * 0.25;
  const droppedByConfidence = new Set();
  const droppedByOverlap = new Set();

  const projected = walls.map((wall, index) => {
    const isHorizontal =
      wall.orientation === 'horizontal'
      || (typeof wall.rotation_y === 'number' && Math.abs(wall.rotation_y) < 0.001);
    const axisCenter = isHorizontal ? wall.position.x : wall.position.z;
    const minorAxis = isHorizontal ? wall.position.z : wall.position.x;
    const length = Number(wall.dimensions?.width || 0);
    return {
      index,
      wall,
      isHorizontal,
      axisCenter,
      minorAxis,
      start: axisCenter - length / 2,
      end: axisCenter + length / 2,
      length,
      qualityScore: (wall.load_bearing ? 1000 : 0) + length * 2,
    };
  });

  const sortedLengths = projected.map((item) => item.length).sort((a, b) => a - b);
  const p90Length = sortedLengths[Math.max(0, Math.floor(sortedLengths.length * 0.9) - 1)] || 1;

  // Pass 1: strictness-based confidence filtering (removes short/noisy walls first).
  const confidenceThreshold = 0.12 + level * 0.58;
  for (const item of projected) {
    const lengthScore = clamp01(item.length / p90Length);
    const structuralBoost = item.wall.load_bearing ? 0.2 : 0;
    const confidence = clamp01(lengthScore * 0.8 + structuralBoost);
    const removable = !item.wall.load_bearing || level >= 0.9;
    if (removable && confidence < confidenceThreshold) {
      droppedByConfidence.add(item.index);
    }
  }

  const overlapRatio = (a, b) => {
    const overlap = Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
    const base = Math.min(a.length, b.length);
    if (base <= 0) return 0;
    return overlap / base;
  };

  for (let i = 0; i < projected.length; i += 1) {
    if (droppedByConfidence.has(i) || droppedByOverlap.has(i)) continue;
    for (let j = i + 1; j < projected.length; j += 1) {
      if (droppedByConfidence.has(j) || droppedByOverlap.has(j)) continue;

      const a = projected[i];
      const b = projected[j];
      if (a.isHorizontal !== b.isHorizontal) continue;

      const nearSameTrack = Math.abs(a.minorAxis - b.minorAxis) <= axisDistanceToleranceM;
      if (!nearSameTrack) continue;

      const ratio = overlapRatio(a, b);
      if (ratio < minOverlapRatio) continue;

      const lengthSimilarity = Math.min(a.length, b.length) / Math.max(a.length, b.length || 1);
      if (lengthSimilarity < minLengthSimilarity) continue;

      const centerGap = Math.abs(a.axisCenter - b.axisCenter);
      if (centerGap > maxCenterGapM) continue;

      const keepI = a.qualityScore >= b.qualityScore;
      droppedByOverlap.add(keepI ? j : i);
      if (!keepI) break;
    }
  }

  const filteredWalls = walls.filter(
    (_, index) => !droppedByConfidence.has(index) && !droppedByOverlap.has(index),
  );
  const removedOverlap = droppedByOverlap.size;
  const removedConfidence = droppedByConfidence.size;
  return {
    walls: filteredWalls,
    removed: walls.length - filteredWalls.length,
    removedOverlap,
    removedConfidence,
  };
}

export default function ThreeViewer({ threeJsData }) {
  const [strictnessPercent, setStrictnessPercent] = useState(70);
  const strictness = strictnessPercent / 100;

  const filteredData = useMemo(() => {
    const sourceWalls = threeJsData?.walls || [];
    const deduped = dedupeWallsByStrictness(sourceWalls, strictness);
    return {
      data: {
        ...(threeJsData || {}),
        walls: deduped.walls,
      },
      removed: deduped.removed,
      total: sourceWalls.length,
      removedOverlap: deduped.removedOverlap,
      removedConfidence: deduped.removedConfidence,
    };
  }, [threeJsData, strictness]);

  const loadBearingCount = filteredData.data?.walls?.filter((w) => w.load_bearing).length || 0;
  const partitionCount = filteredData.data?.walls?.filter((w) => !w.load_bearing).length || 0;
  const windowCount = filteredData.data?.windows?.length || 0;
  const doorCount = filteredData.data?.doors?.length || 0;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 300px',
        background: 'linear-gradient(180deg, rgba(0,255,255,0.02), rgba(0,0,0,0))',
      }}
    >
      <div
        style={{
          position: 'relative',
          minHeight: '420px',
          borderRight: '1px solid rgba(0,255,255,0.12)',
        }}
      >
        <Canvas
          camera={{ position: [20, 15, 20], fov: 60 }}
          style={{ width: '100%', height: '100%' }}
        >
          <Scene threeJsData={filteredData.data} strictness={strictness} />
        </Canvas>

        <div style={{
          position: 'absolute',
          left: '16px',
          bottom: '16px',
          color: 'rgba(170,235,255,0.72)',
          fontSize: '0.56rem',
          fontFamily: "'Courier New', monospace",
          letterSpacing: '1.15px',
          lineHeight: 1.65,
          padding: '0.52rem 0.7rem',
          background: 'rgba(3,10,20,0.72)',
          border: '1px solid rgba(0,255,255,0.14)',
          borderRadius: '8px',
          backdropFilter: 'blur(8px)',
        }}>
          DRAG TO ROTATE<br />
          SCROLL TO ZOOM<br />
          RIGHT-DRAG TO PAN
        </div>
      </div>

      <aside
        style={{
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.9rem',
          background: 'rgba(3,10,20,0.78)',
          fontFamily: "'Courier New', monospace",
        }}
      >
        <div style={{
          border: '1px solid rgba(0,255,255,0.18)',
          borderLeft: '3px solid #00ffff',
          borderRadius: '6px',
          padding: '0.8rem 0.9rem',
          background: 'rgba(0,255,255,0.03)',
        }}>
          <div style={{ color: '#00ffff', fontSize: '0.6rem', letterSpacing: '2.1px', marginBottom: '0.45rem' }}>
            WALL LEGEND
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.42rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div style={{ width: '24px', height: '10px', background: '#ff6b2c', borderRadius: '1px' }} />
              <span style={{ color: '#e0d0c0', fontSize: '0.62rem', letterSpacing: '1px' }}>
                LOAD-BEARING ({loadBearingCount})
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div style={{ width: '24px', height: '10px', background: '#ffffff', borderRadius: '1px', opacity: 0.85 }} />
              <span style={{ color: '#e5e5e5', fontSize: '0.62rem', letterSpacing: '1px' }}>
                PARTITION ({partitionCount})
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div style={{ width: '24px', height: '10px', background: '#00ffff', borderRadius: '1px', opacity: 0.8 }} />
              <span style={{ color: '#9ffcff', fontSize: '0.62rem', letterSpacing: '1px' }}>
                DOORS ({doorCount})
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div style={{ width: '24px', height: '10px', background: '#b6ff4d', borderRadius: '1px', opacity: 0.85 }} />
              <span style={{ color: '#dfffaa', fontSize: '0.62rem', letterSpacing: '1px' }}>
                WINDOWS ({windowCount})
              </span>
            </div>
          </div>
        </div>

        <div style={{
          border: '1px solid rgba(0,255,255,0.18)',
          borderLeft: '3px solid #00ffff',
          borderRadius: '6px',
          padding: '0.8rem 0.9rem',
          background: 'rgba(0,255,255,0.03)',
        }}>
          <div style={{ color: '#00ffff', fontSize: '0.62rem', letterSpacing: '2px', marginBottom: '0.5rem' }}>
            OVERLAP STRICTNESS
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.55rem' }}>
            <div style={{ color: '#d8ffff', fontSize: '0.76rem', letterSpacing: '0.8px' }}>
              Confidence Meter: {strictnessPercent}%
            </div>
            <div style={{ color: 'rgba(0,255,255,0.5)', fontSize: '0.6rem', letterSpacing: '1px' }}>
              REMOVED {filteredData.removed}/{filteredData.total}
            </div>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={strictnessPercent}
            onChange={(event) => setStrictnessPercent(Number(event.target.value))}
            style={{ width: '100%', accentColor: '#00ffff', cursor: 'pointer' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.45rem', color: 'rgba(0,255,255,0.45)', fontSize: '0.56rem', letterSpacing: '1px' }}>
            <span>LENIENT</span>
            <span>AGGRESSIVE</span>
          </div>
          <div style={{ color: 'rgba(0,255,255,0.45)', fontSize: '0.56rem', letterSpacing: '1px', marginTop: '0.5rem' }}>
            OVERLAP: {filteredData.removedOverlap} · LOW-CONF: {filteredData.removedConfidence}
          </div>
        </div>
      </aside>
    </div>
  );
}
