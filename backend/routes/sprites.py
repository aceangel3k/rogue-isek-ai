from flask import request, jsonify
import litellm
import base64
import os
import json
import concurrent.futures
from dotenv import load_dotenv
import requests
from datetime import datetime
import sys
from PIL import Image
from io import BytesIO
import numpy as np
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from utils.google_genai_helper import generate_image_with_gemini
from utils.cache import get_cached, set_cached

# Load environment variables
load_dotenv()

# Create sprites directory if it doesn't exist
SPRITES_DIR = os.path.join(os.path.dirname(__file__), '..', 'generated_sprites')
os.makedirs(SPRITES_DIR, exist_ok=True)

# Cache directory
CACHE_DIR = os.path.join(os.path.dirname(__file__), '..', 'cache')

# Flag to track if we've processed cached sprites
_cached_sprites_processed = False

def save_sprite_to_disk(sprite_data, game_id):
    """Save sprite to disk as PNG file"""
    try:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{sprite_data['id']}_{timestamp}.png"
        filepath = os.path.join(SPRITES_DIR, filename)
        
        # Extract base64 data - handle data URL format
        sprite_sheet = sprite_data['sprite_sheet']
        if sprite_sheet.startswith('data:'):
            # Remove data URL prefix (e.g., "data:image/png;base64,")
            base64_data = sprite_sheet.split(',', 1)[1] if ',' in sprite_sheet else sprite_sheet
        else:
            base64_data = sprite_sheet
        
        # Decode and save to file
        try:
            image_bytes = base64.b64decode(base64_data)
            with open(filepath, 'wb') as f:
                f.write(image_bytes)
            print(f"Saved sprite to: {filepath} ({len(image_bytes)} bytes)")
            return filepath
        except Exception as decode_error:
            print(f"Error decoding base64 for {filename}: {decode_error}")
            print(f"Base64 data preview: {base64_data[:100]}...")
            return None
            
    except Exception as e:
        print(f"Error saving sprite to disk: {e}")
        return None

def remove_solid_background(base64_image, tolerance=30):
    """
    Remove solid color backgrounds from sprites and make them transparent.
    Uses flood fill from edges to only remove background, preserving sprite details.
    """
    try:
        # Decode base64 to image
        if base64_image.startswith('data:'):
            base64_data = base64_image.split(',', 1)[1]
        else:
            base64_data = base64_image
        
        image_bytes = base64.b64decode(base64_data)
        img = Image.open(BytesIO(image_bytes))
        
        # Convert to RGBA if not already
        if img.mode != 'RGBA':
            img = img.convert('RGBA')
        
        # Get image data as numpy array
        data = np.array(img)
        height, width = data.shape[:2]
        
        # Check if image already has transparency
        # If more than 5% of pixels are already transparent, skip processing
        alpha_channel = data[:, :, 3]
        transparent_pixels = np.sum(alpha_channel < 255)
        total_pixels = alpha_channel.size
        transparency_ratio = transparent_pixels / total_pixels
        
        if transparency_ratio > 0.05:  # More than 5% already transparent
            print("  → Image already has transparency, skipping background removal")
            return base64_image
        
        # Sample corner pixels to determine background color
        corners = [
            data[0, 0],  # Top-left
            data[0, -1],  # Top-right
            data[-1, 0],  # Bottom-left
            data[-1, -1]  # Bottom-right
        ]
        
        # Use the first corner as background color (most common case)
        bg_color = corners[0][:3]  # RGB only
        
        # Create a mask for background pixels (starts as False)
        bg_mask = np.zeros((height, width), dtype=bool)
        
        # Flood fill from all edges to find connected background pixels
        def is_background_color(pixel_rgb):
            """Check if pixel color is close to background color"""
            color_diff = np.sqrt(
                (int(pixel_rgb[0]) - int(bg_color[0])) ** 2 +
                (int(pixel_rgb[1]) - int(bg_color[1])) ** 2 +
                (int(pixel_rgb[2]) - int(bg_color[2])) ** 2
            )
            return color_diff <= tolerance
        
        # Simple flood fill from edges (4-directional)
        visited = np.zeros((height, width), dtype=bool)
        stack = []
        
        # Add all edge pixels that match background color
        # Top and bottom edges
        for x in range(width):
            if is_background_color(data[0, x, :3]):
                stack.append((0, x))
            if is_background_color(data[height-1, x, :3]):
                stack.append((height-1, x))
        
        # Left and right edges
        for y in range(height):
            if is_background_color(data[y, 0, :3]):
                stack.append((y, 0))
            if is_background_color(data[y, width-1, :3]):
                stack.append((y, width-1))
        
        # Flood fill
        while stack:
            y, x = stack.pop()
            
            if visited[y, x]:
                continue
            
            if not is_background_color(data[y, x, :3]):
                continue
            
            visited[y, x] = True
            bg_mask[y, x] = True
            
            # Check 4 neighbors
            for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                ny, nx = y + dy, x + dx
                if 0 <= ny < height and 0 <= nx < width and not visited[ny, nx]:
                    stack.append((ny, nx))
        
        # Apply mask - only make background pixels transparent
        data[bg_mask, 3] = 0  # Set alpha to 0 for background only
        
        # Create new image with transparency
        result_img = Image.fromarray(data, 'RGBA')
        
        # Convert back to base64
        buffer = BytesIO()
        result_img.save(buffer, format='PNG')
        result_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
        
        return f"data:image/png;base64,{result_base64}"
        
    except Exception as e:
        print(f"Error removing background: {e}")
        # Return original image if processing fails
        return base64_image

