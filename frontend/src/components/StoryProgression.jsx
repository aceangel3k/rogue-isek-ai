import { useState, useEffect } from 'react';

export default function StoryProgression({ gameData, playerPos, onStoryUpdate }) {
  const [currentStorySegment, setCurrentStorySegment] = useState(0);
  const [storySegments, setStorySegments] = useState([]);
  
  useEffect(() => {
    if (gameData?.story?.segments) {
      setStorySegments(gameData.story.segments);
    }
  }, [gameData]);
  
  // Function to progress the story
  const progressStory = () => {
    if (currentStorySegment < storySegments.length - 1) {
      setCurrentStorySegment(currentStorySegment + 1);
      if (onStoryUpdate) {
        onStoryUpdate(storySegments[currentStorySegment + 1]);
      }
    }
  };
  
  // Function to check if player has reached certain positions that trigger story events
  useEffect(() => {
    // In a real implementation, this would check if player has reached specific locations
    // or interacted with certain objects/NPCs
    
    // For example, trigger story progression when player reaches center of map
    const centerX = gameData?.dungeon?.size ? Math.floor(gameData.dungeon.size / 2) : 8;
    const centerY = gameData?.dungeon?.size ? Math.floor(gameData.dungeon.size / 2) : 8;
    
    if (Math.floor(playerPos.x) === centerX && Math.floor(playerPos.y) === centerY) {
      // Player reached center - progress story
      progressStory();
    }
  }, [playerPos, gameData]);
  
  return (
    <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 text-white p-4">
      <div className="max-w-4xl mx-auto">
        <h3 className="text-xl font-bold mb-2">Story Progression</h3>
        {storySegments.length > 0 && (
          <p className="mb-4">{storySegments[currentStorySegment]}</p>
        )}
        <button 
          onClick={progressStory}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          Continue Story
        </button>
      </div>
    </div>
  );
}