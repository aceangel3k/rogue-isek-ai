export default function NoSharedDungeons({ onReturnToMenu }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: '#000' }}>
      <div className="max-w-3xl w-full text-center">
        {/* ASCII Art Icon */}
        <div className="mb-8">
          <pre className="ascii-art retro-glow" style={{ fontSize: '12px', lineHeight: '1' }}>
{`
    ╔═══════════════════════════════════════╗
    ║                                       ║
    ║     ██████╗ ██╗   ██╗███████╗███████╗║
    ║     ██╔══██╗██║   ██║██╔════╝██╔════╝║
    ║     ██████╔╝██║   ██║█████╗  █████╗  ║
    ║     ██╔══██╗██║   ██║██╔══╝  ██╔══╝  ║
    ║     ██████╔╝╚██████╔╝██║     ██║     ║
    ║     ╚═════╝  ╚═════╝ ╚═╝     ╚═╝     ║
    ║                                       ║
    ╚═══════════════════════════════════════╝
`}
          </pre>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold mb-6 retro-glow" style={{ color: '#00ff00' }}>
          &gt; SHARED_WORLD_BUFFER_EMPTY
        </h1>

        {/* Message */}
        <div className="retro-panel mb-8">
          <p className="text-xl mb-4 retro-glow" style={{ color: '#ffb000' }}>
            [!] ALL AVAILABLE DUNGEONS EXPLORED
          </p>
          <p className="mb-6" style={{ color: '#00ff00' }}>
            &gt; THE SHARED WORLD EXPANDS AS PLAYERS COMPLETE DUNGEONS.<br/>
            &gt; EACH COMPLETED DUNGEON ADDS TO THE COLLECTIVE POOL.<br/>
            &gt; OTHER PLAYERS CAN THEN EXPERIENCE YOUR CREATION.
          </p>
          
          {/* Stats/Info */}
          <div className="retro-border p-6 mb-4" style={{ background: '#0a0a0a' }}>
            <div className="flex items-center justify-center gap-3 mb-3">
              <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: '#00ff00', boxShadow: '0 0 10px #00ff00' }}></div>
              <p className="font-semibold retro-glow" style={{ color: '#00ff00' }}>
                &gt; SYSTEM_PROTOCOL:
              </p>
            </div>
            <ul className="text-left space-y-2 max-w-md mx-auto" style={{ color: '#00ff00' }}>
              <li className="retro-list-item">
                COMPLETE DUNGEON → ADD TO SHARED POOL
              </li>
              <li className="retro-list-item">
                OTHER PLAYERS → EXPERIENCE YOUR CREATION
              </li>
              <li className="retro-list-item">
                YOU → PLAY DUNGEONS FROM OTHER PLAYERS
              </li>
            </ul>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={onReturnToMenu}
            className="retro-button px-8 py-4 text-lg"
          >
            [RETURN TO MAIN MENU]
          </button>
          <button
            onClick={onReturnToMenu}
            className="retro-button px-8 py-4 text-lg"
          >
            [GENERATE NEW DUNGEON]
          </button>
        </div>

        {/* Tip */}
        <div className="mt-8 text-sm retro-glow" style={{ color: '#00ff00' }}>
          <p>&gt; TIP: CREATE DUNGEONS WITH VARIED THEMES FOR DIVERSITY</p>
        </div>
      </div>
    </div>
  );
}
