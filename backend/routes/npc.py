from flask import request, jsonify
import litellm

def generate_npc_dialogue():
    """Generate dynamic NPC dialogue using LLM"""
    data = request.json
    npc_data = data.get('npc_data', {})
    player_message = data.get('player_message', '')
    context = data.get('context', {})
    
    system_prompt = f"""You are {npc_data.get('name', 'NPC')}, a {npc_data.get('role', 'character')} in a {context.get('game_setting', 'game world')}.

Personality: {npc_data.get('personality', 'neutral')}
Background: You're a survivor in this hostile environment, offering goods and information to those who can pay.

Speak in character. Keep responses under 40 words. Be concise, atmospheric, and engaging.
Use the personality to color your speech. No asterisks for actions."""

    messages = [
        {"role": "system", "content": system_prompt}
    ]
    
    # Add conversation history
    for msg in context.get('conversation_history', [])[-4:]:  # Last 4 exchanges
        messages.append(msg)
    
    # Add current message
    messages.append({"role": "user", "content": player_message})
    
    try:
        response = litellm.completion(
            model="cerebras/llama-3.3-70b",
            messages=messages,
            max_tokens=100,
            temperature=0.9
        )
        
        dialogue = response.choices[0].message.content.strip()
        
        return jsonify({
            "dialogue": dialogue,
            "emotion": "neutral",
            "animation": "talk"
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500