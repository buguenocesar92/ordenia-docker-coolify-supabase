# Validación

- Instalación de dependencias y lockfile npm generados.
- TypeScript sin errores.
- Compilación Next.js de producción completada, con salida standalone.
- Sintaxis de scripts de migración, importación y receptor WhatsApp verificada.

El entorno de preparación no dispone de Docker. No se ha ejecutado un build Docker ni una conexión a Supabase real. Falta la prueba de despliegue, migración, email, aislamiento con dos cuentas y webhook real en tu infraestructura. Consulta la guía para esas comprobaciones.

- Dos pruebas automatizadas pasan: arranque standalone, login anónimo, rechazo de cabeceras de identidad falsas y origen externo; challenge Meta, rechazo de firma inválida y evento firmado válido.
- Archivos Compose analizados como YAML; combinación web/migraciones/WhatsApp comprobada.
- No se ha verificado guardado con usuarios reales ni la importación contra PostgreSQL real.

## Consolidación 2026-10-30

Lo de arriba describe la preparación original; esta rama agrega lo siguiente.

- **RLS preparada**: `supabase/migrations/002_ordenia_rls.sql` activa y fuerza RLS en las cuatro
  tablas y crea las funciones `SECURITY DEFINER` que resuelven el titular del webhook. El código fija
  la identidad por transacción (`withUser` en `db/index.ts`). **Activarlo sigue siendo una decisión
  operativa**: cambiar `DATABASE_URL` al rol de aplicación (ver `docs/ROL-DE-APLICACION.md`).
- **Prueba real de RLS**: `tests/rls-real.test.mjs` aplica las migraciones en un Postgres desechable
  y comprueba el aislamiento con un rol de aplicación sin superusuario ni `BYPASSRLS`, con filas de
  dos usuarios. Sin `ORDENIA_TEST_DATABASE_URL` se omite con motivo; no se ejecutó contra Supabase
  self-hosted real.
- **Resolución del titular corregida**: la consulta de `usuarioPorTelefono` pedía una columna que la
  función no expone, así que todo mensaje de WhatsApp terminaba en 500.
- **`x-request-id` acotado**: el valor del cliente solo se acepta con un formato corto y simple; si
  no lo cumple, se genera uno propio.
- **CI**: `.github/workflows/ci.yml` corre typecheck, build, suite, ciclo de respaldo, shellcheck y
  escaneo de secretos. No despliega ni aplica migraciones.
- **Respaldo**: `scripts/respaldo.sh` y `scripts/restaurar.sh`, con el contrato en
  `docs/CONTRATO-RESPALDO.md` y su prueba en bats.
- **Next 16.4.3**: sube desde 16.3.4 por un CVE crítico.

Pendiente:

- `axe-core` y Playwright para la accesibilidad: `tests/accesibilidad.test.mjs` revisa el marcado de
  forma estática, no la accesibilidad medida en el navegador.
- `eslint` declarado como `devDependency`: `eslint.config.mjs` está en el repo, pero `npm run lint`
  queda como aviso, no como puerta verde, hasta que la devDep entre.
