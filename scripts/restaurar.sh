#!/usr/bin/env bash
# Restauracion de un respaldo de Ordenia.
# Contrato normativo: docs/CONTRATO-RESPALDO.md
#
# Codigos de salida:
#   0  respaldo integro / restaurado
#   1  uso incorrecto
#   2  manifiesto, checksum o destino invalidos
#   3  falta la confirmacion explicita
#   4  material sensible en claro dentro del respaldo
#
# Nunca vacia ni sobrescribe datos existentes: antes de restaurar exige que el
# esquema ordenia de la base destino este vacio.
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOFTWARE='ordenia'
DATABASE='postgresql'
VERSION="$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$RAIZ/package.json" | head -1)"
[ -n "$VERSION" ] || VERSION='desconocida'
CONFIRMACION='CONFIRMAR_RESTAURACION'
LOG_DIR="${ORDENIA_LOG_DIR:-$RAIZ/logs}"
ENV_FILE="${ORDENIA_ENV_FILE:-$RAIZ/.env}"

modo=''; origen=''; destino=''
while [ $# -gt 0 ]; do
  case "$1" in
    --verificar) modo='verificar'; shift;;
    --dry-run) modo='dry-run'; shift;;
    --confirmar)
      [ "${2:-}" = "$CONFIRMACION" ] || { echo "ERROR: el valor de --confirmar debe ser $CONFIRMACION" >&2; exit 1; }
      modo='confirmado'; shift 2;;
    -h|--help)
      sed -n '2,12p' "$0"; exit 0;;
    -*)
      echo "Opcion desconocida: $1" >&2; exit 1;;
    *)
      if [ -z "$origen" ]; then origen="$1"
      elif [ -z "$destino" ]; then destino="$1"
      else echo 'ERROR: demasiados argumentos' >&2; exit 1
      fi
      shift;;
  esac
done

[ -n "$origen" ] || {
  echo "Uso: scripts/restaurar.sh --verificar <respaldo>" >&2
  echo "     scripts/restaurar.sh <respaldo> <destino> --dry-run" >&2
  echo "     scripts/restaurar.sh <respaldo> <destino> --confirmar $CONFIRMACION" >&2
  exit 1
}
[ -d "$origen" ] || { echo 'ERROR: el respaldo no existe o no es un directorio' >&2; exit 2; }

MANIFIESTO="$origen/manifest.json"
[ -f "$MANIFIESTO" ] || { echo 'ERROR: falta manifest.json: el respaldo no es del flujo orquestado' >&2; exit 2; }
for clave in software version database sha256 status; do
  grep -q "\"$clave\"" "$MANIFIESTO" || { echo "ERROR: el manifiesto no trae la clave $clave" >&2; exit 2; }
done
valor() { sed -n "s/^[[:space:]]*\"$1\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p" "$MANIFIESTO" | head -1; }

[ "$(valor software)" = "$SOFTWARE" ] || { echo 'ERROR: el manifiesto no corresponde a este software' >&2; exit 2; }
[ "$(valor version)" = "$VERSION" ] || { echo 'ERROR: la version del manifiesto no corresponde a la de la aplicacion' >&2; exit 2; }
[ "$(valor database)" = "$DATABASE" ] || { echo 'ERROR: el manifiesto no corresponde a esta base de datos' >&2; exit 2; }
[ "$(valor status)" = 'completed' ] || { echo 'ERROR: el respaldo no esta completo: no se restaura' >&2; exit 2; }

DIGESTO="$(valor sha256)"
[ -f "$origen/data.dump" ] || { echo 'ERROR: falta data.dump' >&2; exit 2; }
[ -f "$origen/SHA256SUMS" ] || { echo 'ERROR: falta SHA256SUMS' >&2; exit 2; }
( cd "$origen" && sha256sum -c --status SHA256SUMS ) || { echo 'ERROR: el checksum no cuadra' >&2; exit 2; }
[ "$(sha256sum "$origen/data.dump" | cut -d' ' -f1)" = "$DIGESTO" ] || { echo 'ERROR: el sha256 del manifiesto no cuadra con el dump' >&2; exit 2; }

# Material sensible en claro: si algun valor del .env aparece dentro del respaldo,
# el respaldo no se restaura. Solo se reporta el NOMBRE de la variable, nunca el valor.
detectar_secreto_en_claro() {
  [ -f "$ENV_FILE" ] || return 1
  local linea clave valor
  while IFS= read -r linea; do
    clave="${linea%%=*}"
    valor="${linea#*=}"
    valor="${valor%\"}"
    valor="${valor#\"}"
    [ ${#valor} -ge 8 ] || continue
    if grep -rqsF -- "$valor" "$origen"; then
      printf '%s' "$clave"
      return 0
    fi
  done < <(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "$ENV_FILE")
  return 1
}
CLAVE_FUGA="$(detectar_secreto_en_claro || true)"
if [ -n "$CLAVE_FUGA" ]; then
  echo "ERROR: el respaldo contiene material sensible en claro (variable $CLAVE_FUGA)" >&2
  exit 4
fi

if [ "$modo" = 'verificar' ]; then
  echo 'Respaldo integro: manifiesto, checksum y ausencia de secretos en claro verificados.'
  echo 'Esto no demuestra la recuperacion de PostgreSQL: falta el ensayo con datos sinteticos.'
  exit 0
fi

[ -n "$destino" ] || { echo 'ERROR: falta el destino de la restauracion' >&2; exit 1; }
if [ -z "$modo" ]; then
  echo "ERROR: falta --confirmar $CONFIRMACION (o --dry-run para simular sin escribir)" >&2
  exit 3
fi

command -v psql >/dev/null || {
  echo 'ERROR: falta psql (postgresql-client): no se puede comprobar que el destino este vacio' >&2
  exit 2
}
TABLAS="$(psql "$destino" -tAc "select count(*) from information_schema.tables where table_schema='ordenia'" 2>/dev/null || echo ERROR)"
case "$TABLAS" in
  0) ;;
  ERROR|'') echo 'ERROR: no se pudo comprobar el estado del destino' >&2; exit 2;;
  *) echo 'ERROR: el destino no esta vacio: restauracion cancelada.' >&2; exit 2;;
esac

# En la auditoria nunca se escriben credenciales: el destino va sin usuario ni contrasena.
DESTINO_LIMPIO="$(printf '%s' "$destino" | sed -E 's#(://)[^/@]*@#\1#')"
auditar() {
  local resultado="$1"
  mkdir -p "$LOG_DIR"
  chmod 700 "$LOG_DIR" 2>/dev/null || true
  printf '{"ts": "%s", "accion": "restore", "origen": "%s", "sha256_verificado": "%s", "destino": "%s", "resultado": "%s"}\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$origen" "$DIGESTO" "$DESTINO_LIMPIO" "$resultado" >> "$LOG_DIR/restore.log"
  chmod 600 "$LOG_DIR/restore.log"
}

if [ "$modo" = 'dry-run' ]; then
  auditar 'dry-run'
  echo 'Simulacion correcta: el respaldo es integro y el destino esta vacio. No se escribio nada.'
  exit 0
fi

pg_restore --exit-on-error --dbname="$destino" "$origen/data.dump"
cat > "$origen/restore-report.json" <<JSON
{
  "ts": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "origen": "$origen",
  "sha256_verificado": "$DIGESTO",
  "destino": "$DESTINO_LIMPIO",
  "resultado": "ok"
}
JSON
auditar 'ok'
echo 'Datos restaurados. Revisa aislamiento y notificaciones antes de arrancar el servicio.'
