# Ordenia: Docker + Coolify + Supabase

Versión portable del panel de Ordenia. Usa Next.js en Node, PostgreSQL de Supabase y Supabase Auth. El login ya no depende de ChatGPT ni el almacenamiento de Cloudflare D1. El sitio original sigue disponible y esta descarga no lo modifica.

## Qué incluye

- Panel actual: notas, tareas, eventos, compras, categorías automáticas y reglas personales.
- Registro, inicio de sesión, confirmación de correo, recuperación y cierre de sesión con Supabase.
- PostgreSQL: esquema `ordenia`, migración inicial y registro de migraciones.
- Dockerfile con salida standalone, Compose para Coolify y comprobaciones de salud.
- Receptor oficial de WhatsApp: verificación GET, firma HMAC de los mensajes POST, asociación del remitente al usuario y confirmación de guardado.
- Conexión opcional a n8n para clasificación con IA y transcripción de audios.
- Conector Bitwarden opcional. No está activado ni incluye sesiones de bóvedas.
- Importador transaccional de datos exportados desde Sites.

No incluye credenciales reales, una copia de los registros actuales de Sites ni usuarios precreados. Las cuentas, integraciones y Supabase se configuran en tu servidor.

## 1. Preparar Supabase

Puedes usar Supabase Cloud o una instalación Supabase existente en Coolify. El paquete no instala toda la infraestructura Supabase. Si lo autoalojas, despliega primero el servicio oficial Supabase y configura sus dominios, Auth, SMTP y almacenamiento persistente.

En Supabase crea el proyecto y conserva la contraseña de PostgreSQL en tu gestor de secretos.

Desde el diálogo **Connect** obtén:

1. **Project URL** → `SUPABASE_URL`.
2. **Publishable key** → `SUPABASE_PUBLISHABLE_KEY`. También acepta la clave `anon` de proyectos antiguos. No uses `service_role` aquí.
3. **Session pooler** → `DATABASE_URL`. La conexión suele usar puerto 5432. Copia el host y usuario reales; no inventes el host. Codifica caracteres especiales de la contraseña como parte de la URL.

En Supabase Cloud usa `DATABASE_SSL=true`; el cliente verifica el certificado TLS. No desactives la verificación para ocultar un error de certificados. Para Supabase autoalojado, puedes usar `DATABASE_SSL=false` solo con una conexión privada interna sin TLS; nunca expongas ese PostgreSQL sin cifrado a Internet.

La migración necesita crear el esquema y tablas. La URL administrativa `postgres` que suministra Supabase puede hacerlo. El esquema no se expone en la Data API y no concede acceso a `anon` ni `authenticated`. El servidor accede por PostgreSQL y aplica el filtro por usuario en todas las operaciones. RLS se habilita sin políticas públicas; la conexión administrativa evita RLS, así que este aislamiento depende de la validación de sesión y filtros del servidor. No distribuyas `DATABASE_URL` a clientes ni n8n. Para una producción más exigente separa la conexión de migraciones del rol de aplicación con permisos limitados.

En **Authentication → URL Configuration** configura:

- Site URL: `https://ordenia.tudominio.cl`
- Redirect URLs: `https://ordenia.tudominio.cl/auth/confirm` y `https://ordenia.tudominio.cl/auth/confirm?next=/reset-password`

Configura también SMTP para entregar confirmaciones y recuperación de contraseña. Activa confirmación de email y un mínimo de 8 caracteres. Supabase aplica sus límites de autenticación; la app no incluye CAPTCHA.

Para una confirmación SSR estable, usa en la plantilla de confirmación un enlace como:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Confirmar correo</a>
```

Y en recuperación:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password">Cambiar contraseña</a>
```

El endpoint también acepta el flujo PKCE `code`. Las plantillas con token hash permiten abrir el enlace desde otro navegador.

## 2. Variables de entorno

Copia `.env.example` a `.env` para pruebas locales. En Coolify carga los mismos valores en **Environment Variables**. No subas `.env` al repositorio.

