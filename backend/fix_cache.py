#!/usr/bin/env python3
"""
Fix corrupted sprite cache files by converting them back to proper format.
"""

import os
import json

CACHE_DIR = os.path.join(os.path.dirname(__file__), 'cache')

def fix_sprite_cache():
    """Fix all corrupted sprite cache files"""
    print("Fixing corrupted sprite cache files...")
    
    if not os.path.exists(CACHE_DIR):
        print("No cache directory found")
        return
    
    sprite_files = [f for f in os.listdir(CACHE_DIR) if f.startswith('sprite_') and f.endswith('.json')]
    
    if not sprite_files:
        print("No sprite cache files found")
        return
    
    print(f"Found {len(sprite_files)} sprite cache files to fix")
    
    fixed = 0
    already_ok = 0
    errors = 0
    
    for filename in sprite_files:
        filepath = os.path.join(CACHE_DIR, filename)
        try:
            with open(filepath, 'r') as f:
                content = f.read().strip()
            
            # Try to parse the content
            try:
                # First parse
                data = json.loads(content)
                
                # Check if it's already a string (correct format)
                if isinstance(data, str):
                    # Try parsing the string to see if it's valid
                    try:
                        inner_data = json.loads(data)
                        # Remove the processed_bg flag if it exists
                        if isinstance(inner_data, dict) and 'processed_bg' in inner_data:
                            del inner_data['processed_bg']
                            # Re-save in correct format
                            with open(filepath, 'w') as f:
                                json.dump(json.dumps(inner_data), f, indent=2)
                            fixed += 1
                            print(f"✓ Fixed: {filename}")
                        else:
                            already_ok += 1
                    except:
                        already_ok += 1
                        
                # If it's a dict (corrupted format), fix it
                elif isinstance(data, dict):
                    # Remove the processed_bg flag if it exists
                    if 'processed_bg' in data:
                        del data['processed_bg']
                    
                    # Convert to proper format (double-encoded JSON string)
                    with open(filepath, 'w') as f:
                        json.dump(json.dumps(data), f, indent=2)
                    
                    fixed += 1
                    print(f"✓ Fixed: {filename}")
                    
            except json.JSONDecodeError:
                print(f"✗ Could not parse: {filename}")
                errors += 1
                
        except Exception as e:
            print(f"✗ Error processing {filename}: {e}")
            errors += 1
    
    print(f"\n{'='*60}")
    print(f"Cache fix complete!")
    print(f"Fixed: {fixed}")
    print(f"Already OK: {already_ok}")
    print(f"Errors: {errors}")
    print(f"{'='*60}")

if __name__ == '__main__':
    print("Sprite Cache Fix Utility")
    print("="*60)
    fix_sprite_cache()
