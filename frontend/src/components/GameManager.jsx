import { useState, useEffect } from 'react';
import StoryProgression from './StoryProgression';
import Inventory from './Inventory';
import CharacterInteraction from './CharacterInteraction';
import CombatSystem from './CombatSystem';

export default function GameManager({ gameData, playerPos, setGameState }) {
  const [storySegment, setStorySegment] = useState(null);
  const [inventoryItems, setInventoryItems] = useState([
    { id: "health_potion_1", name: "Health Potion", description: "Restores 25 HP", quantity: 3 },
    { id: "torch_1", name: "Torch", description: "Provides light in dark areas", quantity: 2 }
  ]);
  const [activeCharacter, setActiveCharacter] = useState(null);
  const [inCombat, setInCombat] = useState(false);
  const [gameCompleted, setGameCompleted] = useState(false);
  
  // Handle story updates
  const handleStoryUpdate = (segment) => {
    setStorySegment(segment);
  };
  
  // Handle character interactions
  const handleInteraction = (interactionData) => {
    console.log('Interaction:', interactionData);
    // In a real implementation, this would trigger game events based on interaction
  };
  
  // Handle combat start
  const handleCombatStart = (enemy) => {
    setInCombat(true);
    setActiveCharacter(enemy);
  };
  
  // Handle combat end
  const handleCombatEnd = (playerWon) => {
    setInCombat(false);
    setActiveCharacter(null);
    
    if (playerWon === true) {
      // Add item to inventory when enemy is defeated
      setInventoryItems(prev => [
        ...prev,
        { id: "gold_1", name: "Gold", description: "Valuable currency", quantity: 10 }
      ]);
    }
  };
  
  // Check if game is completed
  useEffect(() => {
    // For demonstration purposes, we'll end the game when player reaches a specific position
    const endX = gameData?.dungeon?.size ? gameData.dungeon.size - 2 : 14;
    const endY = gameData?.dungeon?.size ? gameData.dungeon.size - 2 : 14;
    
    if (Math.floor(playerPos.x) === endX && Math.floor(playerPos.y) === endY) {
      setGameCompleted(true);
      setGameState('completed');
    }
  }, [playerPos, gameData, setGameState]);
  
  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Story Progression UI */}
      {/* <StoryProgression 
        gameData={gameData} 
        playerPos={playerPos}
        onStoryUpdate={handleStoryUpdate}
      /> */}
      
      {/* Inventory UI */}
      <Inventory initialItems={inventoryItems} />
      
      {/* Character Interaction UI */}
      <CharacterInteraction 
        gameData={gameData}
        playerPos={playerPos}
        onInteraction={handleInteraction}
      />
      
      {/* Combat System UI */}
      {inCombat && (
        <CombatSystem 
          gameData={gameData}
          playerPos={playerPos}
          onCombatStart={handleCombatStart}
          onCombatEnd={handleCombatEnd}
        />
      )}
      
      {/* Game Completion UI */}
      {gameCompleted && (
        <div className="absolute inset-0 bg-black bg-opacity-90 text-white flex flex-col items-center justify-center pointer-events-auto">
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
    </div>
  );
}