import { useState, useEffect, useRef } from 'react';

export default function BackgroundMusic({ videoId = 'DpxZ5PHa6xo' }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const playerRef = useRef(null);
  const containerRef = useRef(null);
  const isInitialized = useRef(false);

  useEffect(() => {
    // Only initialize once
    if (isInitialized.current) return;
    
    // Check if API is already loaded
    if (window.YT && window.YT.Player) {
      initializePlayer();
      isInitialized.current = true;
    } else {
      // Load YouTube IFrame API only if not already loaded
      if (!window.YT) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        tag.async = true;
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      }

      // Create player when API is ready
      window.onYouTubeIframeAPIReady = () => {
        initializePlayer();
        isInitialized.current = true;
      };
    }

    return () => {
      // Cleanup on unmount
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        try {
          playerRef.current.destroy();
        } catch (e) {
          console.log('Player cleanup error (safe to ignore):', e);
        }
      }
    };
  }, []);

  const initializePlayer = () => {
    if (!containerRef.current) return;
    
    try {
      playerRef.current = new window.YT.Player('youtube-player', {
        height: '0',
        width: '0',
        videoId: videoId,
        playerVars: {
          autoplay: 0,
          controls: 0,
          loop: 1,
          playlist: videoId,
          playsinline: 1,
          enablejsapi: 1,
        },
        events: {
          onReady: (event) => {
            event.target.setVolume(30);
          },
          onStateChange: (event) => {
            if (event.data === window.YT.PlayerState.ENDED) {
              event.target.playVideo();
            }
          },
        },
      });
    } catch (e) {
      console.error('Failed to initialize YouTube player:', e);
    }
  };

  const toggleMusic = () => {
    if (!playerRef.current) return;

    if (isPlaying) {
      playerRef.current.pauseVideo();
      setIsPlaying(false);
    } else {
      playerRef.current.playVideo();
      playerRef.current.unMute();
      setIsPlaying(true);
      setIsMuted(false);
    }
  };

  return (
    <div ref={containerRef}>
      {/* Hidden YouTube Player */}
      <div id="youtube-player" style={{ position: 'absolute', width: '0', height: '0', overflow: 'hidden' }}></div>

      {/* Music Toggle Button */}
      <button
        onClick={toggleMusic}
        className="fixed bottom-4 right-4 retro-button px-4 py-2"
        title={isPlaying ? 'Pause Music' : 'Play Music'}
        style={{
          background: isPlaying ? '#0a0a0a' : '#000',
          borderColor: isPlaying ? '#00ff00' : '#666',
          zIndex: 9999,
        }}
      >
        {isPlaying ? (
          <span style={{ color: '#00ff00' }}>♪ [MUSIC: ON]</span>
        ) : (
          <span style={{ color: '#666' }}>♪ [MUSIC: OFF]</span>
        )}
      </button>
    </div>
  );
}
