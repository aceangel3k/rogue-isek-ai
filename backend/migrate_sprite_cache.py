#!/usr/bin/env python3
"""
Migrate existing sprite cache to support theme-agnostic lookups.

The cache uses MD5 hashes of the full cache key string.
This script reads each cached sprite, extracts the character ID,
and creates a theme-agnostic cache entry.

For example:
- Old: MD5("sprite_security_bot_cyberpunk") -> sprite_29f3bc9cf50d3104f573417f3b9adc39.json
- New: MD5("sprite_security_bot") -> sprite_<new_hash>.json

This allows sprites to be reused across different themes without regenerating.
"""

import os
import json
import hashlib
from pathlib import Path

CACHE_DIR = os.path.join(os.path.dirname(__file__), 'cache')

def get_cache_key(prompt, cache_type='story'):
    """Generate a cache key from a prompt (matches utils/cache.py)"""
    prompt_hash = hashlib.md5(prompt.lower().strip().encode()).hexdigest()
    return f"{cache_type}_{prompt_hash}.json"

def migrate_sprite_cache():
    """Migrate existing sprite cache to theme-agnostic format"""
    
    if not os.path.exists(CACHE_DIR):
        print(f"Cache directory not found: {CACHE_DIR}")
        return
    
    print("="*60)
    print("Migrating sprite cache to theme-agnostic format...")
    print("="*60)
    
    sprite_files = [f for f in os.listdir(CACHE_DIR) if f.startswith('sprite_') and f.endswith('.json')]
    
    if not sprite_files:
        print("No sprite cache files found.")
        return
    
    migrated = 0
    skipped = 0
    errors = 0
    
    for filename in sprite_files:
        try:
            filepath = os.path.join(CACHE_DIR, filename)
            
            # Read the cached sprite data
            with open(filepath, 'r') as f:
                content = f.read().strip()
            
            # The cache stores JSON as a quoted string, so parse it
            try:
                sprite_data = json.loads(content)
                # If it's still a string, parse again (double-encoded)
                if isinstance(sprite_data, str):
                    sprite_data = json.loads(sprite_data)
            except (json.JSONDecodeError, TypeError) as e:
                print(f"  ✗ Could not parse {filename}: {e}")
                errors += 1
                continue
            
            # Extract character ID from sprite data
            char_id = sprite_data.get('id')
            if not char_id:
                print(f"  ✗ No 'id' field in {filename}")
                errors += 1
                continue
            
            # Create theme-agnostic cache key
            theme_agnostic_key = f"sprite_{char_id}"
            theme_agnostic_filename = get_cache_key(theme_agnostic_key, cache_type='sprite')
            theme_agnostic_path = os.path.join(CACHE_DIR, theme_agnostic_filename)
            
            # Skip if theme-agnostic version already exists
            if os.path.exists(theme_agnostic_path):
                # print(f"  → Already exists: {char_id}")
                skipped += 1
                continue
            
            # Write theme-agnostic version
            with open(theme_agnostic_path, 'w') as f:
                json.dump(json.dumps(sprite_data), f, indent=2)
            
            print(f"  ✓ Migrated: {char_id}")
            migrated += 1
            
        except Exception as e:
            print(f"  ✗ Error processing {filename}: {e}")
            errors += 1
    
    print("="*60)
    print(f"Migration complete!")
    print(f"  Migrated: {migrated}")
    print(f"  Skipped: {skipped}")
    print(f"  Errors: {errors}")
    print("="*60)
    
    if migrated > 0:
        print("\n✓ Existing sprites can now be reused across themes!")
        print("✓ No LLM regeneration needed for migrated sprites.")
    elif skipped > 0:
        print("\n✓ All sprites already have theme-agnostic versions!")

if __name__ == '__main__':
    migrate_sprite_cache()
