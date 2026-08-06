# Complejo MPM — Landing page

Landing responsive para **Complejo MPM, Las Grutas**, enfocada en consultas directas y conversión por WhatsApp.

## Ver localmente

```bash
python3 -m http.server 4173
```

Abrir `http://localhost:4173`.

## Build de producción

```bash
npm run build
```

El sitio compilado queda en `dist/` y esa es la carpeta publicada por Vercel.

## Consultas: WhatsApp y Email

El formulario principal (hero, `#consultar`) tiene dos canales: **WhatsApp** (default) y **Email**, elegibles con el toggle sobre el formulario. El formulario del pie de página (`#consultar-final`) mantiene solo WhatsApp.

- **WhatsApp**: valida en el navegador, abre `wa.me` con el mensaje armado (comportamiento sin cambios) y, en paralelo, guarda la consulta en Supabase vía `/api/leads` sin bloquear ni demorar la apertura de WhatsApp.
- **Email**: valida en el navegador, espera la respuesta de `/api/leads`, que guarda la consulta en Supabase y envía una notificación real al dueño vía Resend. Si el mail falla pero el guardado funciona, igual se avisa éxito al visitante — la consulta queda registrada de todas formas.

Cada consulta queda en la tabla `leads` de Supabase con estado `nuevo`/`contactado`, así el registro no depende de que el visitante confirme el envío desde su dispositivo.

### Backend

`api/leads.js` es una función serverless de Vercel (Node, sin dependencias npm — usa `fetch` nativo contra las REST API de Supabase y Resend). El esquema de la tabla está en `supabase/schema.sql` (se corre una vez a mano en el SQL editor del proyecto de Supabase).

Variables de entorno necesarias en Vercel (Project Settings → Environment Variables), ver `.env.example`: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `RESEND_API_KEY`, `OWNER_EMAIL`.

Mientras el dominio propio (`mpmalquileres.com.ar`) no esté verificado en Resend, el canal Email corre en modo sandbox: los mails salen de `onboarding@resend.dev` y solo pueden entregarse a la casilla registrada como dueña de la cuenta de Resend — `OWNER_EMAIL` tiene que ser esa misma casilla.

### Desarrollo local

Para probar solo estilos/maquetado: `python3 -m http.server 4173` (el canal Email no funciona así, no hay `/api`).

Para probar el flujo completo: `vercel dev`, con un `.env.local` basado en `.env.example` apuntando a un proyecto Supabase real y una cuenta Resend.

### Mantenimiento de Supabase

El plan free de Supabase pausa el proyecto tras 7 días sin actividad de API. `.github/workflows/keep-supabase-awake.yml` corre dos veces por semana (lunes y jueves) para mantenerlo despierto — necesita `SUPABASE_URL` y `SUPABASE_ANON_KEY` cargados como secrets del repo en GitHub.
