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

document.querySelectorAll(".js-lead-form").forEach((form) => {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const data = new FormData(form);
    const name = data.get("name");
    const guests = data.get("guests") || "a definir";
    const dateValue = data.get("date");
    const contact = data.get("contact");
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

    try {
      const lead = { name, guests, date: dateValue || "", contact, createdAt: new Date().toISOString() };
      const leads = JSON.parse(localStorage.getItem("mpm_consultas") || "[]");
      localStorage.setItem("mpm_consultas", JSON.stringify([...leads.slice(-9), lead]));
    } catch (_) {
      // WhatsApp remains the source of truth if private browsing blocks storage.
    }

    showToast();
    setTimeout(() => window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer"), 220);
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
