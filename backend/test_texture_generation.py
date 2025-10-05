#!/usr/bin/env python3
"""
Test script for texture generation
Tests the generate_single_texture function directly
"""

import sys
import os

# Add the parent directory to the Python path
sys.path.append(os.path.dirname(__file__))

from routes.textures import generate_single_texture

def test_texture_generation():
    """Test texture generation with a simple prompt"""
    print("=" * 60)
    print("Testing Texture Generation")
    print("=" * 60)
    
    test_prompt = "Seamless tileable stone brick wall texture, dark medieval style, close-up view, no perspective, flat surface, game texture, 1024x1024"
    
    try:
        print(f"\nPrompt: {test_prompt}")
        print("\nAttempting to generate texture...")
        print("This may take 30 seconds to 3 minutes depending on the model...\n")
        
        # Try to generate a texture
        result = generate_single_texture(test_prompt, texture_id="test_wall")
        
        if result.startswith("data:image/png;base64,"):
            print("\n✓ SUCCESS! Texture generated successfully")
            print(f"✓ Base64 data length: {len(result)} characters")
            print(f"✓ Check backend/generated_textures/ for saved image file")
        else:
            print(f"\n✗ FAILED: Unexpected result format")
            print(f"Result: {result[:200]}...")
            
    except Exception as e:
        print(f"\n✗ FAILED with exception:")
        print(f"Error: {str(e)}")
        print("\nPossible issues:")
        print("1. Invalid API keys in backend/.env")
        print("2. API quota exceeded")
        print("3. Network connectivity issues")
        print("4. Model name incorrect")
        
        return False
    
    return True

if __name__ == "__main__":
    success = test_texture_generation()
    sys.exit(0 if success else 1)
