import { useEffect } from 'react';

// Function to check if a position is valid (not inside a wall)
function isValidPosition(pos, mapData, mapSize) {
  const { x, y } = pos;
  
  // Check boundaries
  if (x < 0 || x >= mapSize || y < 0 || y >= mapSize) {
    return false;
  }
  
  // Check if position is inside a wall
  const mapIndex = Math.floor(y) * mapSize + Math.floor(x);
  return mapData[mapIndex] === 0; // 0 means empty space, valid for movement
}

export default function PlayerController({ 
  playerPos, 
  dir, 
  plane, 
  setPlayerPos, 
  setDir, 
  setPlane,
  mapData,
  mapSize,
  movementSpeed = 0.1,
  rotationSpeed = 0.002
}) {
  useEffect(() => {
    // Track key states
    const keys = {
      w: false,
      a: false,
      s: false,
      d: false,
      ArrowLeft: false,
      ArrowRight: false
    };
    
    // Track mouse movement
    let mouseDown = false;
    let prevMouseX = 0;
    
    // Use refs to track current state without causing re-renders
    let currentPos = { ...playerPos };
    let currentDir = { ...dir };
    let currentPlane = { ...plane };
    
    // Handle keyboard input
    const handleKeyDown = (e) => {
      const key = e.key.toLowerCase();
      if (key === 'w') keys.w = true;
      if (key === 'a') keys.a = true;
      if (key === 's') keys.s = true;
      if (key === 'd') keys.d = true;
      if (e.key === 'ArrowLeft') keys.ArrowLeft = true;
      if (e.key === 'ArrowRight') keys.ArrowRight = true;
    };
    
    const handleKeyUp = (e) => {
      const key = e.key.toLowerCase();
      if (key === 'w') keys.w = false;
      if (key === 'a') keys.a = false;
      if (key === 's') keys.s = false;
      if (key === 'd') keys.d = false;
      if (e.key === 'ArrowLeft') keys.ArrowLeft = false;
      if (e.key === 'ArrowRight') keys.ArrowRight = false;
    };
    
    // Handle mouse input
    const handleMouseDown = (e) => {
      mouseDown = true;
      prevMouseX = e.clientX;
      // Request pointer lock for better mouse control
      document.body.requestPointerLock?.();
    };
    
    const handleMouseUp = () => {
      mouseDown = false;
    };
    
    const handleMouseMove = (e) => {
      if (!mouseDown) return;
      
      const deltaX = e.movementX || e.clientX - prevMouseX;
      prevMouseX = e.clientX;
      
      // Rotate camera direction
      const angle = deltaX * rotationSpeed;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      
      const newDirX = currentDir.x * cos - currentDir.y * sin;
      const newDirY = currentDir.x * sin + currentDir.y * cos;
      currentDir = { x: newDirX, y: newDirY };
      setDir(currentDir);
      
      // Rotate camera plane
      const newPlaneX = currentPlane.x * cos - currentPlane.y * sin;
      const newPlaneY = currentPlane.x * sin + currentPlane.y * cos;
      currentPlane = { x: newPlaneX, y: newPlaneY };
      setPlane(currentPlane);
    };
    
    // Arrow key rotation
    const rotateWithKeys = () => {
      if (keys.ArrowLeft || keys.ArrowRight) {
        const angle = (keys.ArrowLeft ? -1 : 1) * 0.05;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        
        const newDirX = currentDir.x * cos - currentDir.y * sin;
        const newDirY = currentDir.x * sin + currentDir.y * cos;
        currentDir = { x: newDirX, y: newDirY };
        setDir(currentDir);
        
        const newPlaneX = currentPlane.x * cos - currentPlane.y * sin;
        const newPlaneY = currentPlane.x * sin + currentPlane.y * cos;
        currentPlane = { x: newPlaneX, y: newPlaneY };
        setPlane(currentPlane);
      }
    };
    
    // Movement loop
    const movePlayer = () => {
      // Calculate movement vector
      let moveX = 0;
      let moveY = 0;
      
      if (keys.w) {
        moveX += currentDir.x * movementSpeed;
        moveY += currentDir.y * movementSpeed;
      }
      if (keys.s) {
        moveX -= currentDir.x * movementSpeed;
        moveY -= currentDir.y * movementSpeed;
      }
      if (keys.a) {
        moveX -= currentPlane.x * movementSpeed;
        moveY -= currentPlane.y * movementSpeed;
      }
      if (keys.d) {
        moveX += currentPlane.x * movementSpeed;
        moveY += currentPlane.y * movementSpeed;
      }
      
      // Handle rotation with arrow keys
      rotateWithKeys();
      
      // Check collision before updating position
      if (moveX !== 0 || moveY !== 0) {
        const newPos = {
          x: currentPos.x + moveX,
          y: currentPos.y + moveY
        };
        
        // Only update position if it's valid (no collision)
        if (mapData && mapSize && isValidPosition(newPos, mapData, mapSize)) {
          currentPos = newPos;
          setPlayerPos(newPos);
        }
      }
    };
    
    // Game loop
    let animationFrameId;
    const gameLoop = () => {
      movePlayer();
      animationFrameId = requestAnimationFrame(gameLoop);
    };
    
    // Start game loop
    animationFrameId = requestAnimationFrame(gameLoop);
    
    // Add event listeners
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);
    
    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
      document.exitPointerLock?.();
    };
  }, [setPlayerPos, setDir, setPlane, mapData, mapSize]);
  
  return null; // This component doesn't render anything visible
}