'use client'

import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Sphere, Line, Stars } from '@react-three/drei'
import * as THREE from 'three'

function latLngToVector3(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lng + 180) * (Math.PI / 180)
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  )
}

const LOCATIONS = [
  { name: 'Sri Lanka', lat: 7.8731, lng: 80.7718, color: '#E8A020' },
  { name: 'Japan', lat: 36.2048, lng: 138.2529, color: '#E8A020' },
  { name: 'South Korea', lat: 35.9078, lng: 127.7669, color: '#E8A020' },
  { name: 'China', lat: 35.8617, lng: 104.1954, color: '#E8A020' },
]

const CONNECTIONS = [
  [0, 1], // Sri Lanka → Japan
  [0, 2], // Sri Lanka → Korea
  [0, 3], // Sri Lanka → China
]

function GlobeMesh() {
  const meshRef = useRef<THREE.Group>(null)
  const particlesRef = useRef<THREE.Points>(null)

  useFrame((_, delta) => {
    if (meshRef.current) meshRef.current.rotation.y += delta * 0.15
    if (particlesRef.current) particlesRef.current.rotation.y += delta * 0.05
  })

  // Globe dots texture
  const globeTexture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 512
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#0B3D6B'
    ctx.fillRect(0, 0, 1024, 512)

    // Draw dot grid to simulate landmasses
    ctx.fillStyle = '#1A6BAD'
    for (let lat = -90; lat <= 90; lat += 4) {
      for (let lng = -180; lng <= 180; lng += 4) {
        const x = ((lng + 180) / 360) * 1024
        const y = ((90 - lat) / 180) * 512
        ctx.beginPath()
        ctx.arc(x, y, 1.5, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    return new THREE.CanvasTexture(canvas)
  }, [])

  // Floating particles around globe
  const particlePositions = useMemo(() => {
    const positions = new Float32Array(300 * 3)
    for (let i = 0; i < 300; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(Math.random() * 2 - 1)
      const r = 1.8 + Math.random() * 0.8
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.cos(phi)
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
    }
    return positions
  }, [])

  const radius = 1.4

  return (
    <group ref={meshRef}>
      {/* Main globe */}
      <Sphere args={[radius, 64, 64]}>
        <meshPhongMaterial
          map={globeTexture}
          transparent
          opacity={0.9}
          shininess={20}
        />
      </Sphere>

      {/* Atmosphere glow */}
      <Sphere args={[radius * 1.02, 64, 64]}>
        <meshPhongMaterial
          color="#1A6BAD"
          transparent
          opacity={0.08}
          side={THREE.BackSide}
        />
      </Sphere>

      {/* Location dots */}
      {LOCATIONS.map((loc) => {
        const pos = latLngToVector3(loc.lat, loc.lng, radius + 0.02)
        return (
          <group key={loc.name} position={pos}>
            <mesh>
              <sphereGeometry args={[0.035, 16, 16]} />
              <meshBasicMaterial color={loc.color} />
            </mesh>
            {/* Pulse ring */}
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.04, 0.06, 32]} />
              <meshBasicMaterial color={loc.color} transparent opacity={0.6} side={THREE.DoubleSide} />
            </mesh>
          </group>
        )
      })}

      {/* Connection arcs */}
      {CONNECTIONS.map(([fromIdx, toIdx], i) => {
        const from = latLngToVector3(LOCATIONS[fromIdx].lat, LOCATIONS[fromIdx].lng, radius)
        const to = latLngToVector3(LOCATIONS[toIdx].lat, LOCATIONS[toIdx].lng, radius)
        const mid = from.clone().add(to).normalize().multiplyScalar(radius * 1.5)
        const curve = new THREE.QuadraticBezierCurve3(from, mid, to)
        const points = curve.getPoints(50)
        return (
          <Line
            key={i}
            points={points}
            color="#E8A020"
            lineWidth={1.5}
            transparent
            opacity={0.6}
          />
        )
      })}

      {/* Floating particles */}
      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[particlePositions, 3]}
          />
        </bufferGeometry>
        <pointsMaterial color="#E8A020" size={0.012} transparent opacity={0.4} />
      </points>
    </group>
  )
}

export default function Globe3D() {
  return (
    <div className="w-full h-full">
      <Canvas
        camera={{ position: [0, 0, 4], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.3} />
        <directionalLight position={[5, 3, 5]} intensity={1.2} color="#ffffff" />
        <directionalLight position={[-5, -3, -5]} intensity={0.3} color="#1A6BAD" />
        <Stars radius={100} depth={50} count={3000} factor={4} saturation={0} fade speed={0.5} />
        <GlobeMesh />
      </Canvas>
    </div>
  )
}
