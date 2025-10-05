import { useState, useEffect } from 'react';

export default function StoryTransition({ 
  previousTheme, 
  newTheme, 
  newCreator,
  storyPatch, 
  onContinue 
}) {
  const [showContinue, setShowContinue] = useState(false);

  useEffect(() => {
    // Show continue button after story is displayed
    const timer = setTimeout(() => {
      setShowContinue(true);
    }, 3000); // 3 seconds to read the story

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-50 p-4">
      <div className="max-w-3xl w-full">
        {/* Title */}
        <div className="text-center mb-8">
          <h2 className="text-4xl font-bold mb-2" style={{ color: '#00ffff', textShadow: '0 0 5px #00ffff' }}>
            &gt; THE JOURNEY CONTINUES...
          </h2>
          <p className="text-lg" style={{ color: '#666' }}>
            [ENTERING {newCreator ? `${newCreator.toUpperCase()}'S` : 'A NEW'} DUNGEON]
          </p>
        </div>

        {/* Story Patch */}
        <div className="retro-panel p-8 mb-8">
          <div className="text-xl leading-relaxed text-center" style={{ color: '#00ffff' }}>
            {storyPatch}
          </div>
        </div>

        {/* Theme Transition */}
        <div className="flex items-center justify-center gap-6 mb-8">
          <div className="text-center flex-1">
            <div className="text-sm mb-2" style={{ color: '#666' }}>&gt; YOU ESCAPED:</div>
            <div className="text-lg font-bold" style={{ color: '#999' }}>{(previousTheme || 'THE PREVIOUS DUNGEON').toUpperCase()}</div>
          </div>
          
          <div className="text-3xl" style={{ color: '#00ffff' }}>→</div>
          
          <div className="text-center flex-1">
            <div className="text-sm mb-2" style={{ color: '#666' }}>&gt; NOW ENTERING:</div>
            <div className="text-lg font-bold" style={{ color: '#00ffff' }}>{newTheme.toUpperCase()}</div>
          </div>
        </div>

        {/* Continue Button */}
        {showContinue && (
          <div className="text-center">
            <button
              onClick={onContinue}
              className="px-8 py-4 retro-button font-bold text-xl animate-pulse"
            >
              [ENTER DUNGEON]
            </button>
            <p className="text-sm mt-4" style={{ color: '#666' }}>
              &gt; PRESS ANY KEY OR CLICK TO CONTINUE
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
