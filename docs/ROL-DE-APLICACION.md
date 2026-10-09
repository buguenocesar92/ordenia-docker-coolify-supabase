# Rol de base de datos para la aplicación (propuesta, NO ejecutada)

Estado actual: `DATABASE_URL` usa el rol administrador `postgres` de Supabase para todo (web y migraciones). Si la web
sufre una inyección SQL o se filtra esa URL, el atacante tiene control total de la instancia, no solo de `ordenia`.
Este documento solo **propone** el SQL; nadie debe ejecutarlo sin revisarlo y sin respaldo. No se cambió ningún rol.

## Qué necesita la web (según `app/` y `db/schema.ts`)

| Tabla | Operaciones que usa el código |
|---|---|
| `ordenia.entries` | SELECT, INSERT, UPDATE, DELETE |
| `ordenia.rules` | SELECT, INSERT, UPDATE (upsert), DELETE |
| `ordenia.connections` | SELECT, INSERT, UPDATE (upsert) |
| `ordenia.deliveries` | SELECT, INSERT |

No necesita DDL, ni `ordenia.migrations`, ni otros esquemas. Las migraciones y `scripts/import-sites.mjs` siguen con
un rol administrador, usado solo a mano (ver `docs/DESPLIEGUE-COOLIFY-SUPABASE.md`, «Migraciones»).

## SQL propuesto (ejecutar como administrador, tras revisar)

```sql
-- 1. Rol sin privilegios heredados. Poner la contraseña con un generador y guardarla en Vaultwarden;
--    NO escribirla en este repo. NOBYPASSRLS es el valor por defecto, se deja explícito.
CREATE ROLE ordenia_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS
  PASSWORD '<generada-fuera-del-repo>' CONNECTION LIMIT 20;

-- 2. Solo el esquema ordenia.
GRANT CONNECT ON DATABASE postgres TO ordenia_app;
GRANT USAGE ON SCHEMA ordenia TO ordenia_app;

-- 3. Mínimo privilegio por tabla.
GRANT SELECT, INSERT, UPDATE, DELETE ON ordenia.entries     TO ordenia_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ordenia.rules       TO ordenia_app;
GRANT SELECT, INSERT, UPDATE         ON ordenia.connections TO ordenia_app;
GRANT SELECT, INSERT                 ON ordenia.deliveries  TO ordenia_app;

-- 4. RLS. La migración activa RLS en las 4 tablas SIN políticas: el dueño/administrador la salta, pero un rol
--    no propietario como ordenia_app vería 0 filas. Hacen falta políticas explícitas:
CREATE POLICY app_all ON ordenia.entries     FOR ALL TO ordenia_app USING (true) WITH CHECK (true);
CREATE POLICY app_all ON ordenia.rules       FOR ALL TO ordenia_app USING (true) WITH CHECK (true);
CREATE POLICY app_all ON ordenia.connections FOR ALL TO ordenia_app USING (true) WITH CHECK (true);
CREATE POLICY app_all ON ordenia.deliveries  FOR ALL TO ordenia_app USING (true) WITH CHECK (true);
```

## Límites honestos de esta propuesta

- Las políticas `USING (true)` **no aíslan usuarios**: el aislamiento por `user_id` sigue en el código de la app
  (todas las consultas filtran por `userId`). Lo que se gana es que una URL filtrada o una SQLi ya no permite DDL, leer
  otros esquemas (p. ej. `auth.users`), crear roles ni `COPY ... PROGRAM`. Para aislar de verdad en la base habría
  que fijar `SET LOCAL app.user_id` por transacción y escribir políticas `USING (user_id = current_setting('app.user_id'))`;
  es un cambio de código mayor y no se hizo.
- Probar primero en una base de pruebas: levantar la app con `DATABASE_URL` del rol `ordenia_app` y recorrer crear nota,
  mover, borrar, vincular WhatsApp y `/api/health`. Ninguna de estas pruebas se ha corrido (no hay base disponible aquí).
- El usuario `ordenia_app` no puede ejecutar `scripts/migrate.mjs` (necesita CREATE); es lo esperado.
- Con Supabase self-hosted, `DATABASE_URL` debe apuntar al pooler/puerto que acepte el rol nuevo; verificar.
- Reversión: `REVOKE ALL ON ALL TABLES IN SCHEMA ordenia FROM ordenia_app; DROP OWNED BY ordenia_app; DROP ROLE ordenia_app;`
  y volver al `DATABASE_URL` anterior.
