import express from "express";
import { handleIncomingMessage } from "./whatsapp.js";
import { runDailyAudit, runAlertCheck } from "./scheduler.js";
import cron from "node-cron";
import "dotenv/config";

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Twilio WhatsApp webhook
app.post("/webhook/whatsapp", async (req, res) => {
  try {
    const { Body: userMessage, From: from, To: to } = req.body;
    console.log(`📱 Message from ${from}: ${userMessage}`);
    await handleIncomingMessage(from, userMessage);
    res.status(200).send("<Response></Response>"); // Twilio expects TwiML
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(500).send("Error");
  }
});

// Health check
app.get("/health", (_, res) => res.json({ status: "ok", time: new Date() }));

// ─── Scheduled Jobs ────────────────────────────────────────────────────────────

// Daily audit at 8:00 AM (server timezone)
cron.schedule("0 8 * * *", () => {
  console.log("⏰ Running daily Google Ads audit...");
  runDailyAudit();
});

// Alert check every hour
cron.schedule("0 * * * *", () => {
  console.log("🔔 Running alert check...");
  runAlertCheck();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 WhatsApp Ads Bot running on port ${PORT}`);
  console.log(`   Webhook: POST http://YOUR_SERVER:${PORT}/webhook/whatsapp`);
  console.log(`   Daily audit: 8:00 AM every day`);
  console.log(`   Alert checks: Every hour\n`);
});
