import { GoogleAdsApi } from "google-ads-api";

const client = new GoogleAdsApi({
  client_id: process.env.GOOGLE_ADS_CLIENT_ID,
  client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
  developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
});

function getCustomer() {
  return client.Customer({
    customer_id: process.env.GOOGLE_ADS_CUSTOMER_ID,
    refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
  });
}

// ─── Full Audit Data ─────────────────────────────────────────────────────────
export async function getAdsAudit() {
  const customer = getCustomer();

  const [campaigns, adGroups, keywords, ads] = await Promise.all([
    getCampaigns(customer),
    getAdGroups(customer),
    getKeywords(customer),
    getAds(customer),
  ]);

  return {
    accountId: process.env.GOOGLE_ADS_CUSTOMER_ID,
    fetchedAt: new Date().toISOString(),
    campaigns,
    adGroups,
    keywords,
    ads,
  };
}

// ─── Daily Summary Data ───────────────────────────────────────────────────────
export async function getAdsSummary() {
  const customer = getCustomer();
  const campaigns = await getCampaigns(customer);

  const totalSpend = campaigns.reduce((s, c) => s + c.costMicros / 1_000_000, 0);
  const totalBudget = campaigns.reduce((s, c) => s + c.budgetMicros / 1_000_000, 0);
  const totalConversions = campaigns.reduce((s, c) => s + c.conversions, 0);
  const totalClicks = campaigns.reduce((s, c) => s + c.clicks, 0);
  const totalImpressions = campaigns.reduce((s, c) => s + c.impressions, 0);

  return {
    fetchedAt: new Date().toISOString(),
    summary: {
      totalSpend: totalSpend.toFixed(2),
      totalBudget: totalBudget.toFixed(2),
      budgetUsedPct: ((totalSpend / totalBudget) * 100).toFixed(1),
      totalConversions,
      totalClicks,
      totalImpressions,
      avgCTR: totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : 0,
      avgCPC: totalClicks > 0 ? (totalSpend / totalClicks).toFixed(2) : 0,
      costPerConversion: totalConversions > 0 ? (totalSpend / totalConversions).toFixed(2) : "N/A",
    },
    campaigns: campaigns.slice(0, 10), // Top 10 campaigns for summary
  };
}

// ─── Alert Check Data ─────────────────────────────────────────────────────────
export async function getAdsAlertData() {
  const customer = getCustomer();
  const campaigns = await getCampaigns(customer);

  const alerts = [];

  for (const c of campaigns) {
    const spend = c.costMicros / 1_000_000;
    const budget = c.budgetMicros / 1_000_000;
    const budgetPct = budget > 0 ? (spend / budget) * 100 : 0;

    if (budgetPct >= 95) alerts.push({ type: "BUDGET_DEPLETED", campaign: c.name, budgetPct: budgetPct.toFixed(1) });
    if (budgetPct >= 110) alerts.push({ type: "OVERSPEND", campaign: c.name, budgetPct: budgetPct.toFixed(1) });
    if (c.averageCpc > 0 && c.clicks < 5 && spend > 20) alerts.push({ type: "LOW_CTR_HIGH_SPEND", campaign: c.name, spend, clicks: c.clicks });
  }

  return { alerts, campaigns, fetchedAt: new Date().toISOString() };
}

// ─── Query Helpers ────────────────────────────────────────────────────────────
async function getCampaigns(customer) {
  const rows = await customer.query(`
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.bidding_strategy_type,
      campaign_budget.amount_micros,
      metrics.cost_micros,
      metrics.clicks,
      metrics.impressions,
      metrics.conversions,
      metrics.average_cpc,
      metrics.ctr,
      metrics.average_cpm,
      metrics.cost_per_conversion
    FROM campaign
    WHERE segments.date DURING LAST_7_DAYS
      AND campaign.status != 'REMOVED'
    ORDER BY metrics.cost_micros DESC
    LIMIT 50
  `);

  return rows.map((r) => ({
    id: r.campaign.id,
    name: r.campaign.name,
    status: r.campaign.status,
    biddingStrategy: r.campaign.bidding_strategy_type,
    budgetMicros: r.campaign_budget?.amount_micros || 0,
    costMicros: r.metrics.cost_micros || 0,
    clicks: r.metrics.clicks || 0,
    impressions: r.metrics.impressions || 0,
    conversions: r.metrics.conversions || 0,
    averageCpc: r.metrics.average_cpc || 0,
    ctr: r.metrics.ctr || 0,
    costPerConversion: r.metrics.cost_per_conversion || 0,
  }));
}

