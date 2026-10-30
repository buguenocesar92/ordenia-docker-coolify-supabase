-- 002_ordenia_rls.sql
-- El aislamiento entre usuarios baja de la aplicacion a la base de datos.
--
-- 001_ordenia.sql dejo RLS activada SIN politicas: el aislamiento real dependia de que cada
-- ruta filtrara por user_id. Con esta migracion, cada tabla tiene una politica que compara
-- user_id con la identidad de la transaccion (app.user_id), y el codigo la fija con
-- set_config(..., true) dentro de la transaccion (db/index.ts, withUser).
--
-- Si app.user_id no esta fijada, current_setting devuelve NULL, la comparacion no es cierta y
-- la politica NIEGA: falla cerrado. Para que esto proteja, la aplicacion debe conectarse con el
-- rol de aplicacion (NOBYPASSRLS) descrito en docs/ROL-DE-APLICACION.md, no con el rol
-- administrador. Ese cambio de DATABASE_URL es una decision operativa: ver ese documento.
--
-- Probar primero en base de prueba; en produccion debe aplicarse, con respaldo, antes de desplegar
-- este codigo (ver docs/DESPLIEGUE-COOLIFY-SUPABASE.md). Para revertir: DROP POLICY, ALTER TABLE ...
-- NO FORCE ROW LEVEL SECURITY y borrar este fichero.

REVOKE ALL ON SCHEMA ordenia FROM PUBLIC, anon, authenticated;

ALTER TABLE ordenia.entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordenia.entries FORCE ROW LEVEL SECURITY;
ALTER TABLE ordenia.rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordenia.rules FORCE ROW LEVEL SECURITY;
ALTER TABLE ordenia.connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordenia.connections FORCE ROW LEVEL SECURITY;
ALTER TABLE ordenia.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordenia.deliveries FORCE ROW LEVEL SECURITY;

CREATE POLICY entries_isolation ON ordenia.entries
  USING (user_id = current_setting('app.user_id', true))
  WITH CHECK (user_id = current_setting('app.user_id', true));

CREATE POLICY rules_isolation ON ordenia.rules
  USING (user_id = current_setting('app.user_id', true))
  WITH CHECK (user_id = current_setting('app.user_id', true));

CREATE POLICY connections_isolation ON ordenia.connections
  USING (user_id = current_setting('app.user_id', true))
  WITH CHECK (user_id = current_setting('app.user_id', true));

CREATE POLICY deliveries_isolation ON ordenia.deliveries
  USING (user_id = current_setting('app.user_id', true))
  WITH CHECK (user_id = current_setting('app.user_id', true));

-- El webhook de WhatsApp (/api/ingest) recibe el mensaje antes de saber de quien es: resuelve la
-- cuenta a partir del telefono verificado. Esa consulta es CRUZADA por diseno, asi que vive en
-- funciones SECURITY DEFINER creadas por el administrador: se ejecutan con sus privilegios y
-- devuelven SOLO el identificador de usuario (y los datos minima del enlace), nunca el resto de
-- la fila. El rol de la aplicacion solo puede ejecutarlas, no leer la tabla.
CREATE OR REPLACE FUNCTION ordenia.usuario_por_telefono_verificado(p_telefono text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, ordenia
AS $$
  SELECT c.user_id FROM ordenia.connections c
   WHERE c.phone = p_telefono AND c.verified = true
   LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION ordenia.enlace_por_codigo(p_telefono text, p_hash text)
RETURNS TABLE(usuario_id text, vence text, otro_verificado boolean)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, ordenia
AS $$
  SELECT c.user_id,
         c.code_expires,
         EXISTS (SELECT 1 FROM ordenia.connections o
                  WHERE o.phone = p_telefono AND o.verified = true AND o.user_id <> c.user_id)
    FROM ordenia.connections c
   WHERE c.phone = p_telefono AND c.code_hash = p_hash
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION ordenia.usuario_por_telefono_verificado(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION ordenia.enlace_por_codigo(text, text) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ordenia_app') THEN
    GRANT EXECUTE ON FUNCTION ordenia.usuario_por_telefono_verificado(text) TO ordenia_app;
    GRANT EXECUTE ON FUNCTION ordenia.enlace_por_codigo(text, text) TO ordenia_app;
  END IF;
END;
$$;
