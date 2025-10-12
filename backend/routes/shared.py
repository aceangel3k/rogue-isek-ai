"""
Shared World System endpoints
Handles loading other players' dungeons and AI story patching
"""

from flask import request, jsonify
import json
from database import get_random_shared_dungeon
from services.llm import generate_text

def get_next_dungeon():
    """Get a random dungeon from another player"""
    try:
        player_id = request.args.get('player_id')
        exclude_ids = request.args.get('exclude_ids', '')  # Comma-separated list of dungeon IDs to exclude
        exclude_prompts = request.args.get('exclude_prompts', '')  # Comma-separated list of prompts to exclude
        
        if not player_id:
            return jsonify({'error': 'player_id required'}), 400
        
        # Parse excluded dungeon IDs
        excluded_dungeon_ids = [id.strip() for id in exclude_ids.split(',') if id.strip()]
        
        # Parse excluded prompts
        excluded_prompts = [p.strip() for p in exclude_prompts.split('|||') if p.strip()]
        
        # Get random dungeon from another player, excluding already played ones
        dungeon = get_random_shared_dungeon(
            exclude_player_id=player_id, 
            exclude_dungeon_ids=excluded_dungeon_ids,
            exclude_prompts=excluded_prompts
        )
        
        if not dungeon:
            return jsonify({
                'success': False,
                'message': 'No shared dungeons available yet. Complete a dungeon to add to the pool!'
            })
        
        # Parse game_data JSON
        dungeon['game_data'] = json.loads(dungeon['game_data'])
        
        # Ensure game_id is set to dungeon_id for asset caching
        # This ensures all players see the original creator's assets
        if 'game_id' not in dungeon['game_data']:
            dungeon['game_data']['game_id'] = dungeon['dungeon_id']
        
        # Also set dungeon_id for reference
        dungeon['game_data']['dungeon_id'] = dungeon['dungeon_id']
        
        # Increment play count
        from database import get_connection
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            'UPDATE shared_dungeons SET plays = plays + 1 WHERE id = ?',
            (dungeon['id'],)
        )
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'dungeon': dungeon
        })
        
    except Exception as e:
        print(f"Error getting next dungeon: {e}")
        return jsonify({'error': str(e)}), 500

def patch_story():
    """Generate AI story patch to bridge two dungeons"""
    try:
        data = request.json
        
        # Required fields
        previous_story = data.get('previous_story', '')
        previous_theme = data.get('previous_theme', '')
        new_story = data.get('new_story', '')
        new_theme = data.get('new_theme', '')
        player_actions = data.get('player_actions', {})
        
        if not new_story or not new_theme:
            return jsonify({'error': 'new_story and new_theme required'}), 400
        
        # Build context for LLM
        kills = player_actions.get('kills', 0)
        gold = player_actions.get('gold', 0)
        time = player_actions.get('time', 0)
        
        # Create story patch prompt
        prompt = f"""You are a master storyteller creating a narrative bridge between two dungeon adventures.

PREVIOUS DUNGEON:
Theme: {previous_theme}
Story: {previous_story}
Player Actions: Defeated {kills} enemies, collected {gold} gold, spent {int(time)} seconds

NEW DUNGEON:
Theme: {new_theme}
Story: {new_story}

Create a SHORT (2-3 sentences) narrative transition that:
1. Acknowledges the player's escape from the previous dungeon
2. Explains how they arrived at this new location
3. Makes the theme shift feel natural and coherent
4. Maintains excitement and momentum

The transition should feel like a natural story progression, not a jarring jump.

Example format:
"Having defeated the [previous threat], you emerge into [transition]. Your path now leads to [new location], where [new threat] awaits..."

Write ONLY the transition text, nothing else:"""

        # Generate story patch using LLM
        story_patch = generate_text(
            prompt=prompt,
            max_tokens=150,
            temperature=0.8
        )
        
        # Clean up the response
        story_patch = story_patch.strip()
        
        return jsonify({
            'success': True,
            'story_patch': story_patch
        })
        
    except Exception as e:
        print(f"Error patching story: {e}")
        return jsonify({'error': str(e)}), 500
