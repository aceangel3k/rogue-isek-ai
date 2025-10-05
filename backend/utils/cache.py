import os
import json
import hashlib
from pathlib import Path

# Cache directory
CACHE_DIR = os.path.join(os.path.dirname(__file__), '..', 'cache')
Path(CACHE_DIR).mkdir(exist_ok=True)

def get_cache_key(prompt, cache_type='story'):
    """Generate a cache key from a prompt"""
    # Create a hash of the prompt for the filename
    prompt_hash = hashlib.md5(prompt.lower().strip().encode()).hexdigest()
    return f"{cache_type}_{prompt_hash}.json"

def get_cached(prompt, cache_type='story'):
    """Get cached data for a prompt"""
    try:
        cache_key = get_cache_key(prompt, cache_type)
        cache_path = os.path.join(CACHE_DIR, cache_key)
        
        if os.path.exists(cache_path):
            with open(cache_path, 'r') as f:
                data = json.load(f)
                print(f"✓ Cache HIT for {cache_type}: {prompt[:50]}...")
                return data
        
        print(f"✗ Cache MISS for {cache_type}: {prompt[:50]}...")
        return None
    except Exception as e:
        print(f"Cache read error: {str(e)}")
        return None

def set_cached(prompt, data, cache_type='story'):
    """Cache data for a prompt"""
    try:
        cache_key = get_cache_key(prompt, cache_type)
        cache_path = os.path.join(CACHE_DIR, cache_key)
        
        with open(cache_path, 'w') as f:
            json.dump(data, f, indent=2)
        
        print(f"✓ Cached {cache_type}: {prompt[:50]}...")
        return True
    except Exception as e:
        print(f"Cache write error: {str(e)}")
        return False

def get_all_cached_keys(cache_type=None):
    """Get all cache keys, optionally filtered by type"""
    try:
        keys = []
        for filename in os.listdir(CACHE_DIR):
            if filename.endswith('.json'):
                if cache_type is None or filename.startswith(f"{cache_type}_"):
                    # Extract the key (remove .json extension)
                    key = filename[:-5]
                    keys.append(key)
        return keys
    except Exception as e:
        print(f"Error getting cache keys: {str(e)}")
        return []

def clear_cache(cache_type=None):
    """Clear all cache or specific cache type"""
    try:
        count = 0
        for filename in os.listdir(CACHE_DIR):
            if cache_type is None or filename.startswith(f"{cache_type}_"):
                os.remove(os.path.join(CACHE_DIR, filename))
                count += 1
        print(f"✓ Cleared {count} cache files")
        return count
    except Exception as e:
        print(f"Cache clear error: {str(e)}")
        return 0
