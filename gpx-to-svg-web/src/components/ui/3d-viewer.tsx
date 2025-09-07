"use client"

import React, { Suspense, useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Grid } from '@react-three/drei'
import * as THREE from 'three'
import { GPXPoint } from '@/lib/gpx-parser'
import { OSMData, OSMBounds } from '@/lib/overpass-api'

interface Building3DProps {
  building: {
    geometry: Array<{ lat: number; lon: number }>
    tags: Record<string, string>
  }
  bounds: OSMBounds
  buildingStyles: {
    fillColor: string
    strokeColor: string
  }
  modelDimensions?: {
    width: number
    depth: number
  }
  buildingHeightRange?: {
    min: number
    max: number
  }
}

function Building3D({ 
  building, 
  bounds, 
  buildingStyles, 
  modelDimensions, 
  buildingHeightRange,
  originalHeight,
  heightMapping 
}: Building3DProps & { 
  originalHeight: number,
  heightMapping: { min: number, max: number, minMM: number, maxMM: number }
}) {
  const meshRef = useRef<THREE.Mesh>(null)

  const { shape, height } = useMemo(() => {
    // Convert lat/lon to 3D coordinates with dynamic scaling
    const latRange = bounds.north - bounds.south
    const lonRange = bounds.east - bounds.west
    
    // Use model dimensions for scaling if provided, otherwise use default
    const scaleX = modelDimensions ? modelDimensions.width : 1000
    const scaleZ = modelDimensions ? modelDimensions.depth : 1000

    const points: THREE.Vector2[] = []
    building.geometry.forEach(coord => {
      const x = ((coord.lon - bounds.west) / lonRange - 0.5) * scaleX
      const z = -((coord.lat - bounds.south) / latRange - 0.5) * scaleZ
      points.push(new THREE.Vector2(x, z))
    })

    // Create shape from points
    const shape = new THREE.Shape(points)

    // Apply color ramp mapping from original height range to mm range
    const { min, max, minMM, maxMM } = heightMapping
    const normalizedHeight = (originalHeight - min) / (max - min) // 0-1
    const mappedHeight = minMM + (normalizedHeight * (maxMM - minMM))

    return { shape, height: mappedHeight }
  }, [building, bounds, modelDimensions, originalHeight, heightMapping])

  const geometry = useMemo(() => {
    const extrudeSettings = {
      depth: height,
      bevelEnabled: false
    }
    return new THREE.ExtrudeGeometry(shape, extrudeSettings)
  }, [shape, height])

  return (
    <mesh 
      ref={meshRef} 
      geometry={geometry}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
    >
      <meshStandardMaterial 
        color={buildingStyles.fillColor} 
        transparent 
        opacity={0.8}
      />
    </mesh>
  )
}

// Helper function to get building height from OSM tags
function getBuildingHeight(building: { tags: Record<string, string> }): number {
  let height = 6 // Default height in meters for residential
  if (building.tags.height) {
    const parsedHeight = parseFloat(building.tags.height)
    if (!isNaN(parsedHeight)) return parsedHeight
  } else if (building.tags['building:levels']) {
    const levels = parseInt(building.tags['building:levels'])
    if (!isNaN(levels)) return levels * 3 // 3m per level
  } else {
    // Better defaults based on building type
    const buildingType = building.tags.building
    switch (buildingType) {
      case 'house':
      case 'residential': return 6
      case 'apartments': return 15
      case 'commercial':
      case 'retail': return 4
      case 'industrial': return 8
      case 'office': return 20
      case 'hospital': return 12
      case 'school': return 4
      case 'church': return 15
      default: return 6
    }
  }
  return height
}

interface Foundation3DProps {
  buildings: OSMData['buildings']
  bounds: OSMBounds
  modelDimensions?: {
    width: number
    depth: number
  }
}

