const VERCEL_TEAM_ID = "team_4IfsjTAFx7anm6JeI2OmSXBt";
const VERCEL_PROJECT_ID = "prj_w5JjWLpkP65qy5OBZdjaxkNWRjNp";

const PERIOD_DAYS = { today: 1, "7d": 7, "30d": 30 };

// Dominios conocidos de asistentes de IA. Lista mantenida a mano — se va a
// desactualizar con el tiempo, es un estimado, no una fuente de verdad.
const AI_REFERRERS = [
  "chatgpt.com",
  "chat.openai.com",
  "perplexity.ai",
  "claude.ai",
  "gemini.google.com",
  "copilot.microsoft.com",
  "www.bing.com",
];

const SOCIAL_REFERRERS = [
  "facebook.com",
  "l.facebook.com",
  "instagram.com",
  "l.instagram.com",
  "t.co",
  "twitter.com",
  "x.com",
  "linkedin.com",
];

// Dominios asociados a redirects de anuncios (no UTM). Best-effort: separar
// "Ads" de "Búsqueda orgánica" con precisión total requeriría cruzar
// referrerHostname con utm_medium por fila, y la API de agregados no
// confirmó soportar más de una dimensión de agrupación a la vez — se deja
// como estimado simple en vez de fingir precisión que no se puede verificar.
const AD_REFERRERS = ["googleads.g.doubleclick.net", "googleadservices.com"];

function categorizeHostname(hostname) {
  if (!hostname) return "directo";
  const host = hostname.toLowerCase();
  if (AD_REFERRERS.some((d) => host.includes(d))) return "ads";
  if (AI_REFERRERS.some((d) => host.includes(d))) return "ia";
  if (SOCIAL_REFERRERS.some((d) => host.includes(d))) return "redes";
  if (host.includes("google.") || host.includes("bing.") || host.includes("duckduckgo.")) {
    return "organico";
  }
  return "referidos";
}

async function verifySession(token) {
  const response = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: process.env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
  });
  return response.ok;
}

function sinceUntil(period) {
  const days = PERIOD_DAYS[period] || PERIOD_DAYS["7d"];
  const until = new Date();
  const since = new Date(until.getTime() - days * 24 * 60 * 60 * 1000);
  return { since: since.toISOString().slice(0, 10), until: until.toISOString().slice(0, 10) };
}

async function vercelAnalytics(path, params) {
  const url = new URL(`https://api.vercel.com/v1/query/web-analytics/${path}`);
  url.searchParams.set("teamId", VERCEL_TEAM_ID);
  url.searchParams.set("projectId", VERCEL_PROJECT_ID);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}` },
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`vercel analytics ${path} failed: ${response.status} ${detail}`);
  }
  return response.json();
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !(await verifySession(token))) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  if (!process.env.VERCEL_API_TOKEN) {
    console.error("admin-analytics: falta VERCEL_API_TOKEN");
    return res.status(500).json({ ok: false, error: "server_misconfigured" });
  }

  const period = PERIOD_DAYS[req.query?.period] ? req.query.period : "7d";
  const { since, until } = sinceUntil(period);

  try {
    const [totals, byReferrer] = await Promise.all([
      vercelAnalytics("visits/count", { since, until }),
      vercelAnalytics("visits/aggregate", { since, until, by: "referrerHostname", limit: "20" }),
    ]);

    const buckets = { directo: 0, organico: 0, ia: 0, ads: 0, redes: 0, referidos: 0 };
    for (const row of byReferrer.data || []) {
      const bucket = categorizeHostname(row.referrerHostname);
      buckets[bucket] += row.visitors || 0;
    }

    return res.status(200).json({
      ok: true,
      period,
      since,
      until,
      pageviews: totals.data?.pageviews ?? 0,
      visitors: totals.data?.visitors ?? 0,
      sources: buckets,
      sourcesEstimated: true,
    });
  } catch (err) {
    console.error("admin-analytics: fallo al consultar Vercel Analytics", err);
    return res.status(502).json({ ok: false, error: "analytics_unavailable" });
  }
};
