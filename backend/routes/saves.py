"""
Save/Load endpoints for AI Dungeon Crawler
Handles game state persistence and campaign progression
"""

from flask import request, jsonify
import json
import uuid
from database import (
    save_game,
    get_player_saves,
    get_save_by_id,
    get_latest_save,
    update_campaign_progress,
    get_campaign_progress,
    save_shared_dungeon
)

def save_game_state():
    """Save game state to database"""
    try:
        data = request.json
        
        # Required fields
        player_id = data.get('player_id')
        prompt = data.get('prompt')
        game_data = data.get('game_data')
        
        if not player_id or not prompt or not game_data:
            return jsonify({'error': 'Missing required fields'}), 400
        
        # Optional fields
        dungeon_id = data.get('dungeon_id', str(uuid.uuid4()))
        level_number = data.get('level_number', 1)
        completed = data.get('completed', False)
        gold = data.get('gold', 0)
        kills = data.get('kills', 0)
        time_elapsed = data.get('time_elapsed', 0)
        
        # Save to database
        save_id = save_game(
            player_id=player_id,
            dungeon_id=dungeon_id,
            prompt=prompt,
            game_data=game_data,
            level_number=level_number,
            completed=completed,
            gold=gold,
            kills=kills,
            time_elapsed=time_elapsed
        )
        
        # If completed, update campaign progress
        if completed:
            update_campaign_progress(
                player_id=player_id,
                level_number=level_number + 1,  # Next level
                gold=gold,
                kills=kills,
                time_elapsed=time_elapsed,
                dungeon_id=dungeon_id
            )
            
            # Save to shared dungeons pool
            # Strip large binary data (sprites, textures) to reduce database size
            # These will be regenerated from cache when loaded
            game_data_stripped = game_data.copy()
            game_data_stripped.pop('sprites', None)
            game_data_stripped.pop('textures', None)
            game_data_stripped.pop('weaponSprite', None)
            game_data_stripped.pop('hudFrame', None)
            
            # Ensure game_id is preserved for asset caching
            if 'game_id' not in game_data_stripped:
                game_data_stripped['game_id'] = dungeon_id
            
            save_shared_dungeon(
                dungeon_id=dungeon_id,
                player_id=player_id,
                prompt=prompt,
                game_data=game_data_stripped,
                difficulty=level_number
            )
        
        return jsonify({
            'success': True,
            'save_id': save_id,
            'dungeon_id': dungeon_id
        })
        
    except Exception as e:
        print(f"Error saving game: {e}")
        return jsonify({'error': str(e)}), 500

def load_game_state():
    """Load game state from database"""
    try:
        player_id = request.args.get('player_id')
        save_id = request.args.get('save_id')
        
        if not player_id:
            return jsonify({'error': 'player_id required'}), 400
        
        if save_id:
            # Load specific save
            save = get_save_by_id(int(save_id))
            if not save:
                return jsonify({'error': 'Save not found'}), 404
        else:
            # Load latest save
            save = get_latest_save(player_id)
            if not save:
                return jsonify({'saves': []})
        
        # Parse game_data JSON
        if save:
            save['game_data'] = json.loads(save['game_data'])
        
        return jsonify({
            'success': True,
            'save': save
        })
        
    except Exception as e:
        print(f"Error loading game: {e}")
        return jsonify({'error': str(e)}), 500

def get_saves():
    """Get all saves for a player"""
    try:
        player_id = request.args.get('player_id')
        completed_only = request.args.get('completed_only', 'false').lower() == 'true'
        
        if not player_id:
            return jsonify({'error': 'player_id required'}), 400
        
        saves = get_player_saves(player_id, completed_only)
        
        # Parse game_data JSON for each save
        for save in saves:
            save['game_data'] = json.loads(save['game_data'])
        
        return jsonify({
            'success': True,
            'saves': saves
        })
        
    except Exception as e:
        print(f"Error getting saves: {e}")
        return jsonify({'error': str(e)}), 500

def get_progress():
    """Get campaign progress for a player"""
    try:
        player_id = request.args.get('player_id')
        
        if not player_id:
            return jsonify({'error': 'player_id required'}), 400
        
        progress = get_campaign_progress(player_id)
        
        if not progress:
            # Return default progress for new player
            progress = {
                'current_level': 1,
                'total_gold': 0,
                'total_kills': 0,
                'total_time': 0,
                'dungeons_completed': 0
            }
        
        return jsonify({
            'success': True,
            'progress': progress
        })
        
    except Exception as e:
        print(f"Error getting progress: {e}")
        return jsonify({'error': str(e)}), 500
