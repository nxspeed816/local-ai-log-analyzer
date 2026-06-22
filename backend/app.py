import json
import re
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
#import
app = Flask(__name__)
CORS(app)

LLAMA_URL = "http://localhost:8080/v1/chat/completions"
MODEL = "gemma-4-e4b"

SYSTEM = """You are a SIEM analyzer. Output ONLY raw valid JSON. No thinking, no explanations, no markdown. JSON: {"threat_detected":boolean,"severity":"High"|"Medium"|"Low","threat_type":string|null,"affected_ip":string|null,"timestamp":string|null,"mitigation":string,"confidence":"High"|"Medium"|"Low"}"""

BATCH_SYSTEM = """You are a SIEM analyzer. Ingest the provided log entries and return ONLY a raw valid JSON ARRAY containing analysis objects for each distinct threat pattern noticed. No thinking, no explanations, no markdown. JSON Array Format: [{"threat_detected":boolean,"severity":"High"|"Medium"|"Low","threat_type":string|null,"affected_ip":string|null,"timestamp":string|null,"mitigation":string,"confidence":"High"|"Medium"|"Low"}]"""

def get_json(text):
    text = text.strip()
    if text.startswith("```"):
        text = text.split("```")[1].replace("json", "").strip()
    
    match = re.search(r'(\[[\s\S]*\]|\{[\s\S]*\})', text)
    if not match:
        raise json.JSONDecodeError("No valid JSON structure found in text", text, 0)
        
    return json.loads(match.group(0))

@app.route('/api/analyze', methods=['POST'])
def analyze():
    log = request.json.get('log', '')
    if not log:
        return jsonify({"error": "No log provided"}), 400
    
    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": f"Log: {log}\nJSON:"}
        ],
        "temperature": 0.0,
        "max_tokens": 512
    }
    
    r = requests.post(LLAMA_URL, json=payload, timeout=30)
    r.raise_for_status()
    
    content = r.json()["choices"][0]["message"]["content"]
    
    try:
        result = get_json(content)
        return jsonify(result)
    except Exception:
        return jsonify({
            "threat_detected": False,
            "severity": "Low",
            "threat_type": "Log Parsing Failure",
            "affected_ip": None,
            "timestamp": None,
            "mitigation": "Failed parsing local token string context.",
            "confidence": "Low"
        })

@app.route('/api/upload', methods=['POST'])
def upload():
    if 'file' not in request.files:
        return jsonify({"error": "No file"}), 400
    
    file = request.files['file']
    content = file.read().decode('utf-8', errors='ignore')
    lines = [l.strip() for l in content.split('\n') if l.strip()]
    
    target_lines = lines[:20]
    batch_size = 10
    results = []
    
    for i in range(0, len(target_lines), batch_size):
        chunk = '\n'.join(target_lines[i:i+batch_size])
        
        payload = {
            "model": MODEL,
            "messages": [
                {"role": "system", "content": BATCH_SYSTEM},
                {"role": "user", "content": f"Logs:\n{chunk}\nJSON Array:"}
            ],
            "temperature": 0.0,
            "max_tokens": 1024
        }
        
        r = requests.post(LLAMA_URL, json=payload, timeout=45)
        r.raise_for_status()
        
        content_raw = r.json()["choices"][0]["message"]["content"]
        
        try:
            chunk_analysis = get_json(content_raw)
            if isinstance(chunk_analysis, list):
                results.extend(chunk_analysis)
            else:
                results.append(chunk_analysis)
        except Exception:
            results.append({
                "threat_detected": False,
                "severity": "Low",
                "threat_type": "Batch Parse Error",
                "mitigation": "Failed parsing this chunk.",
                "confidence": "Low"
            })
            
    return jsonify({"count": len(results), "results": results})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)