/**
 * Test component for sprite loading utilities
 */

import React, { useState, useEffect } from 'react';
import { loadGameSprites } from '../utils/sprites.js';

// Test data
const testCharacterData = [
  {
    "type": "enemy",
    "id": "zombie_knight",
    "description": "Undead knight in rusted armor",
    "directions": 4
  },
  {
    "type": "enemy",
    "id": "skeleton_archer",
    "description": "Skeletal archer with glowing eyes",
    "directions": 4
  },
  {
    "type": "npc",
    "id": "shopkeeper",
    "description": "Mysterious merchant with a hooded cloak",
    "directions": 4
  },
  {
    "type": "item",
    "id": "health_potion",
    "description": "Red glowing health potion in a crystal vial",
    "directions": 1
  }
];

const testTheme = {
  "atmosphere": "dark medieval",
  "style": "pixel art"
};

const SpriteTest = () => {
  const [spriteCanvases, setSpriteCanvases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Test function
  const testSpriteLoading = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Testing sprite loading utilities...');
      
      // Clear any existing cache for this test
      const gameId = 'test_game_' + Date.now();
      
      // Load sprites
      const loadedSpriteCanvases = await loadGameSprites(gameId, testCharacterData, testTheme);
      
      console.log('Loaded sprite canvases:', loadedSpriteCanvases);
      setSpriteCanvases(loadedSpriteCanvases);
      
      // Check that we got the expected number of canvases
      if (loadedSpriteCanvases.length === testCharacterData.length) {
        console.log('✅ All sprites loaded successfully');
      } else {
        console.log('❌ Expected', testCharacterData.length, 'sprites, but got', loadedSpriteCanvases.length);
      }
      
      // Log details about each canvas
      loadedSpriteCanvases.forEach(sprite => {
        console.log('Sprite ID:', sprite.id);
        console.log('Sprite Type:', sprite.type);
        console.log('Canvas Dimensions:', sprite.canvas.width, 'x', sprite.canvas.height);
        console.log('Frame Count:', sprite.frame_count);
      });
      
    } catch (err) {
      console.error('Error testing sprite loading:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Run the test when component mounts
    testSpriteLoading();
  }, []);

  return (
    <div className="p-4 bg-gray-900 text-white min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Sprite Loading Test</h1>
      
      {loading && (
        <div className="mb-4">Loading sprites...</div>
      )}
      
      {error && (
        <div className="mb-4 text-red-500">Error: {error}</div>
      )}
      
      {spriteCanvases.length > 0 ? (
        <div>
          <div className="mb-4">Loaded {spriteCanvases.length} sprites:</div>
          <div className="grid grid-cols-2 gap-4">
            {spriteCanvases.map((sprite, index) => (
              <div key={index} className="border border-gray-700 p-2">
                <div className="mb-2">ID: {sprite.id}</div>
                <div className="mb-2">Type: {sprite.type}</div>
                <div className="mb-2">Dimensions: {sprite.canvas.width}x{sprite.canvas.height}</div>
                <div className="mb-2">Frame Count: {sprite.frame_count}</div>
                <canvas 
                  ref={el => {
                    if (el && sprite.canvas) {
                      const ctx = el.getContext('2d');
                      ctx.clearRect(0, 0, el.width, el.height);
                      ctx.drawImage(sprite.canvas, 0, 0);
                    }
                  }}
                  width={sprite.canvas.width}
                  height={sprite.canvas.height}
                  className="border border-gray-600"
                />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div>No sprites loaded yet.</div>
      )}
    </div>
  );
};

export default SpriteTest;