import { useState, useEffect } from 'react';

export default function CombatSystem({ gameData, playerPos, onCombatStart, onCombatEnd }) {
  const [inCombat, setInCombat] = useState(false);
  const [enemy, setEnemy] = useState(null);
  const [playerHealth, setPlayerHealth] = useState(100);
  const [enemyHealth, setEnemyHealth] = useState(100);
  const [combatLog, setCombatLog] = useState([]);
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  
  // Check if player encounters an enemy
  useEffect(() => {
    if (!gameData?.sprites?.characters) return;
    
    // In a real implementation, this would check actual enemy positions
    // For demonstration, we'll trigger combat when player reaches a specific position
    const combatTriggerX = 5;
    const combatTriggerY = 5;
    
    if (Math.floor(playerPos.x) === combatTriggerX && Math.floor(playerPos.y) === combatTriggerY) {
      // Start combat with a random enemy
      startCombat();
    }
  }, [playerPos, gameData]);
  
  // Start combat with an enemy
  const startCombat = () => {
    // Find a random enemy in the game data
    const enemies = gameData?.sprites?.characters?.filter(char => char.type === "enemy") || [];
    if (enemies.length > 0) {
      const randomEnemy = enemies[Math.floor(Math.random() * enemies.length)];
      setEnemy(randomEnemy);
      setInCombat(true);
      setPlayerHealth(100);
      setEnemyHealth(100);
      setCombatLog([`Combat started with a ${randomEnemy.description}!`]);
      setIsPlayerTurn(true);
      
      if (onCombatStart) {
        onCombatStart(randomEnemy);
      }
    }
  };
  
  // Player attack action
  const playerAttack = () => {
    if (!inCombat || !isPlayerTurn) return;
    
    // Calculate damage (random between 10-30)
    const damage = Math.floor(Math.random() * 21) + 10;
    const newEnemyHealth = Math.max(0, enemyHealth - damage);
    
    setEnemyHealth(newEnemyHealth);
    setCombatLog(prev => [...prev, `You attack the ${enemy.description} for ${damage} damage!`]);
    setIsPlayerTurn(false);
    
    // Check if enemy is defeated
    if (newEnemyHealth <= 0) {
      endCombat(true);
    } else {
      // Enemy's turn after a delay
      setTimeout(enemyTurn, 1000);
    }
  };
  
  // Enemy attack action
  const enemyTurn = () => {
    if (!inCombat || isPlayerTurn) return;
    
    // Calculate damage (random between 5-25)
    const damage = Math.floor(Math.random() * 21) + 5;
    const newPlayerHealth = Math.max(0, playerHealth - damage);
    
    setPlayerHealth(newPlayerHealth);
    setCombatLog(prev => [...prev, `The ${enemy.description} attacks you for ${damage} damage!`]);
    setIsPlayerTurn(true);
    
    // Check if player is defeated
    if (newPlayerHealth <= 0) {
      endCombat(false);
    }
  };
  
  // Player defend action
  const playerDefend = () => {
    if (!inCombat || !isPlayerTurn) return;
    
    // When defending, reduce incoming damage by 50%
    setCombatLog(prev => [...prev, `You defend against the next attack.`]);
    setIsPlayerTurn(false);
    
    // Enemy's turn after a delay
    setTimeout(() => {
      if (!inCombat) return;
      
      // Calculate reduced damage (random between 5-25, reduced by 50%)
      const damage = Math.floor(Math.random() * 21) + 5;
      const reducedDamage = Math.floor(damage * 0.5);
      const newPlayerHealth = Math.max(0, playerHealth - reducedDamage);
      
      setPlayerHealth(newPlayerHealth);
      setCombatLog(prev => [...prev, `The ${enemy.description} attacks you for ${reducedDamage} damage! (defended)`]);
      setIsPlayerTurn(true);
      
      // Check if player is defeated
      if (newPlayerHealth <= 0) {
        endCombat(false);
      }
    }, 1000);
  };
  
  // End combat
  const endCombat = (playerWon) => {
    setInCombat(false);
    setEnemy(null);
    
    if (playerWon) {
      setCombatLog(prev => [...prev, `You defeated the ${enemy.description}!`]);
    } else {
      setCombatLog(prev => [...prev, `You were defeated by the ${enemy.description}!`]);
    }
    
    if (onCombatEnd) {
      onCombatEnd(playerWon);
    }
  };
  
  // Flee from combat
  const fleeCombat = () => {
    if (!inCombat) return;
    
    // 70% chance to successfully flee
    const fleeSuccess = Math.random() < 0.7;
    
    if (fleeSuccess) {
      setCombatLog(prev => [...prev, `You successfully flee from combat!`]);
      endCombat(null); // null indicates flee
    } else {
      setCombatLog(prev => [...prev, `You failed to flee! The ${enemy.description} attacks!`]);
      setIsPlayerTurn(false);
      setTimeout(enemyTurn, 1000);
    }
  };
  
  return (
    <div className="absolute inset-0 bg-black bg-opacity-80 text-white flex flex-col items-center justify-center">
      {inCombat && (
        <div className="bg-gray-900 p-6 rounded-lg shadow-lg w-full max-w-2xl">
          <h2 className="text-2xl font-bold mb-4 text-center">Combat!</h2>
          
          {/* Combat status */}
          <div className="flex justify-between mb-6">
            <div className="text-center">
              <h3 className="text-lg font-bold">Player</h3>
              <div className="w-32 h-4 bg-gray-700 rounded-full mt-2">
                <div 
                  className="h-full bg-green-500 rounded-full"
                  style={{ width: `${playerHealth}%` }}
                ></div>
              </div>
              <p className="mt-1">HP: {playerHealth}/100</p>
            </div>
            
            <div className="text-center">
              <h3 className="text-lg font-bold">{enemy?.description || "Enemy"}</h3>
              <div className="w-32 h-4 bg-gray-700 rounded-full mt-2">
                <div 
                  className="h-full bg-red-500 rounded-full"
                  style={{ width: `${enemyHealth}%` }}
                ></div>
              </div>
              <p className="mt-1">HP: {enemyHealth}/100</p>
            </div>
          </div>
          
          {/* Combat actions */}
          <div className="flex justify-center space-x-4 mb-6">
            <button
              onClick={playerAttack}
              disabled={!isPlayerTurn}
              className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white font-bold py-2 px-4 rounded"
            >
              Attack
            </button>
            <button
              onClick={playerDefend}
              disabled={!isPlayerTurn}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-bold py-2 px-4 rounded"
            >
              Defend
            </button>
            <button
              onClick={fleeCombat}
              disabled={!isPlayerTurn}
              className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 text-white font-bold py-2 px-4 rounded"
            >
              Flee
            </button>
          </div>
          
          {/* Combat log */}
          <div className="bg-black bg-opacity-50 p-4 rounded h-40 overflow-y-auto">
            <h3 className="font-bold mb-2">Combat Log:</h3>
            {combatLog.map((log, index) => (
              <p key={index} className="mb-1">{log}</p>
            ))}
          </div>
          
          {/* Turn indicator */}
          <div className="mt-4 text-center">
            {isPlayerTurn ? (
              <p className="text-green-400">Your turn</p>
            ) : (
              <p className="text-red-400">Enemy's turn</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}