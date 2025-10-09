#!/usr/bin/env python3
"""
Process existing cached sprites to remove solid backgrounds.
This script processes already generated sprites WITHOUT calling AI models.
"""

import json
import base64
from PIL import Image
from io import BytesIO
import numpy as np
import os

# Cache directory
CACHE_DIR = os.path.join(os.path.dirname(__file__), 'cache')

def remove_solid_background(base64_image, tolerance=35):
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
        alpha_channel = data[:, :, 3]
        transparent_pixels = np.sum(alpha_channel < 255)
        total_pixels = alpha_channel.size
        transparency_ratio = transparent_pixels / total_pixels
        
        if transparency_ratio > 0.05:  # More than 5% already transparent
            print("  → Already has transparency, skipping")
            return base64_image
        
        # Sample corner pixels to determine background color
        corners = [
            data[0, 0],  # Top-left
            data[0, -1],  # Top-right
            data[-1, 0],  # Bottom-left
            data[-1, -1]  # Bottom-right
        ]
        
        # Use the first corner as background color
        bg_color = corners[0][:3]  # RGB only
        
        # Create a mask for background pixels
        bg_mask = np.zeros((height, width), dtype=bool)
        
        # Flood fill from all edges to find connected background pixels
        def is_background_color(pixel_rgb):
            color_diff = np.sqrt(
                (int(pixel_rgb[0]) - int(bg_color[0])) ** 2 +
                (int(pixel_rgb[1]) - int(bg_color[1])) ** 2 +
                (int(pixel_rgb[2]) - int(bg_color[2])) ** 2
            )
            return color_diff <= tolerance
        
        # Simple flood fill from edges
        visited = np.zeros((height, width), dtype=bool)
        stack = []
        
        # Add all edge pixels that match background color
        for x in range(width):
            if is_background_color(data[0, x, :3]):
                stack.append((0, x))
            if is_background_color(data[height-1, x, :3]):
                stack.append((height-1, x))
        
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
        data[bg_mask, 3] = 0
        
        # Create new image with transparency
        result_img = Image.fromarray(data, 'RGBA')
        
        # Convert back to base64
        buffer = BytesIO()
        result_img.save(buffer, format='PNG')
        result_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
        
        return f"data:image/png;base64,{result_base64}"
        
    except Exception as e:
        print(f"Error removing background: {e}")
        return base64_image

def process_sprite_cache():
    """Process all cached sprites to remove backgrounds"""
    print("Processing cached sprites...")
    
    # Get all sprite cache files
    if not os.path.exists(CACHE_DIR):
        print(f"Cache directory not found: {CACHE_DIR}")
        return
    
    sprite_files = [f for f in os.listdir(CACHE_DIR) if f.startswith('sprite_') and f.endswith('.json')]
    
    if not sprite_files:
        print("No cached sprites found.")
        return
    
    print(f"Found {len(sprite_files)} cached sprites to process")
    
    processed = 0
    errors = 0
    
    for filename in sprite_files:
        filepath = os.path.join(CACHE_DIR, filename)
        try:
            # Read cached sprite data
            with open(filepath, 'r') as f:
                content = f.read().strip()
            
            # The cache stores JSON as a quoted string, so parse it
            try:
                sprite_data = json.loads(content)
                # If it's still a string, parse again (double-encoded)
                if isinstance(sprite_data, str):
                    sprite_data = json.loads(sprite_data)
            except (json.JSONDecodeError, TypeError) as e:
                print(f"✗ Could not parse {filename}: {e}")
                errors += 1
                continue
            
            # Check if it's a weapon sprite or character sprite
            if 'weapon' in sprite_data:
                # Weapon sprite
                print(f"Processing weapon: {sprite_data['weapon']}")
                original_sprite = sprite_data['sprite']
                processed_sprite = remove_solid_background(original_sprite, tolerance=40)
                sprite_data['sprite'] = processed_sprite
                
            elif 'sprite_sheet' in sprite_data:
                # Character sprite
                print(f"Processing character: {sprite_data.get('id', 'unknown')}")
                original_sprite = sprite_data['sprite_sheet']
                processed_sprite = remove_solid_background(original_sprite, tolerance=35)
                sprite_data['sprite_sheet'] = processed_sprite
            
            else:
                print(f"Unknown sprite format in: {filename}")
                continue
            
            # Save back to cache in double-encoded format (matching cache format)
            with open(filepath, 'w') as f:
                json.dump(json.dumps(sprite_data), f, indent=2)
            
            processed += 1
            print(f"✓ Processed and updated: {filename}")
            
        except Exception as e:
            print(f"✗ Error processing {filename}: {e}")
            errors += 1
    
    print("\n" + "="*60)
    print("Processing complete!")
    print(f"Successfully processed: {processed}")
    print(f"Errors: {errors}")
    print("="*60)

if __name__ == '__main__':
    print("Cached Sprite Background Removal Utility")
    print("This will process existing sprites WITHOUT calling AI models")
    print("="*60)
    
    response = input("Process all cached sprites? (yes/no): ")
    if response.lower() in ['yes', 'y']:
        process_sprite_cache()
    else:
        print("Cancelled.")