def process_cached_sprites_once():
    """
    Process all cached sprites to remove backgrounds on first request.
    This runs automatically once per server startup.
    """
    global _cached_sprites_processed
    
    if _cached_sprites_processed:
        return
    
    print("\n" + "="*60)
    print("Auto-processing cached sprites (one-time on startup)...")
    print("="*60)
    
    try:
        if not os.path.exists(CACHE_DIR):
            print("No cache directory found, skipping.")
            _cached_sprites_processed = True
            return
        
        sprite_files = [f for f in os.listdir(CACHE_DIR) if f.startswith('sprite_') and f.endswith('.json')]
        
        if not sprite_files:
            print("No cached sprites found.")
            _cached_sprites_processed = True
            return
        
        print(f"Found {len(sprite_files)} cached sprites to process")
        
        processed = 0
        skipped = 0
        
        for filename in sprite_files:
            filepath = os.path.join(CACHE_DIR, filename)
            try:
                with open(filepath, 'r') as f:
                    content = f.read().strip()
                
                # The cache stores JSON as a quoted string, so we need to parse it twice
                # First parse removes the outer quotes and escaping
                try:
                    # Try parsing once (normal JSON)
                    sprite_data = json.loads(content)
                    # If it's still a string, parse again (double-encoded)
                    if isinstance(sprite_data, str):
                        sprite_data = json.loads(sprite_data)
                except (json.JSONDecodeError, TypeError) as e:
                    print(f"Could not parse {filename}: {e}")
                    continue
                
                # Check if already processed (has transparent pixels)
                needs_processing = False
                
                if 'weapon' in sprite_data:
                    original_sprite = sprite_data['sprite']
                    # Quick check: if it's already been processed, skip
                    if 'processed_bg' not in sprite_data:
                        print(f"Processing weapon: {sprite_data['weapon']}")
                        processed_sprite = remove_solid_background(original_sprite, tolerance=40)
                        sprite_data['sprite'] = processed_sprite
                        sprite_data['processed_bg'] = True
                        needs_processing = True
                    else:
                        skipped += 1
                        
                elif 'sprite_sheet' in sprite_data:
                    original_sprite = sprite_data['sprite_sheet']
                    if 'processed_bg' not in sprite_data:
                        print(f"Processing character: {sprite_data.get('id', 'unknown')}")
                        processed_sprite = remove_solid_background(original_sprite, tolerance=35)
                        sprite_data['sprite_sheet'] = processed_sprite
                        sprite_data['processed_bg'] = True
                        needs_processing = True
                    else:
                        skipped += 1
                
                if needs_processing:
                    # Save back as JSON string (matching cache format)
                    with open(filepath, 'w') as f:
                        json.dump(json.dumps(sprite_data), f, indent=2)
                    processed += 1
                    
            except Exception as e:
                print(f"Error processing {filename}: {e}")
        
        print(f"✓ Processed: {processed}, Skipped (already processed): {skipped}")
        print("="*60 + "\n")
        
    except Exception as e:
        print(f"Error in auto-processing: {e}")
    finally:
        _cached_sprites_processed = True

