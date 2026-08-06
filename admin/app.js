const { SUPABASE_URL, authedFetch, login, logout, ensureSession } = window.mpmAdminAuth;

const SOURCE_LABELS = {
  directo: "Directo",
  organico: "Búsqueda orgánica",
  ia: "IA / Asistentes",
  redes: "Redes sociales",
  ads: "Ads",
  referidos: "Referidos",
};
// Mismo orden fijo que las variables --viz-* de admin.css — el color de
// cada bucket nunca cambia con el ranking, solo con el bucket en sí.
const SOURCE_ORDER = ["directo", "organico", "ia", "redes", "ads", "referidos"];

const loginView = document.getElementById("login-view");
const dashboardView = document.getElementById("dashboard-view");
const loginForm = document.getElementById("login-form");
const logoutButton = document.getElementById("logout-button");
const sourcesList = document.getElementById("sources-list");
const leadsList = document.getElementById("leads-list");
const channelList = document.getElementById("channel-list");
const guestsList = document.getElementById("guests-list");

let allLeads = [];
let currentPeriod = "today";
let currentFilter = "todos";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[ch]);
}

function showFormFeedback(form, text, kind) {
  const feedback = form.querySelector(".form-feedback");
  feedback.textContent = text;
  feedback.classList.toggle("form-feedback--error", kind === "error");
  feedback.classList.toggle("form-feedback--success", kind === "success");
  feedback.hidden = false;
}

