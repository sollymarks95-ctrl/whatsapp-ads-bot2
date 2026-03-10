import { sendWhatsApp } from "./whatsapp.js";
import { askClaude } from "./claude.js";
import { getAdsAudit, getAdsSummary, getAdsAlertData } from "./googleAds.js";

const YOUR_WHATSAPP_NUMBER = process.env.YOUR_WHATSAPP_NUMBER;

// ─── Daily Morning Audit ──────────────────────────────────────────────────────
export async function runDailyAudit() {
  try {
    console.log("📊 Fetching ads data for daily audit...");
    const auditData = await getAdsAudit();
    const message = await askClaude("daily_audit", auditData, null);

    await sendWhatsApp(
      YOUR_WHATSAPP_NUMBER,
      `☀️ *Good morning — Daily Ads Audit*\n${new Date().toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })}\n\n${message}`
    );

    console.log("✅ Daily audit sent via WhatsApp");
  } catch (err) {
    console.error("❌ Daily audit failed:", err.message);
    await sendWhatsApp(
      YOUR_WHATSAPP_NUMBER,
      `⚠️ Daily audit failed to run. Error: ${err.message}\n\nType *audit* to retry manually.`
    ).catch(() => {});
  }
}

// ─── Hourly Alert Check ───────────────────────────────────────────────────────
export async function runAlertCheck() {
  try {
    console.log("🔔 Checking for alerts...");
    const alertData = await getAdsAlertData();
    const message = await askClaude("alert", alertData, null);

    // Claude returns "NO_ALERTS" if nothing urgent
    if (message.trim() === "NO_ALERTS") {
      console.log("✅ No alerts — all good");
      return;
    }

    await sendWhatsApp(YOUR_WHATSAPP_NUMBER, `🚨 *Google Ads Alert*\n\n${message}`);
    console.log("🚨 Alert sent via WhatsApp");
  } catch (err) {
    console.error("❌ Alert check failed:", err.message);
  }
}
