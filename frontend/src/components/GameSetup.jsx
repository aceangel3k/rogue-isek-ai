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

export default function GameSetup({ onGenerate, setGameState }) {
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
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#000' }}>
      <div className="max-w-4xl w-full">
        {/* ASCII Art Title */}
        <div className="text-center mb-8">
          <pre className="ascii-art ascii-art-animated text-sm md:text-base" style={{ fontSize: '10px', lineHeight: '0.9' }}>
{`
██████╗  ██████╗  ██████╗ ██╗   ██╗███████╗    ██╗███████╗███████╗██╗  ██╗     █████╗ ██╗
██╔══██╗██╔═══██╗██╔════╝ ██║   ██║██╔════╝    ██║██╔════╝██╔════╝██║ ██╔╝    ██╔══██╗██║
██████╔╝██║   ██║██║  ███╗██║   ██║█████╗      ██║███████╗█████╗  █████╔╝     ███████║██║
██╔══██╗██║   ██║██║   ██║██║   ██║██╔══╝      ██║╚════██║██╔══╝  ██╔═██╗     ██╔══██║██║
██║  ██║╚██████╔╝╚██████╔╝╚██████╔╝███████╗    ██║███████║███████╗██║  ██╗    ██║  ██║██║
╚═╝  ╚═╝ ╚═════╝  ╚═════╝  ╚═════╝ ╚══════╝    ╚═╝╚══════╝╚══════╝╚═╝  ╚═╝    ╚═╝  ╚═╝╚═╝
`}
          </pre>
          <p className="text-lg retro-glow mt-4" style={{ color: '#00ff00' }}>
            &gt; ENTER DUNGEON PARAMETERS FOR PROCEDURAL GENERATION
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="mb-8">
          <div className="retro-border p-4" style={{ background: '#0a0a0a' }}>
            <div className="mb-2 retro-glow" style={{ color: '#00ff00' }}>&gt; INPUT_PROMPT:</div>
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="CYBERPUNK TOWER WITH ROGUE AI..."
              className="w-full p-3 text-lg mb-4"
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
          </div>
        </form>
        
        {/* Load Game Button */}
        <div className="mb-8 text-center flex gap-4 justify-center">
          <button
            onClick={() => setShowSavedGames(true)}
            className="retro-button"
            disabled={isLoading}
          >
            [LOAD SAVED GAME]
          </button>
          <button
            onClick={() => {
              localStorage.removeItem('playedDungeonIds');
              alert('Played dungeons history cleared! You can now replay all dungeons.');
            }}
            className="retro-button"
            style={{ opacity: 0.7 }}
            disabled={isLoading}
            title="Clear the list of played dungeons to replay them"
          >
            [RESET DUNGEON HISTORY]
          </button>
        </div>
        
        <div className="retro-panel">
          <h2 className="text-xl font-bold mb-4 retro-glow" style={{ color: '#00ff00' }}>
            &gt; EXAMPLE_PARAMETERS:
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {examplePrompts.map((example, index) => (
              <button
                key={index}
                onClick={() => handleExampleClick(example)}
                className="text-left p-3 retro-list-item"
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