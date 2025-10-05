-- AI Dungeon Crawler Database Schema
-- SQLite schema for game saves and campaign progression

-- Players table
CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_played TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Game saves table
CREATE TABLE IF NOT EXISTS game_saves (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id TEXT NOT NULL,
    dungeon_id TEXT NOT NULL,
    prompt TEXT NOT NULL,
    game_data TEXT NOT NULL, -- JSON blob with full game state
    level_number INTEGER DEFAULT 1,
    completed BOOLEAN DEFAULT 0,
    gold INTEGER DEFAULT 0,
    kills INTEGER DEFAULT 0,
    time_elapsed REAL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    FOREIGN KEY (player_id) REFERENCES players(id)
);

-- Campaign progress table
CREATE TABLE IF NOT EXISTS campaign_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id TEXT NOT NULL,
    current_level INTEGER DEFAULT 1,
    total_gold INTEGER DEFAULT 0,
    total_kills INTEGER DEFAULT 0,
    total_time REAL DEFAULT 0,
    dungeons_completed INTEGER DEFAULT 0,
    last_dungeon_id TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player_id) REFERENCES players(id),
    UNIQUE(player_id)
);

-- Shared dungeons table (for section 3.5)
CREATE TABLE IF NOT EXISTS shared_dungeons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dungeon_id TEXT UNIQUE NOT NULL,
    player_id TEXT NOT NULL,
    prompt TEXT NOT NULL,
    game_data TEXT NOT NULL, -- JSON blob
    difficulty INTEGER DEFAULT 1,
    rating REAL DEFAULT 0,
    plays INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player_id) REFERENCES players(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_game_saves_player ON game_saves(player_id);
CREATE INDEX IF NOT EXISTS idx_game_saves_completed ON game_saves(completed);
CREATE INDEX IF NOT EXISTS idx_shared_dungeons_player ON shared_dungeons(player_id);
CREATE INDEX IF NOT EXISTS idx_shared_dungeons_rating ON shared_dungeons(rating DESC);
