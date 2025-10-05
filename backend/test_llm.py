import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from services.llm import test_cerebras_connection

def test_llm_connection():
    """Test the LLM connection"""
    print("Testing Cerebras connection...")
    success, response = test_cerebras_connection()
    
    if success:
        print("✓ Cerebras connection successful")
        print(f"Response: {response}")
    else:
        print("✗ Cerebras connection failed")
        print(f"Error: {response}")

if __name__ == "__main__":
    test_llm_connection()