#!/usr/bin/env bash
# Respaldo de los datos de Ordenia (PostgreSQL).
# Contrato normativo: docs/CONTRATO-RESPALDO.md
#
#   <destino>/<timestamp>/data.dump      dump de PostgreSQL (pg_dump --format=custom)
#   <destino>/<timestamp>/SHA256SUMS     sha256 de data.dump
#   <destino>/<timestamp>/manifest.json  software, version, database, sha256, status
#   <destino>/<timestamp>/env.vars       SOLO los nombres de variable del .env, nunca los valores
#   <destino>/<timestamp>/env.age        el .env cifrado con age, SOLO si hay receptor configurado
#
# El .env NUNCA se copia en claro: es lo que hace que un respaldo copiado a otra
# maquina sea una credencial tendida. Sin receptor age el respaldo sale sin el .env
# y el manifiesto lo declara. No hay modo degradado a texto plano.
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOFTWARE='ordenia'
DATABASE='postgresql'
VERSION="$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$RAIZ/package.json" | head -1)"
[ -n "$VERSION" ] || VERSION='desconocida'

DESTINO="$RAIZ/backups"
while [ $# -gt 0 ]; do
  case "$1" in
    --destino)
      [ $# -ge 2 ] || { echo 'ERROR: --destino necesita un valor' >&2; exit 1; }
      DESTINO="$2"; shift 2;;
    -h|--help)
      sed -n '2,14p' "$0"; exit 0;;
    *)
      echo "Opcion desconocida: $1" >&2; exit 1;;
  esac
done

if [ -z "${DATABASE_URL:-}" ]; then
  echo 'ERROR: falta DATABASE_URL: no se hace un respaldo sin origen de datos.' >&2
  exit 2
fi
command -v pg_dump >/dev/null || {
  echo 'ERROR: falta pg_dump (postgresql-client): no se hace un respaldo a medias.' >&2
  exit 2
}

ENV_FILE="${ORDENIA_ENV_FILE:-$RAIZ/.env}"
RECIPIENTE="${AGE_RECIPIENTE:-${AGE_RECIPIENT:-}}"

umask 077
mkdir -p "$DESTINO"
SELLO="$(date -u +%Y%m%dT%H%M%SZ)"
CARPETA="$DESTINO/$SELLO"
if [ -e "$CARPETA" ]; then
  echo "ERROR: ya existe $CARPETA" >&2
  exit 2
fi
mkdir "$CARPETA"

pg_dump --dbname="$DATABASE_URL" --format=custom --file "$CARPETA/data.dump"

# El .env no se copia en claro: solo sus nombres, y cifrado si hay receptor age.
nombres_env() {
  [ -f "$1" ] || return 0
  sed -n 's/^\([A-Za-z_][A-Za-z0-9_]*\)=.*/\1/p' "$1"
}
nombres_env "$ENV_FILE" > "$CARPETA/env.vars"

CIFRADO=false
if [ -n "$RECIPIENTE" ]; then
  if ! command -v age >/dev/null; then
    echo 'ERROR: hay receptor age configurado pero age no esta instalado. Sin age el .env no se copia: no se degrada a texto plano.' >&2
    rm -rf "$CARPETA"
    exit 2
  fi
  if [ ! -f "$ENV_FILE" ]; then
    echo 'ERROR: hay receptor age configurado pero no existe el .env que cifrar.' >&2
    rm -rf "$CARPETA"
    exit 2
  fi
  age -r "$RECIPIENTE" -o "$CARPETA/env.age" "$ENV_FILE"
  CIFRADO=true
fi

DIGESTO="$(sha256sum "$CARPETA/data.dump" | cut -d' ' -f1)"
printf '%s  data.dump\n' "$DIGESTO" > "$CARPETA/SHA256SUMS"

# El manifiesto se escribe al final: si algo fallo antes, no hay manifiesto y por
# tanto el respaldo no se restaura.
cat > "$CARPETA/manifest.json" <<JSON
{
  "software": "$SOFTWARE",
  "version": "$VERSION",
  "database": "$DATABASE",
  "sha256": "$DIGESTO",
  "status": "completed",
  "generado_utc": "$SELLO",
  "env_vars": $(wc -l < "$CARPETA/env.vars" | tr -d ' '),
  "env_cifrado": $CIFRADO
}
JSON

echo "Respaldo completo: $CARPETA"
echo "Cifrar y copiar fuera del servidor; contiene datos personales (Ley 21.719)."
