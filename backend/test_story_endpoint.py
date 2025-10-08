import requests
import json
import time

def test_story_generation():
    """Test the story generation endpoint with a sample prompt"""
    url = "http://localhost:5005/api/generate-game"
    prompt = "A haunted castle with undead knights"
    
    print(f"Testing story generation with prompt: {prompt}")
    
    # Send POST request
    response = requests.post(url, json={"prompt": prompt})
    
    # Check response
    if response.status_code == 200:
        data = response.json()
        print("Response received successfully:")
        print(json.dumps(data, indent=2))
        
        # Validate response structure
        if "game_data" in data:
            print("✓ Response contains 'game_data' field")
            
            # Try to parse the game_data as JSON
            try:
                game_data = json.loads(data["game_data"])
                print("✓ game_data is valid JSON")
                
                # Check for required fields
                required_fields = ["story", "theme", "enemies", "items", "npcs", "dungeon"]
                missing_fields = [field for field in required_fields if field not in game_data]
                
                if not missing_fields:
                    print("✓ All required fields present in game_data")
                    print("Story generation endpoint is working correctly!")
                else:
                    print(f"✗ Missing fields in game_data: {missing_fields}")
                    
            except json.JSONDecodeError:
                print("✗ game_data is not valid JSON")
        else:
            print("✗ Response does not contain 'game_data' field")
    else:
        print(f"✗ Request failed with status code: {response.status_code}")
        print(response.text)

if __name__ == "__main__":
    test_story_generation()