| Variable | Dónde obtenerla / uso |
|---|---|
| `APP_URL` | Dominio HTTPS público de Ordenia, sin barra final. Debe coincidir con el dominio de Coolify y Supabase Auth. |
| `SUPABASE_URL` | Supabase Connect → Project URL. Se usa en el servidor. |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase Connect → publishable key, o anon legacy. |
| `DATABASE_URL` | Supabase Connect → Session pooler; secreto administrativo. |
| `DATABASE_SSL` | `true` para Supabase Cloud; configuración de la red privada para autoalojado. |
| `TZ` | `America/Santiago`. |
| `N8N_INGEST_TOKEN` | Secreto propio compartido por web y gateway; pese al nombre, protege `/api/ingest`. |
| `WHATSAPP_ASSISTANT_NUMBER` | Número remitente del asistente con código de país y solo dígitos. Vacío hasta activar WhatsApp. |
| `N8N_CLASSIFY_URL` | URL de producción del webhook n8n de clasificación. Opcional. |
| `N8N_CLASSIFY_TOKEN` | Bearer token que el webhook n8n debe exigir. Opcional. |
| `BITWARDEN_BRIDGE_URL` | URL interna del bridge autorizado. Opcional. |
| `BITWARDEN_BRIDGE_TOKEN` | Secreto del bridge. Opcional. |
| `META_APP_SECRET` | Meta → Configuración de la app → Básica → Clave secreta. |
| `META_VERIFY_TOKEN` | Secreto generado por ti, igual al campo Token de verificación de Meta. |
| `META_ACCESS_TOKEN` | Token de Meta autorizado para el número del asistente; usa credenciales de producción, no el token temporal. |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta → configuración de WhatsApp → Phone Number ID; no es el número telefónico. |
| `WHATSAPP_GRAPH_VERSION` | Versión Graph configurada para tu app. Ejemplo inicial `v25.0`; comprueba compatibilidad en Meta. |
| `AUDIO_TRANSCRIBE_URL` | Webhook n8n de producción que transcribe el archivo recibido. Opcional. |
| `AUDIO_TRANSCRIBE_TOKEN` | Bearer token de ese webhook. Opcional. |

Genera secretos diferentes para ingestión, verificación Meta, clasificación y bridge:

```bash
openssl rand -hex 32
```

Las variables se leen en ejecución; no se necesitan secretos como argumentos del build ni claves `NEXT_PUBLIC_*`. El paquete no usa la clave Supabase `service_role`.

## 3. Desplegar la web en Coolify

1. Descomprime el ZIP. Sube el contenido a tu repositorio privado, incluyendo `package-lock.json`, Dockerfile y Compose. Excluye secretos y exportaciones.
2. En Coolify crea una aplicación desde ese repositorio y elige **Docker Compose**.
3. Selecciona `/docker-compose.yml` como archivo Compose.
4. Rellena las variables obligatorias: `APP_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `DATABASE_URL`, `DATABASE_SSL`, `N8N_INGEST_TOKEN` y `TZ`.
5. Configura el dominio de **web** hacia su puerto interno **3000**, por ejemplo `https://ordenia.tudominio.cl:3000` cuando Coolify pida el puerto en el campo de dominio. El puerto no aparece en la URL pública final. No asignes dominio al servicio `migrate`.
6. Despliega. `migrate` termina con código 0 al aplicar la migración; la web espera su finalización. Las migraciones ya aplicadas se omiten.
7. Comprueba `https://ordenia.tudominio.cl/api/health`; debe responder `{"ok":true}`. Luego abre `/login`.
8. Crea tu cuenta, confirma el correo e inicia sesión. Guarda una nota y recarga para verificar persistencia.

Si Coolify no permite elegir varios archivos Compose para WhatsApp, usa el archivo combinado `docker-compose.coolify-whatsapp.yml` incluido. No añadas WhatsApp antes de completar sus credenciales, porque el receptor necesita esos valores para arrancar.

