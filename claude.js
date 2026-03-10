import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are an expert Google Ads auditor and PPC consultant delivering insights via WhatsApp.

RULES:
- Be concise and actionable — this is WhatsApp, not a report
- Use emojis sparingly but effectively for scannability
- Always prioritise by business impact (money saved / revenue gained)
- Format lists with dashes, not bullet points
- Keep responses under 1200 characters unless a full audit is requested
- For audits and task lists, be thorough but scannable
- Speak like a sharp consultant, not a robot

When given Google Ads data, identify:
- Wasted spend (high cost, low conversion)
- Quality Score issues
- Missing ad extensions
- Keyword cannibalisation
- Budget allocation problems
- Ad copy weaknesses
- Bid strategy mismatches
- Landing page issues (if data available)`;

export async function askClaude(mode, adsData, conversationHistory) {
  let userContent = "";

  if (mode === "audit") {
    userContent = `Run a full Google Ads audit on this account data and give me:\n1. Top 5 critical issues\n2. Quick wins (< 30 min to fix)\n3. Strategic recommendations\n\nData:\n${JSON.stringify(adsData, null, 2)}`;
  } else if (mode === "tasks") {
    userContent = `Based on this Google Ads data, give me a prioritised task list for today. Format each task as:\n[Priority: HIGH/MED/LOW] Task name\n→ Why: brief reason\n→ Expected impact: what will improve\n\nData:\n${JSON.stringify(adsData, null, 2)}`;
  } else if (mode === "summary") {
    userContent = `Give me a daily performance snapshot. Include:\n- Overall spend vs budget\n- Top performing campaigns\n- Underperformers to watch\n- One key action for today\n\nData:\n${JSON.stringify(adsData, null, 2)}`;
  } else if (mode === "daily_audit") {
    userContent = `Good morning! Run the daily Google Ads audit. Be concise. Include:\n📊 Yesterday's key numbers\n⚠️ Any alerts or anomalies\n✅ Top 3 tasks for today\n\nData:\n${JSON.stringify(adsData, null, 2)}`;
  } else if (mode === "alert") {
    userContent = `Check this Google Ads data for alerts. Only respond if there is something urgent (overspend, sudden CTR drop, disapproved ads, budget depleted). If nothing urgent, respond with exactly: NO_ALERTS\n\nData:\n${JSON.stringify(adsData, null, 2)}`;
  } else {
    // chat mode — use conversation history
    const messages = conversationHistory || [];
    if (adsData) {
      // Prepend live data as context in the last user message
      const lastIdx = messages.length - 1;
      messages[lastIdx] = {
        ...messages[lastIdx],
        content: `[Live account context: ${JSON.stringify(adsData, null, 2)}]\n\n${messages[lastIdx].content}`,
      };
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages,
    });
    return response.content[0].text;
  }

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
  });

  return response.content[0].text;
}
