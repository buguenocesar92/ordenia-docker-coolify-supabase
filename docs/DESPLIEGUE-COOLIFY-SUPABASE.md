# Despliegue de Ordenia: Coolify + Supabase self-hosted

Leyenda: 👤 = solo César puede hacerlo (cuentas, pegar secretos, Meta). Nada de secretos en el repo ni en el chat.

## Estado previo

Coolify **todavía no está instalado** en Contabo. Su instalación, el Caddy del borde y la VPN van antes de todo
esto: ver `~/Dev/infra-contabo-dominio/docs/lista-produccion-hefesto.md` (sección 2, Coolify, y sección 5, Supabase).
Hasta que eso esté hecho, los pasos de abajo no se pueden ejecutar.

## Orden

1. 👤 **Supabase self-hosted en Coolify (one-click).** Coolify > New Resource > Supabase. Definir los FQDN de
   Kong y Studio, SMTP para Auth y persistencia de volúmenes. Guardar las claves generadas en Vaultwarden.
2. 👤 **Auth en Supabase.** Site URL = `https://<dominio-ordenia>`; Redirect URLs: `/auth/confirm` y
   `/auth/confirm?next=/reset-password`; confirmación de email activada; plantillas con `token_hash`
   (ver `GUIA-COOLIFY-SUPABASE.md` §1).
3. 👤 **Variables.** Partir de `.env.example` (nunca crear un `.env` en el repo). Pegarlas en Coolify >
   Environment Variables:
   - `APP_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (publishable/anon, **nunca** `service_role`).
   - `DATABASE_URL` (+ `DATABASE_SSL=false` solo si la conexión es interna y privada a Supabase self-hosted).
   - `N8N_INGEST_TOKEN`: generar con `openssl rand -hex 32`.
   - WhatsApp (solo cuando Meta esté listo): `META_APP_SECRET`, `META_VERIFY_TOKEN`, `META_ACCESS_TOKEN`,
     `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ASSISTANT_NUMBER`.
4. 👤 **App Docker Compose en Coolify.** New Resource > Docker Compose desde el repo; archivo
   `docker-compose.yml` (o `docker-compose.coolify-whatsapp.yml` si se activa WhatsApp).
   Atención: el servicio `migrate` aplica la migración 001 automáticamente contra `DATABASE_URL` en cada despliegue.
   Revisar `supabase/migrations/001_ordenia.sql` antes del primer despliegue.
5. 👤 **Dominio con puerto interno 3000.** En el servicio `web`, dominio `https://<dominio-ordenia>:3000`
   (el `:3000` es el puerto interno al que apunta el proxy, no se publica al host). Los compose usan `expose`, no `ports`.
6. 👤 **Meta (opcional, después).** Webhook `https://<dominio-webhook>/webhooks/whatsapp` con el verify token del paso 3.
   El servicio `whatsapp` expone el 8789 interno.
7. **Comprobación.** `curl -fsS https://<dominio-ordenia>/api/health` debe responder `{"ok":true}`
   (503 = la app no llega a la base). Luego 👤 crear dos cuentas y verificar que cada una ve solo sus datos.
