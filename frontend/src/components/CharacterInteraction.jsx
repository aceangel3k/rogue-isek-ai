import { useState, useEffect } from 'react';

export default function CharacterInteraction({ gameData, playerPos, onInteraction }) {
  const [nearbyCharacters, setNearbyCharacters] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [dialogueOptions, setDialogueOptions] = useState([]);
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  
  // Check for nearby characters
  useEffect(() => {
    if (!gameData?.sprites?.characters) return;
    
    // In a real implementation, this would check the actual positions of characters
    // For now, we'll just check if player is near the center of the map
    const centerX = gameData?.dungeon?.size ? Math.floor(gameData.dungeon.size / 2) : 8;
    const centerY = gameData?.dungeon?.size ? Math.floor(gameData.dungeon.size / 2) : 8;
    
    // Calculate distance to center
    const distance = Math.sqrt(
      Math.pow(playerPos.x - centerX, 2) + 
      Math.pow(playerPos.y - centerY, 2)
    );
    
    // If player is close to center, show nearby characters
    if (distance < 3) {
      setNearbyCharacters(gameData.sprites.characters);
    } else {
      setNearbyCharacters([]);
      setActiveConversation(null);
      setSelectedCharacter(null);
    }
  }, [playerPos, gameData]);
  
  // Handle character selection
  const selectCharacter = (character) => {
    setSelectedCharacter(character);
    
    // Generate dialogue options based on character type
    let options = [];
    switch (character.type) {
      case "npc":
        options = [
          "Ask about the dungeon",
          "Request assistance",
          "Trade items",
          "Leave conversation"
        ];
        break;
      case "enemy":
        options = [
          "Attempt to negotiate",
          "Prepare for combat",
          "Try to sneak past",
          "Leave conversation"
        ];
        break;
      default:
        options = [
          "Talk to character",
          "Leave conversation"
        ];
    }
    
    setDialogueOptions(options);
    setActiveConversation({
      character: character,
      message: `You approach the ${character.type}. What do you do?`
    });
  };
  
  // Handle dialogue option selection
  const selectDialogueOption = (option) => {
    if (onInteraction) {
      onInteraction({
        character: selectedCharacter,
        option: option,
        response: generateResponse(selectedCharacter, option)
      });
    }
    
    // Close conversation if "Leave conversation" is selected
    if (option === "Leave conversation") {
      setActiveConversation(null);
      setSelectedCharacter(null);
    }
  };
  
  // Generate response based on character and option
  const generateResponse = (character, option) => {
    // In a real implementation, this would use AI to generate contextual responses
    // For now, we'll use predefined responses
    const responses = {
      "Ask about the dungeon": "The dungeon holds many secrets. Beware the shadows that move in the darkness.",
      "Request assistance": "I can help you, but it will cost you. Do you have anything of value?",
      "Trade items": "I have potions and scrolls for sale. Take a look.",
      "Leave conversation": "Farewell, adventurer.",
      "Attempt to negotiate": "Your words mean nothing to me. Prepare to die!",
      "Prepare for combat": "So be it! En garde!",
      "Try to sneak past": "I see you, coward! Face me!",
      "Talk to character": "Hello there. What brings you to this place?"
    };
    
    return responses[option] || "I'm not sure how to respond to that.";
  };
  
  return (
    <div className="absolute bottom-0 left-0 right-0">
      {/* Nearby characters indicator */}
      {nearbyCharacters.length > 0 && !activeConversation && (
        <div className="bg-black bg-opacity-70 text-white p-4">
          <div className="max-w-4xl mx-auto">
            <p className="mb-2">You sense nearby characters:</p>
            <div className="flex space-x-2">
              {nearbyCharacters.map(character => (
                <button
                  key={character.id}
                  onClick={() => selectCharacter(character)}
                  className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                >
                  Approach {character.type}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      
      {/* Active conversation UI */}
      {activeConversation && (
        <div className="bg-black bg-opacity-80 text-white p-6">
          <div className="max-w-4xl mx-auto">
            <h3 className="text-xl font-bold mb-4">
              Talking to: {selectedCharacter?.type || "Unknown Character"}
            </h3>
            <p className="mb-4 text-lg">{activeConversation.message}</p>
            
            <div className="flex flex-wrap gap-2">
              {dialogueOptions.map((option, index) => (
                <button
                  key={index}
                  onClick={() => selectDialogueOption(option)}
                  className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded"
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}