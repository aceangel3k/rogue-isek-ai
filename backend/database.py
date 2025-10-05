"""
Database utilities for AI Dungeon Crawler
Handles SQLite database operations for game saves and campaign progression
"""

import sqlite3
import json
import os
from datetime import datetime
from typing import Optional, Dict, List, Any

DB_PATH = os.path.join(os.path.dirname(__file__), 'game_data.db')

def init_database():
    """Initialize database with schema"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    
    # Read and execute schema
    schema_path = os.path.join(os.path.dirname(__file__), 'schema.sql')
    with open(schema_path, 'r') as f:
        schema = f.read()
    
    conn.executescript(schema)
    conn.commit()
    conn.close()
    print(f"✓ Database initialized at {DB_PATH}")

def get_connection():
    """Get database connection with row factory"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# Player operations
def create_or_get_player(player_id: str) -> Dict[str, Any]:
    """Create player if doesn't exist, or update last_played"""
    conn = get_connection()
    cursor = conn.cursor()
    
    # Try to get existing player
    cursor.execute('SELECT * FROM players WHERE id = ?', (player_id,))
    player = cursor.execute('SELECT * FROM players WHERE id = ?', (player_id,)).fetchone()
    
    if player:
        # Update last_played
        cursor.execute(
            'UPDATE players SET last_played = CURRENT_TIMESTAMP WHERE id = ?',
            (player_id,)
        )
        conn.commit()
    else:
        # Create new player
        cursor.execute('INSERT INTO players (id) VALUES (?)', (player_id,))
        conn.commit()
        player = cursor.execute('SELECT * FROM players WHERE id = ?', (player_id,)).fetchone()
    
    conn.close()
    return dict(player)

# Game save operations
def save_game(
    player_id: str,
    dungeon_id: str,
    prompt: str,
    game_data: Dict[str, Any],
    level_number: int = 1,
    completed: bool = False,
    gold: int = 0,
    kills: int = 0,
    time_elapsed: float = 0
) -> int:
    """Save game state to database"""
    conn = get_connection()
    cursor = conn.cursor()
    
    # Ensure player exists
    create_or_get_player(player_id)
    
    # Save game
    cursor.execute('''
        INSERT INTO game_saves (
            player_id, dungeon_id, prompt, game_data, level_number,
            completed, gold, kills, time_elapsed, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        player_id,
        dungeon_id,
        prompt,
        json.dumps(game_data),
        level_number,
        1 if completed else 0,
        gold,
        kills,
        time_elapsed,
        datetime.now().isoformat() if completed else None
    ))
    
    save_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    return save_id

def get_player_saves(player_id: str, completed_only: bool = False) -> List[Dict[str, Any]]:
    """Get all saves for a player"""
    conn = get_connection()
    cursor = conn.cursor()
    
    query = 'SELECT * FROM game_saves WHERE player_id = ?'
    params = [player_id]
    
    if completed_only:
        query += ' AND completed = 1'
    
    query += ' ORDER BY created_at DESC'
    
    cursor.execute(query, params)
    saves = cursor.fetchall()
    conn.close()
    
    return [dict(save) for save in saves]

def get_save_by_id(save_id: int) -> Optional[Dict[str, Any]]:
    """Get a specific save by ID"""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM game_saves WHERE id = ?', (save_id,))
    save = cursor.fetchone()
    conn.close()
    
    return dict(save) if save else None

def get_latest_save(player_id: str) -> Optional[Dict[str, Any]]:
    """Get player's most recent save"""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT * FROM game_saves 
        WHERE player_id = ? 
        ORDER BY created_at DESC 
        LIMIT 1
    ''', (player_id,))
    
    save = cursor.fetchone()
    conn.close()
    
    return dict(save) if save else None

# Campaign progress operations
def update_campaign_progress(
    player_id: str,
    level_number: int,
    gold: int,
    kills: int,
    time_elapsed: float,
    dungeon_id: str
):
    """Update player's campaign progress"""
    conn = get_connection()
    cursor = conn.cursor()
    
    # Get existing progress
    cursor.execute('SELECT * FROM campaign_progress WHERE player_id = ?', (player_id,))
    progress = cursor.fetchone()
    
    if progress:
        # Update existing progress
        cursor.execute('''
            UPDATE campaign_progress SET
                current_level = ?,
                total_gold = total_gold + ?,
                total_kills = total_kills + ?,
                total_time = total_time + ?,
                dungeons_completed = dungeons_completed + 1,
                last_dungeon_id = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE player_id = ?
        ''', (level_number, gold, kills, time_elapsed, dungeon_id, player_id))
    else:
        # Create new progress
        cursor.execute('''
            INSERT INTO campaign_progress (
                player_id, current_level, total_gold, total_kills,
                total_time, dungeons_completed, last_dungeon_id
            ) VALUES (?, ?, ?, ?, ?, 1, ?)
        ''', (player_id, level_number, gold, kills, time_elapsed, dungeon_id))
    
    conn.commit()
    conn.close()

def get_campaign_progress(player_id: str) -> Optional[Dict[str, Any]]:
    """Get player's campaign progress"""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM campaign_progress WHERE player_id = ?', (player_id,))
    progress = cursor.fetchone()
    conn.close()
    
    return dict(progress) if progress else None

# Shared dungeons operations (for section 3.5)
def save_shared_dungeon(
    dungeon_id: str,
    player_id: str,
    prompt: str,
    game_data: Dict[str, Any],
    difficulty: int = 1
) -> int:
    """Save a dungeon to the shared pool"""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        INSERT OR REPLACE INTO shared_dungeons (
            dungeon_id, player_id, prompt, game_data, difficulty
        ) VALUES (?, ?, ?, ?, ?)
    ''', (dungeon_id, player_id, prompt, json.dumps(game_data), difficulty))
    
    dungeon_db_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    return dungeon_db_id

def get_random_shared_dungeon(exclude_player_id: Optional[str] = None, exclude_dungeon_ids: Optional[List[str]] = None) -> Optional[Dict[str, Any]]:
    """Get a random shared dungeon from another player"""
    conn = get_connection()
    cursor = conn.cursor()
    
    query = 'SELECT * FROM shared_dungeons'
    params = []
    conditions = []
    
    if exclude_player_id:
        conditions.append('player_id != ?')
        params.append(exclude_player_id)
    
    if exclude_dungeon_ids:
        placeholders = ','.join(['?' for _ in exclude_dungeon_ids])
        conditions.append(f'dungeon_id NOT IN ({placeholders})')
        params.extend(exclude_dungeon_ids)
    
    if conditions:
        query += ' WHERE ' + ' AND '.join(conditions)
    
    query += ' ORDER BY RANDOM() LIMIT 1'
    
    cursor.execute(query, params)
    dungeon = cursor.fetchone()
    conn.close()
    
    return dict(dungeon) if dungeon else None

# Initialize database on module import
if not os.path.exists(DB_PATH):
    init_database()
