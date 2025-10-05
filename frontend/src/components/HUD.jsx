import { useState, useEffect } from 'react';

/**
 * HUD Component - Displays player stats with AI-generated frame
 * 
 * Features:
 * - Health bar with visual indicator
 * - Ammo counter
 * - Gold display
 * - Kill counter
 * - AI-generated HUD frame overlay
 */
export default function HUD({ gameData, playerHealth = 100, maxHealth = 100, ammo = 50, gold = 0, kills = 0 }) {
  const [hudFrame, setHudFrame] = useState(null);
  
  // Load HUD frame from game data
  useEffect(() => {
    if (gameData?.hudFrame) {
      const img = new Image();
      img.onload = () => {
        setHudFrame(img);
        console.log('HUD frame loaded');
      };
      img.onerror = (error) => {
        console.error('Failed to load HUD frame:', error);
      };
      img.src = gameData.hudFrame;
    }
  }, [gameData]);
  
  // Calculate health percentage
  const healthPercent = (playerHealth / maxHealth) * 100;
  
  // Health bar color based on percentage
  const getHealthColor = () => {
    if (healthPercent > 60) return '#00ff00'; // Green
    if (healthPercent > 30) return '#ffff00'; // Yellow
    return '#ff0000'; // Red
  };
  
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 1000 }}>
      {/* Dark vignette overlay at edges */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(circle at center, transparent 40%, rgba(0,0,0,0.5) 80%, rgba(0,0,0,0.8) 100%)',
          pointerEvents: 'none'
        }}
      />
      
      {/* AI-generated HUD frame overlay (edges) */}
      {hudFrame && (
        <img 
          src={hudFrame.src}
          alt="HUD Frame"
          className="absolute inset-0 w-full h-full object-fill"
          style={{
            mixBlendMode: 'normal',
            opacity: 0.7,
            imageRendering: 'pixelated',
            maskImage: 'radial-gradient(circle at center, transparent 35%, rgba(0,0,0,0.3) 60%, black 75%)',
            WebkitMaskImage: 'radial-gradient(circle at center, transparent 35%, rgba(0,0,0,0.3) 60%, black 75%)'
          }}
        />
      )}
      
      {/* Bottom HUD bar - Responsive for mobile */}
      <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-4">
        <div className="flex items-end justify-between max-w-6xl mx-auto">
          {/* Left side - Health */}
          <div className="flex flex-col gap-1 sm:gap-2">
            <div className="text-white font-bold text-xs sm:text-sm uppercase tracking-wider drop-shadow-lg">
              Health
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Health bar */}
              <div className="w-24 sm:w-48 h-6 sm:h-8 bg-black bg-opacity-70 border-2 border-white rounded overflow-hidden">
                <div 
                  className="h-full transition-all duration-300 ease-out"
                  style={{
                    width: `${healthPercent}%`,
                    backgroundColor: getHealthColor(),
                    boxShadow: `0 0 10px ${getHealthColor()}`
                  }}
                />
              </div>
              {/* Health number */}
              <div 
                className="text-xl sm:text-3xl font-bold drop-shadow-lg"
                style={{ color: getHealthColor() }}
              >
                {Math.max(0, Math.floor(playerHealth))}
              </div>
            </div>
          </div>
          
          {/* Center - Ammo (hidden on very small screens) */}
          <div className="hidden sm:flex flex-col items-center gap-2">
            <div className="text-white font-bold text-sm uppercase tracking-wider drop-shadow-lg">
              Ammo
            </div>
            <div className="text-4xl font-bold text-yellow-400 drop-shadow-lg">
              {ammo}
            </div>
          </div>
          
          {/* Right side - Gold & Kills */}
          <div className="flex flex-col gap-1 sm:gap-3">
            {/* Gold */}
            <div className="flex items-center gap-2 sm:gap-3 justify-end">
              <div className="text-white font-bold text-xs sm:text-sm uppercase tracking-wider drop-shadow-lg">
                Gold
              </div>
              <div className="text-lg sm:text-2xl font-bold text-yellow-300 drop-shadow-lg">
                {gold}
              </div>
            </div>
            
            {/* Kills */}
            <div className="flex items-center gap-2 sm:gap-3 justify-end">
              <div className="text-white font-bold text-xs sm:text-sm uppercase tracking-wider drop-shadow-lg">
                Kills
              </div>
              <div className="text-lg sm:text-2xl font-bold text-red-400 drop-shadow-lg">
                {kills}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Top corners - Additional info - Responsive */}
      <div className="absolute top-2 sm:top-4 left-2 sm:left-4 text-white text-xs sm:text-sm font-bold drop-shadow-lg">
        <div className="bg-black bg-opacity-50 px-2 sm:px-3 py-1 sm:py-2 rounded">
          {gameData?.story?.title || 'AI Dungeon Crawler'}
        </div>
      </div>
    </div>
  );
}
