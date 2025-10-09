import { useState } from 'react';
import SavedGames from './SavedGames';

const examplePrompts = [
  "A haunted castle with undead knights",
  "A cyberpunk tower with rogue AI",
  "An ancient temple with cursed guardians",
  "A spaceship with hostile aliens",
  "A dark forest with shadow wolves",
  "An underwater cavern with aggressive sea creatures",
  "A post-apocalyptic bunker with mutated survivors",
  "A fantasy dungeon with dragon cultists",
  "A gothic cathedral with possessed priests",
  "A frozen wasteland with ice demons"
];

export default function GameSetup({ onGenerate, setGameState, progressiveDifficulty, setProgressiveDifficulty }) {
  const [prompt, setPrompt] = useState(() => {
    // Load saved prompt from sessionStorage
    return sessionStorage.getItem('lastPrompt') || '';
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showSavedGames, setShowSavedGames] = useState(false);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    
    // Save prompt to sessionStorage for retry
    sessionStorage.setItem('lastPrompt', prompt);
    
    setIsLoading(true);
    try {
      await onGenerate(prompt);
    } catch (error) {
      console.error('Error generating game:', error);
      alert('Error generating game. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleExampleClick = (examplePrompt) => {
    setPrompt(examplePrompt);
  };
  
  // Add a function to navigate to the sprite test page
  const handleSpriteTestClick = () => {
    setGameState('sprite-test');
  };
  
  const handleLoadGame = async (save) => {
    try {
      setIsLoading(true);
      // Load the saved game data
      const gameData = save.game_data;
      
      // Set the prompt for display
      setPrompt(save.prompt);
      sessionStorage.setItem('lastPrompt', save.prompt);
      
      // Call onGenerate with the saved game data directly
      await onGenerate(save.prompt, gameData);
      setShowSavedGames(false);
    } catch (error) {
      console.error('Error loading game:', error);
      alert('Failed to load game');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="h-screen overflow-y-auto p-4 pt-8 pb-24" style={{ background: '#000' }}>
      <div className="max-w-4xl w-full mx-auto">
        {/* ASCII Art Title - Responsive */}
        <div className="text-center mb-4 sm:mb-8">
          {/* Mobile Portrait: Simple Text Logo */}
          <div className="block sm:hidden">
            <h1 className="text-4xl font-bold retro-glow mb-2" style={{ color: '#00ff00', fontFamily: 'monospace', letterSpacing: '0.1em' }}>
              ROGUE<br/>ISEK AI
            </h1>
          </div>
          
          {/* Desktop/Landscape: Full ASCII Art */}
          <pre className="hidden sm:block ascii-art ascii-art-animated text-sm md:text-base" style={{ lineHeight: '0.9' }}>
{`
██████╗  ██████╗  ██████╗ ██╗   ██╗███████╗    ██╗███████╗███████╗██╗  ██╗     █████╗ ██╗
██╔══██╗██╔═══██╗██╔════╝ ██║   ██║██╔════╝    ██║██╔════╝██╔════╝██║ ██╔╝    ██╔══██╗██║
██████╔╝██║   ██║██║  ███╗██║   ██║█████╗      ██║███████╗█████╗  █████╔╝     ███████║██║
██╔══██╗██║   ██║██║   ██║██║   ██║██╔══╝      ██║╚════██║██╔══╝  ██╔═██╗     ██╔══██║██║
██║  ██║╚██████╔╝╚██████╔╝╚██████╔╝███████╗    ██║███████║███████╗██║  ██╗    ██║  ██║██║
╚═╝  ╚═╝ ╚═════╝  ╚═════╝  ╚═════╝ ╚══════╝    ╚═╝╚══════╝╚══════╝╚═╝  ╚═╝    ╚═╝  ╚═╝╚═╝
`}
          </pre>
          
          <p className="text-xs sm:text-lg retro-glow mt-2 sm:mt-4 px-2" style={{ color: '#00ff00' }}>
            &gt; ENTER DUNGEON PARAMETERS FOR PROCEDURAL GENERATION
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="mb-4 sm:mb-8">
          <div className="retro-border p-3 sm:p-4" style={{ background: '#0a0a0a' }}>
            <div className="mb-2 retro-glow text-xs sm:text-base" style={{ color: '#00ff00' }}>&gt; INPUT_PROMPT:</div>
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="CYBERPUNK TOWER WITH ROGUE AI..."
              className="w-full p-2 sm:p-3 text-sm sm:text-lg mb-3 sm:mb-4"
              style={{ background: '#000', border: '1px solid #00ff00', color: '#00ff00' }}
              disabled={isLoading}
            />
            <button
              type="submit"
              className="w-full retro-button"
              disabled={isLoading || !prompt.trim()}
            >
              {isLoading ? '[GENERATING...]' : '[EXECUTE GENERATION]'}
            </button>
            
            {/* Progressive Difficulty Toggle */}
            <div className="mt-4 pt-4 border-t" style={{ borderColor: '#00ff00', borderOpacity: 0.3 }}>
              <button
                type="button"
                onClick={() => setProgressiveDifficulty(!progressiveDifficulty)}
                className="w-full text-left p-2 hover:brightness-125 transition-all"
                style={{ 
                  border: '1px solid #00ff00',
                  background: '#0a0a0a'
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="retro-glow text-xs sm:text-sm mb-1" style={{ color: '#00ff00' }}>
                      &gt; PROGRESSIVE_DIFFICULTY: [{progressiveDifficulty ? 'ON' : 'OFF'}]
                    </div>
                    <div className="text-xs opacity-70 font-mono" style={{ color: '#00ff00' }}>
                      {progressiveDifficulty 
                        ? '// Accumulate enemies from previous levels' 
                        : '// Each level uses only original enemies'}
                    </div>
                  </div>
                  <div className="ml-4 font-mono text-lg retro-glow" style={{ color: '#00ff00' }}>
                    {progressiveDifficulty ? '[X]' : '[ ]'}
                  </div>
                </div>
              </button>
            </div>
          </div>
        </form>
        
        {/* Load Game Button - Responsive */}
        <div className="mb-4 sm:mb-8 text-center flex flex-col sm:flex-row gap-2 sm:gap-4 justify-center">
          <button
            onClick={() => setShowSavedGames(true)}
            className="retro-button text-xs sm:text-base px-3 py-2"
            disabled={isLoading}
          >
            [LOAD SAVED GAME]
          </button>
          <button
            onClick={() => {
              localStorage.removeItem('playedDungeonIds');
              localStorage.removeItem('playedPrompts');
              alert('Played dungeons history cleared! You can now replay all dungeons.');
            }}
            className="retro-button text-xs sm:text-base px-3 py-2"
            style={{ opacity: 0.7 }}
            disabled={isLoading}
            title="Clear the list of played dungeons to replay them"
          >
            [RESET DUNGEON HISTORY]
          </button>
        </div>
        
        {/* Example Parameters - Always visible, scrollable on mobile landscape */}
        <div className="retro-panel">
          <h2 className="text-sm sm:text-xl font-bold mb-2 sm:mb-4 retro-glow" style={{ color: '#00ff00' }}>
            &gt; EXAMPLE_PARAMETERS:
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 max-h-[40vh] sm:max-h-none overflow-y-auto">
            {examplePrompts.map((example, index) => (
              <button
                key={index}
                onClick={() => handleExampleClick(example)}
                className="text-left p-2 sm:p-3 retro-list-item text-xs sm:text-base hover:brightness-125 transition-all"
                style={{ background: '#0a0a0a', border: '1px solid #00ff00', color: '#00ff00' }}
                disabled={isLoading}
              >
                {example.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        
        {/* Add a button to navigate to the sprite test page */}
        <div className="mt-8 text-center">
          <button
            onClick={handleSpriteTestClick}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors hidden"
          >
            Test Sprite Generation
          </button>
        </div>
      </div>
      
      {/* Saved Games Modal */}
      {showSavedGames && (
        <SavedGames
          onLoadGame={handleLoadGame}
          onClose={() => setShowSavedGames(false)}
        />
      )}
    </div>
  );
}