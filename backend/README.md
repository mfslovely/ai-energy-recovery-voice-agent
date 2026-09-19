# Auralis Recovery API

## Run locally

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

Open `http://localhost:8000/docs` for the API explorer.

Optional local LLM:

```powershell
ollama pull qwen3:8b
```

The UI can call `/api/llm/chat`, but deterministic safety rules remain the authority for DNC, sensitive topics, explicit human requests, and frustration escalation.

## Open-source voice models

Install speech-to-text with `pip install faster-whisper`. The first transcription downloads `small.en`; use `WHISPER_MODEL=base.en` for a faster laptop demo or `medium.en` for higher accuracy.

Install Piper separately and put the `piper` executable on PATH. The default voice is `en_US-lessac-medium`; override it with `PIPER_BIN` and `PIPER_VOICE`.

Voice endpoints: `POST /api/speech/transcribe` (multipart audio) and `POST /api/speech/synthesize` (JSON `{ "text": "..." }`).

`workflow.py` contains the explicit LangGraph safety router. It makes the routing auditable: every turn becomes either `continue_script` or `handoff`, with a recorded reason.

## Real phone option

Set a Twilio phone number's voice webhook to `POST https://YOUR_HOST/api/telephony/incoming`. The turn endpoint accepts Twilio speech recognition, continues the Energy script, and transfers escalation to `HANDOFF_NUMBER`.
