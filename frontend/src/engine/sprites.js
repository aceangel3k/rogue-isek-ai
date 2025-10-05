/**
 * Sprite Rendering System for AI Dungeon Crawler
 * 
 * Features:
 * - Billboard sprite rendering (always face camera)
 * - Z-buffer integration for proper depth sorting
 * - Distance-based sorting
 * - AI-generated sprite image integration
 */

/**
 * Sprite class represents a renderable sprite in the game world
 */
export class Sprite {
  constructor(x, y, textureIndex, scale = 1.0) {
    this.x = x;
    this.y = y;
    this.textureIndex = textureIndex;
    this.scale = scale;
    this.distance = 0; // Will be calculated each frame
  }
}

/**
 * Calculate sprite rendering data for raycasting
 * Based on Wolfenstein 3D sprite rendering algorithm
 */
export function calculateSpriteProjection(sprite, playerX, playerY, dirX, dirY, planeX, planeY, screenWidth, screenHeight) {
  // Translate sprite position relative to camera
  const spriteX = sprite.x - playerX;
  const spriteY = sprite.y - playerY;
  
  // Calculate distance for Z-buffer
  sprite.distance = Math.sqrt(spriteX * spriteX + spriteY * spriteY);
  
  // Transform sprite with inverse camera matrix
  // [ planeX   dirX ] -1                                       [ dirY      -dirX ]
  // [               ]       =  1/(planeX*dirY-dirX*planeY) *   [                 ]
  // [ planeY   dirY ]                                          [ -planeY  planeX ]
  
  const invDet = 1.0 / (planeX * dirY - dirX * planeY);
  
  const transformX = invDet * (dirY * spriteX - dirX * spriteY);
  const transformY = invDet * (-planeY * spriteX + planeX * spriteY); // This is actually the depth (Z) in screen space
  
  // Don't render if sprite is behind camera
  if (transformY <= 0) {
    return null;
  }
  
  // Calculate sprite screen X position
  const spriteScreenX = Math.floor((screenWidth / 2) * (1 + transformX / transformY));
  
  // Calculate sprite height on screen
  const spriteHeight = Math.abs(Math.floor(screenHeight / transformY)) * sprite.scale;
  
  // Calculate sprite width (assuming square sprites)
  const spriteWidth = Math.abs(Math.floor(screenHeight / transformY)) * sprite.scale;
  
  // Calculate draw start/end Y
  const drawStartY = Math.floor(-spriteHeight / 2 + screenHeight / 2);
  const drawEndY = Math.floor(spriteHeight / 2 + screenHeight / 2);
  
  // Calculate draw start/end X
  const drawStartX = Math.floor(-spriteWidth / 2 + spriteScreenX);
  const drawEndX = Math.floor(spriteWidth / 2 + spriteScreenX);
  
  return {
    distance: sprite.distance,
    transformY: transformY,
    spriteScreenX: spriteScreenX,
    spriteHeight: spriteHeight,
    spriteWidth: spriteWidth,
    drawStartX: Math.max(0, drawStartX),
    drawEndX: Math.min(screenWidth, drawEndX),
    drawStartY: Math.max(0, drawStartY),
    drawEndY: Math.min(screenHeight, drawEndY),
    textureIndex: sprite.textureIndex
  };
}

/**
 * Sort sprites by distance (far to near) for proper rendering order
 */
export function sortSpritesByDistance(sprites) {
  return sprites.sort((a, b) => b.distance - a.distance);
}

/**
 * Render sprites using canvas 2D context
 * This is a CPU-based implementation for compatibility
 */
export function renderSprites(
  ctx,
  sprites,
  spriteTextures,
  playerX,
  playerY,
  dirX,
  dirY,
  planeX,
  planeY,
  zBuffer,
  screenWidth,
  screenHeight
) {
  // Calculate projection data for all sprites
  const projectedSprites = [];
  
  for (const sprite of sprites) {
    const projection = calculateSpriteProjection(
      sprite,
      playerX,
      playerY,
      dirX,
      dirY,
      planeX,
      planeY,
      screenWidth,
      screenHeight
    );
    
    if (projection) {
      projectedSprites.push(projection);
    }
  }
  
  // Sort sprites by distance (far to near)
  projectedSprites.sort((a, b) => b.distance - a.distance);
  
  // Render each sprite
  for (const proj of projectedSprites) {
    const texture = spriteTextures[proj.textureIndex];
    if (!texture) continue;
    
    // Draw sprite column by column with Z-buffer check
    for (let stripe = proj.drawStartX; stripe < proj.drawEndX; stripe++) {
      // Check Z-buffer - only draw if sprite is closer than wall
      if (proj.transformY < zBuffer[stripe]) {
        // Calculate texture X coordinate
        const texX = Math.floor((stripe - (-proj.spriteWidth / 2 + proj.spriteScreenX)) * texture.width / proj.spriteWidth);
        
        // Draw vertical stripe of sprite
        if (texX >= 0 && texX < texture.width) {
          ctx.drawImage(
            texture,
            texX, 0, 1, texture.height, // Source
            stripe, proj.drawStartY, 1, proj.drawEndY - proj.drawStartY // Destination
          );
        }
      }
    }
  }
}

/**
 * Create sprite data from enemies for rendering
 */
export function createSpritesFromEnemies(enemies, spriteTextureMap) {
  const sprites = [];
  
  for (const enemy of enemies) {
    if (!enemy.isAlive()) continue;
    
    // Get texture index based on enemy type and direction
    const textureIndex = spriteTextureMap[enemy.type]?.[enemy.direction] || 0;
    
    sprites.push(new Sprite(
      enemy.x,
      enemy.y,
      textureIndex,
      1.0 // Scale
    ));
  }
  
  return sprites;
}

/**
 * Load sprite textures from AI-generated sprite sheets
 * Splits sprite sheets into individual direction frames
 */
export async function loadSpriteTextures(spriteData) {
  const textures = {};
  
  for (const sprite of spriteData) {
    const img = new Image();
    
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = sprite.sprite_sheet;
    });
    
    // If it's a 4-direction sprite sheet (256x64), split into 4 frames
    if (sprite.frame_count === 4) {
      const frameWidth = 64;
      const frameHeight = 64;
      
      textures[sprite.id] = [];
      
      for (let i = 0; i < 4; i++) {
        const canvas = document.createElement('canvas');
        canvas.width = frameWidth;
        canvas.height = frameHeight;
        const ctx = canvas.getContext('2d');
        
        // Extract frame from sprite sheet
        ctx.drawImage(
          img,
          i * frameWidth, 0, frameWidth, frameHeight, // Source
          0, 0, frameWidth, frameHeight // Destination
        );
        
        textures[sprite.id][i] = canvas;
      }
    } else {
      // Single sprite (items, etc.)
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      
      textures[sprite.id] = [canvas];
    }
  }
  
  return textures;
}

/**
 * Create Z-buffer for depth testing
 * Should be updated each frame from raycasting results
 */
export function createZBuffer(screenWidth) {
  return new Float32Array(screenWidth).fill(Infinity);
}

/**
 * Update Z-buffer from raycasting wall distances
 * This should be called after wall rendering, before sprite rendering
 */
export function updateZBufferFromWalls(zBuffer, wallDistances) {
  for (let x = 0; x < zBuffer.length && x < wallDistances.length; x++) {
    zBuffer[x] = wallDistances[x];
  }
}
