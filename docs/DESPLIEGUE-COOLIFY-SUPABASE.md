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
   Las migraciones **no se aplican solas**: el servicio `migrate` está bajo `profiles: ["migrate"]` y `web` no depende
   de él, así que ni `docker compose up` ni un despliegue de Coolify lo ejecutan. Ver "Migraciones (manual)" abajo.
5. 👤 **Dominio con puerto interno 3000.** En el servicio `web`, dominio `https://<dominio-ordenia>:3000`
   (el `:3000` es el puerto interno al que apunta el proxy, no se publica al host). Los compose usan `expose`, no `ports`.
6. 👤 **Meta (opcional, después).** Webhook `https://<dominio-webhook>/webhooks/whatsapp` con el verify token del paso 3.
   El servicio `whatsapp` expone el 8789 interno.
7. **Comprobación.** `curl -fsS https://<dominio-ordenia>/api/health` debe responder un JSON con las claves
   `ok`, `version`, `uptime_s` y `db` (por ejemplo `{"ok":true,"version":"1.0.0","uptime_s":12,"db":"up"}`).
   No se exige el cuerpo literal `{"ok":true}`: la respuesta lleva más campos.
   (503 = la app no llega a la base). Luego 👤 crear dos cuentas y verificar que cada una ve solo sus datos.

## Migraciones (manual, nunca automáticas en producción)

Regla: nada toca el esquema de producción sin que una persona haya leído el SQL antes.

> **Orden obligatorio:** `002_ordenia_rls.sql` debe estar aplicada **antes** de desplegar este código.
> `/api/ingest` resuelve el titular del mensaje con las funciones `ordenia.usuario_por_telefono_verificado`
> y `ordenia.enlace_por_codigo`, que crea `002`. Sin ellas, la ruta responde 500 y **todo** mensaje de
> WhatsApp se pierde.
>
> **Con qué rol se aplica `002`:** la migración usa `FORCE ROW LEVEL SECURITY`, así que las tablas quedan
> sujetas a sus políticas incluso para su dueño. Las funciones `SECURITY DEFINER` se ejecutan con los
> privilegios de **su** dueño: si ese dueño es superusuario o tiene `BYPASSRLS`, saltan las políticas;
> si es un rol normal, las propias funciones quedan sujetas a RLS y, como dentro no hay `app.user_id`
> fijado, la política no se cumple y devuelven vacío (el webhook deja de resolver el titular).
> Comprobar el rol que aplica la migración antes de aplicarla.

1. 👤 Hacer respaldo de la base (y comprobar que se puede restaurar).
2. 👤 Leer `supabase/migrations/*.sql` (hoy `001_ordenia.sql` y `002_ordenia_rls.sql`). Las incluidas no
   eliminan tablas; las futuras hay que revisarlas igual. `scripts/migrate.mjs` registra lo aplicado en
   `ordenia.migrations`, así que repetirlo no duplica.
3. 👤 Aplicar a mano, con una de estas dos vías:
   - Dejando que el script lo haga, solo tras revisar: desde el servidor con el repo desplegado,
     `docker compose --profile migrate run --rm migrate` (usa `DATABASE_URL` y `DATABASE_SSL` del entorno).
     En Coolify, abrir la terminal del recurso o hacerlo por SSH en el host; no añadir `migrate` como servicio de despliegue.
   - O ejecutando el SQL revisado con `psql` contra la base, con una URL de administración que no se guarde en el repo.
4. Desplegar/reiniciar `web` y comprobar `/api/health`.

Se validó con `docker compose config` que `migrate` solo aparece con `--profile migrate`. No se probó cómo trata
Coolify los perfiles de Compose: tras el primer despliegue, confirmar que no levantó `migrate`.