function periodSince(period) {
  const days = period === "today" ? 1 : period === "30d" ? 30 : 7;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function fetchLeads() {
  const response = await authedFetch(`${SUPABASE_URL}/rest/v1/leads?select=*&order=created_at.desc&limit=500`);
  if (!response.ok) throw new Error("fetch_leads_failed");
  return response.json();
}

async function fetchAnalytics(period) {
  const response = await authedFetch(`/api/admin-analytics?period=${period}`);
  if (!response.ok) throw new Error("fetch_analytics_failed");
  return response.json();
}

async function markContacted(id, button) {
  button.disabled = true;
  const lead = allLeads.find((item) => item.id === id);
  const previousStatus = lead?.status;
  if (lead) lead.status = "contactado";
  renderLeads();

  const response = await authedFetch(`${SUPABASE_URL}/rest/v1/leads?id=eq.${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ status: "contactado" }),
  }).catch(() => null);

  if (!response || !response.ok) {
    if (lead) lead.status = previousStatus;
    renderLeads();
  }
}

function renderKPIs(analytics) {
  const since = periodSince(currentPeriod);
  const inPeriod = allLeads.filter((lead) => new Date(lead.created_at) >= since);
  const visitors = analytics.visitors ?? 0;
  document.querySelector('[data-kpi="pageviews"]').textContent = analytics.pageviews ?? "—";
  document.querySelector('[data-kpi="visitors"]').textContent = analytics.visitors ?? "—";
  document.querySelector('[data-kpi="leadsNew"]').textContent = inPeriod.filter((l) => l.status === "nuevo").length;
  document.querySelector('[data-kpi="leadsTotal"]').textContent = inPeriod.length;
  document.querySelector('[data-kpi="conversion"]').textContent =
    visitors > 0 ? `${((inPeriod.length / visitors) * 100).toFixed(1)}%` : "—";
}

// items: [{ key, label, value, color }]. Barra horizontal genérica, reusada
// por origen de tráfico, canal y tamaño de grupo — misma anatomía (track +
// fill redondeado + valor directo), solo cambian los datos y el color.
function renderBarList(container, items, emptyMessage) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) {
    container.innerHTML = `<p class="admin-empty">${emptyMessage}</p>`;
    return;
  }
  container.innerHTML = items.map(({ label, value, color }) => {
    const pct = Math.round((value / total) * 100);
    return `
      <div class="admin-source">
        <span class="admin-source__label"><span class="admin-source__dot" style="background:${color}"></span>${escapeHtml(label)}</span>
        <div class="admin-source__track"><div class="admin-source__fill" style="width:${pct}%;background:${color}"></div></div>
        <span class="admin-source__value">${value} (${pct}%)</span>
      </div>`;
  }).join("");
}

function renderSources(sources) {
  const items = SOURCE_ORDER.map((key) => ({
    label: SOURCE_LABELS[key],
    value: sources[key] || 0,
    color: `var(--viz-${key})`,
  }));
  renderBarList(sourcesList, items, "Todavía no hay suficientes visitas para desglosar el origen. Esto se va a ir completando.");
}

function renderChannels() {
  const whatsapp = allLeads.filter((l) => l.channel === "whatsapp").length;
  const email = allLeads.filter((l) => l.channel === "email").length;
  renderBarList(
    channelList,
    [
      { label: "WhatsApp", value: whatsapp, color: "var(--viz-whatsapp)" },
      { label: "Email", value: email, color: "var(--viz-email)" },
    ],
    "Todavía no hay consultas para desglosar por canal."
  );
}

function renderGuests() {
  const counts = {};
  allLeads.forEach((lead) => {
    const key = lead.guests ? `${lead.guests}` : "Sin especificar";
    counts[key] = (counts[key] || 0) + 1;
  });
  const items = Object.keys(counts)
    .sort((a, b) => (a === "Sin especificar" ? 1 : b === "Sin especificar" ? -1 : Number(a) - Number(b)))
    .map((key) => ({
      label: key === "Sin especificar" ? key : `${key} persona${key === "1" ? "" : "s"}`,
      value: counts[key],
      color: "var(--viz-guests)",
    }));
  renderBarList(guestsList, items, "Todavía no hay consultas para desglosar por tamaño de grupo.");
}

function renderLeads() {
  const filtered = currentFilter === "todos" ? allLeads : allLeads.filter((l) => l.status === currentFilter);
  if (filtered.length === 0) {
    leadsList.innerHTML = '<p class="admin-empty">Todavía no hay consultas nuevas por acá.</p>';
    return;
  }
  leadsList.innerHTML = filtered.map((lead) => {
    const date = new Date(lead.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" });
    const contactLink = lead.channel === "email"
      ? `<a href="mailto:${escapeHtml(lead.contact)}">${escapeHtml(lead.contact)}</a>`
      : `<a href="tel:${escapeHtml(lead.contact)}">${escapeHtml(lead.contact)}</a>`;
    const badgeClass = lead.status === "contactado" ? "admin-badge--contactado" : "admin-badge--nuevo";
    const badgeText = lead.status === "contactado" ? "Contactado" : "Nuevo";
    const actionButton = lead.status === "nuevo"
      ? `<button class="button button--small" data-mark-contacted="${lead.id}" type="button">Marcar contactado</button>`
      : "";
    return `
      <div class="admin-lead">
        <span class="admin-lead__date">${date}</span>
        <span class="admin-lead__name">${escapeHtml(lead.name)}</span>
        <span class="admin-lead__contact">${contactLink}</span>
        <span>${escapeHtml(lead.guests || "—")}</span>
        <span>${escapeHtml(lead.date_estimated || "a definir")}</span>
        <span class="admin-lead__message" title="${escapeHtml(lead.message || "")}">${escapeHtml(lead.message || "—")}</span>
        <span class="admin-badge ${badgeClass}">${badgeText}</span>
        ${actionButton}
      </div>`;
  }).join("");

  leadsList.querySelectorAll("[data-mark-contacted]").forEach((button) => {
    button.addEventListener("click", () => markContacted(button.dataset.markContacted, button));
  });
}

async function loadDashboard() {
  document.querySelectorAll(".admin-kpi__value").forEach((el) => el.classList.add("is-loading"));
  try {
    const [leads, analytics] = await Promise.all([fetchLeads(), fetchAnalytics(currentPeriod)]);
    allLeads = leads;
    renderKPIs(analytics);
    renderSources(analytics.ok === false ? {} : analytics.sources || {});
    renderChannels();
    renderGuests();
    renderLeads();
  } catch (_) {
    sourcesList.innerHTML = '<p class="admin-empty">No pudimos cargar esto. Recargá la página.</p>';
    channelList.innerHTML = '<p class="admin-empty">No pudimos cargar esto. Recargá la página.</p>';
    guestsList.innerHTML = '<p class="admin-empty">No pudimos cargar esto. Recargá la página.</p>';
    leadsList.innerHTML = '<p class="admin-empty">No pudimos cargar esto. Recargá la página.</p>';
  } finally {
    document.querySelectorAll(".admin-kpi__value").forEach((el) => el.classList.remove("is-loading"));
  }
}

function showDashboard() {
  loginView.hidden = true;
  dashboardView.hidden = false;
  loadDashboard();
}

function showLogin() {
  dashboardView.hidden = true;
  loginView.hidden = false;
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const password = new FormData(loginForm).get("password");
  const button = loginForm.querySelector('button[type="submit"]');
  button.disabled = true;
  const ok = await login(password).catch(() => false);
  button.disabled = false;
  if (ok) {
    loginForm.reset();
    showDashboard();
  } else {
    showFormFeedback(loginForm, "Contraseña incorrecta.", "error");
  }
});

logoutButton.addEventListener("click", () => {
  logout();
  showLogin();
});

document.querySelectorAll(".admin-period__chip[data-period]").forEach((chip) => {
  chip.addEventListener("click", () => {
    currentPeriod = chip.dataset.period;
    document.querySelectorAll(".admin-period__chip[data-period]").forEach((c) => c.classList.toggle("is-active", c === chip));
    loadDashboard();
  });
});

document.querySelectorAll(".admin-period__chip[data-filter]").forEach((chip) => {
  chip.addEventListener("click", () => {
    currentFilter = chip.dataset.filter;
    document.querySelectorAll(".admin-period__chip[data-filter]").forEach((c) => c.classList.toggle("is-active", c === chip));
    renderLeads();
  });
});

(async function init() {
  const session = await ensureSession();
  if (session) showDashboard();
  else showLogin();
})();
