# Lily — Voice Health Assistant

A small, locally run, voice-first health information assistant with an original fan-made duck persona.

## What it does

- Greets the user as Lily.
- Uses browser speech recognition for click-to-talk input.
- Sends the recognized question to Gemini through a Node/Express backend.
- Enables Gemini Google Search grounding for current web information.
- Speaks the answer using the voices available on the user's device.
- Shows source links, a compact transcript, and a transcript download.
- Can request approximate browser location or accept a manually entered city/region.
- Supports ending and resetting a conversation.

## Important safety boundary

Lily provides general educational health information and help finding healthcare services. It is not a diagnostic tool, clinician, emergency service, or treatment recommender. It must not diagnose, prescribe, or advise a user to start/stop treatment. For possible emergency symptoms, contact the local emergency number or nearest emergency department. Do not enter identifying or sensitive patient information.

This is a prototype and has not been clinically validated, security-audited, or approved as a medical device. Provider listings and credentials should be independently verified.

## Assumptions

The source brief left several setup fields blank. Defaults used:

- Experience: beginner.
- OS instructions: Windows 10/11 with PowerShell.
- Language: English (US) initially; English India, English UK, Hindi, Spanish and French are selectable.
- Recording: click-to-record; tap the microphone again to submit.
- Audience: general adults seeking health information.
- Location: optional; user must grant browser permission or type a city.
- Tools: Node.js and VS Code assumed available or installable.
- Accounts: Google AI Studio API key required for AI answers.

## Architecture

```text
Browser microphone
      |
      v
Web Speech API (speech recognition)
      |
      v
POST /api/ask (recognized text + optional approximate location)
      |
      v
Node.js + Express backend
      |
      v
Gemini API + Google Search grounding
      |
      v
Answer + source URLs
      |
      +----> transcript and source links in browser
      |
      +----> Web Speech API speech synthesis
```

Input = spoken question and optional location.
Process = recognition, validation, grounded AI response.
Output = spoken answer, sources and downloadable transcript.

## Requirements and dependencies

- Node.js 22 or newer (an active LTS release is recommended).
- npm (included with Node.js).
- A modern browser. Chrome or Edge are recommended for speech recognition testing.
- Microphone permission.
- Optional location permission.
- Gemini API key from Google AI Studio.
- Internet access for Gemini and Google Search grounding.

Required npm packages:
- `express` 5.1.0 — local HTTP server and API route.
- `dotenv` 17.2.3 — loads the server-only `.env` file.
- `helmet` 8.1.0 — sets baseline HTTP security headers.

No separate speech SDK, database, frontend framework, Socket.IO, or build tool is required. Browser speech recognition and synthesis are native browser features. Recognition availability and voice quality vary by browser and operating system.

## Pricing and privacy notes (checked 17 November 2026)

Gemini pricing and model availability can change. Check the official pages before use:

- Gemini pricing: https://ai.google.dev/gemini-api/docs/pricing
- Gemini models: https://ai.google.dev/gemini-api/docs/models
- Google Search grounding: https://ai.google.dev/gemini-api/docs/google-search
- API keys: https://ai.google.dev/gemini-api/docs/api-key
- Billing: https://ai.google.dev/gemini-api/docs/billing

The configured default is `gemini-2.5-flash`. Google's current model documentation notes that access to Gemini 2.5 models is limited to users who have actively used them; if the model is not available to your account, change `GEMINI_MODEL` in `.env` to a currently available model in AI Studio that supports Google Search grounding.

The current pricing page lists Gemini 2.5 Flash text input/output as free on its free tier and Google Search grounding up to 500 requests per day on the free tier (shared with Flash-Lite). Rate limits and eligibility are account/model dependent. Free-tier content may be used by Google to improve products. Do not send protected health information, identifiable patient data, or confidential records. A free tier is not a service-level guarantee. Paid usage requires billing setup; Google's billing guidance says a payment method is required and a minimum $5 prepayment may apply for some paid accounts. Verify your own AI Studio account before enabling billing.

The app does not include an automatic spend cap. Keep an eye on usage in AI Studio. No payment method is required merely to use a key on an eligible free-tier project; paid-tier setup is separate and may require payment details.

Browser speech recognition may use a remote recognition service depending on the browser. The recognized text is sent to your local server, then to Gemini for the answer. The optional approximate location is rounded to two decimal places before it is sent with a question. The transcript remains in page memory until reset/close; downloading creates a local text file.

Browser-native synthesis is free to use, but the app cannot guarantee a duck-like voice. It selects an available device voice for the selected language and adjusts pitch/rate. Install additional system voices if you want more choice. It does not clone or imitate a known character or actor.

## Folder structure

```text
lily-voice-health-assistant/
├── .env.example
├── .gitignore
├── package.json
├── server.js
├── README.md
└── public/
    ├── index.html
    ├── styles.css
    ├── app.js
    └── assets/
        └── lily-duck.png
```

## Windows setup (PowerShell)

