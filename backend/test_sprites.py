import requests
import json

# Test sprite generation endpoint
def test_sprite_generation():
    url = "http://127.0.0.1:5005/api/generate-sprites"
    
    # Sample data for testing
    test_data = {
        "game_id": "test_game_123",
        "characters": [
            {
                "type": "enemy",
                "id": "zombie_knight",
                "description": "Undead knight in rusted armor",
                "directions": 4
            },
            {
                "type": "npc",
                "id": "shopkeeper",
                "description": "Mysterious merchant with a hooded cloak",
                "directions": 4
            },
            {
                "type": "item",
                "id": "health_potion",
                "description": "Red glowing health potion in a crystal vial",
                "directions": 1
            }
        ],
        "theme": {
            "atmosphere": "dark medieval",
            "style": "pixel art"
        }
    }
    
    try:
        response = requests.post(url, json=test_data)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        return response
    except Exception as e:
        print(f"Error testing sprite generation: {str(e)}")
        return None

if __name__ == "__main__":
    print("Testing sprite generation endpoint...")
    test_sprite_generation()