import { useEffect, useRef, useState } from 'react';

/**
 * Mobile Touch Controls Component
 * Provides virtual joystick for movement and action buttons for shooting/interaction
 * Optimized for iPhone 13+ and modern mobile devices
 */
export default function MobileControls({ 
  onMove, 
  onShoot, 
  onInteract, 
  onToggleMinimap,
  disabled = false 
}) {
  const [isMobile, setIsMobile] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);
  const joystickRef = useRef(null);
  const joystickKnobRef = useRef(null);
  const touchStartRef = useRef({ x: 0, y: 0 });
  const joystickActiveRef = useRef(false);
  const movementIntervalRef = useRef(null);
  
  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || 
                            window.innerWidth <= 768 ||
                            ('ontouchstart' in window);
      setIsMobile(isMobileDevice);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Auto-hide instructions after 5 seconds
  useEffect(() => {
    if (isMobile && !disabled) {
      const timer = setTimeout(() => {
        setShowInstructions(false);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [isMobile, disabled]);
  
  // Virtual joystick logic
  useEffect(() => {
    if (!isMobile || disabled) return;
    
    const joystick = joystickRef.current;
    const knob = joystickKnobRef.current;
    if (!joystick || !knob) return;
    
    const joystickRadius = 60; // Outer circle radius
    const knobRadius = 25; // Inner knob radius
    
    const handleTouchStart = (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const rect = joystick.getBoundingClientRect();
      touchStartRef.current = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      };
      joystickActiveRef.current = true;
      
      // Start continuous movement updates
      if (movementIntervalRef.current) {
        clearInterval(movementIntervalRef.current);
      }
    };
    
    const handleTouchMove = (e) => {
      if (!joystickActiveRef.current) return;
      e.preventDefault();
      
      const touch = e.touches[0];
      const dx = touch.clientX - touchStartRef.current.x;
      const dy = touch.clientY - touchStartRef.current.y;
      
      // Calculate distance and angle
      const distance = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      
      // Limit knob movement to joystick radius
      const limitedDistance = Math.min(distance, joystickRadius - knobRadius);
      const knobX = Math.cos(angle) * limitedDistance;
      const knobY = Math.sin(angle) * limitedDistance;
      
      // Update knob position
      knob.style.transform = `translate(${knobX}px, ${knobY}px)`;
      
      // Calculate normalized movement vector (-1 to 1)
      const normalizedX = knobX / (joystickRadius - knobRadius);
      const normalizedY = knobY / (joystickRadius - knobRadius);
      
      // Send movement data to parent
      if (onMove) {
        onMove({
          x: normalizedX,
          y: normalizedY,
          angle: angle,
          magnitude: limitedDistance / (joystickRadius - knobRadius)
        });
      }
    };
    
    const handleTouchEnd = (e) => {
      e.preventDefault();
      joystickActiveRef.current = false;
      
      // Reset knob position with smooth animation
      knob.style.transform = 'translate(0, 0)';
      
      // Stop movement
      if (onMove) {
        onMove({ x: 0, y: 0, angle: 0, magnitude: 0 });
      }
      
      if (movementIntervalRef.current) {
        clearInterval(movementIntervalRef.current);
        movementIntervalRef.current = null;
      }
    };
    
    joystick.addEventListener('touchstart', handleTouchStart, { passive: false });
    joystick.addEventListener('touchmove', handleTouchMove, { passive: false });
    joystick.addEventListener('touchend', handleTouchEnd, { passive: false });
    joystick.addEventListener('touchcancel', handleTouchEnd, { passive: false });
    
    return () => {
      joystick.removeEventListener('touchstart', handleTouchStart);
      joystick.removeEventListener('touchmove', handleTouchMove);
      joystick.removeEventListener('touchend', handleTouchEnd);
      joystick.removeEventListener('touchcancel', handleTouchEnd);
      if (movementIntervalRef.current) {
        clearInterval(movementIntervalRef.current);
      }
    };
  }, [isMobile, disabled, onMove]);
  
  // Don't render on desktop
  if (!isMobile) return null;
  
  return (
    <div 
      className="absolute inset-0 pointer-events-none" 
      style={{ zIndex: 1000 }}
    >
      {/* Virtual Joystick - Bottom Left */}
      <div 
        ref={joystickRef}
        className="absolute bottom-8 left-8 pointer-events-auto"
        style={{
          width: '120px',
          height: '120px',
          opacity: disabled ? 0.3 : 1,
          touchAction: 'none'
        }}
      >
        {/* Outer circle */}
        <div className="absolute inset-0 rounded-full border-4 border-white bg-black bg-opacity-70 flex items-center justify-center"
          style={{
            boxShadow: '0 0 15px rgba(255, 255, 255, 0.8), inset 0 0 20px rgba(255, 255, 255, 0.1)'
          }}
        >
          {/* Inner knob */}
          <div 
            ref={joystickKnobRef}
            className="w-12 h-12 rounded-full bg-white border-2 border-gray-300 transition-transform duration-100 ease-out"
            style={{
              boxShadow: '0 0 25px rgba(255, 255, 255, 0.9), 0 2px 8px rgba(0, 0, 0, 0.5)'
            }}
          />
        </div>
      </div>
      
      {/* Action Buttons - Bottom Right */}
      <div className="absolute bottom-8 right-8 flex flex-col gap-4 pointer-events-auto">
        {/* Shoot Button */}
        <button
          onTouchStart={(e) => {
            e.preventDefault();
            if (!disabled && onShoot) onShoot();
          }}
          disabled={disabled}
          className="w-20 h-20 rounded-full bg-red-600 border-4 border-white flex items-center justify-center active:scale-95 transition-transform disabled:opacity-30"
          style={{
            boxShadow: '0 4px 20px rgba(255, 0, 0, 0.8), 0 0 15px rgba(255, 255, 255, 0.6)',
            touchAction: 'none',
            opacity: disabled ? 0.3 : 1
          }}
        >
          <svg 
            className="w-10 h-10 text-white" 
            fill="currentColor" 
            viewBox="0 0 24 24"
            style={{
              filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5))'
            }}
          >
            <path d="M12 2L4 8v8l8 6 8-6V8l-8-6zm0 2.5L17.5 8v6.5L12 18l-5.5-3.5V8L12 4.5z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </button>
        
        {/* Interact Button (E key equivalent) */}
        <button
          onTouchStart={(e) => {
            e.preventDefault();
            if (!disabled && onInteract) onInteract();
          }}
          disabled={disabled}
          className="w-16 h-16 rounded-full bg-blue-600 border-4 border-white flex items-center justify-center active:scale-95 transition-transform disabled:opacity-30"
          style={{
            boxShadow: '0 4px 20px rgba(0, 100, 255, 0.8), 0 0 15px rgba(255, 255, 255, 0.6)',
            touchAction: 'none',
            opacity: disabled ? 0.3 : 1
          }}
        >
          <span className="text-white font-bold text-xl" style={{
            textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)'
          }}>E</span>
        </button>
      </div>
      
      {/* Minimap Toggle - Top Right */}
      <div className="absolute top-20 right-4 pointer-events-auto">
        <button
          onTouchStart={(e) => {
            e.preventDefault();
            if (!disabled && onToggleMinimap) onToggleMinimap();
          }}
          disabled={disabled}
          className="w-12 h-12 rounded-lg bg-gray-800 border-2 border-white flex items-center justify-center active:scale-95 transition-transform disabled:opacity-30"
          style={{
            touchAction: 'none',
            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.6), 0 0 10px rgba(255, 255, 255, 0.4)',
            opacity: disabled ? 0.3 : 1
          }}
        >
          <svg 
            className="w-6 h-6 text-white" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
            style={{
              filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5))'
            }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        </button>
      </div>
      
      {/* Instructions overlay (shows briefly on first load) */}
      {showInstructions && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-opacity duration-500">
          <div className="bg-black bg-opacity-90 text-white px-6 py-4 rounded-lg text-center max-w-xs border-2 border-white">
            <p className="text-sm font-semibold mb-2">📱 Mobile Controls</p>
            <p className="text-xs opacity-90">
              <span className="block mb-1">🕹️ Left joystick: Move & Look</span>
              <span className="block mb-1">🔴 Red button: Shoot</span>
              <span className="block mb-1">🔵 Blue E: Interact with NPCs</span>
              <span className="block mt-2 text-gray-400">Tap map icon to toggle minimap</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
