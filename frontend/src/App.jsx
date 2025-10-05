import { useState } from 'react';
import GameSetup from './components/GameSetup';
import LoadingScreen from './components/LoadingScreen';
import SimpleRaycaster from './components/SimpleRaycaster';
import SpriteTest from './components/SpriteTest';
import GameManager from './components/GameManager';
import StoryTransition from './components/StoryTransition';
import NoSharedDungeons from './components/NoSharedDungeons';
import BackgroundMusic from './components/BackgroundMusic';

function App() {
  const [gameState, setGameState] = useState('setup'); // setup, loading, playing, transition, completed, sprite-test, no-dungeons
  const [gameData, setGameData] = useState(null);
  const [playerPos, setPlayerPos] = useState({ x: 8, y: 8 });
  const [transitionData, setTransitionData] = useState(null);
  
  // Track dungeons played - persist to localStorage
  const [playedDungeonIds, setPlayedDungeonIds] = useState(() => {
    try {
      const stored = localStorage.getItem('playedDungeonIds');
      const parsed = stored ? JSON.parse(stored) : [];
      console.log('Loaded playedDungeonIds from localStorage:', parsed);
      return parsed;
    } catch (e) {
      console.error('Failed to load playedDungeonIds from localStorage:', e);
      return [];
    }
  });

  const generateGame = async (prompt, savedGameData = null) => {
    try {
      setGameState('loading');
      
      console.log('generateGame called with savedGameData:', !!savedGameData);
      if (savedGameData) {
        console.log('Saved game data structure:', {
          hasEnemies: !!savedGameData.enemies,
          hasNPCs: !!savedGameData.npcs,
          hasSprites: !!savedGameData.sprites,
          enemyCount: savedGameData.enemies?.length,
          npcCount: savedGameData.npcs?.length,
          spriteCount: savedGameData.sprites?.length
        });
      }
      
      let data;
      
      // If loading from save, use saved data directly
      if (savedGameData) {
        data = savedGameData;
      } else {
        // Otherwise, generate new game
        const response = await fetch('/api/generate-game', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ prompt })
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        data = await response.json();
      }
      
      // If loading from save, regenerate images (they were stripped to save space)
      if (savedGameData) {
        console.log('Regenerating images from cache...');
        
        // Regenerate textures
        if (data.textures && data.textures.length > 0) {
          try {
            const texturesResponse = await fetch('/api/generate-textures', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                theme: data.theme
              })
            });
            
            if (texturesResponse.ok) {
              const texturesData = await texturesResponse.json();
              data.textures = texturesData.textures;
              console.log('✓ Textures regenerated from cache');
            }
          } catch (textureError) {
            console.error('Failed to regenerate textures:', textureError);
          }
        }
        
        // Regenerate sprites (always regenerate when loading from save)
        if (data.enemies || data.npcs) {
          try {
            // Rebuild character list from enemies/NPCs
            // Use the same ID logic as backend/routes/game.py
            const characters = [];
            
            // Add enemies
            if (data.enemies) {
              data.enemies.forEach(enemy => {
                const enemyId = enemy.id || (enemy.name || 'enemy').toLowerCase().replace(/ /g, '_');
                console.log(`Regenerating sprite for enemy: ${enemyId}`, enemy);
                characters.push({
                  id: enemyId,
                  type: 'enemy',
                  description: enemy.description || enemy.name || 'enemy',
                  directions: 4
                });
              });
            }
            
            // Add NPCs
            if (data.npcs) {
              data.npcs.forEach(npc => {
                const npcId = npc.id || (npc.name || 'npc').toLowerCase().replace(/ /g, '_');
                console.log(`Regenerating sprite for NPC: ${npcId}`, npc);
                characters.push({
                  id: npcId,
                  type: 'npc',
                  description: `${npc.name || 'NPC'}, a ${npc.role || 'character'}`,
                  directions: 4
                });
              });
            }
            
            if (characters.length > 0) {
              const spritesResponse = await fetch('/api/generate-sprites', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  characters: characters,
                  theme: data.theme
                })
              });
              
              if (spritesResponse.ok) {
                const spritesData = await spritesResponse.json();
                data.sprites = spritesData.sprites;
                console.log('✓ Sprites regenerated from cache:', data.sprites.length);
                // Debug: Check first sprite
                if (data.sprites.length > 0) {
                  const firstSprite = data.sprites[0];
                  console.log('First sprite sample:', {
                    id: firstSprite.id,
                    type: firstSprite.type,
                    has_sprite_sheet: !!firstSprite.sprite_sheet,
                    sprite_sheet_preview: firstSprite.sprite_sheet?.substring(0, 50)
                  });
                }
              } else {
                console.error('Failed to regenerate sprites:', spritesResponse.status, await spritesResponse.text());
              }
            }
          } catch (spriteError) {
            console.error('Failed to regenerate sprites:', spriteError);
          }
        }
      }
      
      // Generate HUD frame and weapon sprite before showing the game
      console.log('Generating HUD frame...');
      try {
        const hudResponse = await fetch('/api/generate-hud', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            theme: data.theme
          })
        });
        
        const hudData = await hudResponse.json();
        if (hudData.hud && hudData.hud.hud_frame) {
          data.hudFrame = hudData.hud.hud_frame;
          console.log('✓ HUD frame loaded');
        }
      } catch (hudError) {
        console.error('Failed to load HUD frame:', hudError);
      }
      
      console.log('Generating weapon sprite...');
      try {
        const weaponResponse = await fetch('/api/generate-weapon', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            weapon: 'pistol',
            theme: data.theme
          })
        });
        
        const weaponData = await weaponResponse.json();
        if (weaponData.weapon && weaponData.weapon.sprite) {
          // Attach weapon sprite to game data
          data.weaponSprite = weaponData.weapon.sprite;
          console.log('✓ Weapon sprite loaded');
        }
      } catch (weaponError) {
        console.error('Failed to load weapon sprite:', weaponError);
        // Continue anyway - weapon will be missing but game still playable
      }
      
      // Backend now returns parsed JSON directly
      setGameData(data);
      setGameState('playing');
    } catch (error) {
      console.error('Error generating game:', error);
      setGameState('setup');
      throw error;
    }
  };

  // Update player position state
  const handlePlayerMove = (position) => {
    setPlayerPos(position);
  };

  // Load next dungeon from shared world
  const loadNextDungeon = async (previousStats) => {
    try {
      setGameState('loading');
      
      // Get player ID
      const playerId = localStorage.getItem('playerId');
      if (!playerId) {
        console.error('No player ID found');
        setGameState('setup');
        return;
      }
      
      // Get next dungeon from another player, excluding already played ones
      // Also exclude the current dungeon
      const excludeList = [...playedDungeonIds];
      if (gameData?.dungeon_id) {
        excludeList.push(gameData.dungeon_id);
        console.log('Adding current dungeon_id to exclude list:', gameData.dungeon_id);
      } else {
        console.warn('Current gameData has no dungeon_id:', gameData);
      }
      const excludeIds = excludeList.join(',');
      console.log('Excluding dungeon IDs:', excludeIds);
      console.log('Exclude list length:', excludeList.length);
      
      const apiUrl = `/api/get-next-dungeon?player_id=${playerId}&exclude_ids=${excludeIds}`;
      console.log('Fetching next dungeon from:', apiUrl);
      
      const dungeonResponse = await fetch(apiUrl);
      
      if (!dungeonResponse.ok) {
        throw new Error('Failed to load next dungeon');
      }
      
      const dungeonData = await dungeonResponse.json();
      
      if (!dungeonData.success || !dungeonData.dungeon) {
        setGameState('no-dungeons');
        return;
      }
      
      const nextDungeon = dungeonData.dungeon;
      console.log('Loaded next dungeon:', nextDungeon.dungeon_id, 'from player:', nextDungeon.player_id);
      console.log('Is this dungeon in exclude list?', excludeList.includes(nextDungeon.dungeon_id));
      
      // Track this dungeon as played
      setPlayedDungeonIds(prev => {
        const updated = [...prev, nextDungeon.dungeon_id];
        console.log('Updated playedDungeonIds:', updated);
        // Persist to localStorage
        try {
          localStorage.setItem('playedDungeonIds', JSON.stringify(updated));
        } catch (e) {
          console.error('Failed to save playedDungeonIds to localStorage:', e);
        }
        return updated;
      });
      
      // Generate story patch
      const patchResponse = await fetch('/api/patch-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          previous_story: gameData?.story?.narrative || gameData?.story?.intro || '',
          previous_theme: gameData?.theme?.atmosphere || gameData?.theme?.description || '',
          new_story: nextDungeon.game_data.story?.narrative || nextDungeon.game_data.story?.intro || nextDungeon.prompt,
          new_theme: nextDungeon.game_data.theme?.atmosphere || nextDungeon.game_data.theme?.description || nextDungeon.prompt,
          player_actions: {
            kills: previousStats?.kills || 0,
            gold: previousStats?.gold || 0,
            time: previousStats?.timeElapsed || 0
          }
        })
      });
      
      let storyPatch = 'Your journey continues into a new realm...';
      if (patchResponse.ok) {
        const patchData = await patchResponse.json();
        if (patchData.success) {
          storyPatch = patchData.story_patch;
        }
      }
      
      // Set transition data
      setTransitionData({
        previousTheme: gameData?.theme?.atmosphere || gameData?.story?.title || 'the previous dungeon',
        newTheme: nextDungeon.game_data.story?.title || nextDungeon.prompt,
        newCreator: nextDungeon.player_id,
        storyPatch: storyPatch,
        nextGameData: nextDungeon.game_data
      });
      
      setGameState('transition');
      
    } catch (error) {
      console.error('Error loading next dungeon:', error);
      alert('Failed to load next dungeon. Returning to main menu.');
      setGameState('setup');
    }
  };
  
  // Continue from transition to playing
  const continueFromTransition = async () => {
    if (!transitionData?.nextGameData) {
      setGameState('setup');
      return;
    }
    
    setGameState('loading');
    
    // Load HUD and weapon for new dungeon
    const data = transitionData.nextGameData;
    
    // Regenerate textures from cache
    console.log('Regenerating images for shared world dungeon...');
    if (data.textures && data.textures.length > 0) {
      try {
        const texturesResponse = await fetch('/api/generate-textures', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ theme: data.theme })
        });
        
        if (texturesResponse.ok) {
          const texturesData = await texturesResponse.json();
          data.textures = texturesData.textures;
          console.log('✓ Textures regenerated from cache');
        }
      } catch (textureError) {
        console.error('Failed to regenerate textures:', textureError);
      }
    }
    
    // Regenerate sprites from cache
    if (data.enemies || data.npcs) {
      try {
        const characters = [];
        
        // Add enemies
        if (data.enemies) {
          data.enemies.forEach(enemy => {
            const enemyId = enemy.id || (enemy.name || 'enemy').toLowerCase().replace(/ /g, '_');
            console.log(`Regenerating sprite for enemy: ${enemyId}`, enemy);
            characters.push({
              id: enemyId,
              type: 'enemy',
              description: enemy.description || enemy.name || 'enemy',
              directions: 4
            });
          });
        }
        
        // Add NPCs
        if (data.npcs) {
          data.npcs.forEach(npc => {
            const npcId = npc.id || (npc.name || 'npc').toLowerCase().replace(/ /g, '_');
            console.log(`Regenerating sprite for NPC: ${npcId}`, npc);
            characters.push({
              id: npcId,
              type: 'npc',
              description: `${npc.name || 'NPC'}, a ${npc.role || 'character'}`,
              directions: 4
            });
          });
        }
        
        if (characters.length > 0) {
          const spritesResponse = await fetch('/api/generate-sprites', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              characters: characters,
              theme: data.theme
            })
          });
          
          if (spritesResponse.ok) {
            const spritesData = await spritesResponse.json();
            data.sprites = spritesData.sprites;
            console.log('✓ Sprites regenerated from cache:', data.sprites.length);
          } else {
            console.error('Failed to regenerate sprites:', spritesResponse.status, await spritesResponse.text());
          }
        }
      } catch (spriteError) {
        console.error('Failed to regenerate sprites:', spriteError);
      }
    }
    
    try {
      const hudResponse = await fetch('/api/generate-hud', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: data.theme })
      });
      
      const hudData = await hudResponse.json();
      if (hudData.hud && hudData.hud.hud_frame) {
        data.hudFrame = hudData.hud.hud_frame;
      }
    } catch (error) {
      console.error('Failed to load HUD:', error);
    }
    
    try {
      const weaponResponse = await fetch('/api/generate-weapon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weapon: 'pistol', theme: data.theme })
      });
      
      const weaponData = await weaponResponse.json();
      if (weaponData.weapon && weaponData.weapon.sprite) {
        data.weaponSprite = weaponData.weapon.sprite;
      }
    } catch (error) {
      console.error('Failed to load weapon:', error);
    }
    
    setGameData(data);
    setGameState('playing');
  };

  return (
    <div className="text-white h-screen w-screen overflow-hidden">
      {gameState === 'setup' && <GameSetup onGenerate={generateGame} setGameState={setGameState} />}
      {gameState === 'loading' && <LoadingScreen />}
      {gameState === 'playing' && (
        <>
          <SimpleRaycaster 
            gameData={gameData} 
            onPlayerMove={handlePlayerMove}
            onLoadNextDungeon={loadNextDungeon}
          />
          <GameManager gameData={gameData} playerPos={playerPos} setGameState={setGameState} />
        </>
      )}
      {gameState === 'sprite-test' && <SpriteTest />}
      {gameState === 'no-dungeons' && (
        <NoSharedDungeons onReturnToMenu={() => setGameState('setup')} />
      )}
      {gameState === 'transition' && transitionData && (
        <StoryTransition
          previousTheme={transitionData.previousTheme}
          newTheme={transitionData.newTheme}
          newCreator={transitionData.newCreator}
          storyPatch={transitionData.storyPatch}
          onContinue={continueFromTransition}
        />
      )}
      {gameState === 'completed' && (
        <div className="absolute inset-0 bg-black bg-opacity-90 text-white flex flex-col items-center justify-center">
          <h2 className="text-3xl font-bold mb-4">Game Completed!</h2>
          <p className="text-xl mb-8">You have successfully navigated the AI Dungeon Crawler</p>
          <button
            onClick={() => setGameState('setup')}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Play Again
          </button>
        </div>
      )}
      
      {/* Background Music - persists throughout entire game */}
      <BackgroundMusic />
    </div>
  );
}

export default App;