def download_image_as_base64(image_url):
    """Download image from URL and convert to base64 data URL"""
    try:
        if not image_url or image_url == 'None':
            raise ValueError("Invalid image URL: None")
        
        # If it's already a data URL, return it as-is
        if image_url.startswith('data:'):
            return image_url
            
        # Otherwise download from URL
        response = requests.get(image_url)
        response.raise_for_status()
        
        # Convert to base64
        image_data = base64.b64encode(response.content).decode('utf-8')
        return f"data:image/png;base64,{image_data}"
    except Exception as e:
        error_message = f"Error downloading image: {str(e)}"
        error_b64 = base64.b64encode(error_message.encode('utf-8')).decode('utf-8')
        return f"data:text/plain;base64,{error_b64}"

def generate_single_sprite(character_data, theme, game_id=None, force_new=False):
    """Generate a single character sprite sheet using Gemini (primary) with gpt-image-1 fallback"""
    try:
        char_id = character_data.get('id', 'unknown')
        atmosphere = theme.get('atmosphere', 'default')
        
        # Use character-specific game_id if provided (for accumulated enemies)
        # Otherwise use the global game_id (for current dungeon enemies)
        effective_game_id = character_data.get('_originalGameId') or game_id
        
        # If force_new is False, check cache
        if not force_new:
            # 1. Try game_id-specific cache first (for new prompt-specific assets)
            if effective_game_id and effective_game_id != 'default':
                cache_key = f"sprite_{effective_game_id}_{char_id}_{atmosphere}"
                cached_sprite = get_cached(cache_key, cache_type='sprite')
                if cached_sprite:
                    print(f"✓ Using cached sprite for {char_id} (game_id: {effective_game_id})")
                    return json.loads(cached_sprite)
            
            # 2. Fallback: Try theme-only cache (for accumulated enemies from previous levels)
            fallback_cache_key = f"sprite_{char_id}_{atmosphere}"
            cached_sprite = get_cached(fallback_cache_key, cache_type='sprite')
            if cached_sprite:
                print(f"✓ Using cached sprite for {char_id} (theme fallback)")
                return json.loads(cached_sprite)
            
            # 3. Fallback: Try theme-agnostic cache
            theme_agnostic_key = f"sprite_{char_id}"
            cached_sprite = get_cached(theme_agnostic_key, cache_type='sprite')
            if cached_sprite:
                print(f"✓ Using cached sprite for {char_id} (theme-agnostic fallback)")
                return json.loads(cached_sprite)
        
        # If force_new is True, skip all cache lookups and generate fresh
        if force_new:
            print(f"Force generating new sprite for {char_id} (skipping cache)")
        
        char_type = character_data.get('type', 'character')
        char_id = character_data.get('id', 'unknown')
        description = character_data.get('description', '')
        directions = character_data.get('directions', 4)
        
        # Create prompt for sprite sheet generation
        if directions == 4:
            prompt = f"""Pixel art sprite sheet: {description}

CRITICAL LAYOUT - 2x2 GRID:
- 4 CHARACTER SPRITES arranged in a 2x2 grid
- Top row: [FRONT view] [BACK view]
- Bottom row: [LEFT side] [RIGHT side]
- Each sprite is the SAME character from a different angle

CRITICAL REQUIREMENTS:
- NO background scenery, NO environment, NO landscape
- TRANSPARENT or SOLID COLOR background only
- Character should be ISOLATED with no props or scenery
- {theme.get('style', 'pixel art')} style
- {theme.get('atmosphere', 'fantasy')} theme
- Game-ready sprite sheet for a dungeon crawler
- Clear silhouette, centered in each quadrant

DO NOT include: backgrounds, landscapes, environments, scenery, or settings.
ONLY the character sprite from 4 angles in a 2x2 grid."""
        else:
            # Single sprite for items
            prompt = f"""Generate a pixel art sprite of {description}.
Theme: {theme.get('atmosphere', 'fantasy')}
Style: {theme.get('style', 'pixel art')}
Pixel art style, transparent background, game-ready sprite for a dungeon crawler.
Clear icon-like design, centered, retro game aesthetic."""
        
        # Try gpt-image-1 first
        base64_image = None
        print(f"Generating sprite '{char_id}' with gpt-image-1...")
        
        try:
            # Note: gpt-image-1 only supports 1024x1024, but prompt requests horizontal layout
            response = litellm.image_generation(
                model="openai/gpt-image-1",
                prompt=prompt,
                n=1,
                size="1024x1024",
                quality="medium"
            )
            
            # Extract image URL - check both 'url' and 'b64_json' formats
            image_url = None
            if response.data and len(response.data) > 0:
                if 'url' in response.data[0] and response.data[0]['url']:
                    image_url = response.data[0]['url']
                elif 'b64_json' in response.data[0]:
                    b64_data = response.data[0]['b64_json']
                    image_url = f"data:image/png;base64,{b64_data}"
            
            if image_url:
                base64_image = download_image_as_base64(image_url)
                
                # Remove solid background to make it transparent
                print(f"Removing background from sprite '{char_id}'...")
                base64_image = remove_solid_background(base64_image, tolerance=35)
                
                print(f"✓ Successfully generated sprite '{char_id}' with gpt-image-1")
            else:
                print(f"gpt-image-1 returned no image, trying Gemini...")
                raise ValueError("No image URL from gpt-image-1")
                
        except Exception as gpt_error:
            print(f"gpt-image-1 failed: {str(gpt_error)}")
            
            # Fallback to Gemini
            google_api_key = os.getenv('GOOGLE_API_KEY')
            if google_api_key:
                try:
                    print(f"Trying Gemini for sprite '{char_id}'...")
                    result = generate_image_with_gemini(
                        api_key=google_api_key,
                        prompt=prompt,
                        model="gemini-2.5-flash-image-preview"
                    )
                    
                    if result.get("image"):
                        base64_image = result["image"]
                        
                        # Remove solid background to make it transparent
                        print(f"Removing background from Gemini sprite '{char_id}'...")
                        base64_image = remove_solid_background(base64_image, tolerance=35)
                        
                        print(f"✓ Successfully generated sprite '{char_id}' with Gemini")
                except Exception as gemini_error:
                    print(f"Gemini also failed: {str(gemini_error)}")
        
        if not base64_image:
            raise ValueError(f"All image generation methods failed for {char_id}")
        
        result = {
            "id": char_id,
            "type": char_type,
            "sprite_sheet": base64_image,
            "dimensions": {
                "width": 1024,
                "height": 1024  # gpt-image-1 always generates 1024x1024
            },
            "frame_count": directions
        }
        
        # Cache the result with multiple keys for flexibility
        if effective_game_id and effective_game_id != 'default':
            # Primary cache: game_id-specific (for new prompts)
            cache_key = f"sprite_{effective_game_id}_{char_id}_{atmosphere}"
            set_cached(cache_key, json.dumps(result), cache_type='sprite')
            print(f"✓ Cached sprite for {char_id} (game_id: {effective_game_id})")
        
        # Also cache with theme-only key (for progressive difficulty reuse)
        fallback_cache_key = f"sprite_{char_id}_{atmosphere}"
        set_cached(fallback_cache_key, json.dumps(result), cache_type='sprite')
        print(f"✓ Cached sprite for {char_id} (theme fallback)")
        
        # Save to disk if game_id provided
        if game_id:
            save_sprite_to_disk(result, game_id)
        
        return result
        
    except Exception as e:
        # If generation fails, return error
        error_message = f"Error generating sprite {char_id}: {str(e)}"
        print(error_message)
        return {
            "id": char_id,
            "type": char_type,
            "sprite_sheet": f"data:text/plain;base64,{base64.b64encode(error_message.encode()).decode()}",
            "dimensions": {"width": 64, "height": 64},
            "frame_count": 1,
            "error": error_message
        }

