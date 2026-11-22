const $ = (id) => document.getElementById(id);

const duck = $("duck");
const mood = $("mood");
const statusEl = $("status");
const micBtn = $("micBtn");
const startBtn = $("startBtn");
const endBtn = $("endBtn");
const resetBtn = $("resetBtn");
const downloadBtn = $("downloadBtn");
const conversation = $("conversation");
const micHint = $("micHint");
const language = $("language");
const voiceLabel = $("voiceLabel");
const locationBtn = $("locationBtn");
const locationStatus = $("locationStatus");
const manualLocation = $("manualLocation");

const moods = ["Oh, hello!", "Quack-tastic!", "Hmm?", "You rang?", "Let's do this!", "Well, well!"];
let messages = [];
let recognition = null;
let recording = false;
let shouldSubmit = false;
let active = false;
let approximateLocation = "";
let voices = [];

function setStatus(text) {
  statusEl.textContent = text;
}

function setMood(text) {
  mood.textContent = text;
}

function randomMood() {
  setMood(moods[Math.floor(Math.random() * moods.length)]);
}
duck.addEventListener("mouseenter", randomMood);
duck.addEventListener("click", randomMood);
duck.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") randomMood();
});

function addMessage(role, text, sources = []) {
  messages.push({ role, text, sources, time: new Date().toISOString() });
  renderMessages();
}
function renderMessages() {
  conversation.replaceChildren();
  if (!messages.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    const icon = document.createElement("span");
    icon.className = "empty-icon";
    icon.textContent = "✦";
    const p = document.createElement("p");
    p.textContent = "Your conversation will appear here after you speak.";
    empty.append(icon, p);
    conversation.append(empty);
    downloadBtn.disabled = true;
    return;
  }
  for (const item of messages) {
    const card = document.createElement("article");
    card.className = `message ${item.role}`;
    const label = document.createElement("span");
    label.className = "message-label";
    label.textContent = item.role === "user" ? "You said" : "Lily";
    const body = document.createElement("p");
    body.textContent = item.text;
    card.append(label, body);
    if (item.sources?.length) {
      const sourceWrap = document.createElement("div");
      sourceWrap.className = "sources";
      for (const source of item.sources) {
        const link = document.createElement("a");
        link.href = source.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = source.title || "Open source";
        sourceWrap.append(link);
      }
      card.append(sourceWrap);
    }
    conversation.append(card);
  }
  downloadBtn.disabled = false;
  conversation.scrollTop = conversation.scrollHeight;
}

function getRecognitionConstructor() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function loadVoices() {
  if (!("speechSynthesis" in window)) {
    voiceLabel.textContent = "Speech unavailable";
    return;
  }
  voices = window.speechSynthesis.getVoices();
  const langPrefix = language.value.split("-")[0].toLowerCase();
  const preferred = voices.find((voice) => voice.lang.toLowerCase() === language.value.toLowerCase())
    || voices.find((voice) => voice.lang.toLowerCase().startsWith(langPrefix));
  voiceLabel.textContent = preferred ? `Voice: ${preferred.name}` : "Device default voice";
}
if ("speechSynthesis" in window) {
  loadVoices();
  window.speechSynthesis.addEventListener?.("voiceschanged", loadVoices);
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

function speak(text) {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window)) {
      resolve();
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language.value;
    const langPrefix = language.value.split("-")[0].toLowerCase();
    const selectedVoice = voices.find((voice) => voice.lang.toLowerCase() === language.value.toLowerCase())
      || voices.find((voice) => voice.lang.toLowerCase().startsWith(langPrefix));
    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.pitch = 1.28;
    utterance.rate = 1.04;
    utterance.volume = 1;
    utterance.onend = resolve;
    utterance.onerror = resolve;
    window.speechSynthesis.speak(utterance);
  });
}

function makeRecognition() {
  const Recognition = getRecognitionConstructor();
  if (!Recognition) return null;
  const instance = new Recognition();
  instance.lang = language.value;
  instance.continuous = false;
  instance.interimResults = true;
  instance.maxAlternatives = 1;

  let finalText = "";
  instance.onstart = () => {
    recording = true;
    shouldSubmit = false;
    micBtn.classList.add("recording");
    micBtn.setAttribute("aria-label", "Stop recording");
    micHint.textContent = "Listening… tap again when you're done";
    setStatus("I'm listening. Go on, I'm all ears!");
    setMood("Shhh!");
  };
  instance.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const text = event.results[i][0].transcript;
      if (event.results[i].isFinal) finalText += `${text} `;
      else interim += text;
    }
    if (interim) micHint.textContent = `Hearing: ${interim}`;
  };
  instance.onerror = (event) => {
    recording = false;
    micBtn.classList.remove("recording");
    micBtn.setAttribute("aria-label", "Start recording");
    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      setStatus("Microphone permission was blocked. Allow it in your browser's site settings, then try again.");
    } else if (event.error === "no-speech") {
      setStatus("I didn't hear anything. Try again a little closer to the microphone.");
    } else {
      setStatus(`Speech recognition error: ${event.error}. Try Chrome or Edge on a secure localhost page.`);
    }
  };
  instance.onend = () => {
    recording = false;
    micBtn.classList.remove("recording");
    micBtn.setAttribute("aria-label", "Start recording");
    micHint.textContent = "Tap the microphone to speak";
    const question = finalText.trim();
    if (shouldSubmit && question) {
      shouldSubmit = false;
      askLily(question);
    } else if (shouldSubmit && !question) {
      shouldSubmit = false;
      setStatus("I didn't catch that. Try once more, nice and clearly.");
    }
  };
  return instance;
}

