'use client'

import { useRef, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

function Particles() {
  const meshRef = useRef<THREE.Points>(null)
  const { mouse } = useThree()

  const count = 120
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 20
      pos[i * 3 + 1] = (Math.random() - 0.5) * 10
      pos[i * 3 + 2] = (Math.random() - 0.5) * 5
    }
    return pos
  }, [])

  const speeds = useMemo(() => Array.from({ length: count }, () => 0.1 + Math.random() * 0.3), [])

  useFrame((state) => {
    if (!meshRef.current) return
    const time = state.clock.elapsedTime
    const posArr = meshRef.current.geometry.attributes.position.array as Float32Array
    for (let i = 0; i < count; i++) {
      posArr[i * 3 + 1] += Math.sin(time * speeds[i] + i) * 0.003
      posArr[i * 3] += Math.cos(time * speeds[i] * 0.5 + i) * 0.002
    }
    meshRef.current.geometry.attributes.position.needsUpdate = true
    // Mouse parallax
    meshRef.current.rotation.x = THREE.MathUtils.lerp(
      meshRef.current.rotation.x, mouse.y * 0.1, 0.05
    )
    meshRef.current.rotation.y = THREE.MathUtils.lerp(
      meshRef.current.rotation.y, mouse.x * 0.1, 0.05
    )
  })

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#E8A020"
        size={0.06}
        transparent
        opacity={0.7}
        sizeAttenuation
      />
    </points>
  )
}

function NavyParticles() {
  const meshRef = useRef<THREE.Points>(null)
  const count = 80

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 20
      pos[i * 3 + 1] = (Math.random() - 0.5) * 10
      pos[i * 3 + 2] = (Math.random() - 0.5) * 5 - 2
    }
    return pos
  }, [])

  useFrame((state) => {
    if (!meshRef.current) return
    const time = state.clock.elapsedTime
    const posArr = meshRef.current.geometry.attributes.position.array as Float32Array
    for (let i = 0; i < count; i++) {
      posArr[i * 3 + 1] += Math.sin(time * 0.2 + i * 0.5) * 0.004
    }
    meshRef.current.geometry.attributes.position.needsUpdate = true
  })

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#1A6BAD"
        size={0.04}
        transparent
        opacity={0.5}
        sizeAttenuation
      />
    </points>
  )
}

export default function ParticleHero() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <Canvas
        camera={{ position: [0, 0, 8], fov: 60 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <Particles />
        <NavyParticles />
      </Canvas>
    </div>
  )
}