async function getAdGroups(customer) {
  const rows = await customer.query(`
    SELECT
      ad_group.id,
      ad_group.name,
      ad_group.status,
      campaign.name,
      metrics.cost_micros,
      metrics.clicks,
      metrics.impressions,
      metrics.conversions,
      metrics.average_quality_score
    FROM ad_group
    WHERE segments.date DURING LAST_7_DAYS
      AND ad_group.status != 'REMOVED'
    ORDER BY metrics.cost_micros DESC
    LIMIT 50
  `);

  return rows.map((r) => ({
    id: r.ad_group.id,
    name: r.ad_group.name,
    status: r.ad_group.status,
    campaign: r.campaign.name,
    costMicros: r.metrics.cost_micros || 0,
    clicks: r.metrics.clicks || 0,
    impressions: r.metrics.impressions || 0,
    conversions: r.metrics.conversions || 0,
    qualityScore: r.metrics.average_quality_score || null,
  }));
}

async function getKeywords(customer) {
  const rows = await customer.query(`
    SELECT
      ad_group_criterion.keyword.text,
      ad_group_criterion.keyword.match_type,
      ad_group_criterion.quality_info.quality_score,
      ad_group_criterion.status,
      campaign.name,
      ad_group.name,
      metrics.cost_micros,
      metrics.clicks,
      metrics.impressions,
      metrics.conversions,
      metrics.average_cpc
    FROM keyword_view
    WHERE segments.date DURING LAST_7_DAYS
      AND ad_group_criterion.status != 'REMOVED'
    ORDER BY metrics.cost_micros DESC
    LIMIT 100
  `);

  return rows.map((r) => ({
    text: r.ad_group_criterion.keyword?.text,
    matchType: r.ad_group_criterion.keyword?.match_type,
    qualityScore: r.ad_group_criterion.quality_info?.quality_score,
    status: r.ad_group_criterion.status,
    campaign: r.campaign.name,
    adGroup: r.ad_group.name,
    costMicros: r.metrics.cost_micros || 0,
    clicks: r.metrics.clicks || 0,
    impressions: r.metrics.impressions || 0,
    conversions: r.metrics.conversions || 0,
    averageCpc: r.metrics.average_cpc || 0,
  }));
}

async function getAds(customer) {
  const rows = await customer.query(`
    SELECT
      ad_group_ad.ad.id,
      ad_group_ad.ad.type,
      ad_group_ad.status,
      ad_group_ad.policy_summary.approval_status,
      campaign.name,
      ad_group.name,
      metrics.cost_micros,
      metrics.clicks,
      metrics.impressions,
      metrics.conversions,
      metrics.ctr
    FROM ad_group_ad
    WHERE segments.date DURING LAST_7_DAYS
      AND ad_group_ad.status != 'REMOVED'
    ORDER BY metrics.cost_micros DESC
    LIMIT 100
  `);

  return rows.map((r) => ({
    id: r.ad_group_ad.ad?.id,
    type: r.ad_group_ad.ad?.type,
    status: r.ad_group_ad.status,
    approvalStatus: r.ad_group_ad.policy_summary?.approval_status,
    campaign: r.campaign.name,
    adGroup: r.ad_group.name,
    costMicros: r.metrics.cost_micros || 0,
    clicks: r.metrics.clicks || 0,
    impressions: r.metrics.impressions || 0,
    conversions: r.metrics.conversions || 0,
    ctr: r.metrics.ctr || 0,
  }));
}
