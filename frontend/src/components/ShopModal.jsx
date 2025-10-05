import { useState } from 'react';
import DialogueBox from './DialogueBox';

export default function ShopModal({ npc, items, playerGold, onPurchase, onClose, gameData }) {
  const [selectedItem, setSelectedItem] = useState(null);
  const [purchaseMessage, setPurchaseMessage] = useState('');
  const [showDialogue, setShowDialogue] = useState(false);
  
  // Extract theme colors with fallbacks
  const primaryColor = gameData?.theme?.primary_color || '#00ff00';
  const secondaryColor = gameData?.theme?.secondary_color || '#00ff00';

  const handlePurchase = (item) => {
    if (playerGold >= item.price) {
      onPurchase(item);
      setPurchaseMessage(`Purchased ${item.name}!`);
      setTimeout(() => setPurchaseMessage(''), 2000);
    } else {
      setPurchaseMessage('Not enough gold!');
      setTimeout(() => setPurchaseMessage(''), 2000);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ background: 'rgba(0, 0, 0, 0.95)', zIndex: 10000 }}>
      <div 
        className="retro-panel max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col"
        style={{ padding: '20px' }}
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 
              className="text-3xl font-bold mb-2"
              style={{ color: primaryColor, textShadow: `0 0 5px ${primaryColor}` }}
            >
              &gt; NPC_INTERFACE: {(npc?.name || "MERCHANT").toUpperCase()}
            </h2>
            <p style={{ color: secondaryColor, textShadow: `0 0 3px ${secondaryColor}` }}>
              &gt; "{npc?.greeting || "WELCOME, TRAVELER. WHAT CAN I GET YOU?"}"
            </p>
          </div>
          <button
            onClick={onClose}
            className="retro-button"
            style={{ padding: '4px 12px' }}
          >
            [X]
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-4" style={{ borderBottom: `2px solid ${primaryColor}` }}>
          <button
            onClick={() => setShowDialogue(false)}
            className="px-6 py-2 font-bold transition-all"
            style={{
              color: !showDialogue ? primaryColor : '#666',
              background: !showDialogue ? '#0a0a0a' : 'transparent',
              border: !showDialogue ? `2px solid ${primaryColor}` : '2px solid #333',
              borderBottom: 'none'
            }}
          >
            [SHOP]
          </button>
          <button
            onClick={() => setShowDialogue(true)}
            className="px-6 py-2 font-bold transition-all"
            style={{
              color: showDialogue ? primaryColor : '#666',
              background: showDialogue ? '#0a0a0a' : 'transparent',
              border: showDialogue ? `2px solid ${primaryColor}` : '2px solid #333',
              borderBottom: 'none'
            }}
          >
            [TALK]
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden">
          {showDialogue ? (
            /* Dialogue View */
            <DialogueBox 
              npc={npc} 
              gameData={gameData}
              onClose={() => setShowDialogue(false)}
            />
          ) : (
            /* Shop View */
            <>
              {/* Player Gold */}
              <div className="mb-6 p-4" style={{ background: '#0a0a0a', border: `2px solid ${secondaryColor}`, boxShadow: `0 0 5px ${secondaryColor}50` }}>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xl" style={{ color: secondaryColor }}>&gt; GOLD_BALANCE:</span>
                  <span className="text-2xl font-bold" style={{ color: secondaryColor }}>{playerGold}</span>
                </div>
              </div>

              {/* Items Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 max-h-96 overflow-y-auto">
                {items && items.length > 0 ? (
                  items.map((item, index) => (
                    <div
                      key={index}
                      className="p-4 retro-border transition-all cursor-pointer"
                      style={{
                        background: selectedItem === item ? '#0a0a0a' : '#000',
                        borderColor: selectedItem === item ? '#00ff00' : '#333',
                        opacity: playerGold < item.price ? 0.5 : 1
                      }}
                      onClick={() => setSelectedItem(item)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-lg font-bold" style={{ color: primaryColor }}>
                          &gt; {item.name.toUpperCase()}
                        </h3>
                        <span className="font-bold" style={{ color: secondaryColor }}>
                          {item.price}G
                        </span>
                      </div>
                      <p className="text-sm mb-3" style={{ color: primaryColor }}>
                        {item.description}
                      </p>
                      <div className="flex justify-between items-center">
                        <span className="text-xs uppercase" style={{ color: '#666' }}>
                          [{item.type}]
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePurchase(item);
                          }}
                          disabled={playerGold < item.price}
                          className="retro-button px-4 py-2"
                        >
                          [BUY]
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-2 text-center py-8" style={{ color: '#666' }}>
                    &gt; NO_ITEMS_AVAILABLE
                  </div>
                )}
              </div>

              {/* Purchase Message */}
              {purchaseMessage && (
                <div
                  className="mb-4 p-3 text-center font-bold retro-border"
                  style={{
                    background: '#0a0a0a',
                    color: purchaseMessage.includes('Not enough') ? '#ff0000' : '#00ff00'
                  }}
                >
                  &gt; {purchaseMessage.toUpperCase()}
                </div>
              )}

              {/* Footer */}
              <div className="flex justify-between items-center pt-4" style={{ borderTop: `2px solid ${primaryColor}` }}>
                <p className="text-sm" style={{ color: '#666' }}>
                  &gt; PRESS [ESC] TO CLOSE
                </p>
                <button
                  onClick={onClose}
                  className="retro-button px-6 py-2"
                >
                  [CLOSE SHOP]
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