async function startRecording() {
  if (!active) {
    setStatus("Tap “Start with Lily” first. I promise not to bite. Much.");
    return;
  }
  if (!getRecognitionConstructor()) {
    setStatus("This browser doesn't support speech recognition. Try the latest Chrome or Edge browser.");
    return;
  }
  if (recording && recognition) {
    shouldSubmit = true;
    recognition.stop();
    return;
  }
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  recognition = makeRecognition();
  try {
    recognition.start();
  } catch (error) {
    setStatus("The microphone is busy. Wait a moment and try again.");
  }
}

async function askLily(question) {
  addMessage("user", question);
  setStatus("Thinking… I'm checking reliable information for you.");
  setMood("Thinking!");
  micBtn.disabled = true;
  startBtn.disabled = true;

  const manual = manualLocation.value.trim();
  const location = manual || approximateLocation;
  try {
    const response = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, location })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
    addMessage("lily", data.answer, data.sources || []);
    setStatus("Lily is speaking…");
    setMood("Quack!");
    await speak(data.answer);
    if (active) {
      setStatus("All yours. What would you like to know next?");
      setMood("Your turn!");
    }
  } catch (error) {
    const message = error.message || "Something went wrong.";
    addMessage("lily", `Oh feathers! ${message}`);
    setStatus(message);
    setMood("Oops!");
    await speak(`Oh feathers. ${message}`);
  } finally {
    micBtn.disabled = !active;
    startBtn.disabled = active;
  }
}

startBtn.addEventListener("click", async () => {
  active = true;
  startBtn.disabled = true;
  micBtn.disabled = false;
  endBtn.disabled = false;
  setStatus("Hello! My name is Lily, your voice assistant. How can I help you today?");
  setMood("Hello!");
  await speak("Hello! My name is Lily, your voice assistant. How can I help you today?");
  if (active) setStatus("Tap the microphone and ask me anything about health or finding care.");
});

micBtn.addEventListener("click", startRecording);

endBtn.addEventListener("click", () => {
  active = false;
  shouldSubmit = false;
  if (recognition && recording) {
    try { recognition.abort(); } catch {}
  }
  recording = false;
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  micBtn.classList.remove("recording");
  micBtn.disabled = true;
  micBtn.setAttribute("aria-label", "Start recording");
  startBtn.disabled = false;
  endBtn.disabled = true;
  micHint.textContent = "Conversation ended";
  setStatus("Conversation ended. Your notes are still here until you reset or close this page.");
  setMood("Bye for now!");
});

resetBtn.addEventListener("click", () => {
  active = false;
  shouldSubmit = false;
  if (recognition) {
    try { recognition.abort(); } catch {}
  }
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  recognition = null;
  recording = false;
  messages = [];
  renderMessages();
  micBtn.classList.remove("recording");
  micBtn.disabled = true;
  startBtn.disabled = false;
  endBtn.disabled = true;
  micHint.textContent = "Tap the microphone to speak";
  setStatus("Your voice assistant. How can I help you today?");
  setMood("Hey!");
});

locationBtn.addEventListener("click", () => {
  if (!navigator.geolocation) {
    locationStatus.textContent = "Location isn't supported here. Enter a city instead.";
    return;
  }
  locationStatus.textContent = "Waiting for your permission…";
  navigator.geolocation.getCurrentPosition(
    (position) => {
      // Round to roughly neighbourhood/city-level precision before sending to the AI provider.
      const lat = position.coords.latitude.toFixed(2);
      const lon = position.coords.longitude.toFixed(2);
      approximateLocation = `Approximate coordinates ${lat}, ${lon}`;
      locationStatus.textContent = "Approximate location ready. It will only be shared with your question.";
    },
    (error) => {
      approximateLocation = "";
      locationStatus.textContent = error.code === 1
        ? "Permission denied. You can type a city instead."
        : "Couldn't get location. You can type a city instead.";
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
  );
});

language.addEventListener("change", () => {
  loadVoices();
  setStatus(`Language set to ${language.options[language.selectedIndex].text}.`);
});

downloadBtn.addEventListener("click", () => {
  if (!messages.length) return;
  const lines = [
    "Lily — Voice Health Assistant transcript",
    `Downloaded: ${new Date().toLocaleString()}`,
    "Note: General information only; not a diagnosis or medical advice.",
    ""
  ];
  for (const item of messages) {
    lines.push(`${item.role === "user" ? "YOU" : "LILY"} (${new Date(item.time).toLocaleString()}):`);
    lines.push(item.text);
    if (item.sources?.length) {
      lines.push("Sources:");
      for (const source of item.sources) lines.push(`- ${source.title}: ${source.url}`);
    }
    lines.push("");
  }
  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `lily-transcript-${new Date().toISOString().slice(0, 10)}.txt`;
  anchor.click();
  URL.revokeObjectURL(url);
});

(async function initialize() {
  renderMessages();
  const recognitionAvailable = Boolean(getRecognitionConstructor());
  if (!recognitionAvailable) {
    micHint.textContent = "Speech recognition needs a supported browser (try Chrome or Edge).";
  }
  try {
    const response = await fetch("/api/health");
    const health = await response.json();
    if (!health.configured) {
      setStatus("Welcome! Add your Gemini API key to .env and restart the server to enable Lily's answers.");
    }
  } catch {
    setStatus("Start the local Node server to connect with Lily.");
  }
})();
