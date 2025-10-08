from flask import request, jsonify
from services.llm import generate_story
import json
import uuid
import requests

def generate_game():
    """Generate a complete game based on user prompt"""
    try:
        # Get the user prompt from request
        data = request.get_json()
        user_prompt = data.get('prompt', '')
        
        if not user_prompt:
            return jsonify({"error": "Prompt is required"}), 400
        
        # Generate story using LLM service
        story_json = generate_story(user_prompt)
        
        # Parse the story JSON
        game_data = json.loads(story_json)
        
        # Add game_id for tracking
        game_data['game_id'] = str(uuid.uuid4())
        game_data['player_prompt'] = user_prompt
        
        # Generate textures by calling the texture endpoint
        try:
            texture_response = requests.post(
                'http://localhost:5005/api/generate-textures',
                json={
                    'theme': game_data.get('theme', {}),
                    'setting': game_data.get('story', {}).get('narrative', ''),
                    'game_id': game_data['game_id']
                },
                timeout=120  # 2 minute timeout for texture generation
            )
            
            if texture_response.status_code == 200:
                texture_data = texture_response.json()
                game_data['textures'] = texture_data.get('textures', [])
                print(f"Texture generation successful: {len(game_data['textures'])} textures generated")
            else:
                print(f"Texture generation failed: {texture_response.status_code}")
                game_data['textures'] = []
        except Exception as tex_error:
            print(f"Error generating textures: {str(tex_error)}")
            game_data['textures'] = []
        
        # Generate sprites for enemies and NPCs
        try:
            # Prepare character data for sprite generation
            characters = []
            
            # Add enemies (4-direction sprites)
            for enemy in game_data.get('enemies', []):
                characters.append({
                    'type': 'enemy',
                    'id': enemy.get('id', enemy.get('name', 'enemy').lower().replace(' ', '_')),
                    'description': enemy.get('description', enemy.get('name', 'enemy')),
                    'directions': 4
                })
            
            # Add NPCs (4-direction sprites)
            for npc in game_data.get('npcs', []):
                characters.append({
                    'type': 'npc',
                    'id': npc.get('id', npc.get('name', 'npc').lower().replace(' ', '_')),
                    'description': f"{npc.get('name', 'NPC')}, a {npc.get('role', 'character')}",
                    'directions': 4
                })
            
            if characters:
                sprite_response = requests.post(
                    'http://localhost:5005/api/generate-sprites',
                    json={
                        'game_id': game_data['game_id'],
                        'characters': characters,
                        'theme': {
                            'atmosphere': game_data.get('theme', {}).get('atmosphere', 'fantasy'),
                            'style': 'pixel art'
                        }
                    },
                    timeout=180  # 3 minute timeout for sprite generation
                )
                
                if sprite_response.status_code == 200:
                    sprite_data = sprite_response.json()
                    game_data['sprites'] = sprite_data.get('sprites', [])
                    print(f"Sprite generation successful: {len(game_data['sprites'])} sprites generated")
                else:
                    print(f"Sprite generation failed: {sprite_response.status_code}")
                    game_data['sprites'] = []
            else:
                print("No characters to generate sprites for")
                game_data['sprites'] = []
        except Exception as sprite_error:
            print(f"Error generating sprites: {str(sprite_error)}")
            game_data['sprites'] = []
        
        # Return the complete game data as a JSON object (not a string)
        return jsonify(game_data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500