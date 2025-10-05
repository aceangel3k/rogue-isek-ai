import { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { EnemyManager } from '../engine/enemy';
import { CombatManager, getCrosshairState } from '../engine/combat';
import { generateDungeon, getEnemySpawnPositions, getNPCSpawnPosition } from '../engine/dungeon';
import { loadTextureToCanvas } from '../utils/textures';
import HUD from './HUD';
import ShopModal from './ShopModal';
import CompletionScreen from './CompletionScreen';
import GameOverScreen from './GameOverScreen';
import StoryIntro from './StoryIntro';

// Utility: Get or create player ID
function getPlayerId() {
  let playerId = localStorage.getItem('playerId');
  if (!playerId) {
    playerId = `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('playerId', playerId);
  }
  return playerId;
}

const MAP_SIZE = 24;

export default function SimpleRaycaster({ gameData, onPlayerMove, onLoadNextDungeon }) {
  const mountRef = useRef(null);
  const rendererRef = useRef(null);
  const materialRef = useRef(null);
  const keysRef = useRef({
    forward: false,
    backward: false,
    strafeLeft: false,
    strafeRight: false,
    turnLeft: false,
    turnRight: false
  });
  const angleRef = useRef(Math.PI); // facing left initially
  
  // Generate procedural dungeon using BSP algorithm
  const dungeon = useMemo(() => {
    const size = gameData?.dungeon?.size || MAP_SIZE;
    const minRoomSize = 4;
    const maxRoomSize = 8;
    const recursionDepth = 4;
    
    return generateDungeon(size, minRoomSize, maxRoomSize, recursionDepth);
  }, [gameData?.dungeon?.size]);
  
  const playerRef = useRef({
    x: dungeon.playerStart.x,
    y: dungeon.playerStart.y,
    dirX: -1,
    dirY: 0,
    planeX: 0,
    planeY: 0.66,
    health: 100,
    maxHealth: 100
  });
  const rafIdRef = useRef(0);
  
  // Enemy manager
  const enemyManagerRef = useRef(new EnemyManager());
  const [enemiesSpawned, setEnemiesSpawned] = useState(false);
  
  // Sprite rendering
  const spriteTexturesRef = useRef({});
  const spriteMeshesRef = useRef([]);
  const zBufferRef = useRef(null);
  const spriteCtxRef = useRef(null);
  const spriteCanvasElementRef = useRef(null);
  
  // Combat system
  const combatManagerRef = useRef(new CombatManager('pistol'));
  const [crosshairColor, setCrosshairColor] = useState('#ffffff');
  const [weaponSprite, setWeaponSprite] = useState(null);
  
  // Minimap
  const minimapCanvasRef = useRef(null);
  const [minimapVisible, setMinimapVisible] = useState(false);
  
  // Screen flash effects
  const [flashOpacity, setFlashOpacity] = useState(0);
  const [flashColor, setFlashColor] = useState('rgba(255, 255, 255, 0.3)');
  const [muzzleFlash, setMuzzleFlash] = useState(false);
  const [weaponRecoil, setWeaponRecoil] = useState(0);
  
  // Camera shake
  const shakeRef = useRef({ x: 0, y: 0, angle: 0, intensity: 0 });
  
  // Shop system
  const [shopOpen, setShopOpen] = useState(false);
  const [playerGold, setPlayerGold] = useState(100); // Starting gold
  const [inventory, setInventory] = useState([]);
  const gamePausedRef = useRef(false);
  const npcPositionRef = useRef(null);
  
  // Level completion
  const [levelComplete, setLevelComplete] = useState(false);
  const [completionStats, setCompletionStats] = useState(null);
  const startTimeRef = useRef(Date.now());
  
  // Game over
  const [gameOver, setGameOver] = useState(false);
  const [gameOverStats, setGameOverStats] = useState(null);
  
  // Story intro
  const [showStoryIntro, setShowStoryIntro] = useState(true);
  
  const mapData = dungeon.mapData;
  const mapSize = dungeon.size;
  
  // Save game to database
  const saveGameToDatabase = async (stats, completed = false) => {
    try {
      const playerId = getPlayerId();
      const prompt = sessionStorage.getItem('lastPrompt') || '';
      
      const response = await fetch('http://localhost:5001/api/save-game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_id: playerId,
          prompt: prompt,
          game_data: gameData,
          level_number: 1, // TODO: Track actual level number in campaign
          completed: completed,
          gold: stats.gold,
          kills: stats.kills,
          time_elapsed: stats.timeElapsed
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('Game saved successfully:', result);
      } else {
        console.error('Failed to save game');
      }
    } catch (error) {
      console.error('Error saving game:', error);
    }
  };
  
  useEffect(() => {
    if (!gameData || !mountRef.current) return;
    
    // Reset story intro for new level
    setShowStoryIntro(true);
    
    const mount = mountRef.current;
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    // Setup Three.js with depth buffer
    const renderer = new THREE.WebGLRenderer({ 
      antialias: false, 
      powerPreference: 'high-performance',
      depth: true,
      stencil: false
    });
    renderer.setSize(width, height);
    renderer.outputEncoding = THREE.sRGBEncoding;
    rendererRef.current = renderer;
    
    // Clear only if needed, don't use innerHTML
    while (mount.firstChild) {
      mount.removeChild(mount.firstChild);
    }
    mount.appendChild(renderer.domElement);
    
    // Create sprite canvas overlay for 2D sprite rendering (like wofl3d)
    const spriteCanvas = document.createElement('canvas');
    spriteCanvas.width = width;
    spriteCanvas.height = height;
    spriteCanvas.style.position = 'absolute';
    spriteCanvas.style.top = '0';
    spriteCanvas.style.left = '0';
    spriteCanvas.style.pointerEvents = 'none';
    spriteCanvas.style.zIndex = '10';
    spriteCanvas.style.transition = 'transform 0.05s ease-out';
    mount.appendChild(spriteCanvas);
    const spriteCtx = spriteCanvas.getContext('2d');
    
    // Store references for shake effect and retry clearing
    const spriteCanvasRef = { current: spriteCanvas };
    spriteCtxRef.current = spriteCtx;
    spriteCanvasElementRef.current = spriteCanvas;
    
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    
    // Create a separate scene and camera for sprites (3D perspective)
    const spriteScene = new THREE.Scene();
    const spriteCamera = new THREE.PerspectiveCamera(75, width / height, 0.01, 1000);
    spriteCamera.position.set(0, 0, 0);
    
    // Create invisible wall geometry for depth buffer
    const wallGeometries = [];
    const wallMaterial = new THREE.MeshBasicMaterial({ 
      colorWrite: false, // Don't write color, only depth
      depthWrite: true,
      depthTest: true
    });
    
    // Create walls from map data
    for (let y = 0; y < mapSize; y++) {
      for (let x = 0; x < mapSize; x++) {
        const cellType = mapData[y * mapSize + x];
        if (cellType > 0) {
          // Create a wall cube at this position
          const wallGeometry = new THREE.BoxGeometry(1, 2, 1);
          const wallMesh = new THREE.Mesh(wallGeometry, wallMaterial);
          wallMesh.position.set(x + 0.5, 1, y + 0.5);
          spriteScene.add(wallMesh);
          wallGeometries.push(wallMesh);
        }
      }
    }
    
    // Keyboard input handlers
    const onKeyDown = (e) => {
      if (e.key === 'w' || e.key === 'ArrowUp') keysRef.current.forward = true;
      if (e.key === 's' || e.key === 'ArrowDown') keysRef.current.backward = true;
      if (e.key === 'a') keysRef.current.strafeLeft = true;
      if (e.key === 'd') keysRef.current.strafeRight = true;
      if (e.key === 'ArrowLeft') keysRef.current.turnLeft = true;
      if (e.key === 'ArrowRight') keysRef.current.turnRight = true;
      
      // E key to open shop when near NPC
      if (e.key === 'e' || e.key === 'E') {
        if (npcPositionRef.current && !shopOpen) {
          const p = playerRef.current;
          const dx = p.x - npcPositionRef.current.x;
          const dy = p.y - npcPositionRef.current.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          console.log(`NPC at (${npcPositionRef.current.x}, ${npcPositionRef.current.y}), Player at (${p.x}, ${p.y}), Distance: ${dist.toFixed(2)}`);
          
          if (dist < 2.5) { // Within 2.5 tiles of NPC
            // Release pointer lock to allow UI interaction
            if (document.pointerLockElement) {
              document.exitPointerLock();
              console.log('Pointer lock released');
            }
            // Use setTimeout to ensure pointer lock is released before opening shop
            setTimeout(() => {
              setShopOpen(true);
              gamePausedRef.current = true;
              console.log('Shop opened');
            }, 100);
          } else {
            console.log('Too far from NPC to open shop');
          }
        }
      }
      
      // ESC key to close shop (only if not in pointer lock)
      if (e.key === 'Escape') {
        if (shopOpen) {
          setShopOpen(false);
          gamePausedRef.current = false;
        }
      }
    };
    
    const onKeyUp = (e) => {
      if (e.key === 'w' || e.key === 'ArrowUp') keysRef.current.forward = false;
      if (e.key === 's' || e.key === 'ArrowDown') keysRef.current.backward = false;
      if (e.key === 'a') keysRef.current.strafeLeft = false;
      if (e.key === 'd') keysRef.current.strafeRight = false;
      if (e.key === 'ArrowLeft') keysRef.current.turnLeft = false;
      if (e.key === 'ArrowRight') keysRef.current.turnRight = false;
    };
    
    // Click to shoot or lock pointer
    const onClick = (e) => {
      if (document.pointerLockElement) {
        // Shoot
        const p = playerRef.current;
        const enemies = enemyManagerRef.current.getAliveEnemies();
        const result = combatManagerRef.current.shoot(p.x, p.y, p.dirX, p.dirY, enemies, mapData, mapSize);
        
        if (result.fired) {
          // White flash when shooting
          setFlashColor('rgba(255, 255, 255, 0.3)');
          setFlashOpacity(1);
          setTimeout(() => {
            setFlashOpacity(0);
            setTimeout(() => setFlashColor(null), 150);
          }, 50);
          
          // Muzzle flash
          setMuzzleFlash(true);
          setTimeout(() => setMuzzleFlash(false), 100);
          
          // Weapon recoil (stronger if hit)
          const recoilAmount = result.hit ? 30 : 20;
          setWeaponRecoil(recoilAmount);
          setTimeout(() => setWeaponRecoil(0), result.hit ? 120 : 100);
          
          if (result.hit) {
            console.log(`Hit enemy! Damage: ${result.damage}, Died: ${result.died}`);
            if (result.died) {
              console.log(`Enemy killed! Total kills: ${combatManagerRef.current.kills}`);
              // Award gold for killing enemy
              const goldDrop = Math.floor(Math.random() * 20) + 10; // 10-30 gold
              setPlayerGold(prev => prev + goldDrop);
              console.log(`+${goldDrop} gold!`);
            }
          } else {
            console.log('Missed!');
          }
        }
      } else {
        // Lock pointer
        renderer.domElement.requestPointerLock();
      }
    };
    
    // Space bar to shoot
    const onKeyPress = (e) => {
      if (e.key === ' ' && document.pointerLockElement) {
        e.preventDefault();
        const p = playerRef.current;
        const enemies = enemyManagerRef.current.getAliveEnemies();
        const result = combatManagerRef.current.shoot(p.x, p.y, p.dirX, p.dirY, enemies, mapData, mapSize);
        
        if (result.fired) {
          // White flash when shooting
          setFlashColor('rgba(255, 255, 255, 0.3)');
          setFlashOpacity(1);
          setTimeout(() => {
            setFlashOpacity(0);
            setTimeout(() => setFlashColor(null), 150);
          }, 50);
          
          // Muzzle flash
          setMuzzleFlash(true);
          setTimeout(() => setMuzzleFlash(false), 100);
          
          // Weapon recoil (stronger if hit)
          const recoilAmount = result.hit ? 30 : 20;
          setWeaponRecoil(recoilAmount);
          setTimeout(() => setWeaponRecoil(0), result.hit ? 120 : 100);
          
          if (result.hit) {
            console.log(`Hit! Damage: ${result.damage}`);
            if (result.died) {
              // Award gold for killing enemy
              const goldDrop = Math.floor(Math.random() * 20) + 10; // 10-30 gold
              setPlayerGold(prev => prev + goldDrop);
              console.log(`+${goldDrop} gold!`);
            }
          }
        }
      }
    };
    
    // Mouse move for looking
    const onMouseMove = (e) => {
      if (document.pointerLockElement) {
        const sensitivity = 0.002;
        angleRef.current += e.movementX * sensitivity; // Fixed: was -= now +=
      }
    };
    
    // Register event listeners
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('keydown', onKeyPress);
    renderer.domElement.addEventListener('click', onClick);
    window.addEventListener('mousemove', onMouseMove);
    
    // Create map texture
    const mapTex = new THREE.DataTexture(
      mapData,
      mapSize,
      mapSize,
      THREE.RedFormat,
      THREE.UnsignedByteType
    );
    mapTex.needsUpdate = true;
    mapTex.minFilter = THREE.NearestFilter;
    mapTex.magFilter = THREE.NearestFilter;
    
    // Load textures
    const loadTextures = async () => {
      let wallAtlas, floorTex, ceilTex;
      
      // Try to load AI textures
      if (gameData.textures && gameData.textures.length > 0) {
        const wallTextures = gameData.textures.filter(t => t.id.startsWith('wall_'));
        const floorTexture = gameData.textures.find(t => t.id === 'floor');
        
        if (wallTextures.length > 0) {
          // Create wall atlas
          const atlasCanvas = document.createElement('canvas');
          const texSize = 64;
          atlasCanvas.width = texSize * wallTextures.length;
          atlasCanvas.height = texSize;
          const ctx = atlasCanvas.getContext('2d');
          
          for (let i = 0; i < wallTextures.length; i++) {
            try {
              const canvas = await loadTextureToCanvas(wallTextures[i].url);
              ctx.drawImage(canvas, i * texSize, 0, texSize, texSize);
            } catch (e) {
              // Use solid color on error
              ctx.fillStyle = ['#964B4B', '#4B9664', '#4B6496'][i % 3];
              ctx.fillRect(i * texSize, 0, texSize, texSize);
            }
          }
          
          wallAtlas = new THREE.CanvasTexture(atlasCanvas);
        }
        
        if (floorTexture) {
          try {
            const canvas = await loadTextureToCanvas(floorTexture.url);
            floorTex = new THREE.CanvasTexture(canvas);
          } catch (e) {
            console.error('Floor texture load failed:', e);
          }
        }
      }
      
      // Create fallback textures if needed
      if (!wallAtlas) {
        const atlasCanvas = document.createElement('canvas');
        atlasCanvas.width = 64 * 3;
        atlasCanvas.height = 64;
        const ctx = atlasCanvas.getContext('2d');
        ctx.fillStyle = '#964B4B'; ctx.fillRect(0, 0, 64, 64);
        ctx.fillStyle = '#4B9664'; ctx.fillRect(64, 0, 64, 64);
        ctx.fillStyle = '#4B6496'; ctx.fillRect(128, 0, 64, 64);
        wallAtlas = new THREE.CanvasTexture(atlasCanvas);
      }
      
      if (!floorTex) {
        const floorCanvas = document.createElement('canvas');
        floorCanvas.width = 64;
        floorCanvas.height = 64;
        const ctx = floorCanvas.getContext('2d');
        ctx.fillStyle = '#333333';
        ctx.fillRect(0, 0, 64, 64);
        floorTex = new THREE.CanvasTexture(floorCanvas);
      }
      
      if (!ceilTex) {
        const ceilCanvas = document.createElement('canvas');
        ceilCanvas.width = 64;
        ceilCanvas.height = 64;
        const ctx = ceilCanvas.getContext('2d');
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, 64, 64);
        ceilTex = new THREE.CanvasTexture(ceilCanvas);
      }
      
      wallAtlas.minFilter = THREE.NearestFilter;
      wallAtlas.magFilter = THREE.NearestFilter;
      floorTex.minFilter = THREE.NearestFilter;
      floorTex.magFilter = THREE.NearestFilter;
      floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
      ceilTex.minFilter = THREE.NearestFilter;
      ceilTex.magFilter = THREE.NearestFilter;
      ceilTex.wrapS = ceilTex.wrapT = THREE.RepeatWrapping;
      
      // Spawn enemies and load sprite textures if not already spawned
      if (!enemiesSpawned && gameData?.enemies) {
        const spawnPositions = getEnemySpawnPositions(
          dungeon.rooms,
          dungeon.playerStart,
          dungeon.exit,
          Math.min(gameData.enemies.length, 10) // 5-10 enemies
        );
        
        enemyManagerRef.current.spawnEnemies(spawnPositions, gameData.enemies);
        setEnemiesSpawned(true);
        console.log('Enemies spawned:', enemyManagerRef.current.getAllEnemies().length);
        
        // Initialize NPC position
        const npcPos = getNPCSpawnPosition(dungeon.rooms);
        npcPositionRef.current = npcPos;
        console.log('NPC spawned at:', npcPos);
        
        // Load sprite textures from AI-generated sprites
        if (gameData.sprites && gameData.sprites.length > 0) {
          console.log('Loading sprite textures...');
          const loadSprites = async () => {
            for (const spriteData of gameData.sprites) {
              try {
                const img = new Image();
                img.crossOrigin = 'anonymous'; // Allow cross-origin images
                
                await new Promise((resolve, reject) => {
                  img.onload = () => {
                    console.log(`Image loaded for ${spriteData.id} (type: ${spriteData.type}): ${img.width}x${img.height}`);
                    resolve();
                  };
                  img.onerror = (e) => {
                    console.error(`Image load error for ${spriteData.id}:`, e);
                    reject(e);
                  };
                  img.src = spriteData.sprite_sheet;
                });
                
                // Verify image loaded
                if (img.width === 0 || img.height === 0) {
                  console.error(`Invalid image dimensions for ${spriteData.id}`);
                  continue;
                }
                
                // Split sprite sheet into 4 directions or use single sprite
                // gpt-image-1 generates 1024x1024 with 4 sprites in 2x2 grid
                if (spriteData.frame_count === 4) {
                  // 2x2 grid layout
                  const frameWidth = img.width / 2;  // 2 columns
                  const frameHeight = img.height / 2; // 2 rows
                  const frames = [];
                  
                  console.log(`Splitting 2x2 sprite sheet for ${spriteData.id}: ${img.width}x${img.height} into 4 frames of ${frameWidth}x${frameHeight}`);
                  
                  // Frame positions in 2x2 grid:
                  // [0: Front (top-left)] [1: Back (top-right)]
                  // [2: Left (bottom-left)] [3: Right (bottom-right)]
                  const positions = [
                    { x: 0, y: 0 },           // 0: Front (top-left)
                    { x: frameWidth, y: 0 },  // 1: Back (top-right)
                    { x: 0, y: frameHeight }, // 2: Left (bottom-left)
                    { x: frameWidth, y: frameHeight } // 3: Right (bottom-right)
                  ];
                  
                  for (let i = 0; i < 4; i++) {
                    const canvas = document.createElement('canvas');
                    canvas.width = frameWidth;
                    canvas.height = frameHeight;
                    const ctx = canvas.getContext('2d');
                    
                    // Draw this frame from the 2x2 grid
                    ctx.drawImage(
                      img,
                      positions[i].x, positions[i].y, frameWidth, frameHeight,
                      0, 0, frameWidth, frameHeight
                    );
                    
                    frames[i] = canvas;
                    
                    // Verify content
                    const imageData = ctx.getImageData(0, 0, Math.min(10, frameWidth), Math.min(10, frameHeight));
                    const hasContent = imageData.data.some(v => v !== 0);
                    console.log(`  Frame ${i} (${frameWidth}x${frameHeight}): hasContent=${hasContent}`);
                  }
                  
                  // Store by both ID and type for flexible lookup
                  spriteTexturesRef.current[spriteData.id] = frames;
                  if (spriteData.type) {
                    spriteTexturesRef.current[spriteData.type] = frames;
                  }
                } else {
                  // Single omnidirectional sprite
                  const canvas = document.createElement('canvas');
                  canvas.width = img.width;
                  canvas.height = img.height;
                  const ctx = canvas.getContext('2d');
                  ctx.drawImage(img, 0, 0);
                  
                  // Use same sprite for all 4 directions
                  const frames = [canvas, canvas, canvas, canvas];
                  spriteTexturesRef.current[spriteData.id] = frames;
                  if (spriteData.type) {
                    spriteTexturesRef.current[spriteData.type] = frames;
                  }
                  
                  console.log(`Single sprite for ${spriteData.id}: ${canvas.width}x${canvas.height}`);
                }
                
                console.log(`Loaded sprite: ${spriteData.id} (type: ${spriteData.type})`);
              } catch (error) {
                console.error(`Failed to load sprite ${spriteData.id}:`, error);
              }
            }
            console.log('All sprites loaded:', Object.keys(spriteTexturesRef.current));
            
            console.log(`Sprites loaded and ready for 2D canvas rendering`);
          };
          loadSprites();
        }
        
        // Load weapon sprite from pre-generated data
        if (gameData.weaponSprite) {
          const img = new Image();
          img.onload = () => {
            setWeaponSprite(img);
            console.log('Weapon sprite loaded:', img.width, 'x', img.height);
          };
          img.onerror = (error) => {
            console.error('Failed to load weapon sprite:', error);
          };
          img.src = gameData.weaponSprite;
        } else {
          console.warn('No weapon sprite in game data');
        }
      }
      
      // Create shader (adapted from wofl3d)
      const vertexShader = `
        precision highp float;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `;
      
      const fragmentShader = `
        precision highp float;
        varying vec2 vUv;
        uniform vec2 uResolution;
        uniform vec2 uPlayerPos;
        uniform vec2 uDir;
        uniform vec2 uPlane;
        uniform sampler2D uMapTex;
        uniform vec2 uMapSize;
        uniform sampler2D uWallAtlas;
        uniform sampler2D uFloorTex;
        uniform sampler2D uCeilTex;
        uniform float uAtlasCount;
        uniform float uFloorScale;
        uniform float uCeilScale;
        
        float mapCell(vec2 cell) {
          vec2 uv = (cell + 0.5) / uMapSize;
          float r = texture2D(uMapTex, uv).r;
          return floor(r * 255.0 + 0.5);
        }
        
        void main() {
          float x = vUv.x * uResolution.x;
          float y = (1.0 - vUv.y) * uResolution.y;
          float cameraX = 2.0 * x / uResolution.x - 1.0;
          vec2 rayDir = uDir + uPlane * cameraX;
          
          // DDA
          ivec2 mapPos = ivec2(int(floor(uPlayerPos.x)), int(floor(uPlayerPos.y)));
          vec2 deltaDist = abs(1.0 / rayDir);
          vec2 sideDist;
          ivec2 step;
          
          if (rayDir.x < 0.0) {
            step.x = -1;
            sideDist.x = (uPlayerPos.x - float(mapPos.x)) * deltaDist.x;
          } else {
            step.x = 1;
            sideDist.x = (float(mapPos.x + 1) - uPlayerPos.x) * deltaDist.x;
          }
          
          if (rayDir.y < 0.0) {
            step.y = -1;
            sideDist.y = (uPlayerPos.y - float(mapPos.y)) * deltaDist.y;
          } else {
            step.y = 1;
            sideDist.y = (float(mapPos.y + 1) - uPlayerPos.y) * deltaDist.y;
          }
          
          int side = 0;
          bool hit = false;
          float cellType = 0.0;
          
          for (int i = 0; i < 96; i++) {
            if (sideDist.x < sideDist.y) {
              sideDist.x += deltaDist.x;
              mapPos.x += step.x;
              side = 0;
            } else {
              sideDist.y += deltaDist.y;
              mapPos.y += step.y;
              side = 1;
            }
            
            if (mapPos.x < 0 || mapPos.x >= int(uMapSize.x) || mapPos.y < 0 || mapPos.y >= int(uMapSize.y)) break;
            cellType = mapCell(vec2(float(mapPos.x), float(mapPos.y)));
            if (cellType > 0.5) {
              hit = true;
              break;
            }
          }
          
          float perpWallDist = 1e9;
          if (hit) {
            if (side == 0) perpWallDist = (float(mapPos.x) - uPlayerPos.x + float(1 - step.x) * 0.5) / rayDir.x;
            else perpWallDist = (float(mapPos.y) - uPlayerPos.y + float(1 - step.y) * 0.5) / rayDir.y;
          }
          
          float lineHeight = uResolution.y / max(perpWallDist, 0.0001);
          float drawStart = -lineHeight * 0.5 + uResolution.y * 0.5;
          float drawEnd = lineHeight * 0.5 + uResolution.y * 0.5;
          
          // Render ceiling
          if (y < min(drawStart, uResolution.y)) {
            float denom = (uResolution.y * 0.5) - y;
            float currentDist = uResolution.y / max(2.0 * denom, 0.0001);
            vec2 worldPos = uPlayerPos + rayDir * currentDist;
            vec2 tUv = fract(worldPos / uCeilScale);
            vec4 c = texture2D(uCeilTex, tUv);
            gl_FragColor = vec4(c.rgb * 0.5, 1.0);
            return;
          }
          
          // Render floor
          if (y > max(drawEnd, 0.0)) {
            float denom = 2.0 * y - uResolution.y;
            float currentDist = uResolution.y / max(denom, 0.0001);
            vec2 worldPos = uPlayerPos + rayDir * currentDist;
            vec2 tUv = fract(worldPos / uFloorScale);
            vec4 c = texture2D(uFloorTex, tUv);
            gl_FragColor = vec4(c.rgb * 0.7, 1.0);
            return;
          }
          
          // Render wall
          if (hit) {
            // Check if this is an exit portal (tile type 9)
            bool isExitPortal = cellType > 8.5 && cellType < 9.5;
            
            if (isExitPortal) {
              // Render floor/ceiling through the portal with translucent overlay
              // Render floor
              float denom = 2.0 * y - uResolution.y;
              float currentDist = uResolution.y / max(denom, 0.0001);
              vec2 worldPos = uPlayerPos + rayDir * currentDist;
              vec2 tUv = fract(worldPos / uFloorScale);
              vec4 floorColor = texture2D(uFloorTex, tUv);
              
              // Add glowing portal effect
              float pulse = 0.5 + 0.3 * sin(float(gl_FragCoord.x + gl_FragCoord.y) * 0.1);
              vec3 portalGlow = vec3(1.0, 0.9, 0.3) * pulse; // Yellow/gold glow
              
              // Mix floor with portal glow (60% transparent)
              gl_FragColor = vec4(mix(floorColor.rgb * 0.7, portalGlow, 0.4), 1.0);
            } else {
              float wallX;
              if (side == 0) wallX = uPlayerPos.y + perpWallDist * rayDir.y;
              else wallX = uPlayerPos.x + perpWallDist * rayDir.x;
              wallX -= floor(wallX);
              
              float texX = wallX * 64.0;
              float texY = ((y - drawStart) / max(lineHeight, 0.0001)) * 64.0;
              
              float atlasIndex = clamp(cellType - 1.0, 0.0, uAtlasCount - 1.0);
              float atlasWidth = 64.0 * uAtlasCount;
              float u = (texX + atlasIndex * 64.0) / atlasWidth;
              float v = texY / 64.0;
              
              vec4 color = texture2D(uWallAtlas, vec2(u, v));
              
              // Side shading
              if (side == 1) color.rgb *= 0.7;
              
              // Distance fog
              float fog = clamp(1.0 - perpWallDist / 20.0, 0.3, 1.0);
              color.rgb *= fog;
              
              gl_FragColor = vec4(color.rgb, 1.0);
            }
          } else {
            gl_FragColor = vec4(0.1, 0.1, 0.1, 1.0);
          }
        }
      `;
      
      const uniforms = {
        uResolution: { value: new THREE.Vector2(width, height) },
        uPlayerPos: { value: new THREE.Vector2(playerRef.current.x, playerRef.current.y) },
        uDir: { value: new THREE.Vector2(playerRef.current.dirX, playerRef.current.dirY) },
        uPlane: { value: new THREE.Vector2(playerRef.current.planeX, playerRef.current.planeY) },
        uMapTex: { value: mapTex },
        uMapSize: { value: new THREE.Vector2(mapSize, mapSize) },
        uWallAtlas: { value: wallAtlas },
        uFloorTex: { value: floorTex },
        uCeilTex: { value: ceilTex },
        uAtlasCount: { value: 3 },
        uFloorScale: { value: 4.0 },
        uCeilScale: { value: 4.0 }
      };
      
      const material = new THREE.ShaderMaterial({
        uniforms,
        vertexShader,
        fragmentShader
      });
      materialRef.current = material;
      
      const geometry = new THREE.PlaneGeometry(2, 2);
      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);
      
      // Animation loop with movement (like wofl3d)
      let lastTime = performance.now();
      const animate = (now) => {
        const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
        lastTime = now;
        
        // Pause game when shop is open or game over
        if (gamePausedRef.current) {
          rafIdRef.current = requestAnimationFrame(animate);
          return;
        }
        
        // Get current player state
        const p = playerRef.current;
        let x = p.x;
        let y = p.y;
        
        // Update orientation from angle (mouse look + arrow keys + shake)
        const rotSpeed = 3.0;
        const inputTurn = (keysRef.current.turnRight ? 1 : 0) + (keysRef.current.turnLeft ? -1 : 0);
        angleRef.current += inputTurn * rotSpeed * dt;
        
        // Apply shake to angle
        const shakenAngle = angleRef.current + shakeRef.current.angle;
        
        const c = Math.cos(shakenAngle);
        const s = Math.sin(shakenAngle);
        const dirX = c;
        const dirY = s;
        const planeX = -s * 0.66;
        const planeY = c * 0.66;
        
        // Movement speed
        const walkSpeed = 3.0;
        
        // Forward/backward
        const inputMove = (keysRef.current.forward ? 1 : 0) + (keysRef.current.backward ? -1 : 0);
        if (inputMove !== 0) {
          const step = inputMove * walkSpeed * dt;
          const tx = x + dirX * step;
          const ty = y + dirY * step;
          // Check collision (allow movement through floor tiles and exit portal)
          const mapIdx = Math.floor(ty) * mapSize + Math.floor(tx);
          const tileType = mapData[mapIdx];
          if (tileType === 0 || tileType === 9) { // 0 = floor, 9 = exit portal
            x = tx;
            y = ty;
          }
        }
        
        // Strafing (A/D) - swapped to fix inversion
        const inputStrafe = (keysRef.current.strafeLeft ? 1 : 0) + (keysRef.current.strafeRight ? -1 : 0);
        if (inputStrafe !== 0) {
          const step = inputStrafe * walkSpeed * dt;
          // Right vector = (dirY, -dirX)
          const rx = dirY;
          const ry = -dirX;
          const tx = x + rx * step;
          const ty = y + ry * step;
          const mapIdx = Math.floor(ty) * mapSize + Math.floor(tx);
          const tileType = mapData[mapIdx];
          if (tileType === 0 || tileType === 9) { // 0 = floor, 9 = exit portal
            x = tx;
            y = ty;
          }
        }
        
        // Update player ref
        playerRef.current.x = x;
        playerRef.current.y = y;
        playerRef.current.dirX = dirX;
        playerRef.current.dirY = dirY;
        playerRef.current.planeX = planeX;
        playerRef.current.planeY = planeY;
        
        // Check if player reached exit portal (tile type 9)
        const playerTileX = Math.floor(x);
        const playerTileY = Math.floor(y);
        const playerTileIdx = playerTileY * mapSize + playerTileX;
        
        if (mapData[playerTileIdx] === 9 && !levelComplete) {
          // Player reached exit - complete level
          const timeElapsed = (Date.now() - startTimeRef.current) / 1000;
          const stats = {
            kills: combatManagerRef.current?.kills || 0,
            gold: playerGold,
            timeElapsed: timeElapsed,
            healthRemaining: playerRef.current.health,
            itemsPurchased: inventory.length
          };
          
          setCompletionStats(stats);
          setLevelComplete(true);
          gamePausedRef.current = true;
          
          // Release pointer lock
          if (document.pointerLockElement) {
            document.exitPointerLock();
          }
          
          // Save game to database
          saveGameToDatabase(stats, true);
          
          console.log('Level complete!');
          return; // Stop game loop
        }
        
        // Update enemies (pass dt in seconds for consistency)
        const damage = enemyManagerRef.current.update(
          x, y, mapData, mapSize, dt
        );
        
        // Apply damage to player
        if (damage > 0) {
          playerRef.current.health = Math.max(0, playerRef.current.health - damage);
          console.log(`Player took ${damage} damage! Health: ${playerRef.current.health}`);
          
          // Damage flash effect
          setFlashColor('rgba(255, 0, 0, 0.4)');
          setFlashOpacity(1);
          setTimeout(() => setFlashOpacity(0), 200);
          
          // Check if player died
          if (playerRef.current.health <= 0 && !gameOver) {
            const timeElapsed = (Date.now() - startTimeRef.current) / 1000;
            setGameOverStats({
              kills: combatManagerRef.current?.kills || 0,
              gold: playerGold,
              timeElapsed: timeElapsed,
              itemsPurchased: inventory.length
            });
            setGameOver(true);
            gamePausedRef.current = true;
            
            // Release pointer lock
            if (document.pointerLockElement) {
              document.exitPointerLock();
            }
            
            console.log('Game Over!');
            return; // Stop game loop
          }
          
          // Red flash when taking damage
          setFlashColor('rgba(255, 0, 0, 0.5)');
          setFlashOpacity(1);
          setTimeout(() => {
            setFlashOpacity(0);
            setTimeout(() => setFlashColor(null), 300);
          }, 100);
          
          // Camera shake when taking damage
          shakeRef.current.intensity = damage / 10; // Intensity based on damage
        }
        
        // Update crosshair color based on aim (with wall collision)
        const crosshairState = getCrosshairState(x, y, dirX, dirY, enemyManagerRef.current.getAliveEnemies(), mapData, mapSize);
        setCrosshairColor(crosshairState.color);
        
        // Update minimap
        if (minimapCanvasRef.current) {
          const minimapCtx = minimapCanvasRef.current.getContext('2d');
          if (minimapCtx) {
            const minimapSize = 200;
            const scale = minimapSize / mapSize;
            
            // Clear minimap
            minimapCtx.fillStyle = '#000000';
            minimapCtx.fillRect(0, 0, minimapSize, minimapSize);
            
            // Draw walls
            minimapCtx.fillStyle = '#666666';
            for (let my = 0; my < mapSize; my++) {
              for (let mx = 0; mx < mapSize; mx++) {
                if (mapData[my * mapSize + mx] > 0) {
                  minimapCtx.fillRect(mx * scale, my * scale, scale, scale);
                }
              }
            }
            
            // Draw enemies
            const enemies = enemyManagerRef.current.getAllEnemies();
            for (const enemy of enemies) {
              if (enemy.isAlive()) {
                minimapCtx.fillStyle = '#ff0000';
                minimapCtx.beginPath();
                minimapCtx.arc(enemy.x * scale, enemy.y * scale, 4, 0, Math.PI * 2);
                minimapCtx.fill();
              }
            }
            
            // Draw NPC (cyan marker)
            if (npcPositionRef.current) {
              minimapCtx.fillStyle = '#00ffff'; // Cyan for NPC
              minimapCtx.beginPath();
              minimapCtx.arc(npcPositionRef.current.x * scale, npcPositionRef.current.y * scale, 5, 0, Math.PI * 2);
              minimapCtx.fill();
              // Add a ring around NPC
              minimapCtx.strokeStyle = '#00ffff';
              minimapCtx.lineWidth = 2;
              minimapCtx.beginPath();
              minimapCtx.arc(npcPositionRef.current.x * scale, npcPositionRef.current.y * scale, 8, 0, Math.PI * 2);
              minimapCtx.stroke();
            }
            
            // Draw exit portal (yellow/gold star)
            if (dungeon.exit) {
              const exitX = dungeon.exit.x * scale;
              const exitY = dungeon.exit.y * scale;
              
              // Pulsing glow effect
              const pulseSize = 6 + Math.sin(Date.now() / 300) * 2;
              
              // Outer glow
              minimapCtx.fillStyle = '#fbbf2480'; // Semi-transparent yellow
              minimapCtx.beginPath();
              minimapCtx.arc(exitX, exitY, pulseSize + 4, 0, Math.PI * 2);
              minimapCtx.fill();
              
              // Inner star
              minimapCtx.fillStyle = '#fbbf24'; // Yellow for exit
              minimapCtx.beginPath();
              minimapCtx.arc(exitX, exitY, pulseSize, 0, Math.PI * 2);
              minimapCtx.fill();
              
              // Draw star shape
              minimapCtx.fillStyle = '#ffffff';
              minimapCtx.font = 'bold 12px Arial';
              minimapCtx.textAlign = 'center';
              minimapCtx.textBaseline = 'middle';
              minimapCtx.fillText('★', exitX, exitY);
            }
            
            // Draw player
            minimapCtx.fillStyle = '#00ff00';
            minimapCtx.beginPath();
            minimapCtx.arc(x * scale, y * scale, 5, 0, Math.PI * 2);
            minimapCtx.fill();
            
            // Draw player direction
            minimapCtx.strokeStyle = '#00ff00';
            minimapCtx.lineWidth = 2;
            minimapCtx.beginPath();
            minimapCtx.moveTo(x * scale, y * scale);
            minimapCtx.lineTo((x + dirX * 2) * scale, (y + dirY * 2) * scale);
            minimapCtx.stroke();
          }
        }
        
        // Notify parent (throttled)
        if (onPlayerMove && Math.random() < 0.1) {
          onPlayerMove({ 
            x, y, 
            health: playerRef.current.health,
            enemiesAlive: enemyManagerRef.current.getAliveEnemies().length,
            kills: combatManagerRef.current.kills
          });
        }
        
        // Apply camera shake (more random, includes rotation)
        if (shakeRef.current.intensity > 0) {
          // Random shake offset in all directions (exaggerated vertical)
          shakeRef.current.x = (Math.random() - 0.5) * shakeRef.current.intensity * 0.15;
          shakeRef.current.y = (Math.random() - 0.5) * shakeRef.current.intensity * 0.3; // 2x vertical shake
          shakeRef.current.angle = (Math.random() - 0.5) * shakeRef.current.intensity * 0.05;
          
          // Apply shake to sprite canvas overlay
          if (spriteCanvasRef.current) {
            const shakePixelsX = shakeRef.current.x * 100; // Convert to pixels
            const shakePixelsY = shakeRef.current.y * 100;
            const shakeAngleDeg = shakeRef.current.angle * (180 / Math.PI);
            spriteCanvasRef.current.style.transform = 
              `translate(${shakePixelsX}px, ${shakePixelsY}px) rotate(${shakeAngleDeg}deg)`;
          }
          
          // Decay shake intensity
          shakeRef.current.intensity *= 0.88; // Slightly slower decay for more shake
          
          // Stop shake when intensity is very low
          if (shakeRef.current.intensity < 0.01) {
            shakeRef.current.intensity = 0;
            shakeRef.current.x = 0;
            shakeRef.current.y = 0;
            shakeRef.current.angle = 0;
            
            // Reset sprite canvas transform
            if (spriteCanvasRef.current) {
              spriteCanvasRef.current.style.transform = 'none';
            }
          }
        }
        
        // Update shader uniforms with shake offset
        if (materialRef.current) {
          materialRef.current.uniforms.uPlayerPos.value.set(
            x + shakeRef.current.x, 
            y + shakeRef.current.y
          );
          materialRef.current.uniforms.uDir.value.set(dirX, dirY);
          materialRef.current.uniforms.uPlane.value.set(planeX, planeY);
        }
        
        // Build Z-buffer for sprite occlusion (simple raycasting per column)
        if (!zBufferRef.current || zBufferRef.current.length !== width) {
          zBufferRef.current = new Float32Array(width);
        }
        const zbuf = zBufferRef.current;
        
        // Compute Z-buffer by raycasting each screen column (with shake offset)
        const shakeX = x + shakeRef.current.x;
        const shakeY = y + shakeRef.current.y;
        
        for (let screenX = 0; screenX < width; screenX++) {
          const cameraX = 2 * screenX / width - 1;
          const rayDirX = dirX + planeX * cameraX;
          const rayDirY = dirY + planeY * cameraX;
          
          let mapX = Math.floor(shakeX);
          let mapY = Math.floor(shakeY);
          
          const deltaDistX = Math.abs(1 / rayDirX);
          const deltaDistY = Math.abs(1 / rayDirY);
          
          let sideDistX, sideDistY;
          let stepX, stepY;
          
          if (rayDirX < 0) {
            stepX = -1;
            sideDistX = (shakeX - mapX) * deltaDistX;
          } else {
            stepX = 1;
            sideDistX = (mapX + 1 - shakeX) * deltaDistX;
          }
          
          if (rayDirY < 0) {
            stepY = -1;
            sideDistY = (shakeY - mapY) * deltaDistY;
          } else {
            stepY = 1;
            sideDistY = (mapY + 1 - shakeY) * deltaDistY;
          }
          
          let hit = false;
          let side = 0;
          
          // DDA
          for (let i = 0; i < 64; i++) {
            if (sideDistX < sideDistY) {
              sideDistX += deltaDistX;
              mapX += stepX;
              side = 0;
            } else {
              sideDistY += deltaDistY;
              mapY += stepY;
              side = 1;
            }
            
            if (mapX < 0 || mapX >= mapSize || mapY < 0 || mapY >= mapSize) break;
            if (mapData[mapY * mapSize + mapX] > 0) {
              hit = true;
              break;
            }
          }
          
          if (hit) {
            if (side === 0) {
              zbuf[screenX] = (mapX - shakeX + (1 - stepX) / 2) / rayDirX;
            } else {
              zbuf[screenX] = (mapY - shakeY + (1 - stepY) / 2) / rayDirY;
            }
          } else {
            zbuf[screenX] = 1000; // Far away
          }
        }
        
        // Render sprites on 2D canvas overlay with Z-buffer occlusion
        spriteCtx.clearRect(0, 0, width, height);
        
        const enemies = enemyManagerRef.current.getAllEnemies().filter(e => e.isAlive());
        
        // Collect all sprites (enemies + NPC) for proper depth sorting
        const allSprites = [];
        
        // Add enemies
        enemies.forEach(e => {
          const dx = e.x - x;
          const dy = e.y - y;
          allSprites.push({ 
            type: 'enemy', 
            data: e, 
            dist: dx * dx + dy * dy 
          });
        });
        
        // Add NPC if exists
        if (npcPositionRef.current && gameData?.npcs?.[0]) {
          const npc = npcPositionRef.current;
          const dx = npc.x - x;
          const dy = npc.y - y;
          allSprites.push({ 
            type: 'npc', 
            data: npc, 
            dist: dx * dx + dy * dy 
          });
        }
        
        // Sort all sprites by distance (far to near)
        allSprites.sort((a, b) => b.dist - a.dist);
        
        // Render each sprite
        for (const sprite of allSprites) {
          if (sprite.type === 'enemy') {
            const enemy = sprite.data;
            // Transform sprite position relative to camera
            const spriteX = enemy.x - x;
            const spriteY = enemy.y - y;
            
            const invDet = 1.0 / (planeX * dirY - dirX * planeY);
            const transformX = invDet * (dirY * spriteX - dirX * spriteY);
            const transformY = invDet * (-planeY * spriteX + planeX * spriteY);
            
            // Skip if behind camera or too close
            if (transformY <= 0.05) continue;
            
            // Project to screen
            const screenX = Math.floor((width / 2) * (1 + transformX / transformY));
            const spriteH = Math.abs(Math.floor(height / transformY));
            const spriteW = spriteH; // Keep square
            
            const cx = screenX;
            const cy = Math.floor(height / 2);
            const halfW = Math.floor(spriteW / 2);
            const halfH = Math.floor(spriteH / 2);
            
            const xStart = Math.max(0, cx - halfW);
            const xEnd = Math.min(width - 1, cx + halfW);
            
            // Calculate which sprite direction to show based on enemy facing and player view angle
            const spriteFrames = spriteTexturesRef.current[enemy.type];
            if (spriteFrames) {
              // Calculate angle from player to enemy (reversed)
              const angleFromPlayer = Math.atan2(-spriteY, -spriteX);
              
              // Get enemy's facing angle (from enemy.direction: 0=down, 1=up, 2=left, 3=right)
              const enemyFacingAngle = [Math.PI / 2, -Math.PI / 2, Math.PI, 0][enemy.direction];
              
              // Calculate relative angle (what angle is the player viewing the enemy from)
              let relativeAngle = angleFromPlayer - enemyFacingAngle;
              
              // Normalize to -PI to PI
              while (relativeAngle > Math.PI) relativeAngle -= 2 * Math.PI;
              while (relativeAngle < -Math.PI) relativeAngle += 2 * Math.PI;
              
              // Map angle to sprite direction
              // 0 = Front (enemy facing player)
              // 1 = Back (enemy facing away)
              // 2 = Left side
              // 3 = Right side
              let spriteDir = 0;
              if (relativeAngle > -Math.PI / 4 && relativeAngle <= Math.PI / 4) {
                spriteDir = 0; // Front
              } else if (relativeAngle > Math.PI / 4 && relativeAngle <= 3 * Math.PI / 4) {
                spriteDir = 2; // Left side
              } else if (relativeAngle > -3 * Math.PI / 4 && relativeAngle <= -Math.PI / 4) {
                spriteDir = 3; // Right side
              } else {
                spriteDir = 1; // Back
              }
              
              const spriteImg = spriteFrames[spriteDir];
              
              // Draw sprite column by column with Z-buffer check
              for (let sx = xStart; sx <= xEnd; sx++) {
                // Check Z-buffer - only draw if sprite is closer than wall
                if (zbuf[sx] > 0 && transformY >= zbuf[sx]) continue;
                
                // Draw this column of the sprite
                const texX = ((sx - (cx - halfW)) / spriteW) * spriteImg.width;
                
                spriteCtx.drawImage(
                  spriteImg,
                  texX, 0, 1, spriteImg.height,
                  sx, cy - halfH, 1, spriteH
                );
              }
            }
          } else if (sprite.type === 'npc') {
            const npc = sprite.data;
          
          // Transform NPC position relative to camera
          const spriteX = npc.x - x;
          const spriteY = npc.y - y;
          
          const invDet = 1.0 / (planeX * dirY - dirX * planeY);
          const transformX = invDet * (dirY * spriteX - dirX * spriteY);
          const transformY = invDet * (-planeY * spriteX + planeX * spriteY);
          
          
          // Only render if in front of camera
          if (transformY > 0.05) {
            // Project to screen
            const screenX = Math.floor((width / 2) * (1 + transformX / transformY));
            const spriteH = Math.abs(Math.floor(height / transformY));
            const spriteW = spriteH;
            
            const cx = screenX;
            const cy = Math.floor(height / 2);
            const halfW = Math.floor(spriteW / 2);
            const halfH = Math.floor(spriteH / 2);
            
            const xStart = Math.max(0, cx - halfW);
            const xEnd = Math.min(width - 1, cx + halfW);
            
            // Try multiple possible NPC sprite IDs
            const possibleIds = [
              gameData.npcs[0].type,
              'npc',
              'merchant',
              'shopkeeper',
              ...Object.keys(spriteTexturesRef.current).filter(id => 
                id.toLowerCase().includes('npc') || 
                id.toLowerCase().includes('merchant') ||
                id.toLowerCase().includes('shop')
              )
            ];
            
            let spriteFrames = null;
            let usedId = null;
            
            for (const id of possibleIds) {
              if (id && spriteTexturesRef.current[id]) {
                spriteFrames = spriteTexturesRef.current[id];
                usedId = id;
                break;
              }
            }
            
            if (spriteFrames) {
              // NPC faces a fixed direction (south/down by default)
              // Calculate angle from player to NPC
              const angleFromPlayer = Math.atan2(-spriteY, -spriteX);
              
              // NPC facing angle: facing south (down) = PI/2
              const npcFacingAngle = Math.PI / 2;
              
              // Calculate relative angle (what angle is the player viewing the NPC from)
              let relativeAngle = angleFromPlayer - npcFacingAngle;
              
              // Normalize to -PI to PI
              while (relativeAngle > Math.PI) relativeAngle -= 2 * Math.PI;
              while (relativeAngle < -Math.PI) relativeAngle += 2 * Math.PI;
              
              // Map angle to sprite direction
              // 0 = Front (NPC facing player)
              // 1 = Back (NPC facing away)
              // 2 = Left side
              // 3 = Right side
              let spriteDir = 0;
              if (relativeAngle > -Math.PI / 4 && relativeAngle <= Math.PI / 4) {
                spriteDir = 0; // Front
              } else if (relativeAngle > Math.PI / 4 && relativeAngle <= 3 * Math.PI / 4) {
                spriteDir = 2; // Left side
              } else if (relativeAngle > -3 * Math.PI / 4 && relativeAngle <= -Math.PI / 4) {
                spriteDir = 3; // Right side
              } else {
                spriteDir = 1; // Back
              }
              
              const spriteImg = spriteFrames[spriteDir];
              
              if (spriteImg) {
                // Draw sprite column by column with Z-buffer check
                for (let sx = xStart; sx <= xEnd; sx++) {
                  // Check Z-buffer - only draw if sprite is closer than wall
                  if (zbuf[sx] > 0 && transformY >= zbuf[sx]) continue;
                  
                  // Draw this column of the sprite
                  const texX = ((sx - (cx - halfW)) / spriteW) * spriteImg.width;
                  
                  spriteCtx.drawImage(
                    spriteImg,
                    texX, 0, 1, spriteImg.height,
                    sx, cy - halfH, 1, spriteH
                  );
                }
              }
            } else {
              // Debug: log once per second if NPC sprite not found
              if (!window.npcSpriteWarned || Date.now() - window.npcSpriteWarned > 1000) {
                console.warn('NPC sprite not found. Available sprites:', Object.keys(spriteTexturesRef.current));
                console.warn('NPC data:', gameData.npcs[0]);
                window.npcSpriteWarned = Date.now();
              }
            }
          }
          }
        }
        
        // Render walls (sprites are already rendered on 2D canvas overlay)
        renderer.render(scene, camera);
        
        rafIdRef.current = requestAnimationFrame(animate);
      };
      
      rafIdRef.current = requestAnimationFrame(animate);
      
      // Handle resize
      const handleResize = () => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        renderer.setSize(w, h);
        if (materialRef.current) {
          materialRef.current.uniforms.uResolution.value.set(w, h);
        }
      };
      window.addEventListener('resize', handleResize);
      
      return () => {
        cancelAnimationFrame(rafIdRef.current);
        document.removeEventListener('keydown', onKeyDown);
        document.removeEventListener('keyup', onKeyUp);
        document.removeEventListener('keydown', onKeyPress);
        renderer.domElement.removeEventListener('click', onClick);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('resize', handleResize);
        if (mount && renderer.domElement && mount.contains(renderer.domElement)) {
          mount.removeChild(renderer.domElement);
        }
        renderer.dispose();
        geometry.dispose();
        material.dispose();
        mapTex.dispose();
        wallAtlas.dispose();
        floorTex.dispose();
        ceilTex.dispose();
      };
    };
    
    loadTextures();
  }, [gameData]);
  
  return (
    <div className="w-full h-screen relative" style={{ position: 'relative' }}>
      {/* Three.js mount point - no React children */}
      <div ref={mountRef} className="w-full h-screen" />
      
      {/* Screen flash overlay */}
      {flashColor && (
        <div 
          className="absolute inset-0 pointer-events-none transition-opacity duration-300"
          style={{ 
            backgroundColor: flashColor,
            opacity: flashOpacity,
            zIndex: 100
          }}
        />
      )}
      
      {/* Crosshair */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-40">
        <div className="relative w-8 h-8">
          {/* Horizontal line */}
          <div 
            className="absolute top-1/2 left-0 w-full h-0.5 transform -translate-y-1/2"
            style={{ backgroundColor: crosshairColor }}
          ></div>
          {/* Vertical line */}
          <div 
            className="absolute left-1/2 top-0 w-0.5 h-full transform -translate-x-1/2"
            style={{ backgroundColor: crosshairColor }}
          ></div>
          {/* Center dot */}
          <div 
            className="absolute top-1/2 left-1/2 w-1 h-1 rounded-full transform -translate-x-1/2 -translate-y-1/2"
            style={{ backgroundColor: crosshairColor }}
          ></div>
        </div>
      </div>
      
      {/* Minimap - Toggleable with Tab */}
      {minimapVisible && (
        <div 
          className="absolute top-4 right-4 border-2 border-white pointer-events-none"
          style={{ zIndex: 9999 }}
        >
          <canvas 
            ref={minimapCanvasRef}
            width={200}
            height={200}
            className="bg-black block"
            style={{ display: 'block' }}
          />
          <div className="absolute bottom-0 left-0 right-0 bg-black/75 text-white text-xs p-1 text-center">
            <div>Green: Player | Red: Enemies | Cyan: NPC | Yellow ★: Exit</div>
          </div>
        </div>
      )}
      
      {/* Minimap toggle button */}
      <button
        onClick={() => setMinimapVisible(prev => !prev)}
        className="absolute bg-black bg-opacity-70 text-white px-3 py-2 rounded border border-white hover:bg-opacity-90 transition-all text-sm"
        style={{ 
          top: minimapVisible ? '220px' : '16px',
          right: '16px',
          zIndex: 9998, 
          pointerEvents: 'auto' 
        }}
      >
        {minimapVisible ? 'Hide Map (Tab)' : 'Show Map (Tab)'}
      </button>
      
      {/* Weapon sprite (Wolfenstein style) */}
      {weaponSprite && (
        <div 
          className="absolute left-1/2 pointer-events-none"
          style={{ 
            zIndex: 50,
            bottom: 0,
            transform: `translateX(-50%) translateY(${weaponRecoil}px)`,
            transition: 'transform 0.1s ease-out'
          }}
        >
          <div
            style={{
              transform: shakeRef.current.intensity > 0 
                ? `translate(${shakeRef.current.x * 100}px, ${shakeRef.current.y * 100}px) rotate(${shakeRef.current.angle * (180 / Math.PI)}deg)`
                : 'none',
              transition: 'transform 0.05s ease-out'
            }}
          >
            {/* Muzzle Flash */}
            {muzzleFlash && (
              <div 
                className="absolute top-0 left-1/2 transform -translate-x-1/2"
                style={{
                  width: '150px',
                  height: '150px',
                  background: 'radial-gradient(circle, rgba(255,255,200,0.9) 0%, rgba(255,200,100,0.6) 30%, transparent 70%)',
                  filter: 'blur(8px)',
                  animation: 'pulse 0.1s ease-out',
                  zIndex: 51
                }}
              />
            )}
            
            <img 
              src={weaponSprite.src}
              alt="Weapon"
              className="block"
              style={{
                width: '400px',
                height: 'auto',
                imageRendering: 'pixelated',
                filter: muzzleFlash ? 'brightness(1.5)' : 'none'
              }}
            />
          </div>
        </div>
      )}
      
      {/* HUD Overlay - hide when game over */}
      {!gameOver && (
        <HUD 
          gameData={gameData}
          playerHealth={playerRef.current?.health || 100}
          maxHealth={100}
          ammo={50}
          gold={playerGold}
          kills={combatManagerRef.current?.kills || 0}
        />
      )}
      
      {/* Shop Modal */}
      {shopOpen && (
        <ShopModal
          npc={gameData?.npcs?.[0]}
          items={gameData?.shop?.items || []}
          playerGold={playerGold}
          gameData={gameData}
          onPurchase={(item) => {
            setPlayerGold(prev => prev - item.price);
            setInventory(prev => [...prev, item]);
            console.log('Purchased:', item.name);
            
            // Apply item effects
            if (item.type === 'health') {
              playerRef.current.health = Math.min(
                playerRef.current.maxHealth,
                playerRef.current.health + (item.effect || 50)
              );
            }
          }}
          onClose={() => {
            setShopOpen(false);
            gamePausedRef.current = false;
          }}
        />
      )}
      
      {/* NPC proximity indicator */}
      {!levelComplete && npcPositionRef.current && (() => {
        const p = playerRef.current;
        if (!p) return null;
        
        const dx = p.x - npcPositionRef.current.x;
        const dy = p.y - npcPositionRef.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 2.5 && !shopOpen) {
          return (
            <div className="absolute bottom-32 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-90 text-white px-6 py-3 rounded-lg border-2 border-cyan-400 z-50 shadow-lg">
              <p className="text-lg font-bold">
                Press <kbd className="px-2 py-1 bg-gray-700 rounded mx-1">E</kbd> to talk to {gameData?.npcs?.[0]?.name || 'Merchant'}
              </p>
              <p className="text-xs text-gray-400 mt-1">Distance: {dist.toFixed(1)} tiles</p>
            </div>
          );
        }
        return null;
      })()}
      
      {/* Exit portal proximity indicator */}
      {!levelComplete && dungeon.exit && (() => {
        const p = playerRef.current;
        if (!p) return null;
        
        const dx = p.x - dungeon.exit.x;
        const dy = p.y - dungeon.exit.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        const themeColor = gameData?.theme?.primary_color || '#10b981';
        
        if (dist < 3.0) {
          return (
            <div 
              className="absolute bottom-32 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-90 text-white px-6 py-3 rounded-lg border-2 z-50 shadow-lg animate-pulse"
              style={{ borderColor: themeColor }}
            >
              <p className="text-lg font-bold" style={{ color: themeColor }}>
                ✨ Exit Portal Ahead ✨
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {dist < 1.5 ? 'Step forward to complete the level!' : `Distance: ${dist.toFixed(1)} tiles`}
              </p>
            </div>
          );
        }
        return null;
      })()}
      
      {/* Story Intro */}
      {showStoryIntro && (
        <StoryIntro
          gameData={gameData}
          onContinue={() => {
            setShowStoryIntro(false);
            // Request pointer lock when story is dismissed
            if (rendererRef.current && rendererRef.current.domElement) {
              rendererRef.current.domElement.requestPointerLock();
            }
          }}
        />
      )}
      
      {/* Completion Screen */}
      {levelComplete && completionStats && (
        <CompletionScreen
          gameData={gameData}
          stats={completionStats}
          onNextLevel={() => {
            console.log('Loading next dungeon from shared world...');
            // Call the parent function to load next dungeon
            if (onLoadNextDungeon) {
              onLoadNextDungeon(completionStats);
            } else {
              // Fallback: reload
              window.location.reload();
            }
          }}
          onMainMenu={() => {
            // Return to setup screen
            window.location.reload();
          }}
        />
      )}
      
      
      {/* Game Over Screen */}
      {gameOver && gameOverStats && (
        <GameOverScreen
          gameData={gameData}
          stats={gameOverStats}
          onRetry={() => {
            window.location.reload();
          }}
          onMainMenu={() => {
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}
