import express from "express";
import helmet from "helmet";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = Number(process.env.PORT || 3000);
const API_KEY = process.env.GEMINI_API_KEY?.trim();
const MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";

app.disable("x-powered-by");
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"]
    }
  }
}));
app.use(express.json({ limit: "16kb" }));
app.use(express.static(path.join(__dirname, "public"), {
  extensions: ["html"]
}));

// Small in-memory limiter for this single-user local prototype.
const requestLog = new Map();
function rateLimit(req, res, next) {
  const now = Date.now();
  const key = req.ip || "local";
  const windowMs = 5 * 60 * 1000;
  const maxRequests = 12;
  const recent = (requestLog.get(key) || []).filter((time) => now - time < windowMs);

  if (recent.length >= maxRequests) {
    return res.status(429).json({
      error: "Lily needs a short breather. Please wait a few minutes before asking again."
    });
  }

  recent.push(now);
  requestLog.set(key, recent);

  // Keep the map bounded in a long-running local session.
  if (requestLog.size > 200) {
    const oldestKey = requestLog.keys().next().value;
    requestLog.delete(oldestKey);
  }
  next();
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    configured: Boolean(API_KEY),
    model: MODEL
  });
});

const systemInstruction = `
You are Lily, an original fan-made cartoon duck voice assistant. Your manner is energetic,
playfully impatient, warm, loyal and kind. Use short, lively, plain-language sentences and
light original humor. Never imitate a named cartoon character or voice actor, reproduce
copyrighted catchphrases, or claim official affiliation with any studio. If asked, say:
"I'm Lily, an independent fan-made duck voice assistant inspired by classic cartoon ducks."

Your purpose is to provide general, educational health information and help users find
reputable healthcare services. You are NOT a doctor and must NEVER diagnose a user, claim
that they have a disease, prescribe medicines, recommend a dosage, tell them to start/stop
treatment, or replace a clinician. Explain uncertainty and encourage a qualified healthcare
professional for personal medical decisions. Do not infer a diagnosis from symptoms.

If the user describes possible emergency warning signs (for example severe trouble breathing,
chest pain, signs of stroke, severe bleeding, loss of consciousness, or immediate danger),
tell them to contact their local emergency number or go to the nearest emergency department
now. Do not delay with follow-up questions. Do not assume the user is in the United States.

For doctor, hospital, clinic, or treatment-centre questions, use current Google Search grounding.
Prefer official hospital/provider pages, government health agencies, medical associations,
and recognized health systems. Never invent doctors, addresses, ratings, phone numbers,
availability, or affiliations. Explain that listings and credentials must be independently
verified. Do not present search ranking as proof of clinical quality. If location is missing,
ask for a city/region.

For disease questions, give a concise overview, common symptoms/risk factors where relevant,
and sensible next steps. Distinguish established facts from uncertainty. Do not overstate
screening, prevention, cure, prognosis, or treatment effectiveness.

Privacy: do not ask for full name, date of birth, address, insurance number, medical record
number, or other identifying details. Encourage users not to share sensitive personal health
information. Approximate location may be supplied only when the user grants browser location
permission or types a city.

Answer in the language used by the user when reasonably possible. Keep the spoken answer
around 80-130 words, unless an emergency requires a shorter urgent instruction. Avoid markdown
tables and long lists because the answer will be spoken aloud. End with one useful, non-leading
next-step question when appropriate. Do not mention that you searched unless useful.
`.trim();

app.post("/api/ask", rateLimit, async (req, res) => {
  try {
    if (!API_KEY) {
      return res.status(503).json({
        error: "Lily's AI key is not configured yet. Copy .env.example to .env, add a Gemini API key, and restart the server."
      });
    }

    const question = typeof req.body?.question === "string" ? req.body.question.trim() : "";
    const location = typeof req.body?.location === "string" ? req.body.location.trim() : "";

    if (!question) {
      return res.status(400).json({ error: "I didn't catch a question. Please tap the microphone and try again." });
    }
    if (question.length > 1200) {
      return res.status(400).json({ error: "That question is a little too long. Please keep it under 1,200 characters." });
    }
    if (location.length > 120) {
      return res.status(400).json({ error: "Please keep the location to a city, region, or approximate location." });
    }

    const locationContext = location ? `The user's approximate location context is: ${location}.` : "The user has not provided a location.";
    const prompt = `${locationContext}\n\nUser's spoken question:\n${question}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 35000);

    let upstream;
    try {
      upstream = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": API_KEY
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: systemInstruction }]
            },
            contents: [{
              role: "user",
              parts: [{ text: prompt }]
            }],
            tools: [{ google_search: {} }],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 650
            }
          }),
          signal: controller.signal
        }
      );
    } finally {
      clearTimeout(timeout);
    }

    const payload = await upstream.json().catch(() => ({}));

    if (!upstream.ok) {
      const providerMessage = payload?.error?.message || "The AI service returned an error.";
      if (upstream.status === 400 || upstream.status === 401 || upstream.status === 403) {
        return res.status(502).json({
          error: `Gemini could not accept the request. Check your API key, model access, and Google AI Studio project settings. Details: ${providerMessage}`
        });
      }
      if (upstream.status === 429) {
        return res.status(429).json({
          error: "Lily has reached the service's current usage limit. Please wait and try again, or check your Gemini quota."
        });
      }
      return res.status(502).json({ error: `The AI service is temporarily unavailable. ${providerMessage}` });
    }

    const candidate = payload?.candidates?.[0];
    const answer = candidate?.content?.parts
      ?.map((part) => part.text || "")
      .join("\n")
      .trim();

    if (!answer) {
      return res.status(502).json({
        error: "Lily couldn't form a reliable answer this time. Please try a shorter or clearer question."
      });
    }

    const chunks = candidate?.groundingMetadata?.groundingChunks || [];
    const sources = chunks
      .map((chunk) => chunk.web)
      .filter((web) => web?.uri && /^https?:\/\//i.test(web.uri))
      .map((web) => ({
        title: String(web.title || "Source").slice(0, 180),
        url: web.uri
      }))
      .filter((source, index, list) => list.findIndex((item) => item.url === source.url) === index)
      .slice(0, 6);

    res.json({ answer, sources, model: MODEL });
  } catch (error) {
    if (error?.name === "AbortError") {
      return res.status(504).json({ error: "That took too long. Please try again in a moment." });
    }
    console.error("Ask route error:", error);
    res.status(500).json({ error: "Something unexpected happened. Please restart Lily and try again." });
  }
});

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Lily is ready at http://localhost:${PORT}`);
  console.log(`Gemini model: ${MODEL}`);
  if (!API_KEY) {
    console.warn("GEMINI_API_KEY is missing. The interface will load, but AI answers are disabled until .env is configured.");
  }
});
