import * as THREE from 'three';
import { useEffect, useRef, useState } from 'react';
import FloorRenderer from './FloorRenderer';
import PlayerController from './PlayerController';
import { loadTextureToCanvas } from '../utils/textures';
import { loadGameSprites } from '../utils/sprites';

// Vertex shader - simple pass-through
const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Fragment shader - raycasting implementation with dynamic lighting and sprite rendering
const fragmentShader = `
  precision highp float;
  varying vec2 vUv;
  uniform vec2 uResolution;
  uniform float uTime;
  uniform vec2 uPlayerPos;
  uniform vec2 uDir;
  uniform vec2 uPlane;
  uniform sampler2D uMapTex;
  uniform vec2 uMapSize;
  uniform sampler2D uWallAtlas;
  uniform float uAtlasCount;
  uniform vec3 uLightPos; // Light position in world space
  uniform vec3 uLightColor; // Light color
  uniform float uLightIntensity; // Light intensity

  // Function to get map cell value
  float mapCell(vec2 cell) {
    vec2 uv = (cell + 0.5) / uMapSize;
    float r = texture2D(uMapTex, uv).r;
    return floor(r * 255.0 + 0.5);
  }

  void main() {
    // Convert UV to screen coordinates
    float x = vUv.x * uResolution.x;
    float cameraX = 2.0 * x / uResolution.x - 1.0;
    vec2 rayDir = uDir + uPlane * cameraX;
    
    // DDA algorithm for walls
    vec2 deltaDist = abs(1.0 / rayDir);
    
    vec2 rayPos = uPlayerPos;
    vec2 sideDist;
    vec2 step;
    int side = 0;
    
    // Calculate step and initial sideDist
    if (rayDir.x < 0.0) {
      step.x = -1.0;
      sideDist.x = (uPlayerPos.x - floor(uPlayerPos.x)) * deltaDist.x;
    } else {
      step.x = 1.0;
      sideDist.x = (floor(uPlayerPos.x) + 1.0 - uPlayerPos.x) * deltaDist.x;
    }
    
    if (rayDir.y < 0.0) {
      step.y = -1.0;
      sideDist.y = (uPlayerPos.y - floor(uPlayerPos.y)) * deltaDist.y;
    } else {
      step.y = 1.0;
      sideDist.y = (floor(uPlayerPos.y) + 1.0 - uPlayerPos.y) * deltaDist.y;
    }
    
    // DDA loop
    bool hit = false;
    float cellType = 0.0;
    vec2 mapPos = floor(uPlayerPos);
    float perpWallDist = 0.0;
    
    for (int i = 0; i < 64; i++) {
      if (sideDist.x < sideDist.y) {
        sideDist.x += deltaDist.x;
        mapPos.x += step.x;
        side = 0;
      } else {
        sideDist.y += deltaDist.y;
        mapPos.y += step.y;
        side = 1;
      }
      
      cellType = mapCell(mapPos);
      if (cellType > 0.5) {
        hit = true;
        break;
      }
    }
    
    if (hit) {
      // Calculate distance
      if (side == 0) {
        perpWallDist = (mapPos.x - uPlayerPos.x + (1.0 - step.x) * 0.5) / rayDir.x;
      } else {
        perpWallDist = (mapPos.y - uPlayerPos.y + (1.0 - step.y) * 0.5) / rayDir.y;
      }
      
      // Calculate wall height
      float lineHeight = uResolution.y / perpWallDist;
      
      // Calculate wall X coordinate for texture mapping
      float wallX;
      if (side == 0) {
        wallX = uPlayerPos.y + perpWallDist * rayDir.y;
      } else {
        wallX = uPlayerPos.x + perpWallDist * rayDir.x;
      }
      wallX = wallX - floor(wallX);
      
      // Sample texture from atlas
      float atlasIndex = cellType - 1.0;
      float atlasU = (atlasIndex + wallX) / uAtlasCount;
      float atlasV = vUv.y;
      
      vec3 color = texture2D(uWallAtlas, vec2(atlasU, atlasV)).rgb;
      
      // Darken Y walls for depth effect
      if (side == 1) {
        color = color * 0.7;
      }
      
      // Add dynamic lighting effect
      float lightDistance = length(vec3(mapPos.x, 0.0, mapPos.y) - uLightPos);
      float attenuation = 1.0 / (1.0 + 0.1 * lightDistance + 0.01 * lightDistance * lightDistance);
      vec3 lightContribution = uLightColor * uLightIntensity * attenuation;
      
      // Apply lighting to color
      color = color * (0.3 + lightContribution); // 0.3 is ambient light
      
      gl_FragColor = vec4(color, 1.0);
    } else {
      // Ceiling color
      gl_FragColor = vec4(0.1, 0.1, 0.1, 1.0);
    }
  }
`;

