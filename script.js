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

const GALLERY_BASE = "/public/images/galeria/";

const GALLERY_PHOTOS = [
  { category: "frente", file: "frente-01-acceso.webp", caption: "Acceso al complejo", alt: "Entrada del complejo MPM desde la calle, con el portón corredizo abierto y la cochera techada al fondo." },
  { category: "frente", file: "frente-02-fachada.webp", caption: "Fachada del complejo", alt: "Fachada color terracota del Complejo MPM vista desde la vereda." },
  { category: "frente", file: "frente-03-unidades.webp", caption: "Frente del departamento", alt: "Frente de uno de los departamentos, con puerta numerada, aire acondicionado y ventana enrejada." },
  { category: "frente", file: "frente-04-entrada-depto.webp", caption: "Entrada a un departamento", alt: "Entrada a uno de los departamentos, pared terracota y senda de piedras." },
  { category: "frente", file: "frente-05-pasillo.webp", caption: "Pasillo de acceso", alt: "Pasillo lateral exterior con piso de piedra que lleva hasta el portón del complejo." },

  { category: "cochera", file: "cochera-01-playon.webp", caption: "Cochera cubierta", alt: "Cochera cubierta para cada uno de los departamentos, con piso de piedra." },
  { category: "cochera", file: "cochera-02-pasillo.webp", caption: "Acceso a las unidades", alt: "Pasillo de la cochera techada con las puertas numeradas de los departamentos." },
  { category: "cochera", file: "cochera-03-vista-completa.webp", caption: "Cochera para todos", alt: "Vista completa de la cochera techada, cubierta para todos los departamentos." },
  { category: "cochera", file: "cochera-04-auto.webp", caption: "Lugar cubierto para tu auto", alt: "Cochera cubierta con un auto estacionado bajo techo." },
  { category: "cochera", file: "cochera-05-varios-autos.webp", caption: "Cochera techada", alt: "Cochera techada con varios autos estacionados frente a los departamentos." },

  { category: "dormitorio", file: "dormitorio-01.webp", caption: "Dormitorio con TV", alt: "Dormitorio con ventilador de pared y TV sobre una cómoda de madera." },
  { category: "dormitorio", file: "dormitorio-03-camas.webp", caption: "Habitación con dos camas", alt: "Habitación con dos camas individuales, cortinas verdes y estufa, ideal para grupos." },
  { category: "dormitorio", file: "dormitorio-04.webp", caption: "Dormitorio matrimonial", alt: "Dormitorio matrimonial con acolchado a cuadros y cuadro decorativo." },
  { category: "dormitorio", file: "dormitorio-05.webp", caption: "Dormitorio", alt: "Dormitorio con pared turquesa y camas con acolchado bordó." },
  { category: "dormitorio", file: "dormitorio-06.webp", caption: "Dormitorio", alt: "Dormitorio con cama a cuadros celestes y mesa de luz con lámpara." },
  { category: "dormitorio", file: "dormitorio-07-matrimonial.webp", caption: "Dormitorio matrimonial", alt: "Dormitorio con cama doble, dos mesas de luz y lámparas." },

  { category: "cocina", file: "cocina-01-integrada.webp", caption: "Cocina y comedor integrados", alt: "Cocina, comedor y cucheta comparten un mismo ambiente luminoso." },
  { category: "cocina", file: "cocina-02-equipada.webp", caption: "Cocina equipada", alt: "Cocina equipada con heladera, TV, microondas y dispenser de agua." },
  { category: "cocina", file: "cocina-03-alacena.webp", caption: "Cocina", alt: "Cocina con alacena de madera y mesada de granito." },
  { category: "cocina", file: "cocina-04-anafe.webp", caption: "Cocina con anafe", alt: "Cocina con anafe a gas, bacha doble y dispenser de agua." },
  { category: "cocina", file: "cocina-05-heladera-tv.webp", caption: "Cocina", alt: "Heladera con TV y muebles de cocina de madera." },

  { category: "bano", file: "bano-01-completo.webp", caption: "Baño completo", alt: "Baño completo con bidet, inodoro, bacha y ducha con cortina floreada." },
  { category: "bano", file: "bano-03.webp", caption: "Baño", alt: "Baño con azulejos celestes y ducha con cortina." },
  { category: "bano", file: "bano-04-servicio.webp", caption: "Baño de servicio", alt: "Baño de servicio con inodoro y bidet." },
  { category: "bano", file: "bano-05.webp", caption: "Baño", alt: "Bacha y botiquín con espejo." },

  { category: "living", file: "living-01.webp", caption: "Living comedor", alt: "Living comedor con mesa y sofá cama." },
  { category: "living", file: "living-02-estar.webp", caption: "Estar", alt: "Galería de estar con mesa alta tipo bar." },
  { category: "living", file: "living-03-comedor.webp", caption: "Comedor", alt: "Comedor con heladera, TV y pared celeste." },
  { category: "living", file: "living-04.webp", caption: "Comedor y cocina", alt: "Comedor integrado a la cocina con pasillo hacia el exterior." },
  { category: "living", file: "living-05.webp", caption: "Comedor", alt: "Comedor con mesa y sillas de madera, puerta hacia la calle." },
  { category: "living", file: "living-06.webp", caption: "Living", alt: "Living con sommier junto a la ventana." },

  { category: "patio", file: "patio-01.webp", caption: "Patio", alt: "Patio con mesa y sillas junto a la parrilla." },
  { category: "patio", file: "patio-02.webp", caption: "Patio", alt: "Patio con mesa y cuatro sillas." },
  { category: "patio", file: "patio-03-tendedero.webp", caption: "Parrilla y tendedero", alt: "Parrilla de ladrillo con tendedero en el patio." },
  { category: "patio", file: "patio-04-parrilla.webp", caption: "Parrilla", alt: "Parrilla de ladrillo lista para usar." },
  { category: "patio", file: "patio-05-lavadero.webp", caption: "Patio con lavadero", alt: "Patio con pileta lavadero, tendedero y parrilla." },
  { category: "patio", file: "patio-06-galeria.webp", caption: "Galería cubierta", alt: "Galería cubierta con mesa para seis personas." },
  { category: "patio", file: "patio-07.webp", caption: "Patio y parrilla", alt: "Patio con mesa, sillas y la parrilla de fondo." },

  { category: "entorno", file: "entorno-01-acantilado.webp", caption: "Acantilados", alt: "Vista aérea de los acantilados y la costa de Las Grutas." },
  { category: "entorno", file: "entorno-02-luna.webp", caption: "Luna sobre el mar", alt: "Luna llena reflejada en el mar de Las Grutas." },
  { category: "entorno", file: "entorno-03-cartel.webp", caption: "Las Grutas", alt: "Cartel de Las Grutas con el mar de fondo." },
  { category: "entorno", file: "entorno-04-atardecer.webp", caption: "Atardecer", alt: "Cartel de Las Grutas al atardecer." },
];

