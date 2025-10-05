import { useEffect, useState } from 'react';

export default function CompletionScreen({ 
  gameData, 
  stats, 
  onNextLevel, 
  onMainMenu 
}) {
  const [timeElapsed, setTimeElapsed] = useState('0:00');
  
  // Extract theme colors with fallbacks
  const primaryColor = gameData?.theme?.primary_color || '#10b981'; // green-500
  const secondaryColor = gameData?.theme?.secondary_color || '#059669'; // green-600

  useEffect(() => {
    // Format time elapsed
    if (stats?.timeElapsed) {
      const minutes = Math.floor(stats.timeElapsed / 60);
      const seconds = Math.floor(stats.timeElapsed % 60);
      setTimeElapsed(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    }
  }, [stats]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
      <div 
        className="retro-panel max-w-2xl w-full mx-4"
        style={{ padding: '32px' }}
      >
        {/* Header */}
        <div className="text-center mb-8">
          <h1 
            className="text-5xl font-bold mb-4"
            style={{ color: primaryColor }}
          >
            🎉 Level Complete!
          </h1>
          <p className="text-xl text-gray-300">
            {gameData?.story?.win_condition || "You've conquered the dungeon!"}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          {/* Kills */}
          <div 
            className="p-6 border-2 text-center"
            style={{ 
              borderColor: primaryColor,
              backgroundColor: '#0a0a0a',
              boxShadow: `0 0 5px ${primaryColor}50`
            }}
          >
            <div className="text-4xl mb-2">⚔️</div>
            <div 
              className="text-3xl font-bold mb-1"
              style={{ color: primaryColor }}
            >
              {stats?.kills || 0}
            </div>
            <div className="text-gray-400 text-sm uppercase">Enemies Defeated</div>
          </div>

          {/* Gold */}
          <div 
            className="p-6 border-2 text-center"
            style={{ 
              borderColor: primaryColor,
              backgroundColor: '#0a0a0a',
              boxShadow: `0 0 5px ${primaryColor}50`
            }}
          >
            <div className="text-4xl mb-2">🪙</div>
            <div 
              className="text-3xl font-bold mb-1"
              style={{ color: primaryColor }}
            >
              {stats?.gold || 0}
            </div>
            <div className="text-gray-400 text-sm uppercase">Gold Collected</div>
          </div>

          {/* Time */}
          <div 
            className="p-6 border-2 text-center"
            style={{ 
              borderColor: primaryColor,
              backgroundColor: '#0a0a0a',
              boxShadow: `0 0 5px ${primaryColor}50`
            }}
          >
            <div className="text-4xl mb-2">⏱️</div>
            <div 
              className="text-3xl font-bold mb-1"
              style={{ color: primaryColor }}
            >
              {timeElapsed}
            </div>
            <div className="text-gray-400 text-sm uppercase">Time Elapsed</div>
          </div>

          {/* Health Remaining */}
          <div 
            className="p-6 border-2 text-center"
            style={{ 
              borderColor: primaryColor,
              backgroundColor: '#0a0a0a',
              boxShadow: `0 0 5px ${primaryColor}50`
            }}
          >
            <div className="text-4xl mb-2">❤️</div>
            <div 
              className="text-3xl font-bold mb-1"
              style={{ color: primaryColor }}
            >
              {stats?.healthRemaining || 0}
            </div>
            <div className="text-gray-400 text-sm uppercase">Health Remaining</div>
          </div>
        </div>

        {/* Bonus Stats */}
        {stats?.itemsPurchased > 0 && (
          <div className="mb-6 p-4 bg-gray-800 rounded border border-gray-700 text-center">
            <p className="text-gray-300">
              <span className="font-bold" style={{ color: primaryColor }}>
                {stats.itemsPurchased}
              </span> items purchased from the shop
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={onNextLevel}
            className="flex-1 py-4 retro-button font-bold text-xl"
          >
            [NEXT LEVEL]
          </button>
          <button
            onClick={onMainMenu}
            className="px-8 py-4 retro-button font-bold text-xl"
          >
            [MAIN MENU]
          </button>
        </div>

        {/* Flavor Text */}
        <div className="mt-6 text-center">
          <p className="text-gray-500 text-sm italic">
            "The path ahead grows darker, but your courage shines brighter..."
          </p>
        </div>
      </div>
    </div>
  );
}
