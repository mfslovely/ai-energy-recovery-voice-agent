# Auralis — Energy dropout recovery

A hackathon-ready prototype for CIMET/econnex: a voice-first recovery agent that resumes an abandoned Energy comparison journey and hands off safely when the caller is frustrated, requests a person, raises a sensitive topic, or asks not to be called.

## Run the front end

```powershell
python -m http.server 4173
```

Then open `http://localhost:4173`.

## Run the backend

```powershell
pip install -r requirements.txt
uvicorn backend.app:app --reload --port 8000
```

The API supports lead retrieval, conversation analysis, handoff creation, and sandbox journey submission. Optional Ollama integration uses `qwen3:8b`.
