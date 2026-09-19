from datetime import datetime, timezone
from pathlib import Path
import json, re, os, tempfile, subprocess
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from fastapi.responses import Response

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
DATA_DIR.mkdir(exist_ok=True)
CONVERSATIONS_FILE = DATA_DIR / "conversations.json"
try:
    CONVERSATIONS = json.loads(CONVERSATIONS_FILE.read_text(encoding="utf-8")) if CONVERSATIONS_FILE.exists() else {}
except Exception:
    CONVERSATIONS = {}
app = FastAPI(title="Auralis Recovery API", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

LEADS = [
    {"id":"EN-48219","name":"Priya Nair","email":"priya.test@example.com","phone":"+61 400 000 219","last_completed":"Postcode","postcode":"3020","move_in_date":None,"status":"ready"},
    {"id":"EN-48207","name":"Jordan Wu","email":"jordan.test@example.com","phone":"+61 400 000 207","last_completed":"Usage estimate","postcode":"3056","move_in_date":"2026-10-18","status":"ready"},
    {"id":"EN-48188","name":"Mia Thompson","email":"mia.test@example.com","phone":"+61 400 000 188","last_completed":"Retailer","postcode":"2065","move_in_date":"2026-10-02","status":"review"},
]
def persist_conversations():
    CONVERSATIONS_FILE.write_text(json.dumps(CONVERSATIONS, indent=2, ensure_ascii=False), encoding="utf-8")

class Turn(BaseModel):
    lead_id: str
    text: str = Field(min_length=1, max_length=2000)

class SubmitJourney(BaseModel):
    lead_id: str
    postcode: str
    move_in_date: str
    consent: bool

def safety(text: str):
    t = text.lower()
    dnc = any(x in t for x in ["stop calling", "don't call", "dont call", "do not call", "do not contact", "not interested", "call me again"])
    human = any(x in t for x in ["human", "person", "agent", "someone real"])
    sensitive = any(x in t for x in ["card number", "payment", "complaint", "financial advice"])
    anger = any(x in t for x in ["already told", "done with this", "ridiculous", "angry", "damn", "three of you"])
    return {"escalate": dnc or human or sensitive or anger, "dnc": dnc, "reason": "DNC request" if dnc else "Customer requested a human" if human else "Sensitive topic" if sensitive else "Frustration detected" if anger else None}

def extract_postcode(text: str):
    digits = {"zero":"0","oh":"0","one":"1","two":"2","three":"3","four":"4","five":"5","six":"6","seven":"7","eight":"8","nine":"9"}
    direct = re.search(r"\b(\d{4})\b", text)
    if direct: return direct.group(1)
    tokens = re.findall(r"[a-z]+", text.lower())
    spoken = ''.join(digits[t] for t in tokens if t in digits)
    return spoken[:4] if len(spoken) >= 4 else None

@app.get("/api/health")
def health(): return {"ok": True, "service": "auralis-recovery-api", "time": datetime.now(timezone.utc).isoformat()}

@app.get("/api/leads")
def leads(): return {"leads": LEADS}

@app.get("/api/leads/{lead_id}")
def lead(lead_id: str):
    item = next((x for x in LEADS if x["id"] == lead_id), None)
    if not item: raise HTTPException(404, "Lead not found")
    return {"lead": item}

@app.get("/api/conversations/{lead_id}")
def get_conversation(lead_id: str):
    return {"lead_id": lead_id, "turns": CONVERSATIONS.get(lead_id, [])}

@app.post("/api/conversations/{lead_id}")
def save_conversation(lead_id: str, body: dict):
    turn = {"role": body.get("role", "customer"), "text": body.get("text", ""), "timestamp": datetime.now(timezone.utc).isoformat()}
    CONVERSATIONS.setdefault(lead_id, []).append(turn)
    persist_conversations()
    return {"saved": True, "turn": turn, "count": len(CONVERSATIONS[lead_id])}

@app.post("/api/conversation/analyse")
def analyse(turn: Turn):
    result = safety(turn.text)
    fields = {}
    postcode = extract_postcode(turn.text)
    if postcode: fields["postcode"] = postcode
    return {"lead_id": turn.lead_id, "safety": result, "fields": fields, "confidence": 0.96 if fields else 0.88, "next": "handoff" if result["escalate"] else ("move_in_date" if postcode else "postcode")}

@app.post("/api/handoff")
def handoff(turn: Turn):
    result = safety(turn.text)
    return {"handoff_id": f"HO-{datetime.now().strftime('%H%M%S')}", "status":"ready", "reason":result["reason"] or "Low confidence", "summary": "Customer requested a safe human handoff. Preserve all captured journey data; do not ask them to repeat details.", "context": {"lead_id":turn.lead_id, "captured_fields":{"postcode":"3020"}, "dnc":result["dnc"]}}

@app.post("/api/journey/submit")
def submit(payload: SubmitJourney):
    if not payload.consent: raise HTTPException(400, "Consent is required before submission")
    if not re.fullmatch(r"\d{4}", payload.postcode): raise HTTPException(400, "Postcode must be 4 digits")
    return {"submitted":True, "journey_id":f"JRN-{datetime.now().strftime('%Y%m%d%H%M%S')}", "payload":payload.model_dump(), "message":"Energy journey accepted by sandbox"}

@app.post("/api/llm/chat")
def llm_chat(body: dict):
    """Optional Ollama adapter. Falls back safely when Ollama is not installed."""
    try:
        import requests
        response = requests.post(os.getenv("OLLAMA_URL", "http://localhost:11434/api/chat"), json={"model":os.getenv("OLLAMA_MODEL","qwen3:8b"),"messages":body.get("messages",[]),"stream":False}, timeout=20)
        response.raise_for_status(); return response.json()
    except Exception:
        return {"fallback":True,"message":{"role":"assistant","content":"I can continue with the Energy recovery script, or connect you with a human."}}

@app.post("/api/speech/transcribe")
async def transcribe(audio: UploadFile = File(...)):
    """Transcribe an uploaded call snippet using local faster-whisper."""
    try:
        from faster_whisper import WhisperModel
        suffix = Path(audio.filename or "audio.webm").suffix or ".webm"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(await audio.read()); source = tmp.name
        model = WhisperModel(os.getenv("WHISPER_MODEL", "small.en"), device=os.getenv("WHISPER_DEVICE", "cpu"), compute_type=os.getenv("WHISPER_COMPUTE", "int8"))
        segments, info = model.transcribe(source, vad_filter=True)
        text = " ".join(segment.text.strip() for segment in segments).strip()
        Path(source).unlink(missing_ok=True)
        return {"text": text, "language": info.language, "model": os.getenv("WHISPER_MODEL", "small.en")}
    except ImportError:
        raise HTTPException(503, "Speech-to-text is not installed. Run: pip install faster-whisper")
    except Exception as exc:
        raise HTTPException(422, f"Could not transcribe audio: {exc}")

@app.post("/api/speech/synthesize")
async def synthesize(body: dict):
    """Generate local WAV audio with Piper."""
    text = str(body.get("text", "")).strip()
    if not text: raise HTTPException(400, "text is required")
    output = Path(tempfile.gettempdir()) / f"auralis-{datetime.now().strftime('%Y%m%d%H%M%S%f')}.wav"
    try:
        subprocess.run([os.getenv("PIPER_BIN", "piper"), "--model", os.getenv("PIPER_VOICE", "en_US-lessac-medium"), "--output_file", str(output)], input=text.encode(), check=True, timeout=30)
        return {"audio_path": str(output), "voice": os.getenv("PIPER_VOICE", "en_US-lessac-medium")}
    except FileNotFoundError:
        raise HTTPException(503, "Piper is not installed or is not on PATH")
    except Exception as exc:
        raise HTTPException(422, f"Could not synthesize speech: {exc}")

@app.post("/api/telephony/incoming")
async def incoming_call():
    """Twilio-compatible entrypoint; point a Twilio number webhook here."""
    xml = '<Response><Say voice="alice">Hello. This is an Auralis Energy recovery call. This call is recorded. Please say yes to continue, or say human at any time.</Say><Gather input="speech" action="/api/telephony/turn" method="POST" speechTimeout="auto" /></Response>'
    return Response(content=xml, media_type="application/xml")

@app.post("/api/telephony/turn")
async def phone_turn(SpeechResult: str = ""):
    result = safety(SpeechResult)
    if result["escalate"]:
        reply = "I hear you. I will stop the automated call and connect you with a person. They will have the details collected so far."
        xml = f'<Response><Say voice="alice">{reply}</Say><Dial>{os.getenv("HANDOFF_NUMBER", "+61000000000")}</Dial></Response>'
    else:
        reply = "Thank you. What is the postcode for the property?"
        xml = f'<Response><Say voice="alice">{reply}</Say><Gather input="speech" action="/api/telephony/turn" method="POST" speechTimeout="auto" /></Response>'
    return Response(content=xml, media_type="application/xml")
