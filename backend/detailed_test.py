import requests
import json
import time

def test_story_generation():
    """Test the story generation endpoint with detailed output"""
    url = "http://localhost:5001/api/generate-game"
    prompt = "A haunted castle with undead knights"
    
    print(f"Testing story generation with prompt: {prompt}")
    print(f"Making request to: {url}")
    
    # Prepare the request
    headers = {
        "Content-Type": "application/json",
        "Origin": "http://localhost:5173"
    }
    data = {"prompt": prompt}
    
    print("Request headers:", headers)
    print("Request data:", data)
    
    # Send POST request with timeout
    try:
        print("Sending request...")
        start_time = time.time()
        response = requests.post(url, json=data, headers=headers, timeout=30)
        end_time = time.time()
        
        print(f"Request completed in {end_time - start_time:.2f} seconds")
        print(f"Response status code: {response.status_code}")
        print(f"Response headers: {response.headers}")
        print(f"Response content: {response.text}")
        
        if response.status_code == 200:
            print("✓ Story generation endpoint is working correctly")
        else:
            print(f"✗ Story generation endpoint failed with status code {response.status_code}")
            
    except requests.exceptions.Timeout:
        print("✗ Request timed out after 30 seconds")
    except requests.exceptions.ConnectionError:
        print("✗ Connection error - Flask server may not be running")
    except Exception as e:
        print(f"✗ Request failed with error: {e}")

if __name__ == "__main__":
    test_story_generation()