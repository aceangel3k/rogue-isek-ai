"""
Google GenAI helper for image generation using gemini-2.5-flash-image-preview
Based on implementation from /Users/angelespiritu/Dev/github/ai_prompt_editor/backend
"""
import logging
import base64
from typing import Dict, Any
from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

def get_gemini_generation_config(temperature=0.8):
    """Helper to create generation config for Gemini image generation"""
    try:
        safety_settings = [
            types.SafetySetting(
                category=types.HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                threshold=types.HarmBlockThreshold.BLOCK_NONE
            ),
            types.SafetySetting(
                category=types.HarmCategory.HARM_CATEGORY_HARASSMENT,
                threshold=types.HarmBlockThreshold.BLOCK_NONE
            ),
            types.SafetySetting(
                category=types.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                threshold=types.HarmBlockThreshold.BLOCK_NONE
            ),
            types.SafetySetting(
                category=types.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold=types.HarmBlockThreshold.BLOCK_NONE
            )
        ]
        
        config = types.GenerateContentConfig(
            temperature=temperature,
            safety_settings=safety_settings
        )
        return config
    except Exception as e:
        logger.warning(f"Error creating generation config: {e}, using dict fallback")
        return {"temperature": temperature}

def parse_gemini_response(response) -> Dict[str, Any]:
    """Parse image data from Gemini API response"""
    output_image_url = None
    image_found = False
    
    try:
        if hasattr(response, 'candidates') and response.candidates:
            for candidate in response.candidates:
                if hasattr(candidate, 'content') and hasattr(candidate.content, 'parts'):
                    for part in candidate.content.parts:
                        # Check for inline_data (image)
                        if hasattr(part, 'inline_data'):
                            inline_data = part.inline_data
                            if hasattr(inline_data, 'data'):
                                image_data = inline_data.data
                                mime_type = getattr(inline_data, 'mime_type', 'image/png')
                                
                                # Convert bytes to base64 if needed
                                if isinstance(image_data, bytes):
                                    image_b64 = base64.b64encode(image_data).decode('utf-8')
                                else:
                                    image_b64 = image_data
                                
                                output_image_url = f"data:{mime_type};base64,{image_b64}"
                                image_found = True
                                logger.info("Successfully extracted image from Gemini response")
                                break
                
                # Check for finish_reason blocking
                if hasattr(candidate, 'finish_reason'):
                    finish_reason = str(candidate.finish_reason)
                    if 'SAFETY' in finish_reason or 'BLOCKED' in finish_reason:
                        block_msg = f"Content blocked by safety filters: {finish_reason}"
                        logger.error(block_msg)
                        return {"error": block_msg}
        
        if image_found and output_image_url:
            return {"image": output_image_url}
        else:
            return {"error": "No image found in response"}
            
    except Exception as e:
        logger.error(f"Error parsing Gemini response: {e}")
        return {"error": f"Failed to parse response: {e}"}

def generate_image_with_gemini(api_key: str, prompt: str, model: str = "gemini-2.5-flash-image-preview") -> Dict[str, Any]:
    """
    Generate an image using Google Gemini
    
    Args:
        api_key: Google API key
        prompt: Text prompt for image generation
        model: Gemini model to use (default: gemini-2.5-flash-image-preview)
    
    Returns:
        Dict with 'image' (base64 data URL) or 'error'
    """
    try:
        client = genai.Client(api_key=api_key)
        logger.info(f"Generating image with {model}")
        
        # Ensure model has proper prefix
        model_name = model if model.startswith("models/") else f"models/{model}"
        
        content_parts = [{
            "role": "user",
            "parts": [{"text": prompt}]
        }]
        
        generation_config = get_gemini_generation_config(temperature=0.8)
        
        response = client.models.generate_content(
            model=model_name,
            contents=content_parts,
            config=generation_config
        )
        
        logger.info(f"Received response from {model}")
        parsed_response = parse_gemini_response(response)
        
        if parsed_response.get("image"):
            return {"image": parsed_response["image"]}
        else:
            error_msg = parsed_response.get("error", "Image generation failed")
            logger.error(f"Gemini image generation failed: {error_msg}")
            return {"error": error_msg}
            
    except Exception as e:
        logger.error(f"Error during Gemini image generation: {e}")
        error_msg = str(e)
        if "API_KEY_INVALID" in error_msg:
            return {"error": "Invalid Google API Key"}
        if "Quota exceeded" in error_msg:
            return {"error": "Google API Quota Exceeded"}
        return {"error": f"Gemini generation failed: {e}"}
