/**
 * Sprite loading utilities for AI Dungeon Crawler
 * Handles loading base64 sprite sheets into Canvas elements and localStorage caching
 */
 
/**
 * Load a base64 sprite sheet into a canvas element
 * @param {string} base64Data - Base64 encoded sprite sheet data
 * @returns {Promise<HTMLCanvasElement>} Canvas element with the loaded sprite sheet
 */
export async function loadSpriteToCanvas(base64Data) {
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
      reject(new Error('Failed to load sprite image: ' + error));
    };
    
    img.src = base64Data;
  });
}

/**
 * Create a sprite cache key based on game ID and sprite ID
 * @param {string} gameId - Unique game identifier
 * @param {string} spriteId - Unique sprite identifier
 * @returns {string} Cache key
 */
function createCacheKey(gameId, spriteId) {
  return `sprite_${gameId}_${spriteId}`;
}

/**
 * Save a sprite to localStorage cache
 * @param {string} gameId - Unique game identifier
 * @param {string} spriteId - Unique sprite identifier
 * @param {string} base64Data - Base64 encoded sprite sheet data
 */
export function cacheSprite(gameId, spriteId, base64Data) {
  // In Node.js environment, localStorage is not available
  if (typeof localStorage === 'undefined') {
    console.log('Sprite caching skipped - localStorage not available in Node.js environment');
    return;
  }
  
  try {
    const cacheKey = createCacheKey(gameId, spriteId);
    localStorage.setItem(cacheKey, base64Data);
  } catch (error) {
    console.warn('Failed to cache sprite:', error);
  }
}

/**
 * Load a sprite from localStorage cache
 * @param {string} gameId - Unique game identifier
 * @param {string} spriteId - Unique sprite identifier
 * @returns {string|null} Base64 encoded sprite sheet data or null if not found
 */
export function getCachedSprite(gameId, spriteId) {
  // In Node.js environment, localStorage is not available
  if (typeof localStorage === 'undefined') {
    console.log('Sprite cache retrieval skipped - localStorage not available in Node.js environment');
    return null;
  }
  
  try {
    const cacheKey = createCacheKey(gameId, spriteId);
    return localStorage.getItem(cacheKey);
  } catch (error) {
    console.warn('Failed to retrieve cached sprite:', error);
    return null;
  }
}

/**
 * Clear all cached sprites for a specific game
 * @param {string} gameId - Unique game identifier
 */
export function clearGameSpriteCache(gameId) {
  // In Node.js environment, localStorage is not available
  if (typeof localStorage === 'undefined') {
    console.log('Sprite cache clearing skipped - localStorage not available in Node.js environment');
    return;
  }
  
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(`sprite_${gameId}_`)) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
  } catch (error) {
    console.warn('Failed to clear game sprite cache:', error);
  }
}

/**
 * Load all sprites for a game with caching
 * @param {string} gameId - Unique game identifier
 * @param {Array} characterData - Array of character objects with type, id, description, and directions properties
 * @param {Object} theme - Theme object with atmosphere and style properties
 * @returns {Promise<Array>} Array of canvas elements for each sprite sheet
 */
export async function loadGameSprites(gameId, characterData, theme) {
  const canvases = [];
  
  // Check if all sprites are cached
  const allCached = characterData.every(character => 
    getCachedSprite(gameId, character.id) !== null
  );
  
  if (allCached) {
    // If all sprites are cached, load them directly
    for (const character of characterData) {
      const base64Data = getCachedSprite(gameId, character.id);
      try {
        const canvas = await loadSpriteToCanvas(base64Data);
        canvases.push({
          id: character.id,
          type: character.type,
          canvas: canvas,
          dimensions: character.dimensions || { width: canvas.width, height: canvas.height },
          frame_count: character.frame_count || 1
        });
      } catch (error) {
        console.error(`Error loading cached sprite to canvas ${character.id}:`, error);
      }
    }
  } else {
    // If not all cached, fetch from backend
    try {
      const response = await fetch('http://localhost:5001/api/generate-sprites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          game_id: gameId,
          characters: characterData,
          theme: theme
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Cache all sprites
        data.sprites.forEach(sprite => {
          cacheSprite(gameId, sprite.id, sprite.sprite_sheet);
        });
        
        // Load all sprites into canvases
        for (const sprite of data.sprites) {
          try {
            const canvas = await loadSpriteToCanvas(sprite.sprite_sheet);
            canvases.push({
              id: sprite.id,
              type: sprite.type,
              canvas: canvas,
              dimensions: sprite.dimensions,
              frame_count: sprite.frame_count
            });
          } catch (error) {
            console.error(`Error loading sprite to canvas ${sprite.id}:`, error);
          }
        }
      } else {
        console.error('Failed to fetch sprites:', response.status);
      }
    } catch (error) {
      console.error('Error fetching sprites:', error);
    }
  }
  
  return canvases;
}