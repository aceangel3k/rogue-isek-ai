import * as THREE from 'three';
import { useEffect, useRef, useState } from 'react';
import { loadTextureToCanvas } from '../utils/textures';

// Floor fragment shader
const floorFragmentShader = `
  precision highp float;
  varying vec2 vUv;
  uniform vec2 uResolution;
  uniform float uTime;
  uniform vec2 uPlayerPos;
  uniform vec2 uDir;
  uniform vec2 uPlane;
  uniform sampler2D uFloorTex;
  
  void main() {
    // Use actual floor texture
    vec2 floorUv = vec2(vUv.x, 1.0 - vUv.y); // Flip Y coordinate
    vec3 color = texture2D(uFloorTex, floorUv).rgb;
    
    gl_FragColor = vec4(color, 1.0);
  }
`;

// Floor vertex shader
const floorVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export default function FloorRenderer({ gameData }) {
  const containerRef = useRef();
  const rendererRef = useRef();
  const sceneRef = useRef();
  const cameraRef = useRef();
  const materialRef = useRef();
  const [floorTexture, setFloorTexture] = useState(null);
  
  useEffect(() => {
    if (!gameData) return;
    
    // Initialize Three.js
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
    cameraRef.current = camera;
    
    const renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(window.innerWidth, window.innerHeight / 2);
    rendererRef.current = renderer;
    
    // Load floor texture from gameData or use solid color fallback
    const loadFloorTexture = async () => {
      try {
        let canvas;
        
        // Check if floor texture is available in gameData
        if (gameData.textures && gameData.textures.length > 0) {
          const floorTexture = gameData.textures.find(t => t.id === 'floor');
          if (floorTexture) {
            console.log('Loading AI-generated floor texture');
            canvas = await loadTextureToCanvas(floorTexture.url);
          }
        }
        
        // Fallback to solid color if no texture
        if (!canvas) {
          console.log('Using solid color floor (no AI texture available)');
          canvas = document.createElement('canvas');
          canvas.width = 64;
          canvas.height = 64;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#333333';
          ctx.fillRect(0, 0, 64, 64);
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.NearestFilter;
        texture.magFilter = THREE.NearestFilter;
        setFloorTexture(texture);
      } catch (error) {
        console.error('Error loading floor texture:', error);
        // Create fallback texture on error
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#333333';
        ctx.fillRect(0, 0, 64, 64);
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.NearestFilter;
        texture.magFilter = THREE.NearestFilter;
        setFloorTexture(texture);
      }
    };
    
    loadFloorTexture();
  }, [gameData]);
  
  useEffect(() => {
    if (!floorTexture) return;
    
    // Create shader material with floor texture
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        uTime: { value: 0 },
        uPlayerPos: { value: new THREE.Vector2(gameData.dungeon.size / 2, gameData.dungeon.size / 2) },
        uDir: { value: new THREE.Vector2(-1, 0) },
        uPlane: { value: new THREE.Vector2(0, 0.66) },
        uFloorTex: { value: floorTexture }
      },
      vertexShader: floorVertexShader,
      fragmentShader: floorFragmentShader
    });
    materialRef.current = material;
    
    // Create quad geometry
    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, material);
    
    // Initialize Three.js scene
    const scene = sceneRef.current || new THREE.Scene();
    scene.add(mesh);
    sceneRef.current = scene;
    
    // Position camera
    const camera = cameraRef.current || new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
    camera.position.z = 1;
    cameraRef.current = camera;
    
    // Add renderer to container
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(rendererRef.current.domElement);
    }
    
    // Render loop
    const animate = () => {
      requestAnimationFrame(animate);
      material.uniforms.uTime.value = performance.now() / 1000;
      rendererRef.current.render(scene, camera);
    };
    
    animate();
    
    // Handle window resize
    const handleResize = () => {
      rendererRef.current.setSize(window.innerWidth, window.innerHeight / 2);
      material.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      rendererRef.current.dispose();
      geometry.dispose();
      material.dispose();
      if (floorTexture) {
        floorTexture.dispose();
      }
    };
  }, [floorTexture, gameData]);
  
  return (
    <div ref={containerRef} className="w-full h-1/2 bottom-0 absolute">
      {/* Floor renderer will be rendered here */}
    </div>
  );
}