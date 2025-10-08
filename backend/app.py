from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Create Flask app
app = Flask(__name__)

# Set max content length to 50MB (for game saves with some image data)
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024

# Enable CORS for all routes
CORS(app)

# Import routes
from routes.game import generate_game
from routes.textures import generate_textures
from routes.sprites import generate_sprites, generate_weapon, generate_hud
from routes.npc import generate_npc_dialogue
from routes.saves import save_game_state, load_game_state, get_saves, get_progress
from routes.shared import get_next_dungeon, patch_story

# Register routes
app.route('/api/generate-game', methods=['POST'])(generate_game)
app.route('/api/generate-textures', methods=['POST'])(generate_textures)
app.route('/api/generate-sprites', methods=['POST'])(generate_sprites)
app.route('/api/generate-weapon', methods=['POST'])(generate_weapon)
app.route('/api/generate-hud', methods=['POST'])(generate_hud)
app.route('/api/generate-npc-dialogue', methods=['POST'])(generate_npc_dialogue)

# Save/Load routes
app.route('/api/save-game', methods=['POST'])(save_game_state)
app.route('/api/load-game', methods=['GET'])(load_game_state)
app.route('/api/get-saves', methods=['GET'])(get_saves)
app.route('/api/get-progress', methods=['GET'])(get_progress)

# Shared World routes
app.route('/api/get-next-dungeon', methods=['GET'])(get_next_dungeon)
app.route('/api/patch-story', methods=['POST'])(patch_story)

@app.route('/')
def index():
    return "API Running"

if __name__ == '__main__':
    app.run(debug=True, port=5005)