import * as THREE from 'three';
import { useEffect, useRef } from 'react';
import { loadGameSprites } from '../utils/sprites';

// Vertex shader for sprites - simple pass-through
const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Fragment shader for sprite rendering
const fragmentShader = `
  precision highp float;
  varying vec2 vUv;
  uniform vec2 uResolution;
  uniform sampler2D uSpriteAtlas;
  uniform vec2 uSpritePos;
  uniform vec2 uSpriteDimensions;
  
  void main() {
    // Convert UV to sprite coordinates
    vec2 spriteUV = vUv * uSpriteDimensions;
    
    // Sample sprite texture
    vec2 atlasUV = (uSpritePos + spriteUV) / uResolution;
    vec4 color = texture2D(uSpriteAtlas, atlasUV);
    
    // Only render if not transparent
    if (color.a > 0.5) {
      gl_FragColor = color;
    } else {
      // Discard transparent pixels
      discard;
    }
  }
`;

// Sprite rendering component that integrates with raycaster
export default function SpriteRenderer({ gameData, playerPos }) {
  const containerRef = useRef();
  const rendererRef = useRef();
  const sceneRef = useRef();
  const cameraRef = useRef();
  const spritesRef = useRef([]);
  
  useEffect(() => {
    if (!gameData) return;
    
    // Initialize Three.js
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
    cameraRef.current = camera;
    
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    rendererRef.current = renderer;
    
    // Load sprites using existing utility
    const loadSprites = async () => {
      try {
        // If gameData has sprites, use them; otherwise create test requests
        let loadedSprites;
        if (gameData.sprites && gameData.sprites.characters) {
          loadedSprites = await loadGameSprites(
            gameData.game_id, 
            gameData.sprites.characters, 
            gameData.theme
          );
        } else {
          // Fallback to test requests if no game sprites are available
          const characterData = [
            {
              id: "npc_1",
              type: "npc",
              description: "A friendly character",
              directions: 4
            },
            {
              id: "npc_2",
              type: "npc",
              description: "Another friendly character",
              directions: 4
            },
            {
              id: "enemy_1",
              type: "enemy",
              description: "A threatening enemy",
              directions: 4
            }
          ];
          
          loadedSprites = await loadGameSprites(
            gameData.game_id || 'test_game', 
            characterData, 
            gameData.theme || { atmosphere: "mysterious", style: "pixel art" }
          );
        }
        
        // Create sprite atlas texture
        const spriteCanvases = loadedSprites.map(sprite => sprite.canvas);
        const atlasWidth = Math.max(...spriteCanvases.map(canvas => canvas.width));
        const atlasHeight = Math.max(...spriteCanvases.map(canvas => canvas.height));
        
        // Create a canvas for the sprite atlas
        const atlasCanvas = document.createElement('canvas');
        atlasCanvas.width = atlasWidth;
        atlasCanvas.height = atlasHeight * spriteCanvases.length;
        const atlasCtx = atlasCanvas.getContext('2d');
        
        // Draw all sprites into the atlas
        for (let i = 0; i < spriteCanvases.length; i++) {
          atlasCtx.drawImage(
            spriteCanvases[i], 
            0, 
            i * atlasHeight, 
            spriteCanvases[i].width, 
            spriteCanvases[i].height
          );
        }
        
        // Create Three.js texture from atlas
        const spriteAtlasTexture = new THREE.CanvasTexture(atlasCanvas);
        spriteAtlasTexture.minFilter = THREE.NearestFilter;
        spriteAtlasTexture.magFilter = THREE.NearestFilter;
        
        // Create sprite materials
        const spriteMaterials = [];
        for (let i = 0; i < spriteCanvases.length; i++) {
          const material = new THREE.ShaderMaterial({
            uniforms: {
              uResolution: { value: new THREE.Vector2(atlasWidth, atlasHeight * spriteCanvases.length) },
              uSpriteAtlas: { value: spriteAtlasTexture },
              uSpritePos: { value: new THREE.Vector2(0, i * atlasHeight) },
              uSpriteDimensions: { value: new THREE.Vector2(atlasWidth, atlasHeight) },
              uTime: { value: 0 }
            },
            vertexShader,
            fragmentShader,
            transparent: true
          });
          spriteMaterials.push(material);
        }
        
        // Create quad geometry for sprites
        const geometry = new THREE.PlaneGeometry(2, 2);
        
        // Create sprite meshes (test positions)
        const spriteMeshes = [];
        for (let i = 0; i < spriteMaterials.length; i++) {
          const mesh = new THREE.Mesh(geometry, spriteMaterials[i]);
          // Position sprites in front of player for testing
          mesh.position.set(
            playerPos.x + Math.cos(i) * 3,
            0,
            playerPos.y + Math.sin(i) * 3
          );
          mesh.visible = false; // Initially hidden
          scene.add(mesh);
          spriteMeshes.push(mesh);
        }
        
        spritesRef.current = spriteMeshes;
        
        // Add renderer to container
        containerRef.current.innerHTML = '';
        containerRef.current.appendChild(renderer.domElement);
        
        // Handle window resize
        const handleResize = () => {
          renderer.setSize(window.innerWidth, window.innerHeight);
        };
        
        window.addEventListener('resize', handleResize);
        
        // Render loop
        const animate = () => {
          requestAnimationFrame(animate);
          
          // Update sprite positions
          spritesRef.current.forEach((mesh, i) => {
            mesh.position.x = playerPos.x + Math.cos(performance.now() * 0.001 + i) * 3;
            mesh.position.z = playerPos.y + Math.sin(performance.now() * 0.001 + i) * 3;
          });
          
          renderer.render(scene, camera);
        };
        
        animate();
        
        return () => {
          window.removeEventListener('resize', handleResize);
          renderer.dispose();
          geometry.dispose();
          spriteMaterials.forEach(material => material.dispose());
          spriteAtlasTexture.dispose();
        };
      } catch (error) {
        console.error('Error loading sprites:', error);
      }
    };
    
    loadSprites();
  }, [gameData, playerPos]);
  
  return (
    <div ref={containerRef} className="w-full h-full absolute top-0 pointer-events-none"></div>
  );
}