def generate_weapon_sprite(weapon_name, theme, game_id=None, force_new=False):
    """Generate a first-person weapon sprite (Wolfenstein style)"""
    try:
        atmosphere = theme.get('atmosphere', 'default')
        
        # Check cache first (unless force_new is True)
        if not force_new:
            # Try game_id-specific cache first
            if game_id and game_id != 'default':
                cache_key = f"weapon_{game_id}_{weapon_name}_{atmosphere}"
                cached_weapon = get_cached(cache_key, cache_type='sprite')
                if cached_weapon:
                    print(f"Using cached weapon sprite for {weapon_name} (game_id: {game_id})")
                    return json.loads(cached_weapon)
            
            # Fallback: theme-only cache
            fallback_cache_key = f"weapon_{weapon_name}_{atmosphere}"
            cached_weapon = get_cached(fallback_cache_key, cache_type='sprite')
            if cached_weapon:
                print(f"Using cached weapon sprite for {weapon_name} (theme fallback)")
                return json.loads(cached_weapon)
        
        # Create prompt for weapon sprite
        prompt = f"""First-person view pixel art weapon sprite: {weapon_name}

CRITICAL REQUIREMENTS:
- First-person perspective (player holding the weapon)
- Bottom-center of image (like Wolfenstein 3D or Doom)
- Weapon should take up lower 1/3 of screen
- {theme.get('style', 'pixel art')} style
- {theme.get('atmosphere', 'fantasy')} theme
- Hands/arms visible holding the weapon
- Clear, iconic weapon design
- Transparent or solid color background
- Game-ready sprite for a dungeon crawler FPS

DO NOT include: full character body, scenery, or environment.
ONLY the weapon and hands from first-person view."""
        
        print(f"Generating weapon sprite '{weapon_name}' with gpt-image-1...")
        
        try:
            response = litellm.image_generation(
                model="openai/gpt-image-1",
                prompt=prompt,
                n=1,
                size="1024x1024",
                quality="medium"
            )
            
            # Extract image URL
            image_url = None
            if response.data and len(response.data) > 0:
                if 'url' in response.data[0] and response.data[0]['url']:
                    image_url = response.data[0]['url']
                elif 'b64_json' in response.data[0]:
                    b64_data = response.data[0]['b64_json']
                    image_url = f"data:image/png;base64,{b64_data}"
            
            if not image_url:
                raise ValueError("Model returned no image data")
            
            base64_image = download_image_as_base64(image_url)
            
            # Remove solid background to make it transparent
            print(f"Removing background from weapon sprite '{weapon_name}'...")
            base64_image = remove_solid_background(base64_image, tolerance=40)
            
            print(f"✓ Successfully generated weapon sprite '{weapon_name}'")
            
        except Exception as e:
            print(f"gpt-image-1 failed for weapon: {str(e)}")
            # Try Gemini fallback
            google_api_key = os.getenv('GOOGLE_API_KEY')
            if google_api_key:
                try:
                    result = generate_image_with_gemini(
                        api_key=google_api_key,
                        prompt=prompt,
                        model="gemini-2.5-flash-image-preview"
                    )
                    if result.get("image"):
                        base64_image = result["image"]
                        
                        # Remove solid background to make it transparent
                        print(f"Removing background from Gemini weapon sprite '{weapon_name}'...")
                        base64_image = remove_solid_background(base64_image, tolerance=40)
                        
                        print(f"✓ Generated weapon sprite with Gemini")
                    else:
                        raise ValueError("Gemini returned no image")
                except Exception as gemini_error:
                    print(f"Gemini also failed: {str(gemini_error)}")
                    raise
            else:
                raise
        
        result = {
            "weapon": weapon_name,
            "sprite": base64_image,
            "dimensions": {
                "width": 1024,
                "height": 1024
            }
        }
        
        # Cache with multiple keys for flexibility
        if game_id and game_id != 'default':
            cache_key = f"weapon_{game_id}_{weapon_name}_{atmosphere}"
            set_cached(cache_key, json.dumps(result), cache_type='sprite')
        
        # Also cache with theme-only key (for reuse across dungeons)
        fallback_cache_key = f"weapon_{weapon_name}_{atmosphere}"
        set_cached(fallback_cache_key, json.dumps(result), cache_type='sprite')
        
        return result
        
    except Exception as e:
        print(f"Error generating weapon sprite {weapon_name}: {e}")
        raise

