import React, { useRef, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Edges, Grid, Line, OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';

// Wall mesh palette: structural walls red/orange, partitions white
function Wall({ wall }) {
  const { position, dimensions, load_bearing, rotation_y } = wall;
  const color = load_bearing ? '#ff6b2c' : '#f8f8f6';
  const opacity = load_bearing ? 0.32 : 0.2;
  const edgeColor = load_bearing ? '#ff944d' : '#ffffff';

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
        <Edges scale={1} threshold={15} color={edgeColor} />
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

function WindowMarker({ window }) {
  const { position, orientation, dimensions } = window;
  const width = orientation === 'horizontal' ? dimensions.width : dimensions.depth;
  const depth = orientation === 'horizontal' ? dimensions.depth : dimensions.width;

  return (
    <group position={[position.x, position.y, position.z]}>
      <mesh>
        <boxGeometry args={[Math.max(width, 0.12), dimensions.height, Math.max(depth, 0.12)]} />
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
function Scene({ threeJsData }) {
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

      {walls.map((wall) => <Wall key={wall.id} wall={wall} />)}
      {windows.map((window) => <WindowMarker key={window.id} window={window} />)}
      {visibleLabels.map((label) => <RoomLabel key={label.id} label={label} />)}
      {doors.map((door) => <DoorSwing key={door.id} door={door} />)}

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

export default function ThreeViewer({ threeJsData }) {
  const loadBearingCount = threeJsData?.walls?.filter(w => w.load_bearing).length || 0;
  const partitionCount = threeJsData?.walls?.filter(w => !w.load_bearing).length || 0;
  const windowCount = threeJsData?.windows?.length || 0;
  const doorCount = threeJsData?.doors?.length || 0;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas
        camera={{ position: [20, 15, 20], fov: 60 }}
        style={{ width: '100%', height: '100%' }}
      >
        <Scene threeJsData={threeJsData} />
      </Canvas>

      {/* Legend overlay */}
      <div style={{
        position: 'absolute', bottom: '20px', left: '20px',
        background: 'rgba(3,10,20,0.85)',
        border: '1px solid rgba(0,255,255,0.2)',
        borderLeft: '3px solid #00ffff',
        padding: '1rem 1.2rem',
        backdropFilter: 'blur(10px)',
        fontFamily: "'Courier New', monospace",
      }}>
        <div style={{ color: '#00ffff', fontSize: '0.65rem', letterSpacing: '3px', marginBottom: '0.75rem' }}>
          WALL LEGEND
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ width: '24px', height: '10px', background: '#ff6b2c', borderRadius: '1px' }} />
            <span style={{ color: '#e0d0c0', fontSize: '0.7rem', letterSpacing: '1px' }}>
              LOAD-BEARING ({loadBearingCount})
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ width: '24px', height: '10px', background: '#ffffff', borderRadius: '1px', opacity: 0.85 }} />
            <span style={{ color: '#e5e5e5', fontSize: '0.7rem', letterSpacing: '1px' }}>
              PARTITION ({partitionCount})
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ width: '24px', height: '10px', background: '#00ffff', borderRadius: '1px', opacity: 0.8 }} />
            <span style={{ color: '#9ffcff', fontSize: '0.7rem', letterSpacing: '1px' }}>
              DOORS ({doorCount})
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ width: '24px', height: '10px', background: '#b6ff4d', borderRadius: '1px', opacity: 0.85 }} />
            <span style={{ color: '#dfffaa', fontSize: '0.7rem', letterSpacing: '1px' }}>
              WINDOWS ({windowCount})
            </span>
          </div>
        </div>
      </div>

      {/* Controls hint */}
      <div style={{
        position: 'absolute', bottom: '20px', right: '20px',
        color: 'rgba(0,255,255,0.35)', fontSize: '0.65rem',
        fontFamily: "'Courier New', monospace", letterSpacing: '1.5px',
        textAlign: 'right', lineHeight: 1.8,
      }}>
        DRAG TO ROTATE<br />
        SCROLL TO ZOOM<br />
        RIGHT-DRAG TO PAN
      </div>
    </div>
  );
}
