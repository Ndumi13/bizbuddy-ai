const express = require("express");
const cors = require("cors");
const path = require("path");
const crypto = require("crypto");
const dotenv = require("dotenv");

const app = express();
const PORT = process.env.PORT || 5000;
let openRouterConfig = null;

function refreshProviderConfig() {
  dotenv.config({ path: path.resolve(__dirname, "..", ".env") });
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.GROQ_API_KEY || process.env.GROQ_KEY;
  if (apiKey && apiKey.length > 10) {
    openRouterConfig = { apiKey };
    return openRouterConfig;
  }

  openRouterConfig = null;
  return null;
}

refreshProviderConfig();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

function getPayFastConfig() {
  dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

  return {
    merchantId: process.env.PAYFAST_MERCHANT_ID || "",
    merchantKey: process.env.PAYFAST_MERCHANT_KEY || "",
    passphrase: process.env.PAYFAST_PASSPHRASE || "",
    mode: (process.env.PAYFAST_MODE || "sandbox").toLowerCase(),
    returnUrl: process.env.PAYFAST_RETURN_URL || "http://localhost:5000/payfast/return",
    cancelUrl: process.env.PAYFAST_CANCEL_URL || "http://localhost:5000/payfast/cancel",
    notifyUrl: process.env.PAYFAST_NOTIFY_URL || "http://localhost:5000/payfast/notify"
  };
}

function generatePayFastSignature(data, passphrase = "") {
  const sortedEntries = Object.entries(data)
    .filter(([, value]) => value !== undefined && value !== "")
    .sort(([left], [right]) => left.localeCompare(right));

  const payload = sortedEntries
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join("&");

  const source = passphrase ? `${payload}&passphrase=${encodeURIComponent(passphrase)}` : payload;
  return crypto.createHash("md5").update(source).digest("hex");
}

app.post("/create-payfast-payment", (req, res) => {
  const config = getPayFastConfig();
  const amount = Number(req.body?.amount || 50);
  const creditsToBuy = Number(req.body?.credits || 50);
  const userEmail = req.body?.email || "";

  if (!config.merchantId || !config.merchantKey) {
    return res.status(400).json({ error: "PayFast merchant credentials are not configured yet." });
  }

  const paymentId = `bizbuddy-${Date.now()}`;
  const paymentUrl = config.mode === "live"
    ? "https://www.payfast.co.za/eng/process"
    : "https://sandbox.payfast.co.za/eng/process";

  const returnUrl = `${config.returnUrl}?payment_id=${encodeURIComponent(paymentId)}&credits=${creditsToBuy}`;
  const cancelUrl = `${config.cancelUrl}?payment_id=${encodeURIComponent(paymentId)}`;
  const notifyUrl = `${config.notifyUrl}?payment_id=${encodeURIComponent(paymentId)}`;

  const formData = {
    merchant_id: config.merchantId,
    merchant_key: config.merchantKey,
    return_url: returnUrl,
    cancel_url: cancelUrl,
    notify_url: notifyUrl,
    name_first: "BizBuddy",
    name_last: "User",
    email_address: userEmail,
    m_payment_id: paymentId,
    amount: amount.toFixed(2),
    item_name: `${creditsToBuy} BizBuddy credits`,
    currency: "ZAR",
    custom_str1: userEmail,
    custom_int1: String(creditsToBuy)
  };

  const signature = generatePayFastSignature(formData, config.passphrase);

  return res.json({
    paymentUrl,
    fields: {
      ...formData,
      signature
    }
  });
});

app.get("/payfast/return", (req, res) => {
  const creditsToAdd = Number(req.query.credits || 50);
  res.send(`<!doctype html>
  <html>
    <head><meta charset="utf-8" /><title>Payment successful</title></head>
    <body style="font-family: Arial, sans-serif; padding: 24px;">
      <h2>Payment successful</h2>
      <p>Your purchase is being confirmed. You will be returned to BizBuddy shortly.</p>
      <script>
        try {
          const user = JSON.parse(localStorage.getItem("bizbuddyUser") || "null");
          if (user?.email) {
            const key = \`bizbuddyCredits:${user.email.toLowerCase()}\`;
            const current = Number(localStorage.getItem(key) || 250);
            localStorage.setItem(key, String(current + ${creditsToAdd}));
          }
        } catch (error) {
          console.error(error);
        }
        setTimeout(() => {
          window.location.href = "/";
        }, 1200);
      </script>
    </body>
  </html>`);
});

app.get("/payfast/cancel", (req, res) => {
  res.send(`<!doctype html><html><head><meta charset="utf-8" /><title>Payment cancelled</title></head><body style="font-family: Arial, sans-serif; padding: 24px;"><h2>Payment cancelled</h2><p>Your checkout was cancelled. No credits were added.</p><p><a href="/">Return to BizBuddy</a></p></body></html>`);
});

app.post("/payfast/notify", (req, res) => {
  res.status(200).send("OK");
});

app.post("/ask", async (req, res) => {
  const userMessage = req.body?.message || "";

  refreshProviderConfig();

  if (!userMessage) {
    return res.status(400).json({ reply: "Please provide a message to continue." });
  }

  if (!openRouterConfig?.apiKey) {
    return res.json({
      reply: "No AI provider key is configured. Add OPENROUTER_API_KEY to your environment to enable AI replies."
    });
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openRouterConfig.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:5000",
        "X-Title": "BizBuddy AI"
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are BizBuddy AI, a practical business assistant for entrepreneurs. Give concise, useful advice."
          },
          { role: "user", content: userMessage }
        ]
      })
    });

    const data = await response.json();
    const reply = data?.choices?.[0]?.message?.content || "No reply was generated.";

    if (!response.ok) {
      const detail = data?.error?.message || "Unknown error";
      return res.status(500).json({ reply: `AI request failed: ${detail}` });
    }

    return res.json({ reply });
  } catch (error) {
    const detail = error?.message || "Unknown error";
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