function Foundation3D({ buildings, bounds, modelDimensions }: Foundation3DProps) {
  const foundationGeometry = useMemo(() => {
    if (buildings.length === 0) return new THREE.BufferGeometry()

    const latRange = bounds.north - bounds.south
    const lonRange = bounds.east - bounds.west
    const scaleX = modelDimensions ? modelDimensions.width : 1000
    const scaleZ = modelDimensions ? modelDimensions.depth : 1000

    // Create a combined shape from all building footprints
    const allShapes: THREE.Shape[] = []
    
    buildings.forEach(building => {
      if (building.geometry && building.geometry.length > 2) {
        const points: THREE.Vector2[] = []
        building.geometry.forEach(coord => {
          const x = ((coord.lon - bounds.west) / lonRange - 0.5) * scaleX
          const z = -((coord.lat - bounds.south) / latRange - 0.5) * scaleZ
          points.push(new THREE.Vector2(x, z))
        })
        
        if (points.length > 2) {
          allShapes.push(new THREE.Shape(points))
        }
      }
    })

    if (allShapes.length === 0) return new THREE.BufferGeometry()

    // Create foundation geometry with small height
    const foundationHeight = 2 // 2mm foundation thickness
    const foundationGeometries: THREE.ExtrudeGeometry[] = []
    
    allShapes.forEach(shape => {
      const extrudeSettings = {
        depth: foundationHeight,
        bevelEnabled: false
      }
      foundationGeometries.push(new THREE.ExtrudeGeometry(shape, extrudeSettings))
    })

    // Merge all foundation geometries
    if (foundationGeometries.length === 1) {
      return foundationGeometries[0]
    } else {
      // For multiple buildings, merge geometries
      const mergedGeometry = new THREE.BufferGeometry()
      const positions: number[] = []
      const indices: number[] = []
      let vertexOffset = 0

      foundationGeometries.forEach(geometry => {
        const pos = geometry.attributes.position
        const idx = geometry.index

        // Add positions
        for (let i = 0; i < pos.count * 3; i++) {
          positions.push(pos.array[i])
        }

        // Add indices with offset
        if (idx) {
          for (let i = 0; i < idx.count; i++) {
            indices.push(idx.array[i] + vertexOffset)
          }
        }
        
        vertexOffset += pos.count
      })

      mergedGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
      mergedGeometry.setIndex(indices)
      mergedGeometry.computeVertexNormals()
      
      return mergedGeometry
    }
  }, [buildings, bounds, modelDimensions])

  return (
    <mesh 
      geometry={foundationGeometry}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -3, 0]}
    >
      <meshStandardMaterial 
        color="#8B4513"
        transparent 
        opacity={0.9}
      />
    </mesh>
  )
}

interface GPXTrack3DProps {
  points: GPXPoint[]
  bounds: OSMBounds
  trackColor: string
  strokeWidth: number
  modelDimensions?: {
    width: number
    depth: number
  }
  pathExtrusionHeight?: number
}

function GPXTrack3D({ points, bounds, trackColor, strokeWidth, modelDimensions, pathExtrusionHeight }: GPXTrack3DProps) {
  const meshRef = useRef<THREE.Mesh>(null)

  const trackGeometry = useMemo(() => {
    if (points.length < 2) return new THREE.BufferGeometry()

    const latRange = bounds.north - bounds.south
    const lonRange = bounds.east - bounds.west
    
    // Use model dimensions for scaling if provided, otherwise use default
    const scaleX = modelDimensions ? modelDimensions.width : 1000
    const scaleZ = modelDimensions ? modelDimensions.depth : 1000
    const extrusionHeight = pathExtrusionHeight || 2

    // Convert GPS points to 2D path coordinates (corrected orientation)
    const pathPoints: THREE.Vector2[] = points.map(point => {
      const x = ((point.lon - bounds.west) / lonRange - 0.5) * scaleX
      const z = -((point.lat - bounds.south) / latRange - 0.5) * scaleZ
      return new THREE.Vector2(x, z)
    })

    // Create a path shape with proper width
    const pathWidth = strokeWidth * 0.5 // Convert stroke width to mm scale
    const pathShape = new THREE.Shape()
    
    if (pathPoints.length >= 2) {
      // Create a path by connecting all points and giving it width
      const expandedPath: THREE.Vector2[] = []
      
      for (let i = 0; i < pathPoints.length; i++) {
        const current = pathPoints[i]
        let direction: THREE.Vector2
        
        if (i === 0) {
          // First point: use direction to next point
          direction = new THREE.Vector2().subVectors(pathPoints[i + 1], current).normalize()
        } else if (i === pathPoints.length - 1) {
          // Last point: use direction from previous point
          direction = new THREE.Vector2().subVectors(current, pathPoints[i - 1]).normalize()
        } else {
          // Middle points: average direction
          const dirToPrev = new THREE.Vector2().subVectors(current, pathPoints[i - 1]).normalize()
          const dirToNext = new THREE.Vector2().subVectors(pathPoints[i + 1], current).normalize()
          direction = new THREE.Vector2().addVectors(dirToPrev, dirToNext).normalize()
        }
        
        // Calculate perpendicular for path width
        const perpendicular = new THREE.Vector2(-direction.y, direction.x).multiplyScalar(pathWidth)
        
        expandedPath.push(new THREE.Vector2().addVectors(current, perpendicular))
      }
      
      // Add points in reverse order to create closed shape
      for (let i = pathPoints.length - 1; i >= 0; i--) {
        const current = pathPoints[i]
        let direction: THREE.Vector2
        
        if (i === 0) {
          direction = new THREE.Vector2().subVectors(pathPoints[i + 1], current).normalize()
        } else if (i === pathPoints.length - 1) {
          direction = new THREE.Vector2().subVectors(current, pathPoints[i - 1]).normalize()
        } else {
          const dirToPrev = new THREE.Vector2().subVectors(current, pathPoints[i - 1]).normalize()
          const dirToNext = new THREE.Vector2().subVectors(pathPoints[i + 1], current).normalize()
          direction = new THREE.Vector2().addVectors(dirToPrev, dirToNext).normalize()
        }
        
        const perpendicular = new THREE.Vector2(-direction.y, direction.x).multiplyScalar(pathWidth)
        expandedPath.push(new THREE.Vector2().subVectors(current, perpendicular))
      }
      
      // Create shape from expanded path
      pathShape.moveTo(expandedPath[0].x, expandedPath[0].y)
      for (let i = 1; i < expandedPath.length; i++) {
        pathShape.lineTo(expandedPath[i].x, expandedPath[i].y)
      }
      pathShape.closePath()
    }

    // Extrude the path upward
    const extrudeSettings = {
      depth: extrusionHeight,
      bevelEnabled: false
    }
    
    return new THREE.ExtrudeGeometry(pathShape, extrudeSettings)
  }, [points, bounds, strokeWidth, modelDimensions, pathExtrusionHeight])

  return (
    <mesh 
      ref={meshRef} 
      geometry={trackGeometry}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
    >
      <meshStandardMaterial 
        color={trackColor}
        transparent 
        opacity={0.9}
      />
    </mesh>
  )
}

interface Scene3DProps {
  osmData?: OSMData
  bounds?: OSMBounds
  gpxPoints?: GPXPoint[]
  buildingStyles?: {
    fillColor: string
    strokeColor: string
  }
  trackColor?: string
  strokeWidth?: number
  modelDimensions?: {
    width: number
    depth: number
  }
  buildingHeightRange?: {
    min: number
    max: number
  }
  pathExtrusionHeight?: number
}

function Scene3D({ 
  osmData, 
  bounds, 
  gpxPoints, 
  buildingStyles, 
  trackColor = '#FF6B6B',
  strokeWidth = 2,
  modelDimensions,
  buildingHeightRange,
  pathExtrusionHeight
}: Scene3DProps) {
  // Calculate height mapping for color ramp effect
  const heightMapping = useMemo(() => {
    if (!osmData?.buildings || osmData.buildings.length === 0 || !buildingHeightRange) {
      return null
    }

    // Get all building heights
    const heights = osmData.buildings.map(getBuildingHeight)
    const minHeight = Math.min(...heights)
    const maxHeight = Math.max(...heights)

    // If all buildings have the same height, create a small range
    const actualMin = minHeight === maxHeight ? minHeight - 1 : minHeight
    const actualMax = minHeight === maxHeight ? maxHeight + 1 : maxHeight

    return {
      min: actualMin,
      max: actualMax,
      minMM: buildingHeightRange.min,
      maxMM: buildingHeightRange.max
    }
  }, [osmData?.buildings, buildingHeightRange])

  if (!bounds) {
    return (
      <group>
        {/* No foundation without bounds */}
      </group>
    )
  }

  return (
    <group>
      {/* Foundation - only under building boundaries */}
      {osmData?.buildings && osmData.buildings.length > 0 && (
        <Foundation3D
          buildings={osmData.buildings}
          bounds={bounds}
          modelDimensions={modelDimensions}
        />
      )}

      {/* Buildings */}
      {osmData?.buildings.map((building, index) => {
        const originalHeight = getBuildingHeight(building)
        return (
          <Building3D
            key={index}
            building={building}
            bounds={bounds}
            buildingStyles={buildingStyles || { fillColor: '#B0B0B0', strokeColor: '#808080' }}
            modelDimensions={modelDimensions}
            buildingHeightRange={buildingHeightRange}
            originalHeight={originalHeight}
            heightMapping={heightMapping || { min: 6, max: 6, minMM: 5, maxMM: 30 }}
          />
        )
      })}

      {/* GPX Track */}
      {gpxPoints && gpxPoints.length > 1 && (
        <GPXTrack3D
          points={gpxPoints}
          bounds={bounds}
          trackColor={trackColor}
          strokeWidth={strokeWidth}
          modelDimensions={modelDimensions}
          pathExtrusionHeight={pathExtrusionHeight}
        />
      )}

      {/* Lighting */}
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[100, 100, 50]}
        intensity={1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
    </group>
  )
}

interface Viewer3DProps {
  osmData?: OSMData
  bounds?: OSMBounds
  gpxPoints?: GPXPoint[]
  buildingStyles?: {
    fillColor: string
    strokeColor: string
  }
  trackColor?: string
  strokeWidth?: number
  modelDimensions?: {
    width: number
    depth: number
  }
  buildingHeightRange?: {
    min: number
    max: number
  }
  pathExtrusionHeight?: number
  className?: string
}

export function Viewer3D({
  osmData,
  bounds,
  gpxPoints,
  buildingStyles,
  trackColor,
  strokeWidth,
  modelDimensions,
  buildingHeightRange,
  pathExtrusionHeight,
  className
}: Viewer3DProps) {
  return (
    <div className={`w-full h-full ${className}`}>
      <Canvas
        camera={{
          position: [200, 150, 200],
          fov: 60,
        }}
        shadows
      >
        <Suspense fallback={null}>
          <Scene3D
            osmData={osmData}
            bounds={bounds}
            gpxPoints={gpxPoints}
            buildingStyles={buildingStyles}
            trackColor={trackColor}
            strokeWidth={strokeWidth}
            modelDimensions={modelDimensions}
            buildingHeightRange={buildingHeightRange}
            pathExtrusionHeight={pathExtrusionHeight}
          />
          <OrbitControls
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            minDistance={50}
            maxDistance={1000}
          />
        </Suspense>
      </Canvas>
    </div>
  )
}