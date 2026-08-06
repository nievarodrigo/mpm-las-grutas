const SUPABASE_URL = "https://pobhshndkzdekreubkoy.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvYmhzaG5ka3pkZWtyZXVia295Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5NzM0OTIsImV4cCI6MjEwMTU0OTQ5Mn0.6rTNHq6rgTIG_NpwzAsK2Imz07zuDf9bUhTRJv7mvTE";
const ADMIN_EMAIL = "admin@mpmalquileres.internal";
const SESSION_KEY = "mpm_admin_session";

function readSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch (_) {
    return null;
  }
}

function writeSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

function toSession(tokenResponse) {
  return {
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token,
    expiresAt: Date.now() + tokenResponse.expires_in * 1000,
  };
}

async function login(password) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password }),
  });
  if (!response.ok) return false;
  const data = await response.json();
  writeSession(toSession(data));
  return true;
}

function logout() {
  clearSession();
}

async function refreshSession(session) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: session.refreshToken }),
  });
  if (!response.ok) {
    clearSession();
    return null;
  }
  const data = await response.json();
  const next = toSession(data);
  writeSession(next);
  return next;
}

// Devuelve una sesión con un access token vigente, refrescando si está por
// vencer (margen de 5 minutos), o null si no hay sesión / no se pudo refrescar.
async function ensureSession() {
  let session = readSession();
  if (!session) return null;
  if (session.expiresAt - Date.now() < 5 * 60 * 1000) {
    session = await refreshSession(session);
  }
  return session;
}

async function authedFetch(url, opts = {}) {
  let session = await ensureSession();
  if (!session) throw new Error("no_session");

  const doFetch = (token) =>
    fetch(url, {
      ...opts,
      headers: { ...(opts.headers || {}), Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
    });

  let response = await doFetch(session.accessToken);
  if (response.status === 401) {
    session = await refreshSession(session);
    if (!session) throw new Error("no_session");
    response = await doFetch(session.accessToken);
  }
  return response;
}

window.mpmAdminAuth = { login, logout, ensureSession, authedFetch, SUPABASE_URL, SUPABASE_ANON_KEY };
