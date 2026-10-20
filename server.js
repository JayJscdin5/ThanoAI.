const express = require("express");
const path = require("path");
const dotenv = require("dotenv");
const { GoogleGenerativeAI } = require("@google/generative-ai");

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const apiKey = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
const MAX_OUTPUT_TOKENS = Number(process.env.MAX_OUTPUT_TOKENS) || 192;
const DAILY_LIMIT_PER_IP = Number(process.env.DAILY_LIMIT_PER_IP) || 50;
const DAILY_LIMIT_TOTAL = Number(process.env.DAILY_LIMIT_TOTAL) || 1000;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_HISTORY_MESSAGES = 16;
const MAX_TEXT_LENGTH = 4000;

if (!apiKey) {
  console.error("Missing GEMINI_API_KEY environment variable.");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);
const usageByIp = new Map();
let totalUsage = { day: getUtcDay(), count: 0 };

app.set("trust proxy", 1);
app.use(express.json({ limit: "7mb" }));
app.use(express.static(path.join(__dirname, "public")));

function getClientIp(req) {
  return req.ip || req.socket.remoteAddress || "unknown";
}

function getUtcDay() {
  return new Date().toISOString().slice(0, 10);
}

function reserveDailyRequest(ip) {
  const day = getUtcDay();
  if (totalUsage.day !== day) totalUsage = { day, count: 0 };

  let entry = usageByIp.get(ip);
  if (!entry || entry.day !== day) {
    entry = { day, count: 0 };
    usageByIp.set(ip, entry);
  }
  if (entry.count >= DAILY_LIMIT_PER_IP) return "ip";
  if (totalUsage.count >= DAILY_LIMIT_TOTAL) return "total";

  entry.count += 1;
  totalUsage.count += 1;
  return null;
}

function normalizeHistory(history, currentImage) {
  const messages = Array.isArray(history) ? history.slice(-MAX_HISTORY_MESSAGES) : [];
  const contents = messages
    .filter((message) => message && (message.role === "user" || message.role === "ai" || message.role === "model"))
    .map((message) => ({
      role: message.role === "user" ? "user" : "model",
      parts: [{ text: String(message.text || "").slice(0, MAX_TEXT_LENGTH) }]
    }));

  if (currentImage) {
    const match = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(currentImage);
    if (!match) throw new Error("Unsupported image format.");
    const estimatedBytes = Math.floor(match[2].length * 0.75);
    if (estimatedBytes > MAX_IMAGE_BYTES) throw new Error("Image is too large. Please use an image under 5 MB.");
    const last = contents[contents.length - 1];
    if (last && last.role === "user") {
      last.parts.push({ inlineData: { data: match[2], mimeType: match[1] } });
    } else {
      contents.push({ role: "user", parts: [{ inlineData: { data: match[2], mimeType: match[1] } }] });
    }
  }

  return contents;
}

app.post("/api/chat", async (req, res) => {
  const ip = getClientIp(req);
  const quota = reserveDailyRequest(ip);
  if (quota) {
    const reply = quota === "total"
      ? "ThanoAI has reached its daily message limit. Please try again tomorrow."
      : "Daily message limit reached for this connection. Please try again tomorrow.";
    return res.status(429).json({ reply });
  }

  try {
    const userText = String(req.body?.userText || "").slice(0, MAX_TEXT_LENGTH);
    const currentImage = req.body?.currentImage || null;
    const contents = normalizeHistory(req.body?.history, currentImage);
    if (!userText && !currentImage) {
      return res.status(400).json({ reply: "Type a message or attach an image first." });
    }
    if (contents.length === 0) {
      contents.push({ role: "user", parts: [{ text: userText }] });
    }

    const model = genAI.getGenerativeModel({
      model: MODEL,
      systemInstruction: `You are ThanoAI, a helpful chat assistant. Reply in a warm, casual, clear voice without forcing slang. Keep the default answer short: usually 2–4 short sentences and under about 80 words. Use everyday words and short paragraphs. If steps or several ideas are needed, use a small, indented bullet or numbered list. Use Markdown sparingly for bold key terms; never include raw formatting tests, separator clutter, or questions about whether formatting displayed correctly. Answer the user's actual request directly and avoid unrelated summaries or meta commentary. Give more detail when the user asks for it.`,
    });
    const result = await model.generateContent({
      contents,
      generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS }
    });
    return res.json({ reply: result.response.text() });
  } catch (error) {
    console.error("Gemini request failed:", error.message);
    const message = error.message === "Unsupported image format." || error.message.startsWith("Image is too large")
      ? error.message
      : "Sorry, I couldn't get a reply just now. Please try again.";
    return res.status(500).json({ reply: message });
  }
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "ThanoAI.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`ThanoAI is running on port ${PORT}`);
});





