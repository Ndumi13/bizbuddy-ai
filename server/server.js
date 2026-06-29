const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

let Groq = null;
try {
  ({ Groq } = require("groq-sdk"));
} catch (error) {
  Groq = null;
}

const app = express();
const PORT = process.env.PORT || 5000;
let groq = null;

function loadEnvFile() {
  const candidates = [
    path.resolve(__dirname, "..", ".env"),
    path.resolve(process.cwd(), ".env")
  ];

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;

    const content = fs.readFileSync(candidate, "utf8").replace(/^\uFEFF/, "");
    const lines = content.split(/\r?\n/);

    for (const line of lines) {
      const trimmed = line.trim().replace(/^\uFEFF/, "");
      if (!trimmed || trimmed.startsWith("#")) continue;

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) continue;

      const key = trimmed.slice(0, separatorIndex).trim();
      let value = trimmed.slice(separatorIndex + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

loadEnvFile();

const apiKey = process.env.GROQ_API_KEY || process.env.GROQ_KEY;
if (apiKey && apiKey.length > 10) {
  groq = new Groq({ apiKey });
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/ask", async (req, res) => {
  const userMessage = req.body?.message || "";

  if (!userMessage) {
    return res.status(400).json({ reply: "Please provide a message to continue." });
  }

  if (!groq) {
    return res.json({
      reply: "Groq API key is not configured. Add GROQ_API_KEY to your environment to enable AI replies."
    });
  }

  try {
    const response = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content:
            "You are BizBuddy AI, a practical business assistant for entrepreneurs. Give concise, useful advice."
        },
        { role: "user", content: userMessage }
      ]
    });

    const reply = response.choices?.[0]?.message?.content || "No reply was generated.";
    return res.json({ reply });
  } catch (error) {
    const detail = error?.response?.data?.error?.message || error?.message || "Unknown error";
    return res.status(500).json({ reply: `AI request failed: ${detail}` });
  }
});

function startServer(port = PORT) {
  return app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };