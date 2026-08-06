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

## Panel de administración (`/admin`)

Pantalla privada para ver las consultas (marcar como "contactado") y las visitas del sitio (con desglose estimado de origen: búsqueda orgánica, IA/asistentes, ads, redes, referidos, directo).

- **Login**: contraseña única compartida (no hay cuentas individuales) — la protección real no es la URL (es un sitio estático, cualquier ruta es pública a nivel red), sino que sin sesión válida no hay datos: tanto las policies RLS de Supabase como `/api/admin-analytics` rechazan cualquier pedido sin un token de sesión vigente.
- **Leads**: `admin/app.js` habla directo con la REST API de Supabase (mismo patrón que el resto del sitio, sin SDK), autenticado con el token de sesión. El rol `authenticated` solo puede leer todas las filas y actualizar la columna `status` — nunca `name`/`contact`/`message`, reforzado con un `grant` de columna en Postgres, no solo con lógica de la app.
- **Visitas**: requiere tener activado **Vercel Web Analytics** en el proyecto (Project Settings → Analytics) y el snippet `<script defer src="/_vercel/insights/script.js">` ya agregado en `index.html`. `api/admin-analytics.js` consulta la Web Analytics API de Vercel server-side con `VERCEL_API_TOKEN` (nunca expuesto al cliente) y categoriza el origen con una heurística simple sobre `referrerHostname`/UTM — es un estimado, no un dato exacto, y así se lo muestra en la UI.

### Configuración manual (una sola vez)

1. Activar Web Analytics en Vercel (Project Settings → Analytics).
2. Generar un token de Vercel scopeado al proyecto, con expiración, y cargarlo como `VERCEL_API_TOKEN` en las env vars de Vercel.
3. Fijar el timeout de sesión de Supabase Auth (Authentication → Sessions) — la sesión del panel persiste en `localStorage`, no en `sessionStorage`.
4. Correr la sección de grants/policies para `authenticated` en `supabase/schema.sql` en el SQL editor de Supabase (una sola vez, igual que el resto del schema).

La cuenta compartida de login se crea una sola vez vía el Admin API de Supabase (`service_role` key), no por el flujo normal de signup.
