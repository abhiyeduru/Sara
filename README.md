# SARA AI — Autonomous Voice Workforce OS (v2.0)

Production-grade, multi-tenant AI Voice Workforce platform with real-time Telugu, English & Hindi voice intelligence, Exotel (+91 India) telephony, Twilio global telephony, streaming speech pipelines, and autonomous CRM automation.

---

## 🚀 Key Highlights & Architecture

1. **Multilingual Voice Engine ("IN TELUGU MAIN")**:
   - **Primary Spoken Language**: Sweet, respectful native Telugu (addressing callers with *'అండీ'*).
   - **Pronunciation Normalization**: Automatic English numeral pronunciation for natural TTS acoustics (e.g. *85 Lakhs*, *2 BHK*, *2 PM*).
   - **Code-Switching**: Fluent handling of mixed Telugu-English and Romanized Telugu (e.g., *"Nuvvu Telugulo matladu"*, *"Sunday 2 PM ki site visit arrange chey"*).
   - **Zero Hallucination Guardrails**: Strictly bounded to verified business knowledge and pricing.

2. **Telephony & Calling Providers**:
   - **Exotel (+91 India)**:
     - Dedicated Indian mobile number normalization (`validate_indian_phone_number`).
     - REST API Outbound Connect: `POST /v1/Accounts/{AccountSid}/Calls/connect.json`.
     - Status Webhook receiver: `POST /api/webhooks/exotel/status`.
     - Passthru Applet receiver: `POST /api/webhooks/exotel/passthru`.
     - Safe Simulation Mode for cost-free localhost testing.
   - **Twilio**: Global inbound/outbound telephony and bi-directional media streams.

3. **Multi-Model AI Providers**:
   - **LLM**: Groq ultra-low latency `qwen/qwen3.8-27b` (~120ms TTFT) with streaming token delivery, OpenAI fallback, and Ollama local integration (`qwen2.5:7b`).
   - **STT**: Unified STT combining Sarvam `saarika:v2.5`, Deepgram `nova-2`, and Groq Whisper.
   - **TTS**: Sarvam AI `bulbul:v3` with 10+ native Telugu voices (Pooja, Roopa, Priya, Kavitha, etc.), Cartesia Sonic-2, and Edge Neural TTS fallback.

---

## 🛠️ Local Mac Setup & Run Instructions

### Prerequisites
- macOS (Apple Silicon M1/M2/M3 or Intel)
- Python 3.10+ (Recommended: Python 3.11 or 3.12)
- Node.js 18+ & npm
- (Optional) Ollama installed if running Qwen locally (`ollama run qwen2.5:7b`)

### 1. Environment Configuration
Verify that `.env` exists in the project root:
```bash
cp .env.example .env  # Or update .env directly
```
Key variables already configured:
- `GROQ_API_KEY`: Groq ultra-fast LLM API key
- `GROQ_MODEL`: `qwen/qwen3.8-27b`
- `SARVAM_API_KEY`: Sarvam AI Indian speech API key
- `DEEPGRAM_API_KEY`: Deepgram Nova-2 STT API key
- `EXOTEL_API_KEY` & `EXOTEL_API_TOKEN`: Exotel Indian telephony credentials
- `EXOTEL_ACCOUNT_SID`: `sara`
- `DATABASE_URL`: `sqlite:///sara.db`

### 2. Run Database Seeding
```bash
python3 -m server.seed_workforce
python3 -m server.seed_crm
```

### 3. Start Backend & Frontend

#### Method A: Unified Runner
```bash
node start.js
```
Runs:
- FastAPI Backend on `http://localhost:8000` (API Docs at `http://localhost:8000/docs`)
- Vite React SPA on `http://localhost:5174`

#### Method B: Separate Terminals
**Terminal 1 (Backend):**
```bash
python3 -m uvicorn server.main:app --host 0.0.0.0 --port 8000 --reload
```

**Terminal 2 (Frontend):**
```bash
cd client
npm run dev -- --port 5174
```

---

## 🌐 Exposing Localhost for Live Exotel Webhooks

To receive status callbacks and connect live Exotel calls to your Mac:

```bash
# Using ngrok
ngrok http 8000
```
Copy your public forwarding URL (e.g. `https://xyz.ngrok-free.app`) and configure it in Exotel Dashboard or `.env`:
- Status Callback URL: `https://xyz.ngrok-free.app/api/webhooks/exotel/status`
- Passthru Applet URL: `https://xyz.ngrok-free.app/api/webhooks/exotel/passthru`

---

## 🧪 Automated Test Suites

Run any of the automated test suites to verify functionality:

1. **Exotel Telephony & Telugu Voice Test**:
   ```bash
   python3 test_exotel_telephony.py
   ```
   *Verifies Indian number validation, Exotel client, status callbacks, Telugu dialogue, and Sarvam TTS synthesis.*

2. **Multilingual Voice & Code-Switching Test**:
   ```bash
   python3 test_multilingual_voice.py
   ```
   *Tests Telugu, English, Hindi, and Telugu-English code-switching conversation turns.*

3. **End-to-End WebSocket Voice Test**:
   ```bash
   python3 test_e2e.py
   ```
   *Tests real-time WebSocket session, TTFT latency, TTS audio chunks, barge-in interruption, and CRM logging.*

4. **Zero-Hallucination & Business Agents Test**:
   ```bash
   python3 test_business_agents_and_hallucination.py
   ```

5. **Admin Governance & Minutes Sync Test**:
   ```bash
   python3 test_admin_and_minutes_sync.py
   ```

---

## 📱 Placing a Test Call

1. Open the UI at `http://localhost:5174`.
2. Go to **Phone Numbers** or **Voice Calls** in the sidebar.
3. Click **Test Outbound AI Call**.
4. Select Telephony Gateway:
   - **Exotel (India +91 Calling)** for Indian mobile numbers.
   - Toggle **Safe Simulation Mode** if you want to test the workflow without carrier deduction.
5. Enter the target Indian number (e.g., `+91 98490 12345` or 10 digits).
6. Click **Dial Now**.