def generate_sprites():
    """Generate character sprites for NPCs, enemies, and items"""
    # Auto-process cached sprites on first request
    process_cached_sprites_once()
    
    try:
        # Get the request data
        data = request.get_json()
        game_id = data.get('game_id', 'default')
        characters = data.get('characters', [])
        theme = data.get('theme', {})
        force_new = data.get('force_new', False)  # Option to force new generation
        
        if not characters:
            return jsonify({"error": "No characters specified"}), 400
        
        # Generate sprites in parallel for speed
        sprites = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            # Submit all sprite generation tasks
            future_to_char = {
                executor.submit(generate_single_sprite, char, theme, game_id, force_new): char 
                for char in characters
            }
            
            # Collect results as they complete
            for future in concurrent.futures.as_completed(future_to_char):
                char = future_to_char[future]
                try:
                    sprite_data = future.result()
                    sprites.append(sprite_data)
                except Exception as e:
                    print(f"Error generating sprite for {char.get('id')}: {str(e)}")
                    # Add error sprite
                    sprites.append({
                        "id": char.get('id', 'unknown'),
                        "type": char.get('type', 'unknown'),
                        "sprite_sheet": f"data:text/plain;base64,{base64.b64encode(str(e).encode()).decode()}",
                        "dimensions": {"width": 64, "height": 64},
                        "frame_count": 1,
                        "error": str(e)
                    })
        
        # Sort sprites to ensure consistent order
        sprites.sort(key=lambda x: x['id'])
        
        return jsonify({
            "sprites": sprites,
            "game_id": game_id,
            "total_generated": len(sprites)
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def generate_weapon():
    """Generate a weapon sprite for first-person view"""
    try:
        data = request.get_json()
        weapon_name = data.get('weapon', 'pistol')
        theme = data.get('theme', {})
        game_id = data.get('game_id', None)
        force_new = data.get('force_new', False)
        
        weapon_sprite = generate_weapon_sprite(weapon_name, theme, game_id, force_new)
        
        return jsonify({
            "weapon": weapon_sprite,
            "success": True
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def generate_hud_frame(theme, game_id=None, force_new=False):
    """Generate a HUD frame texture"""
    try:
        atmosphere = theme.get('atmosphere', 'default')
        
        # Check cache first (unless force_new is True)
        if not force_new:
            # Try game_id-specific cache first
            if game_id and game_id != 'default':
                cache_key = f"hud_frame_{game_id}_{atmosphere}"
                cached_hud = get_cached(cache_key, cache_type='sprite')
                if cached_hud:
                    print(f"Using cached HUD frame (game_id: {game_id})")
                    return json.loads(cached_hud)
            
            # Fallback: theme-only cache
            fallback_cache_key = f"hud_frame_{atmosphere}"
            cached_hud = get_cached(fallback_cache_key, cache_type='sprite')
            if cached_hud:
                print(f"Using cached HUD frame (theme fallback)")
                return json.loads(cached_hud)
        
        # Create prompt for HUD frame
        prompt = f"""Decorative border/frame overlay for a retro FPS game HUD:

CRITICAL REQUIREMENTS:
- {theme.get('style', 'pixel art')} style
- {theme.get('atmosphere', 'fantasy')} theme aesthetic
- ONLY decorative borders and corner elements
- Empty space in corners and edges for UI text/numbers
- NO text, NO numbers, NO health bars, NO UI elements
- Just ornamental frames, borders, and decorative patterns
- Transparent or dark center (80% of screen)
- Think decorative picture frame or monitor bezel

Style: Ornamental borders like Doom/Wolfenstein 3D screen edges.
DO NOT include: any text, numbers, bars, icons, characters, weapons, or UI elements.
ONLY decorative frame/border artwork that leaves space for overlaid UI."""
        
        print("Generating HUD frame with Gemini...")
        
        # Try Gemini first
        google_api_key = os.getenv('GOOGLE_API_KEY')
        if google_api_key:
            try:
                result = generate_image_with_gemini(
                    api_key=google_api_key,
                    prompt=prompt,
                    model="gemini-2.5-flash-image-preview"
                )
                if result.get("image"):
                    base64_image = result["image"]
                    print("✓ Generated HUD frame with Gemini")
                else:
                    raise ValueError("Gemini returned no image")
            except Exception as gemini_error:
                print(f"Gemini failed for HUD: {str(gemini_error)}")
                # Fallback to gpt-image-1
                print("Falling back to gpt-image-1...")
                try:
                    response = litellm.image_generation(
                        model="openai/gpt-image-1",
                        prompt=prompt,
                        n=1,
                        size="1024x1024",
                        quality="medium"
                    )
                    
                    # Extract image URL
                    image_url = None
                    if response.data and len(response.data) > 0:
                        if 'url' in response.data[0] and response.data[0]['url']:
                            image_url = response.data[0]['url']
                        elif 'b64_json' in response.data[0]:
                            b64_data = response.data[0]['b64_json']
                            image_url = f"data:image/png;base64,{b64_data}"
                    
                    if not image_url:
                        raise ValueError("Model returned no image data")
                    
                    base64_image = download_image_as_base64(image_url)
                    print("✓ Successfully generated HUD frame with gpt-image-1")
                except Exception as gpt_error:
                    print(f"gpt-image-1 also failed: {str(gpt_error)}")
                    raise
        else:
            # No Gemini key, use gpt-image-1
            print("No Gemini API key, using gpt-image-1...")
            response = litellm.image_generation(
                model="openai/gpt-image-1",
                prompt=prompt,
                n=1,
                size="1024x1024",
                quality="medium"
            )
            
            # Extract image URL
            image_url = None
            if response.data and len(response.data) > 0:
                if 'url' in response.data[0] and response.data[0]['url']:
                    image_url = response.data[0]['url']
                elif 'b64_json' in response.data[0]:
                    b64_data = response.data[0]['b64_json']
                    image_url = f"data:image/png;base64,{b64_data}"
            
            if not image_url:
                raise ValueError("Model returned no image data")
            
            base64_image = download_image_as_base64(image_url)
            print("✓ Successfully generated HUD frame with gpt-image-1")
        
        result = {
            "hud_frame": base64_image,
            "dimensions": {
                "width": 1024,
                "height": 1024
            }
        }
        
        # Cache with multiple keys for flexibility
        if game_id and game_id != 'default':
            cache_key = f"hud_frame_{game_id}_{atmosphere}"
            set_cached(cache_key, json.dumps(result), cache_type='sprite')
        
        # Also cache with theme-only key (for reuse across dungeons)
        fallback_cache_key = f"hud_frame_{atmosphere}"
        set_cached(fallback_cache_key, json.dumps(result), cache_type='sprite')
        
        return result
        
    except Exception as e:
        print(f"Error generating HUD frame: {e}")
        raise

def generate_hud():
    """Generate HUD frame texture"""
    try:
        data = request.get_json()
        theme = data.get('theme', {})
        game_id = data.get('game_id', None)
        force_new = data.get('force_new', False)
        
        hud_data = generate_hud_frame(theme, game_id, force_new)
        
        return jsonify({
            "hud": hud_data,
            "success": True
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500