export default function ShaderRaycaster({ gameData, onPlayerMove }) {
  const containerRef = useRef();
  const rendererRef = useRef();
  const sceneRef = useRef();
  const cameraRef = useRef();
  const materialRef = useRef();
  const [texturesLoaded, setTexturesLoaded] = useState(false);
  const [wallAtlasTexture, setWallAtlasTexture] = useState(null);
  
  // Player state
  const [playerPos, setPlayerPos] = useState({ 
    x: gameData?.dungeon?.size ? gameData.dungeon.size / 2 : 8, 
    y: gameData?.dungeon?.size ? gameData.dungeon.size / 2 : 8 
  });
  
  const [dir, setDir] = useState({ x: -1, y: 0 });
  const [plane, setPlane] = useState({ x: 0, y: 0.66 });
  
  // Call onPlayerMove callback when player position changes
  useEffect(() => {
    if (onPlayerMove) {
      onPlayerMove(playerPos);
    }
  }, [playerPos, onPlayerMove]);
  
  // Generate dungeon layout based on layout type
  const generateDungeonLayout = (size, layoutType) => {
    const mapData = new Uint8Array(size * size);
    
    // Initialize all cells as empty
    for (let i = 0; i < size * size; i++) {
      mapData[i] = 0;
    }
    
    switch (layoutType) {
      case "rooms":
        // Create walls around the edges
        for (let x = 0; x < size; x++) {
          for (let y = 0; y < size; y++) {
            if (x === 0 || y === 0 || x === size - 1 || y === size - 1) {
              mapData[y * size + x] = 1; // Wall
            }
          }
        }
        
        // Add some internal walls to create rooms
        for (let i = 2; i < size - 2; i += 4) {
          for (let j = 2; j < size - 2; j += 4) {
            // Vertical walls
            for (let k = 1; k < size - 1; k++) {
              if (Math.abs(k - j) > 2) {
                mapData[k * size + i] = 1;
              }
            }
            
            // Horizontal walls
            for (let k = 1; k < size - 1; k++) {
              if (Math.abs(k - i) > 2) {
                mapData[j * size + k] = 1;
              }
            }
          }
        }
        break;
        
      case "maze":
        // Create a simple maze pattern
        for (let x = 0; x < size; x++) {
          for (let y = 0; y < size; y++) {
            if (x === 0 || y === 0 || x === size - 1 || y === size - 1) {
              mapData[y * size + x] = 1; // Wall
            } else if (x % 2 === 0 && y % 2 === 0) {
              mapData[y * size + x] = 1; // Wall
            } else if (x % 2 === 1 && y % 2 === 1) {
              mapData[y * size + x] = 1; // Wall
            }
          }
        }
        break;
        
      case "tower":
        // Create a tower-like structure with concentric walls
        const center = Math.floor(size / 2);
        for (let x = 0; x < size; x++) {
          for (let y = 0; y < size; y++) {
            if (x === 0 || y === 0 || x === size - 1 || y === size - 1) {
              mapData[y * size + x] = 1; // Outer wall
            } else {
              const distance = Math.sqrt(Math.pow(x - center, 2) + Math.pow(y - center, 2));
              if (distance < 8 && distance > 6) {
                mapData[y * size + x] = 1; // Inner wall
              } else if (distance < 4 && distance > 2) {
                mapData[y * size + x] = 1; // Center wall
              }
            }
          }
        }
        break;
        
      default:
        // Simple room with walls around edges
        for (let i = 0; i < size * size; i++) {
          const x = i % size;
          const y = Math.floor(i / size);
          
          if (x === 0 || y === 0 || x === size - 1 || y === size - 1) {
            mapData[i] = 1; // Wall
          }
        }
    }
    
    return mapData;
  };
  
  // Generate map data
  const mapSize = gameData?.dungeon?.size || 16;
  const mapData = generateDungeonLayout(mapSize, gameData?.dungeon?.layout || "default");
  
  useEffect(() => {
    if (!gameData) return;
    
    // Initialize Three.js
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
    cameraRef.current = camera;
    
    const renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    rendererRef.current = renderer;
    
    // Create map texture
    const mapSizeVec = new THREE.Vector2(mapSize, mapSize);
    
    const mapTexture = new THREE.DataTexture(mapData, mapSize, mapSize, THREE.RedFormat);
    mapTexture.minFilter = THREE.NearestFilter;
    mapTexture.magFilter = THREE.NearestFilter;
    mapTexture.needsUpdate = true;
    
    // Load textures using actual gameData
    const loadTextures = async () => {
      try {
        let loadedTextures = [];
        
        // Check if textures are available in gameData
        if (gameData.textures && gameData.textures.length > 0) {
          console.log('Loading AI-generated textures from backend');
          
          // Filter wall textures
          const wallTextures = gameData.textures.filter(t => t.id.startsWith('wall_'));
          
          // Load each texture
          for (const texture of wallTextures) {
            try {
              const canvas = await loadTextureToCanvas(texture.url);
              loadedTextures.push({ id: texture.id, canvas });
            } catch (err) {
              console.error(`Failed to load texture ${texture.id}:`, err);
            }
          }
        }
        
        // If no textures loaded, use solid colors as fallback
        if (loadedTextures.length === 0) {
          console.log('Using solid color textures (no AI textures available)');
        }
        
        // Create wall atlas texture
        const atlasSize = 64 * Math.max(3, loadedTextures.length);
        const atlasData = new Uint8Array(atlasSize * 64 * 3); // RGB
        
        // Fill with actual texture data or default colors if not loaded
        for (let y = 0; y < 64; y++) {
          for (let x = 0; x < atlasSize; x++) {
            const idx = (y * atlasSize + x) * 3;
            const texIdx = Math.floor(x / 64);
            
            if (texIdx < loadedTextures.length && loadedTextures[texIdx].canvas) {
              // Use actual AI-generated texture data
              const canvas = loadedTextures[texIdx].canvas;
              const ctx = canvas.getContext('2d');
              const imageData = ctx.getImageData(x % 64, y, 1, 1).data;
              
              atlasData[idx] = imageData[0];     // R
              atlasData[idx + 1] = imageData[1]; // G
              atlasData[idx + 2] = imageData[2]; // B
            } else {
              // Fallback to solid colors
              switch (texIdx) {
                case 0:
                  atlasData[idx] = 150;
                  atlasData[idx + 1] = 100;
                  atlasData[idx + 2] = 100;
                  break;
                case 1:
                  atlasData[idx] = 100;
                  atlasData[idx + 1] = 150;
                  atlasData[idx + 2] = 100;
                  break;
                case 2:
                  atlasData[idx] = 100;
                  atlasData[idx + 1] = 100;
                  atlasData[idx + 2] = 150;
                  break;
                default:
                  atlasData[idx] = 100;
                  atlasData[idx + 1] = 100;
                  atlasData[idx + 2] = 100;
              }
            }
          }
        }
        
        const wallAtlasTexture = new THREE.DataTexture(atlasData, atlasSize, 64, THREE.RGBFormat);
        wallAtlasTexture.minFilter = THREE.NearestFilter;
        wallAtlasTexture.magFilter = THREE.NearestFilter;
        wallAtlasTexture.needsUpdate = true;
        
        // Create shader material with loaded textures
        const material = new THREE.ShaderMaterial({
          uniforms: {
            uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
            uTime: { value: 0 },
            uPlayerPos: { value: new THREE.Vector2(playerPos.x, playerPos.y) },
            uDir: { value: new THREE.Vector2(dir.x, dir.y) },
            uPlane: { value: new THREE.Vector2(plane.x, plane.y) },
            uMapTex: { value: mapTexture },
            uMapSize: { value: mapSizeVec },
            uWallAtlas: { value: wallAtlasTexture },
            uAtlasCount: { value: Math.max(3, loadedTextures.length) },
            uLightPos: { value: new THREE.Vector3(mapSize / 2, 0, mapSize / 2) },
            uLightColor: { value: new THREE.Vector3(1.0, 1.0, 1.0) }, // White light
            uLightIntensity: { value: 1.0 }
          },
          vertexShader,
          fragmentShader
        });
        materialRef.current = material;
        
        // Create quad geometry
        const geometry = new THREE.PlaneGeometry(2, 2);
        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);
        
        // Add renderer to container
        containerRef.current.innerHTML = '';
        containerRef.current.appendChild(renderer.domElement);
        
        // Handle window resize
        const handleResize = () => {
          renderer.setSize(window.innerWidth, window.innerHeight);
          material.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
        };
        
        window.addEventListener('resize', handleResize);
        
        // Update state
        setWallAtlasTexture(wallAtlasTexture);
        setTexturesLoaded(true);
        
        // Render loop
        const animate = () => {
          requestAnimationFrame(animate);
          material.uniforms.uTime.value = performance.now() / 1000;
          material.uniforms.uPlayerPos.value.set(playerPos.x, playerPos.y);
          material.uniforms.uDir.value.set(dir.x, dir.y);
          material.uniforms.uPlane.value.set(plane.x, plane.y);
          renderer.render(scene, camera);
        };
        
        animate();
        
        return () => {
          window.removeEventListener('resize', handleResize);
          renderer.dispose();
          geometry.dispose();
          material.dispose();
          mapTexture.dispose();
          if (wallAtlasTexture) {
            wallAtlasTexture.dispose();
          }
        };
      } catch (error) {
        console.error('Error loading textures:', error);
        setTexturesLoaded(true); // Still set to true to render with default colors
      }
    };
    
    loadTextures();
  }, [gameData]);
  
  // Update shader uniforms when player state changes
  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uPlayerPos.value.set(playerPos.x, playerPos.y);
      materialRef.current.uniforms.uDir.value.set(dir.x, dir.y);
      materialRef.current.uniforms.uPlane.value.set(plane.x, plane.y);
    }
  }, [playerPos, dir, plane]);
  
  return (
    <div className="relative w-full h-screen">
      <div ref={containerRef} className="w-full h-full absolute top-0"></div>
      <FloorRenderer gameData={gameData} />
      <PlayerController 
        playerPos={playerPos}
        dir={dir}
        plane={plane}
        setPlayerPos={setPlayerPos}
        setDir={setDir}
        setPlane={setPlane}
        mapData={mapData}
        mapSize={mapSize}
      />
    </div>
  );
}