// Selección curada para la solapa "Todas": un representante por ambiente clave.
// El primero queda como foto grande (hero) del mosaico.
const FEATURED_ALL = ["frente-02-fachada.webp", "cochera-01-playon.webp", "dormitorio-04.webp", "cocina-01-integrada.webp", "patio-04-parrilla.webp"];

const MOSAIC_SIZE = 5;
const mosaic = document.getElementById("galeria-mosaic");
const galleryFilters = document.querySelectorAll(".gallery-filter");

let currentList = [];
let currentIndex = 0;

function photosForFilter(filter) {
  if (filter === "all") {
    const featuredSet = new Set(FEATURED_ALL);
    const featured = FEATURED_ALL.map((file) => GALLERY_PHOTOS.find((p) => p.file === file)).filter(Boolean);
    const rest = GALLERY_PHOTOS.filter((p) => !featuredSet.has(p.file));
    return featured.concat(rest);
  }
  return GALLERY_PHOTOS.filter((p) => p.category === filter);
}

function renderMosaic(filter) {
  const list = photosForFilter(filter);
  currentList = list;

  const visibleCount = Math.min(MOSAIC_SIZE, list.length);
  const extra = list.length - visibleCount;
  const useHero = visibleCount >= 5;

  mosaic.innerHTML = "";
  mosaic.classList.toggle("gallery-mosaic--quad", !useHero);

  list.slice(0, visibleCount).forEach((photo, index) => {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "mosaic-tile" + (index === 0 && useHero ? " mosaic-tile--hero" : "");

    const img = document.createElement("img");
    img.src = GALLERY_BASE + photo.file;
    img.alt = photo.alt;
    img.loading = "lazy";
    tile.appendChild(img);

    if (index === visibleCount - 1 && extra > 0) {
      const overlay = document.createElement("div");
      overlay.className = "mosaic-tile__overlay";
      overlay.textContent = `+${extra} foto${extra === 1 ? "" : "s"}`;
      tile.appendChild(overlay);
    } else {
      const label = document.createElement("span");
      label.textContent = photo.caption;
      tile.appendChild(label);
    }

    tile.addEventListener("click", () => openLightbox(index));
    mosaic.appendChild(tile);
  });
}

galleryFilters.forEach((filterButton) => {
  filterButton.addEventListener("click", () => {
    galleryFilters.forEach((button) => button.classList.remove("is-active"));
    filterButton.classList.add("is-active");
    renderMosaic(filterButton.dataset.filter);
  });
});

renderMosaic("all");

const lightbox = document.querySelector(".lightbox");
const lightboxImage = lightbox.querySelector("img");
const lightboxCaption = lightbox.querySelector("p");
const lightboxCounter = lightbox.querySelector(".lightbox__counter");

function updateLightbox() {
  const photo = currentList[currentIndex];
  lightboxImage.src = GALLERY_BASE + photo.file;
  lightboxImage.alt = photo.alt;
  lightboxCaption.textContent = photo.alt;
  lightboxCounter.textContent = `${currentIndex + 1} / ${currentList.length}`;
}

function openLightbox(index) {
  currentIndex = index;
  updateLightbox();
  lightbox.showModal();
  document.body.classList.add("lightbox-open");
}

function showNext() {
  currentIndex = (currentIndex + 1) % currentList.length;
  updateLightbox();
}
function showPrev() {
  currentIndex = (currentIndex - 1 + currentList.length) % currentList.length;
  updateLightbox();
}

function closeLightbox() {
  lightbox.close();
  document.body.classList.remove("lightbox-open");
}
lightbox.querySelector(".lightbox__close").addEventListener("click", closeLightbox);
lightbox.querySelector(".lightbox__nav--next").addEventListener("click", showNext);
lightbox.querySelector(".lightbox__nav--prev").addEventListener("click", showPrev);
lightbox.addEventListener("keydown", (event) => {
  if (event.key === "ArrowRight") showNext();
  if (event.key === "ArrowLeft") showPrev();
});
lightbox.addEventListener("click", (event) => {
  const box = lightbox.getBoundingClientRect();
  const outside = event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom;
  if (outside) closeLightbox();
});
lightbox.addEventListener("close", () => document.body.classList.remove("lightbox-open"));
