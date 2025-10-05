import { useState, useRef, useEffect } from 'react';

export default function DialogueBox({ npc, gameData, onClose }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: npc?.greeting || "Greetings, traveler. How may I assist you?",
      timestamp: Date.now()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  
  // Extract theme colors with fallbacks
  const primaryColor = gameData?.theme?.primary_color || '#00ff00';
  const secondaryColor = gameData?.theme?.secondary_color || '#00ff00';

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage = inputText.trim();
    setInputText('');

    // Add user message to chat
    const newUserMessage = {
      role: 'user',
      content: userMessage,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, newUserMessage]);
    setIsLoading(true);

    try {
      // Call AI dialogue endpoint
      const response = await fetch('http://localhost:5001/api/generate-npc-dialogue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          npc_data: {
            name: npc?.name || 'Merchant',
            role: npc?.role || 'shopkeeper',
            personality: npc?.personality || 'friendly and helpful'
          },
          player_message: userMessage,
          context: {
            game_setting: gameData?.story?.setting || 'a mysterious dungeon',
            conversation_history: messages.slice(-6).map(msg => ({
              role: msg.role,
              content: msg.content
            }))
          }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Add AI response to chat
      const aiMessage = {
        role: 'assistant',
        content: data.dialogue || "I'm not sure how to respond to that.",
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error getting NPC response:', error);
      const errorMessage = {
        role: 'assistant',
        content: "Forgive me, I seem to have lost my train of thought...",
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div 
      className="flex flex-col h-full retro-panel"
    >
      {/* Header */}
      <div 
        className="flex justify-between items-center p-4"
        style={{ borderBottom: `2px solid ${primaryColor}` }}
      >
        <div>
          <h3 
            className="text-xl font-bold"
            style={{ color: primaryColor, textShadow: `0 0 5px ${primaryColor}` }}
          >
            &gt; DIALOGUE_INTERFACE: {(npc?.name || 'MERCHANT').toUpperCase()}
          </h3>
          <p className="text-sm" style={{ color: '#666' }}>[{(npc?.role || 'SHOPKEEPER').toUpperCase()}]</p>
        </div>
        <button
          onClick={onClose}
          className="retro-button"
          style={{ padding: '4px 12px' }}
        >
          [X]
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className="max-w-[80%] p-3"
              style={{
                background: msg.role === 'user' ? '#1a1a1a' : '#0a0a0a',
                color: msg.role === 'user' ? secondaryColor : primaryColor,
                border: `2px solid ${msg.role === 'user' ? secondaryColor : primaryColor}`,
                boxShadow: `0 0 5px ${msg.role === 'user' ? secondaryColor : primaryColor}50`
              }}
            >
              <p className="text-base whitespace-pre-wrap" style={{ 
                color: msg.role === 'user' ? secondaryColor : primaryColor,
                filter: 'brightness(1.3)'
              }}>
                {msg.role === 'user' ? '> ' : ''}{msg.content}
              </p>
              <p className="text-xs mt-1" style={{ color: '#666' }}>
                [{new Date(msg.timestamp).toLocaleTimeString()}]
              </p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div 
              className="p-3"
              style={{
                background: '#000',
                border: `2px solid ${primaryColor}`,
                boxShadow: `0 0 5px ${primaryColor}50`
              }}
            >
              <p className="text-sm" style={{ color: primaryColor }}>
                &gt; PROCESSING<span className="animate-pulse">...</span>
              </p>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div 
        className="p-4"
        style={{ borderTop: `2px solid ${primaryColor}` }}
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={`> INPUT_MESSAGE...`}
            disabled={isLoading}
            className="flex-1 px-4 py-2 disabled:opacity-50"
            style={{
              background: '#000',
              border: `2px solid ${primaryColor}`,
              color: primaryColor
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!inputText.trim() || isLoading}
            className="retro-button px-6 py-2"
          >
            [SEND]
          </button>
        </div>
        <p className="text-xs mt-2" style={{ color: '#666' }}>
          &gt; [ENTER] TO SEND • [SHIFT+ENTER] FOR NEW LINE
        </p>
      </div>
    </div>
  );
}
