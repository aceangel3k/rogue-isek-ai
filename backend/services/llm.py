import litellm
import os
from dotenv import load_dotenv
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from utils.cache import get_cached, set_cached

# Load environment variables
load_dotenv()

# Get LLM model from environment variable
# Default: gpt-4o-mini (fast, cheap, good quality)
# Alternative: cerebras/llama3.3-70b (faster, requires Cerebras API key)
LLM_MODEL = os.getenv('LLM_MODEL', 'gpt-4o-mini')

def test_llm_connection():
    """Test connection to LLM service"""
    try:
        # Test with a simple prompt
        response = litellm.completion(
            model=LLM_MODEL,
            messages=[{"role": "user", "content": "Hello, are you working?"}],
            max_tokens=10
        )
        return True, response.choices[0].message.content
    except Exception as e:
        return False, str(e)

def generate_story(user_prompt):
    """Generate game story using configured LLM"""
    try:
        # Check cache first
        cached_story = get_cached(user_prompt, cache_type='story')
        if cached_story:
            return cached_story
        
        # System prompt for game story generation
        system_prompt = """You are an expert game master creating fast-paced dungeon crawler games.
        Generate complete game designs as valid JSON only. Be creative and match the user's theme.
        Focus on fast-paced action, clear objectives, and atmospheric settings."""
        
        # User prompt template
        user_prompt_template = f"""Create a dungeon crawler game based on: {user_prompt}

        Generate a complete game with:
        1. Story: Brief narrative (2-3 sentences), title, clear win condition
        2. Theme: Primary color (hex), secondary color, atmosphere description
        3. Enemies: 3-5 types with stats
           - name: Enemy name
           - health: 20-60 HP
           - damage: 10-25 damage per hit
           - speed: 0.03-0.08 movement speed
           - description: Visual description for sprite generation
        4. Items: 5-7 items
           - weapons: damage 15-50, cost 50-200 gold
           - health items: heal 30-100, cost 30-100 gold
           - special items: keys, power-ups
        5. NPCs: 1-2 characters (name, role, personality, greeting)
        6. Dungeon: size (16/24/32), random seed, layout type

        Return as JSON matching this exact schema:
        {{
          "story": {{
            "title": "",
            "narrative": "",
            "win_condition": ""
          }},
          "theme": {{
            "primary_color": "#RRGGBB",
            "secondary_color": "#RRGGBB",
            "atmosphere": ""
          }},
          "enemies": [
            {{
              "id": "",
              "name": "",
              "health": 0,
              "damage": 0,
              "speed": 0.0,
              "description": ""
            }}
          ],
          "items": [
            {{
              "type": "weapon|health|key",
              "name": "",
              "damage": 0,
              "heal": 0,
              "cost": 0
            }}
          ],
          "npcs": [
            {{
              "id": "",
              "name": "",
              "role": "shopkeeper",
              "personality": "",
              "greeting": ""
            }}
          ],
          "dungeon": {{
            "size": 24,
            "seed": 0,
            "layout": "rooms|maze|tower"
          }}
        }}"""
        
        response = litellm.completion(
            model=LLM_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt_template}
            ],
            response_format={"type": "json_object"},
            temperature=0.8,
            max_tokens=2000
        )
        
        story_json = response.choices[0].message.content
        
        # Cache the result
        set_cached(user_prompt, story_json, cache_type='story')
        
        return story_json
    except Exception as e:
        raise Exception(f"Error generating story: {str(e)}")

def generate_text(prompt, max_tokens=150, temperature=0.8, system_prompt=None):
    """Generic text generation function using configured LLM"""
    try:
        messages = []
        
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        
        messages.append({"role": "user", "content": prompt})
        
        response = litellm.completion(
            model=LLM_MODEL,
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature
        )
        
        return response.choices[0].message.content.strip()
    except Exception as e:
        raise Exception(f"Error generating text: {str(e)}")

def generate_npc_dialogue(npc_data, player_message, context):
    """Generate NPC dialogue using configured LLM"""
    try:
        system_prompt = f"""You are {npc_data['name']}, a {npc_data['role']} in a dungeon crawler game.

        Personality: {npc_data['personality']}
        Background: You're a character in this hostile environment, offering goods and information to those who can pay.

        Speak in character. Keep responses under 40 words. Be concise, atmospheric, and engaging.
        Use the personality to color your speech. No asterisks for actions."""
        
        messages = [
            {"role": "system", "content": system_prompt}
        ]
        
        # Add conversation history (last 4 exchanges)
        for msg in context.get('conversation_history', [])[-4:]:
            messages.append(msg)
        
        # Add current message
        messages.append({"role": "user", "content": player_message})
        
        response = litellm.completion(
            model=LLM_MODEL,
            messages=messages,
            max_tokens=100,
            temperature=0.9
        )
        
        return response.choices[0].message.content.strip()
    except Exception as e:
        raise Exception(f"Error generating NPC dialogue: {str(e)}")