Coolify administra el proxy HTTPS; esta aplicación no publica los puertos 3000/8789 en todas las interfaces. La base de datos vive fuera del contenedor web, en Supabase. No necesitas un volumen de datos para la web. El servicio de migración terminado es normal.

## 4. Prueba local con Docker

```bash
cp .env.example .env
# Editar .env con las credenciales del proyecto Supabase.
# APP_URL=http://localhost:3000; añadir esta URL al Auth de tu proyecto de prueba.
docker compose -f docker-compose.yml -f docker-compose.local.yml up --build -d
```

Abre `http://localhost:3000`. Usa un proyecto Supabase de pruebas. Para diagnóstico:

```bash
docker compose logs --tail=100 migrate web
```

## 5. Conectar WhatsApp

1. Completa las variables Meta y `WHATSAPP_ASSISTANT_NUMBER`. El número personal se usa como destinatario/remitente usuario; el asistente tiene su número Business separado.
2. En Coolify cambia al Compose combinado `docker-compose.coolify-whatsapp.yml` y despliega.
3. Asigna al servicio **whatsapp** un dominio HTTPS, por ejemplo `https://whatsapp.ordenia.tudominio.cl:8789`.
4. En Meta configura la URL de devolución de llamada: `https://whatsapp.ordenia.tudominio.cl/webhooks/whatsapp`.
5. Pon como Token de verificación el valor de `META_VERIFY_TOKEN`; no el token de acceso. Pulsa Verificar y guardar.
6. Suscribe el campo `messages` de WhatsApp y la app a la cuenta WABA cuando Meta lo solicite. Sigue los requisitos de publicación que muestre tu panel. En el panel que vimos, las apps sin publicar solo reciben webhooks de prueba del panel: el envío de prueba por sí solo no garantiza recepción real.
7. En Ordenia → Conexiones, escribe tu número internacional y pulsa Vincular mi número.
8. Envía `VINCULAR CODIGO` desde ese número al asistente dentro de los 10 minutos.
9. Envía `hacer ejercicio`. Comprueba el guardado en el panel y la confirmación por WhatsApp.

El gateway valida la firma HMAC sobre los bytes recibidos y limita el cuerpo del webhook. Solo procesa mensajes del Phone Number ID configurado. No usa cabeceras de identidad de Sites ni requiere un token de servicio ChatGPT. Cada remitente verificado se asocia a una cuenta de Supabase.

No lee el historial del chat personal contigo mismo. Escribe o reenvía al contacto del asistente. Esta versión procesa webhooks de forma síncrona y usa deduplicación transaccional; para mucho tráfico conviene una cola persistente y una outbox de respuestas.

## 6. Conectar n8n

La web funciona sin n8n usando reglas. Para IA, crea un webhook POST de producción, actívalo y configura autenticación por cabecera `Authorization: Bearer <N8N_CLASSIFY_TOKEN>`.

Recibe:

```json
{
  "text":"Dentista el jueves a las 10",
  "now":"2026-10-09T12:00:00.000Z",
  "timezone":"America/Santiago",
  "rules":[],
  "schema":{"items":[{"kind":"event|task|shop|note","title":"string","category":"Tema / Subtema","date":"YYYY-MM-DD o vacío","time":"HH:mm o vacío","recurrence":"string o vacío"}]}
}
```

El modelo debe responder JSON estructurado y el nodo **Respond to Webhook** devolver HTTP 200:

```json
{"items":[{"kind":"task","title":"Hacer ejercicio","category":"Salud / Ejercicio","date":"","time":"","recurrence":""}]}
```

Respeta fecha actual y zona horaria, divide productos y evita inventar datos. La app valida la respuesta y vuelve a reglas si n8n falla. n8n no necesita acceso a PostgreSQL ni credenciales Supabase para este contrato.

Audios: el webhook de transcripción recibe `multipart/form-data` con campo `file`, exige su Bearer token y devuelve `{"text":"texto transcrito"}`. Configura las dos variables de audio en el gateway. El MVP limita el audio a 16 MiB y la llamada a transcripción a 30 segundos.

