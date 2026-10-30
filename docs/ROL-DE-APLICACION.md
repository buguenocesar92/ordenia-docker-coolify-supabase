# Rol de base de datos para la aplicacion

Estado: **el codigo y la migracion estan preparados; activarlo es una decision operativa.**

- El codigo ya fija la identidad del titular por transaccion: `db/index.ts` exporta
  `withUser(userId, fn)`, que abre una transaccion y hace
  `set_config('app.user_id', <usuario>, true)` antes de cada consulta.
- La migracion `supabase/migrations/002_ordenia_rls.sql` activa y **fuerza** RLS en las
  cuatro tablas y crea una politica por tabla que compara `user_id` con
  `current_setting('app.user_id', true)`. Sin `app.user_id` la comparacion no es cierta y la
  politica **niega**: falla cerrado.
- El webhook de WhatsApp (`app/api/ingest`) resuelve el titular por telefono verificado con
  dos funciones `SECURITY DEFINER` creadas por el administrador
  (`ordenia.usuario_por_telefono_verificado` y `ordenia.enlace_por_codigo`). Devuelven solo el
  identificador de usuario; el rol de la aplicacion solo puede ejecutarlas.

**Lo que falta, y es una decision de Cesar:** que la aplicacion se conecte con este rol y no
con el administrador. Mientras `DATABASE_URL` apunte al rol administrador de Supabase
(`postgres`), ese rol salta RLS y el aislamiento sigue Depending solo de los filtros
`user_id` del codigo. Las politicas solo protegen cuando el rol que conecta **no** puede
saltarselas.

## Que necesita la web (segun `app/` y `db/schema.ts`)

| Tabla | Operaciones que usa el codigo |
|---|---|
| `ordenia.entries` | SELECT, INSERT, UPDATE, DELETE |
| `ordenia.rules` | SELECT, INSERT, UPDATE (upsert), DELETE |
| `ordenia.connections` | SELECT, INSERT, UPDATE (upsert) |
| `ordenia.deliveries` | SELECT, INSERT |

No necesita DDL, ni `ordenia.migrations`, ni otros esquemas. Las migraciones y
`scripts/import-sites.mjs` siguen con un rol administrador, usado solo a mano (ver
`docs/DESPLIEGUE-COOLIFY-SUPABASE.md`, "Migraciones").

## SQL propuesto (ejecutar como administrador, tras revisar y con respaldo)

```sql
-- 1. Rol sin privilegios heredados y sin poder saltarse RLS. La contrasena se genera
--    fuera del repo y vive en Vaultwarden/Infisical. NOBYPASSRLS es explicito.
CREATE ROLE ordenia_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS
  PASSWORD '<generada-fuera-del-repo>' CONNECTION LIMIT 20;

-- 2. Solo el esquema ordenia.
GRANT CONNECT ON DATABASE postgres TO ordenia_app;
GRANT USAGE ON SCHEMA ordenia TO ordenia_app;

-- 3. Minimo privilegio por tabla. Sin DDL, sin otros esquemas.
GRANT SELECT, INSERT, UPDATE, DELETE ON ordenia.entries     TO ordenia_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ordenia.rules       TO ordenia_app;
GRANT SELECT, INSERT, UPDATE         ON ordenia.connections TO ordenia_app;
GRANT SELECT, INSERT                 ON ordenia.deliveries  TO ordenia_app;

-- 4. El webhook necesita resolver el titular por telefono: son funciones SECURITY DEFINER
--    que el administrador crea. El rol de la aplicacion solo las ejecuta.
GRANT EXECUTE ON FUNCTION ordenia.usuario_por_telefono_verificado(text) TO ordenia_app;
GRANT EXECUTE ON FUNCTION ordenia.enlace_por_codigo(text, text) TO ordenia_app;
```

Las politicas **no** se crean aqui: son las de `supabase/migrations/002_ordenia_rls.sql`, y
filtran por `app.user_id`. Ninguna politica debe filtrar solo por rol: tiene que comparar
`user_id` con la identidad de la transaccion.

## Como se activa

1. Crear el rol y aplicar los `GRANT` (comando de administrador).
2. Aplicar `supabase/migrations/002_ordenia_rls.sql` en la base de **prueba** y recorrer el
   flujo completo: crear nota, mover, borrar, vincular WhatsApp, `/api/health`.
3. Cambiar `DATABASE_URL` del despliegue a la del rol `ordenia_app` (ventana de mantenimiento:
   la web y el receptor de WhatsApp se reinician).
4. Comprobar que el receptor de WhatsApp sigue funcionando: usa las funciones `SECURITY
   DEFINER`, que el rol si puede ejecutar.

## Límites honestos

- El aislamiento real **no** se puede probar aqui: no hay instancia de Postgres de prueba en
  este entorno. La prueba de aislamiento entre dos usuarios queda *skipped* con motivo
  (`tests/rls.test.mjs`).
- Con Supabase self-hosted, `DATABASE_URL` debe apuntar al pooler/puerto que acepte el rol
  nuevo; verificar antes de cambiar nada.
- El rol `ordenia_app` no puede ejecutar `scripts/migrate.mjs` (necesita `CREATE`): es lo
  esperado.
- La politica de conservacion y supresion de datos del titular (Ley 21.719) es de producto:
  ver `docs/CONTRATO-RESPALDO.md` para el ciclo de respaldo y destruccion.

## Reversión

```sql
REVOKE ALL ON ALL TABLES IN SCHEMA ordenia FROM ordenia_app;
REVOKE EXECUTE ON FUNCTION ordenia.usuario_por_telefono_verificado(text) FROM ordenia_app;
REVOKE EXECUTE ON FUNCTION ordenia.enlace_por_codigo(text, text) FROM ordenia_app;
DROP OWNED BY ordenia_app;
DROP ROLE ordenia_app;
```

y volver al `DATABASE_URL` anterior. Para revertir las politicas:

```sql
DROP POLICY IF EXISTS entries_isolation ON ordenia.entries;
-- (idem para rules, connections y deliveries)
ALTER TABLE ordenia.entries NO FORCE ROW LEVEL SECURITY;
-- (idem para las otras tres tablas)
```
