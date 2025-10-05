import { useEffect, useState } from 'react';

export default function GameOverScreen({ 
  gameData, 
  stats, 
  onRetry, 
  onMainMenu 
}) {
  const [timeElapsed, setTimeElapsed] = useState('0:00');
  
  // Extract theme colors with fallbacks
  const primaryColor = gameData?.theme?.primary_color || '#ef4444'; // red-500
  const secondaryColor = gameData?.theme?.secondary_color || '#dc2626'; // red-600

  useEffect(() => {
    // Format time elapsed
    if (stats?.timeElapsed) {
      const minutes = Math.floor(stats.timeElapsed / 60);
      const seconds = Math.floor(stats.timeElapsed % 60);
      setTimeElapsed(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    }
  }, [stats]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center" style={{ zIndex: 10000 }}>
      <div 
        className="retro-panel max-w-2xl w-full mx-4"
        style={{ padding: '32px' }}
      >
        {/* Header */}
        <div className="text-center mb-8">
          <h1 
            className="text-5xl font-bold mb-4 animate-pulse"
            style={{ color: primaryColor }}
          >
            💀 You Died 💀
          </h1>
          <p className="text-xl text-gray-300">
            The darkness has claimed you...
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
            <div className="text-gray-400 text-sm uppercase">Time Survived</div>
          </div>

          {/* Items Purchased */}
          <div 
            className="p-6 border-2 text-center"
            style={{ 
              borderColor: primaryColor,
              backgroundColor: '#0a0a0a',
              boxShadow: `0 0 5px ${primaryColor}50`
            }}
          >
            <div className="text-4xl mb-2">🛒</div>
            <div 
              className="text-3xl font-bold mb-1"
              style={{ color: primaryColor }}
            >
              {stats?.itemsPurchased || 0}
            </div>
            <div className="text-gray-400 text-sm uppercase">Items Purchased</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={onRetry}
            className="flex-1 py-4 retro-button font-bold text-xl"
          >
            [TRY AGAIN]
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
            "Death is not the end, but merely a lesson learned..."
          </p>
        </div>
      </div>
    </div>
  );
}
