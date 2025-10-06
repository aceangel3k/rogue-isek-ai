import { useState } from 'react';

export default function StoryIntro({ gameData, onContinue }) {
  const [isVisible, setIsVisible] = useState(true);

  const handleContinue = () => {
    setIsVisible(false);
    if (onContinue) {
      onContinue();
    }
  };

  if (!isVisible) return null;

  const story = gameData?.story || {};
  const theme = gameData?.theme || {};
  const title = story.title || 'The Dungeon Awaits';
  const narrative = story.narrative || story.intro || 'Your adventure begins...';
  const winCondition = story.win_condition || 'Survive and escape.';
  const primaryColor = theme.primary_color || '#10b981';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center p-4 overflow-y-auto" style={{ zIndex: 10000 }}>
      <div className="max-w-3xl w-full my-auto">
        {/* Title */}
        <div className="text-center mb-4 sm:mb-8">
          <h1 
            className="text-3xl sm:text-5xl font-bold mb-2 sm:mb-4"
            style={{ color: primaryColor, textShadow: `0 0 5px ${primaryColor}` }}
          >
            &gt; {title.toUpperCase()}
          </h1>
          {theme.atmosphere && (
            <p className="text-sm sm:text-lg" style={{ color: '#666' }}>
              [{theme.atmosphere.toUpperCase()}]
            </p>
          )}
        </div>

        {/* Story Narrative */}
        <div 
          className="retro-panel p-4 sm:p-8 mb-4 sm:mb-6"
        >
          <div className="text-base sm:text-xl leading-relaxed mb-4 sm:mb-6" style={{ color: primaryColor }}>
            {narrative}
          </div>
          
          {/* Objective */}
          <div style={{ borderTop: `2px solid ${primaryColor}`, paddingTop: '12px' }}>
            <div className="text-xs sm:text-sm mb-2" style={{ color: '#666' }}>&gt; OBJECTIVE:</div>
            <div 
              className="text-base sm:text-lg font-bold"
              style={{ color: primaryColor }}
            >
              {winCondition}
            </div>
          </div>
        </div>

        {/* Continue Button */}
        <div className="text-center pb-4">
          <button
            onClick={handleContinue}
            className="px-6 py-3 sm:px-8 sm:py-4 retro-button font-bold text-lg sm:text-xl"
            style={{
              background: '#0a0a0a',
              borderColor: '#00ff00',
              borderWidth: '3px',
              boxShadow: '0 0 20px rgba(0, 255, 0, 0.5), inset 0 0 10px rgba(0, 255, 0, 0.1)',
              color: '#00ff00',
              minHeight: '60px',
              minWidth: '280px'
            }}
          >
            [BEGIN ADVENTURE]
          </button>
          <p className="text-xs sm:text-sm mt-4" style={{ color: '#00ff00', opacity: 0.7 }}>
            &gt; PRESS ANY KEY OR CLICK TO START
          </p>
        </div>
      </div>
    </div>
  );
}
