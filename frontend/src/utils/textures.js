/**
 * Texture loading utilities for AI Dungeon Crawler
 * Handles loading base64 images into Canvas elements and localStorage caching
 */

/**
 * Load a base64 image into a canvas element
 * @param {string} base64Data - Base64 encoded image data
 * @returns {Promise<HTMLCanvasElement>} Canvas element with the loaded image
 */
export async function loadTextureToCanvas(base64Data) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      
      resolve(canvas);
    };
    
    img.onerror = (error) => {
      reject(new Error('Failed to load texture image: ' + error));
    };
    
    img.src = base64Data;
  });
}

/**
 * Create a texture cache key based on game ID and texture ID
 * @param {string} gameId - Unique game identifier
 * @param {string} textureId - Unique texture identifier
 * @returns {string} Cache key
 */
function createCacheKey(gameId, textureId) {
  return `texture_${gameId}_${textureId}`;
}

/**
 * Save a texture to localStorage cache
 * @param {string} gameId - Unique game identifier
 * @param {string} textureId - Unique texture identifier
 * @param {string} base64Data - Base64 encoded image data
 */
export function cacheTexture(gameId, textureId, base64Data) {
  try {
    const cacheKey = createCacheKey(gameId, textureId);
    localStorage.setItem(cacheKey, base64Data);
  } catch (error) {
    console.warn('Failed to cache texture:', error);
  }
}

/**
 * Load a texture from localStorage cache
 * @param {string} gameId - Unique game identifier
 * @param {string} textureId - Unique texture identifier
 * @returns {string|null} Base64 encoded image data or null if not found
 */
export function getCachedTexture(gameId, textureId) {
  try {
    const cacheKey = createCacheKey(gameId, textureId);
    return localStorage.getItem(cacheKey);
  } catch (error) {
    console.warn('Failed to retrieve cached texture:', error);
    return null;
  }
}

/**
 * Clear all cached textures for a specific game
 * @param {string} gameId - Unique game identifier
 */
export function clearGameTextureCache(gameId) {
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(`texture_${gameId}_`)) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
  } catch (error) {
    console.warn('Failed to clear game texture cache:', error);
  }
}

/**
 * Load all textures for a game with caching
 * @param {string} gameId - Unique game identifier
 * @param {Array} textureData - Array of texture objects with id and url properties
 * @returns {Promise<Array>} Array of canvas elements for each texture
 */
export async function loadGameTextures(gameId, textureData) {
  const canvases = [];
  
  for (const texture of textureData) {
    // Check if texture is cached
    let base64Data = getCachedTexture(gameId, texture.id);
    
    if (!base64Data) {
      // If not cached, fetch from backend
      try {
        const response = await fetch('/api/generate-textures', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            game_id: gameId,
            theme: texture.theme,
            setting: texture.setting,
            count: texture.count || 3
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          // For now, we'll just use the first texture from the response
          // In a real implementation, we would handle all returned textures
          base64Data = data.textures[0].url;
          
          // Cache the texture
          cacheTexture(gameId, texture.id, base64Data);
        } else {
          console.error(`Failed to fetch texture ${texture.id}:`, response.status);
          continue;
        }
      } catch (error) {
        console.error(`Error fetching texture ${texture.id}:`, error);
        continue;
      }
    }
    
    // Load the texture into a canvas
    try {
      const canvas = await loadTextureToCanvas(base64Data);
      canvases.push({
        id: texture.id,
        canvas: canvas
      });
    } catch (error) {
      console.error(`Error loading texture to canvas ${texture.id}:`, error);
    }
  }
  
  return canvases;
}