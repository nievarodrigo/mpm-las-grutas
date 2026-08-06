const WHATSAPP_NUMBER = "5491144751508";

const header = document.querySelector(".site-header");
const topbar = document.querySelector(".topbar");
const menuButton = document.querySelector(".menu-button");
const toast = document.querySelector(".toast");

document.getElementById("year").textContent = new Date().getFullYear();

function updateHeader() {
  const sticky = window.scrollY > 90;
  header.classList.toggle("is-sticky", sticky);
  topbar.style.visibility = sticky ? "hidden" : "visible";
}
updateHeader();
window.addEventListener("scroll", updateHeader, { passive: true });

menuButton.addEventListener("click", () => {
  const open = document.body.classList.toggle("menu-open");
  menuButton.setAttribute("aria-expanded", String(open));
  menuButton.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
});

document.querySelectorAll(".nav-links a").forEach((link) => {
  link.addEventListener("click", () => {
    document.body.classList.remove("menu-open");
    menuButton.setAttribute("aria-expanded", "false");
  });
});

const observer = new IntersectionObserver(
  (entries) => entries.forEach((entry) => entry.isIntersecting && entry.target.classList.add("is-visible")),
  { threshold: 0.12 }
);
document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));

function showToast() {
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 1800);
}

function todayLocalISODate() {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60000;
  return new Date(now - offsetMs).toISOString().slice(0, 10);
}
document.querySelectorAll('input[type="date"]').forEach((input) => {
  input.min = todayLocalISODate();
});

const CONTACT_MODES = {
  whatsapp: { type: "text", autocomplete: "tel", placeholder: "Ej. 11 2345 6789", label: "WhatsApp" },
  email: { type: "email", autocomplete: "email", placeholder: "tu@email.com", label: "Email" },
};

const channelPicker = document.querySelectorAll('.channel-toggle input[name="channel-picker"]');
let resetChannelToggle = () => {};

if (channelPicker.length) {
  const heroForm = document.querySelector("#consultar .js-lead-form");
  const contactInput = heroForm.querySelector('[data-role="contact"]');
  const contactLabel = heroForm.querySelector(".js-contact-label");
  const channelField = heroForm.querySelector('input[name="channel"]');

  const setChannel = (channel) => {
    const mode = CONTACT_MODES[channel] || CONTACT_MODES.whatsapp;
    channelField.value = channel;
    contactInput.type = mode.type;
    contactInput.autocomplete = mode.autocomplete;
    contactInput.placeholder = mode.placeholder;
    contactLabel.textContent = mode.label;
  };

  channelPicker.forEach((radio) => {
    radio.addEventListener("change", () => radio.checked && setChannel(radio.value));
  });

  // Los radios del toggle viven fuera del <form> (a propósito, para que no dupliquen
  // la clave "channel" en el FormData junto con el hidden), así que form.reset() no
  // los toca — hay que volverlos a whatsapp a mano tras un envío exitoso por email.
  resetChannelToggle = () => {
    const whatsappRadio = document.querySelector('.channel-toggle input[value="whatsapp"]');
    if (whatsappRadio) whatsappRadio.checked = true;
    setChannel("whatsapp");
  };
}

function setLoading(button, loading) {
  if (loading) {
    button.dataset.label = button.dataset.label || button.innerHTML;
    button.disabled = true;
    button.classList.add("is-loading");
  } else {
    button.disabled = false;
    button.classList.remove("is-loading");
    if (button.dataset.label) button.innerHTML = button.dataset.label;
  }
}

function showFormFeedback(form, text, kind) {
  const feedback = form.querySelector(".form-feedback");
  if (!feedback) return;
  feedback.textContent = text;
  feedback.classList.toggle("form-feedback--error", kind === "error");
  feedback.classList.toggle("form-feedback--success", kind === "success");
  feedback.hidden = false;
}

function postLead(payload) {
  return fetch("/api/leads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

document.querySelectorAll(".js-lead-form").forEach((form) => {
  const submitBtn = form.querySelector('button[type="submit"]');

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const data = new FormData(form);
    if ((data.get("hp") || "").toString().trim() !== "") return;

    const channel = data.get("channel") || "whatsapp";
    const name = data.get("name");
    const guests = data.get("guests") || "a definir";
    const dateValue = data.get("date");
    const contact = data.get("contact");

    const payload = {
      name,
      contact,
      channel,
      guests: data.get("guests") || null,
      date: dateValue || null,
      hp: data.get("hp") || "",
    };

    if (channel === "whatsapp") {
      // Fire-and-forget: el registro en Supabase es un side effect, nunca un gate.
      // Si falla o tarda, WhatsApp se abre igual, con el mismo timing de siempre.
      postLead(payload).catch(() => {});

      const date = dateValue
        ? new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${dateValue}T00:00:00Z`))
        : "a definir";

      const message = [
        "Hola MPM 👋 Quisiera consultar disponibilidad.",
        "",
        `Nombre: ${name}`,
        `Grupo: ${guests}`,
        `Fecha estimada: ${date}`,
        `Mi contacto: ${contact}`,
        "",
        "Vi la web de Las Grutas todo el año."
      ].join("\n");

      showToast();
      setTimeout(() => window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer"), 220);
      return;
    }

    // channel === "email": acá sí esperamos la respuesta, no hay fallback client-side.
    setLoading(submitBtn, true);
    try {
      const response = await postLead(payload);
      const result = await response.json();
      if (result.ok) {
        showFormFeedback(
          form,
          result.emailSent
            ? "¡Listo! Te vamos a responder por email a la brevedad."
            : "Recibimos tu consulta. El mail tardó en salir, pero ya la tenemos anotada.",
          "success"
        );
        form.reset();
        resetChannelToggle();
      } else {
        showFormFeedback(form, result.message || "No pudimos enviar tu consulta. Probá por WhatsApp.", "error");
      }
    } catch (_) {
      showFormFeedback(form, "No pudimos conectar. Probá escribirnos directo por WhatsApp.", "error");
    } finally {
      setLoading(submitBtn, false);
    }
  });
});

const lightbox = document.querySelector(".lightbox");
const lightboxImage = lightbox.querySelector("img");
const lightboxCaption = lightbox.querySelector("p");

document.querySelectorAll(".gallery-card").forEach((card) => {
  card.addEventListener("click", () => {
    lightboxImage.src = card.dataset.image;
    lightboxImage.alt = card.dataset.alt;
    lightboxCaption.textContent = card.dataset.alt;
    lightbox.showModal();
    document.body.classList.add("lightbox-open");
  });
});

function closeLightbox() {
  lightbox.close();
  document.body.classList.remove("lightbox-open");
}
lightbox.querySelector(".lightbox__close").addEventListener("click", closeLightbox);
lightbox.addEventListener("click", (event) => {
  const box = lightbox.getBoundingClientRect();
  const outside = event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom;
  if (outside) closeLightbox();
});
lightbox.addEventListener("close", () => document.body.classList.remove("lightbox-open"));