## 7. Bitwarden opcional

Se conserva `integrations/bitwarden-bridge.mjs` como puente CLI. Requiere un entorno que tenga la CLI oficial `bw`, perfiles aislados por usuario y sesiones desbloqueadas. No basta con indicar la URL de Vaultwarden/Bitwarden.

- `BRIDGE_TOKEN`: mismo valor que `BITWARDEN_BRIDGE_TOKEN` en la web.
- `PORT`: 8788 por defecto.
- `BW_BINARY`: ruta al ejecutable `bw`.
- `BW_USERS_JSON`: mapa privado de ID Supabase → `{ "appDataDir": "/ruta/perfil", "session": "SESION_PRIVADA" }`.

El bridge original escucha en localhost: ejecútalo con un proxy privado que pueda llegar a ese proceso o adapta su red al contenedor de tu despliegue. No se incorpora como servicio automático porque faltan autorización y sesiones individuales. Guarda sesiones en la configuración privada; nunca en Git o en este ZIP. La captura segura envía las credenciales al bridge sin guardarlas como notas ni enviarlas al modelo. La detección de textos sensibles es heurística, no reconoce cualquier contraseña arbitraria.

En Chrome usa la extensión oficial de Bitwarden, selecciona servidor autoalojado, indica tu URL e inicia sesión. Ordenia no instala ni autoriza automáticamente la extensión.

## 8. Migrar los datos actuales de Sites

Esta descarga contiene estructura y migraciones, no un volcado de tus datos actuales. Para transferirlos:

1. Exporta `entries`, `rules`, `connections` y `deliveries` desde la base D1 del sitio original en un JSON con esos cuatro arrays. Conserva los nombres de columnas originales.
2. Crea y confirma en Supabase las cuentas destino.
3. Prepara fuera de Git `user-map.json` con los IDs de usuario originales y UUIDs nuevos:

```json
{"ID_USUARIO_SITES":"UUID_USUARIO_SUPABASE"}
```

4. Con una copia privada local y `DATABASE_URL` configurada, ejecuta:

```bash
npm ci
npm run db:migrate
npm run data:import -- /ruta/privada/export.json /ruta/privada/user-map.json
```

El importador valida que las cuentas destino existen, conserva IDs de registros y falla ante conflictos en vez de sobrescribir. Toda la importación es una transacción. Las conexiones WhatsApp quedan sin verificar: cada usuario vuelve a vincular su número. Los tokens y sesiones de Bitwarden no se migran. Mantén las exportaciones en almacenamiento privado.

No cambies el dominio de producción hasta comprobar registros y aislamiento con dos cuentas. No elimines el sitio anterior hasta terminar la migración.

## 9. Copias de seguridad y actualización

- Usa las copias de seguridad de Supabase o `pg_dump` por conexión compatible para respaldar PostgreSQL. Conserva también configuración Auth/SMTP y secretos por separado.
- Si Supabase está autoalojado, respalda además sus volúmenes y configuración. El ZIP del código no es un backup de datos.
- Antes de migraciones futuras, crea backup y prueba restauración. Las migraciones incluidas no eliminan tablas.
- Sube cambios al repositorio y redepliega en Coolify. El lockfile fija dependencias. Actualiza dependencias e imagen base periódicamente con comprobaciones.

## Límites de esta versión

Calendar sigue siendo exportación manual `.ics`; no incluye OAuth Google ni sincronización directa. La frecuencia de una tarea es un dato, no un planificador de recordatorios. IA, audios y bóveda requieren configuración externa. No se ha desplegado el paquete en tu Coolify ni conectado a tu Supabase real. La validación local se registra en `VALIDACION.md`.

## Documentación oficial consultada

- https://coolify.io/docs/applications/builds/docker-compose
- https://coolify.io/docs/applications/configuration/environment-variables
- https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs
- https://supabase.com/docs/guides/database/connecting-to-postgres
- https://supabase.com/docs/guides/self-hosting/accessing-postgres
