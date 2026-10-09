# Validación

- Instalación de dependencias y lockfile npm generados.
- TypeScript sin errores.
- Compilación Next.js de producción completada, con salida standalone.
- Sintaxis de scripts de migración, importación y receptor WhatsApp verificada.

El entorno de preparación no dispone de Docker. No se ha ejecutado un build Docker ni una conexión a Supabase real. Falta la prueba de despliegue, migración, email, aislamiento con dos cuentas y webhook real en tu infraestructura. Consulta la guía para esas comprobaciones.

- Dos pruebas automatizadas pasan: arranque standalone, login anónimo, rechazo de cabeceras de identidad falsas y origen externo; challenge Meta, rechazo de firma inválida y evento firmado válido.
- Archivos Compose analizados como YAML; combinación web/migraciones/WhatsApp comprobada.
- No se ha verificado guardado con usuarios reales ni la importación contra PostgreSQL real.