1. Install Node.js 22 or newer from https://nodejs.org/en/download/ . Choose an LTS release.
2. Extract the ZIP to a folder you can edit, for example `C:\Projects\lily-voice-health-assistant`.
3. Open that folder in VS Code.
4. In VS Code, choose **Terminal → New Terminal**. Confirm PowerShell is selected.
5. Run:

   ```powershell
   node --version
   npm --version
   npm install
   ```

6. Create a Gemini key:
   - Open https://aistudio.google.com/apikey
   - Sign in and create/select a Google AI Studio project.
   - Create an API key.
   - Review the free/paid tier and data-use terms for your account.
7. Copy the example environment file:

   ```powershell
   Copy-Item .env.example .env
   notepad .env
   ```

8. Paste your key after `GEMINI_API_KEY=` and save. Keep `.env` private. Never paste the key into `public/app.js`, HTML, screenshots, or a public repository.
9. Start Lily:

   ```powershell
   npm start
   ```

10. Open **http://localhost:3000** in Chrome or Edge. `localhost` is treated as a secure context for microphone/location permission by modern browsers.

To stop the server, focus the terminal and press `Ctrl+C`.

## First conversation test

1. Confirm the terminal says `Lily is ready at http://localhost:3000`.
2. Open the local URL and click **Start with Lily**. The greeting should play.
3. Click **Use my location** only if you want to share approximate location; otherwise enter a city/region.
4. Click the round microphone button and allow microphone access.
5. Ask a low-risk test question, such as: "What is asthma, in simple terms?"
6. Tap the microphone again to stop and submit the recording.
7. Wait for Lily's answer. It should appear in the notes and play aloud.
8. Open any source links shown beneath Lily's answer.
9. Ask a follow-up, such as: "What kind of specialist usually treats asthma?"
10. Click **Download transcript** to save the session.
11. Click **End conversation** to stop speech/listening, or **Reset** to clear the session.

## API endpoints

- `GET /api/health` — local status and whether the API key is configured.
- `POST /api/ask` — accepts JSON `{ "question": "...", "location": "optional city/region" }`; returns `{ "answer": "...", "sources": [...] }`.

The backend rejects empty/oversized questions and locations, limits request size, applies a simple in-memory rate limit, uses a 35-second upstream timeout, and keeps the API key on the server.

## Troubleshooting

**Lily says the API key is missing**
- Ensure `.env` is in the project root, beside `server.js`.
- Ensure the line is `GEMINI_API_KEY=your_key` with no quotes required.
- Restart `npm start` after changing `.env`.

**Invalid key / permission / model not found**
- Check the key in AI Studio and the project's Gemini API access.
- Confirm the model name is currently available to your account.
- If the default `gemini-2.5-flash` is unavailable, set `GEMINI_MODEL` to a currently available model that supports Google Search grounding.
- Do not share the key in a support request.

**Quota or 429 errors**
- Wait for the quota window to reset and check AI Studio usage/rate limits.
- Check whether your selected model and Google Search grounding are enabled for your tier.
- Do not assume a free tier provides unlimited or guaranteed availability.

**Microphone permission denied**
- Click the lock/tune icon beside the local browser address and allow Microphone.
- Refresh the page.
- Close other apps/tabs that may be using the microphone.
- Test with current Chrome or Edge.

**Speech recognition unsupported**
- Try the latest Chrome or Edge desktop browser.
- Browser speech recognition is not Baseline across major browsers. This prototype does not upload raw audio to its own backend or provide a server-side transcription fallback.

**No voice or an unsuitable voice**
- Check device volume and browser sound settings.
- Install/select another system voice for the chosen language.
- Voice names and quality are device-dependent; a cartoon-duck voice is not guaranteed.

**Location denied**
- Enter a city/region in the location field. Location is optional.

**Network error**
- Confirm internet access and that the Gemini API is available.
- Check the terminal for server errors.
- Retry with a shorter question.

**Port 3000 already in use**
- Change `PORT=3001` in `.env`, restart, and open `http://localhost:3001`.

**PowerShell says scripts are disabled**
- `npm` normally invokes its command shim. If PowerShell blocks `npm.ps1`, use Command Prompt in VS Code, or run `npm.cmd install` and `npm.cmd start`.

## Changing the persona, language, or AI model

- Persona and medical guardrails: edit `systemInstruction` in `server.js`.
- Default voice language: change the selected option in `public/index.html`.
- Available voices: Lily selects a matching installed browser voice in `public/app.js`.
- Model: change `GEMINI_MODEL` in `.env` to a supported model with Google Search grounding.
- Colours and layout: edit CSS variables near the top of `public/styles.css`.

## Known limitations

- This is a single-user local prototype, not a production service.
- No accounts, database, server-side transcript storage, or deployment.
- Speech recognition may depend on browser-vendor cloud services and may not work offline.
- Browser TTS does not provide a guaranteed original duck voice.
- AI and web search can be wrong, incomplete, delayed, or unavailable. Verify important medical information with qualified professionals and official provider sources.
- It is not clinically validated and must not be used to make medical decisions.
