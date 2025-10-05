import sys
import os
import json

# Add the parent directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from services.llm import generate_story

def test_story_generation():
    """Test the story generation function directly"""
    prompt = "A haunted castle with undead knights"
    
    print(f"Testing story generation with prompt: {prompt}")
    print("This may take a few seconds...")
    
    try:
        # Generate story using LLM service
        story_json = generate_story(prompt)
        
        print("✓ Story generation successful")
        print("Generated story:")
        print(story_json)
        
        # Try to parse the JSON
        story_data = json.loads(story_json)
        print("✓ Generated story is valid JSON")
        
        # Check for required fields
        required_fields = ["story", "theme", "enemies", "items", "npcs", "dungeon"]
        missing_fields = [field for field in required_fields if field not in story_data]
        
        if not missing_fields:
            print("✓ All required fields present in generated story")
        else:
            print(f"✗ Missing fields in generated story: {missing_fields}")
            
    except json.JSONDecodeError as e:
        print("✗ Generated story is not valid JSON")
        print(f"JSON Error: {e}")
    except Exception as e:
        print("✗ Story generation failed")
        print(f"Error: {e}")

if __name__ == "__main__":
    test_story_generation()