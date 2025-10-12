from flask import request, jsonify
import litellm
import base64
import os
import concurrent.futures
from dotenv import load_dotenv
import requests
from datetime import datetime
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from utils.cache import get_cached, set_cached
from utils.google_genai_helper import generate_image_with_gemini

# Load environment variables
load_dotenv()

# Create textures directory if it doesn't exist
TEXTURES_DIR = os.path.join(os.path.dirname(__file__), '..', 'generated_textures')
os.makedirs(TEXTURES_DIR, exist_ok=True)

def download_image_as_base64(image_url, save_filename=None):
    """Download image from URL and convert to base64 data URL"""
    # Handle case where image_url might be None
    if not image_url or image_url == 'None':
        raise ValueError("Invalid image URL: None")
        
    response = requests.get(image_url)
    response.raise_for_status()
    
    # Save to file for debugging if filename provided
    if save_filename:
        filepath = os.path.join(TEXTURES_DIR, save_filename)
        with open(filepath, 'wb') as f:
            f.write(response.content)
        print(f"Saved texture to: {filepath}")
    
    # Convert to base64
    image_data = base64.b64encode(response.content).decode('utf-8')
    return f"data:image/png;base64,{image_data}"

def generate_single_texture(prompt, texture_id="texture"):
    """Generate a single texture using Gemini (primary) with gpt-image-1 fallback"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    google_api_key = os.getenv('GOOGLE_API_KEY')
    
    # Try Gemini first (primary)
    if google_api_key:
        try:
            print(f"Generating texture '{texture_id}' with Gemini 2.5 Flash Image Preview...")
            result = generate_image_with_gemini(
                api_key=google_api_key,
                prompt=prompt,
                model="gemini-2.5-flash-image-preview"
            )
            
            if result.get("image"):
                # Save to file
                save_filename = f"{texture_id}_{timestamp}_gemini.png"
                filepath = os.path.join(TEXTURES_DIR, save_filename)
                
                # Extract base64 data and save
                base64_data = result["image"].split(',')[1] if ',' in result["image"] else result["image"]
                with open(filepath, 'wb') as f:
                    f.write(base64.b64decode(base64_data))
                print(f"Saved texture to: {filepath}")
                print(f"✓ Successfully generated texture '{texture_id}' with Gemini")
                return result["image"]
            else:
                raise Exception(result.get("error", "Gemini returned no image"))
                
        except Exception as e:
            print(f"Gemini failed for '{texture_id}': {str(e)}")
            print("Falling back to gpt-image-1...")
    else:
        print("No Google API key found, skipping Gemini")
    
    # Fallback to gpt-image-1
    try:
        print(f"Generating texture '{texture_id}' with gpt-image-1...")
        response = litellm.image_generation(
            model="openai/gpt-image-1",
            prompt=prompt,
            n=1,
            size="1024x1024",
            quality="standard"
        )
        
        # Extract image URL
        image_url = response.data[0]['url']
        
        if not image_url or image_url == 'None':
            raise ValueError("Model returned None as image URL")
        
        # Download image and convert to base64, save to file
        save_filename = f"{texture_id}_{timestamp}_gpt.png"
        base64_image = download_image_as_base64(image_url, save_filename)
        print(f"✓ Successfully generated texture '{texture_id}' with gpt-image-1")
        return base64_image
        
    except Exception as e2:
        # If both fail, raise exception
        error_message = f"Failed to generate texture '{texture_id}': Gemini failed, gpt-image-1: {str(e2)}"
        print(f"✗ {error_message}")
        raise Exception(error_message)

def generate_placeholder_texture(texture_id, prompt):
    """Generate a placeholder texture as base64 data URL"""
    placeholder_text = f"Texture ID: {texture_id}\nPrompt: {prompt}\n\nThis is a placeholder for AI-generated texture."
    placeholder_b64 = base64.b64encode(placeholder_text.encode('utf-8')).decode('utf-8')
    return f"data:text/plain;base64,{placeholder_b64}"

def generate_textures():
    """Generate textures for a dungeon crawler game using AI models"""
    try:
        # Get the request data
        data = request.get_json()
        theme = data.get('theme', {})
        game_id = data.get('game_id', 'default')
        force_new = data.get('force_new', False)  # Option to force new generation
        
        # Create cache key from theme AND game_id to ensure unique textures per prompt
        atmosphere = theme.get('atmosphere', 'dark')
        
        # Check cache first (unless force_new is True)
        if not force_new:
            # Try game_id-specific cache first
            if game_id and game_id != 'default':
                cache_key = f"{game_id}_{atmosphere}_textures"
                cached_textures = get_cached(cache_key, cache_type='textures')
                if cached_textures:
                    print(f"Using cached textures for game_id: {game_id}")
                    return jsonify({"textures": cached_textures, "game_id": game_id})
            
            # Fallback: Try theme-only cache (for backward compatibility)
            fallback_cache_key = f"{atmosphere}_textures"
            cached_textures = get_cached(fallback_cache_key, cache_type='textures')
            if cached_textures:
                print(f"Using cached textures (theme-only fallback): {atmosphere}")
                return jsonify({"textures": cached_textures, "game_id": game_id})
        
        # Set cache key for saving (prefer game_id-specific if available)
        if game_id and game_id != 'default':
            cache_key = f"{game_id}_{atmosphere}_textures"
        else:
            cache_key = f"{atmosphere}_textures"
        
        # Create prompts for tileable wall textures
        # Key: Use "seamless tileable texture" and focus on material, not scenes
        
        wall_prompts = [
            f"Seamless tileable stone brick wall texture, {atmosphere} medieval style, close-up view, no perspective, flat surface, game texture, 512x512",
            f"Seamless tileable weathered stone wall texture, {atmosphere} dungeon style, close-up view, no perspective, flat surface, game texture, 512x512",
            f"Seamless tileable rough stone wall texture with moss, {atmosphere} castle style, close-up view, no perspective, flat surface, game texture, 512x512"
        ]
        
        # Create prompt for tileable floor texture
        floor_prompt = f"Seamless tileable stone floor texture, {atmosphere} dungeon style, close-up view, no perspective, flat surface, game texture, 512x512"
        
        # Create prompt for tileable ceiling texture
        ceiling_prompt = f"Seamless tileable stone ceiling texture, {atmosphere} dungeon style, close-up view, no perspective, flat surface, game texture, 512x512"
        
        # Generate all textures in parallel using ThreadPoolExecutor
        textures = []
        all_prompts = wall_prompts + [floor_prompt, ceiling_prompt]
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            # Submit all texture generation tasks with texture IDs
            future_to_info = {}
            for i, prompt in enumerate(all_prompts):
                if i < 3:
                    texture_id = f"wall_{i+1}"
                elif i == 3:
                    texture_id = "floor"
                else:
                    texture_id = "ceiling"
                future = executor.submit(generate_single_texture, prompt, texture_id)
                future_to_info[future] = (i, texture_id, prompt)
            
            # Collect results as they complete
            for future in concurrent.futures.as_completed(future_to_info):
                i, texture_id, prompt = future_to_info[future]
                try:
                    base64_image = future.result()
                    textures.append({
                        "id": texture_id,
                        "url": base64_image
                    })
                except Exception as e:
                    print(f"✗ Skipping texture '{texture_id}' due to error: {str(e)}")
                    # Don't add failed textures - let frontend use solid colors
        
        # Sort textures to ensure consistent order
        textures.sort(key=lambda x: x['id'])
        
        # Cache the textures with game_id-specific key
        set_cached(cache_key, textures, cache_type='textures')
        print(f"✓ Cached textures for game_id: {game_id}")
        
        return jsonify({"textures": textures, "game_id": game_id})
    except Exception as e:
        return jsonify({"error": str(e)}), 500