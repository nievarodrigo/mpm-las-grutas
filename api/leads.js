const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function clean(value, maxLength) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function parseGuests(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/\d+/);
  return match ? Number(match[0]) : null;
}

async function sendOwnerEmail({ name, contact, guests, dateEstimated, message }) {
  const lines = [
    `Nombre: ${name}`,
    `Grupo: ${guests || "a definir"}`,
    `Fecha estimada: ${dateEstimated || "a definir"}`,
    `Contacto: ${contact}`,
    message ? `Mensaje: ${message}` : null,
  ].filter(Boolean);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "MPM Alquileres <onboarding@resend.dev>",
      to: [process.env.OWNER_EMAIL],
      reply_to: contact,
      subject: `Nueva consulta de ${name} — MPM Alquileres`,
      text: lines.join("\n"),
    }),
  });

  return response.ok;
}

async function insertLead(supabaseUrl, supabaseKey, row) {
  const response = await fetch(`${supabaseUrl}/rest/v1/leads`, {
    method: "POST",
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(row),
  });

  if (response.ok) return { ok: true };
  const detail = await response.text().catch(() => "");
  return { ok: false, status: response.status, detail };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (_) {
      body = null;
    }
  }
  if (!body || typeof body !== "object") {
    return res.status(400).json({ ok: false, error: "invalid_json" });
  }

  // Honeypot: un bot completó un campo que ningún humano ve. Éxito silencioso, no se persiste nada.
  if (typeof body.hp === "string" && body.hp.trim() !== "") {
    return res.status(200).json({ ok: true });
  }

  const name = clean(body.name, 200);
  const contact = clean(body.contact, 200);
  const channel = body.channel === "email" || body.channel === "whatsapp" ? body.channel : null;
  const dateEstimated = typeof body.date === "string" && DATE_RE.test(body.date) ? body.date : null;
  const guests = parseGuests(body.guests);
  const message = clean(body.message, 2000) || null;

  if (!name) return res.status(400).json({ ok: false, error: "invalid_name" });
  if (!contact) return res.status(400).json({ ok: false, error: "invalid_contact" });
  if (!channel) return res.status(400).json({ ok: false, error: "invalid_channel" });
  if (channel === "email" && !EMAIL_RE.test(contact)) {
    return res.status(400).json({ ok: false, error: "invalid_email" });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error("leads: faltan env vars de Supabase");
    return res.status(500).json({ ok: false, error: "server_misconfigured" });
  }

  // Orden intencional: primero Resend, recién después el INSERT. La policy RLS de `leads`
  // es insert-only para el rol anon, así que no hay forma de corregir `email_sent` con un
  // UPDATE posterior sin sumar una service-role key. Resend corre server-side, invisible
  // para el visitante, así que invertir el orden no cambia nada de cara al usuario.
  let emailSent = null;
  if (channel === "email") {
    if (!process.env.RESEND_API_KEY || !process.env.OWNER_EMAIL) {
      console.error("leads: faltan env vars de Resend");
      emailSent = false;
    } else {
      emailSent = await sendOwnerEmail({ name, contact, guests, dateEstimated, message }).catch((err) => {
        console.error("leads: fallo al enviar con Resend", err);
        return false;
      });
    }
  }

  const insert = await insertLead(supabaseUrl, supabaseKey, {
    name,
    contact,
    channel,
    guests,
    date_estimated: dateEstimated,
    message,
    status: "nuevo",
    email_sent: emailSent,
  });

  if (!insert.ok) {
    console.error("leads: falló el insert en Supabase", insert.status, insert.detail);
    return res.status(502).json({
      ok: false,
      error: "insert_failed",
      message: "No pudimos registrar tu consulta. Probá escribirnos directo por WhatsApp.",
    });
  }

  return res.status(200).json({ ok: true, channel, emailSent });
};
