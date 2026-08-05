# Complejo MPM — Landing page

Landing responsive para **Complejo MPM, Las Grutas**, enfocada en consultas directas y conversión por WhatsApp.

## Ver localmente

```bash
python3 -m http.server 4173
```

Abrir `http://localhost:4173`.

## Captura de consultas

Los dos formularios validan nombre, cantidad de huéspedes y contacto. Al enviar, arman un mensaje con los datos y abren WhatsApp al **+54 9 11 4475-1508**. No necesita backend para esta primera versión.

Cuando se implemente automatización de email, se puede reemplazar este envío por un endpoint de CRM sin cambiar el diseño.
