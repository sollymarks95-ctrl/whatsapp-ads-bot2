import twilio from "twilio";
import { askClaude } from "./claude.js";
import { getAdsAudit, getAdsSummary } from "./googleAds.js";

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const YOUR_WHATSAPP_NUMBER = process.env.YOUR_WHATSAPP_NUMBER; // e.g. "whatsapp:+972XXXXXXXXX"
const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER; // e.g. "whatsapp:+14155238886"

// Conversation memory (in-memory per session — resets on server restart)
const conversationHistory = {};

export async function sendWhatsApp(to, message) {
  // WhatsApp has a 1600 char limit per message — split if needed
  const chunks = splitMessage(message, 1500);
  for (const chunk of chunks) {
    await client.messages.create({
      from: TWILIO_WHATSAPP_NUMBER,
      to,
      body: chunk,
    });
  }
}

export async function handleIncomingMessage(from, userMessage) {
  // Only respond to your own number for security
  if (from !== YOUR_WHATSAPP_NUMBER) {
    console.log(`⛔ Blocked message from unknown number: ${from}`);
    return;
  }

  const msg = userMessage?.trim().toLowerCase();

  // ── Shortcut commands ──────────────────────────────────────────────────────
  if (msg === "audit" || msg === "run audit") {
    await sendWhatsApp(from, "🔍 Running full Google Ads audit... this may take a moment.");
    const auditData = await getAdsAudit();
    const reply = await askClaude("audit", auditData, null);
    await sendWhatsApp(from, reply);
    return;
  }

  if (msg === "tasks" || msg === "what to do") {
    await sendWhatsApp(from, "📋 Fetching your prioritised task list...");
    const auditData = await getAdsAudit();
    const reply = await askClaude("tasks", auditData, null);
    await sendWhatsApp(from, reply);
    return;
  }

  if (msg === "summary" || msg === "today") {
    await sendWhatsApp(from, "📊 Pulling today's summary...");
    const summaryData = await getAdsSummary();
    const reply = await askClaude("summary", summaryData, null);
    await sendWhatsApp(from, reply);
    return;
  }

  if (msg === "help") {
    await sendWhatsApp(
      from,
      `🤖 *Google Ads Assistant — Commands*\n\n` +
        `*audit* — Full account audit\n` +
        `*tasks* — Prioritised to-do list\n` +
        `*summary* / *today* — Today's performance snapshot\n` +
        `*help* — Show this menu\n\n` +
        `Or just ask me anything about your campaigns! 💬`
    );
    return;
  }

  // ── Free-form Q&A with conversation memory ────────────────────────────────
  if (!conversationHistory[from]) conversationHistory[from] = [];

  conversationHistory[from].push({ role: "user", content: userMessage });

  // Keep last 10 turns to avoid token overflow
  if (conversationHistory[from].length > 20) {
    conversationHistory[from] = conversationHistory[from].slice(-20);
  }

  const summaryData = await getAdsSummary(); // Give Claude live context
  const reply = await askClaude("chat", summaryData, conversationHistory[from]);

  conversationHistory[from].push({ role: "assistant", content: reply });

  await sendWhatsApp(from, reply);
}

function splitMessage(text, maxLen) {
  if (text.length <= maxLen) return [text];
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + maxLen));
    i += maxLen;
  }
  return chunks;
}
