#!/usr/bin/env bats
# Ciclo backup -> restore con datos sinteticos y en aislamiento.
#
# Nada de este test toca una base real: pg_dump, pg_restore y psql son stubs que
# no se conectan a nada. Lo que se prueba es el contrato (docs/CONTRATO-RESPALDO.md),
# no el runtime de PostgreSQL.
bats_require_minimum_version 1.5.0

setup() {
  RAIZ="$BATS_TEST_DIRNAME/.."
  TMP="$BATS_TEST_TMPDIR"
  BIN="$TMP/bin"
  mkdir -p "$BIN" "$TMP/backups" "$TMP/logs"

  cat > "$BIN/pg_dump" <<'STUB'
#!/usr/bin/env bash
# Stub de pg_dump: no se conecta a ninguna base.
set -uo pipefail
destino=""
anterior=""
for a in "$@"; do
  case "$a" in --file=*) destino="${a#--file=}";; esac
  if [ "$anterior" = "--file" ]; then destino="$a"; fi
  anterior="$a"
done
[ -n "$destino" ] || exit 2
printf 'DUMP-SINTETICO-ORDENIA\n' > "$destino"
exit 0
STUB

  cat > "$BIN/pg_restore" <<'STUB'
#!/usr/bin/env bash
# Stub de pg_restore: no restaura nada, solo deja rastro de que se llamo.
# STUB_PG_RESTORE_FAIL=1 simula un fallo de restauracion.
set -uo pipefail
printf '%s\n' "$*" >> "${STUB_LOG_RESTORE:-/dev/null}"

if [ "${STUB_PG_RESTORE_FAIL:-0}" = "1" ]; then
  exit 17
fi

exit 0
STUB

  cat > "$BIN/psql" <<'STUB'
#!/usr/bin/env bash
# Stub de psql: responde el numero de tablas del esquema ordenia en el destino.
set -uo pipefail
printf '%s\n' "${STUB_PSQL_TABLAS:-0}"
exit 0
STUB

  chmod +x "$BIN/pg_dump" "$BIN/pg_restore" "$BIN/psql"
  export PATH="$BIN:$PATH"
  export STUB_LOG_RESTORE="$TMP/restaurado.log"
  export DATABASE_URL="postgresql://sintetico@localhost/ordenia_prueba"
  export ORDENIA_ENV_FILE="$TMP/.env"
  export ORDENIA_LOG_DIR="$TMP/logs"
  printf 'DATABASE_URL=postgresql://sintetico@localhost/ordenia_prueba\nAPP_URL=https://ordenia.example.cl\nSECRETO_SINTETICO=valor-sintetico-que-no-debe-aparecer\n' > "$ORDENIA_ENV_FILE"
  export DESTINO="$TMP/backups"
  unset AGE_RECIPIENTE 2>/dev/null || true
  unset AGE_RECIPIENT 2>/dev/null || true
}

respaldo() { run bash "$RAIZ/scripts/respaldo.sh" --destino "$DESTINO"; }
carpeta() { find "$DESTINO" -mindepth 1 -maxdepth 1 -type d | head -1; }

@test "respaldo.sh exige DATABASE_URL antes de hacer nada" {
  unset DATABASE_URL
  run bash "$RAIZ/scripts/respaldo.sh" --destino "$DESTINO"
  echo "status=$status output=$output"
  [ "$status" -ne 0 ]
  [[ "$output" == *"DATABASE_URL"* ]]
}

@test "respaldo.sh crea data.dump, SHA256SUMS y manifest.json con status completed" {
  respaldo
  echo "status=$status output=$output"
  [ "$status" -eq 0 ]
  c="$(carpeta)"
  [ -n "$c" ]
  [ -f "$c/data.dump" ]
  [ -f "$c/SHA256SUMS" ]
  [ -f "$c/manifest.json" ]
  for clave in software version database sha256 status; do
    run grep -q "\"$clave\"" "$c/manifest.json"
    [ "$status" -eq 0 ]
  done
  run grep -q '"status": "completed"' "$c/manifest.json"
  [ "$status" -eq 0 ]
}

@test "el .env NUNCA queda en claro en el arbol del respaldo" {
  respaldo
  [ "$status" -eq 0 ]
  run bash -c "find '$DESTINO' -name '.env' -o -name '*.env' | head -5"
  echo "$output"
  [ -z "$output" ]
  run bash -c "grep -rl 'valor-sintetico-que-no-debe-aparecer' '$DESTINO' 2>/dev/null | head -5"
  echo "$output"
  [ -z "$output" ]
}

@test "env.vars trae solo nombres de variable, nunca valores" {
  respaldo
  [ "$status" -eq 0 ]
  c="$(carpeta)"
  [ -f "$c/env.vars" ]
  run cat "$c/env.vars"
  echo "$output"
  [[ "$output" == *"DATABASE_URL"* ]]
  [[ "$output" == *"SECRETO_SINTETICO"* ]]
  [[ "$output" != *"valor-sintetico"* ]]
}

@test "con AGE_RECIPIENTE el .env sale cifrado y age lo puede descifrar" {
  command -v age >/dev/null || skip "age no instalado"
  command -v age-keygen >/dev/null || skip "age-keygen no instalado"
  AGE_RECIPIENTE="$(age-keygen -o "$TMP/age.key" 2>&1 | grep -o 'age1[a-z0-9]*' | head -1)"
  [ -n "$AGE_RECIPIENTE" ]
  export AGE_RECIPIENTE
  respaldo
  echo "status=$status output=$output"
  [ "$status" -eq 0 ]
  c="$(carpeta)"
  [ -f "$c/env.age" ]
  run bash -c "grep -c 'valor-sintetico' '$c/env.age' || true"
  [ "${output%% *}" = "0" ]
  run bash -c "age -d -i '$TMP/age.key' '$c/env.age'"
  echo "$output"
  [[ "$output" == *"SECRETO_SINTETICO=valor-sintetico"* ]]
}

@test "restaurar.sh exige la confirmacion explicita" {
  respaldo
  [ "$status" -eq 0 ]
  c="$(carpeta)"
  run bash "$RAIZ/scripts/restaurar.sh" "$c" "postgresql://destino@localhost/ordenia_prueba"
  echo "status=$status output=$output"
  [ "$status" -eq 3 ]
  [[ "$output" == *"--confirmar"* ]]
}

@test "el modo rapido (--dry-run) valida el respaldo sin restaurar" {
  respaldo
  [ "$status" -eq 0 ]
  c="$(carpeta)"
  run bash "$RAIZ/scripts/restaurar.sh" "$c" "postgresql://destino@localhost/ordenia_prueba" --dry-run
  echo "status=$status output=$output"
  [ "$status" -eq 0 ]
  [[ "$output" == *"Simulaci"* ]]
  [ ! -f "$STUB_LOG_RESTORE" ]
}

@test "restaurar.sh se niega a restaurar sobre un destino no vacio" {
  respaldo
  [ "$status" -eq 0 ]
  c="$(carpeta)"
  export STUB_PSQL_TABLAS="3"
  run bash "$RAIZ/scripts/restaurar.sh" "$c" "postgresql://destino@localhost/ordenia_prueba" --confirmar CONFIRMAR_RESTAURACION
  echo "status=$status output=$output"
  [ "$status" -ne 0 ]
  [[ "$output" == *"destino no esta vacio"* ]]
}

@test "restaurar.sh rechaza un manifiesto con version distinta" {
  respaldo
  [ "$status" -eq 0 ]
  c="$(carpeta)"
  sed -i 's/"version": "[^"]*"/"version": "9.9.9"/' "$c/manifest.json"
  run bash "$RAIZ/scripts/restaurar.sh" --verificar "$c"
  echo "status=$status output=$output"
  [ "$status" -eq 2 ]
}

@test "--verificar devuelve 4 ante material sensible en claro" {
  respaldo
  [ "$status" -eq 0 ]
  c="$(carpeta)"
  printf 'SECRETO_SINTETICO=valor-sintetico-que-no-debe-aparecer\n' > "$c/fugas.txt"
  run bash "$RAIZ/scripts/restaurar.sh" --verificar "$c"
  echo "status=$status output=$output"
  [ "$status" -eq 4 ]
}

@test "el ciclo completo deja auditoria con el sha256 verificado" {
  respaldo
  [ "$status" -eq 0 ]
  c="$(carpeta)"
  digest="$(cut -d' ' -f1 "$c/SHA256SUMS")"
  run bash "$RAIZ/scripts/restaurar.sh" "$c" "postgresql://destino@localhost/ordenia_prueba" --confirmar CONFIRMAR_RESTAURACION
  echo "status=$status output=$output"
  [ "$status" -eq 0 ]
  [ -f "$TMP/logs/restore.log" ]
  run cat "$TMP/logs/restore.log"
  echo "$output"
  [[ "$output" == *'"accion":"restore"'* ]]
  [[ "$output" == *'"resultado":"ok"'* ]]
  [[ "$output" == *"$digest"* ]]
}

@test "la auditoria no guarda credenciales del destino" {
  respaldo
  [ "$status" -eq 0 ]
  c="$(carpeta)"
  run bash "$RAIZ/scripts/restaurar.sh" "$c" "postgresql://usuario:clave-secreta@localhost/ordenia_prueba" --confirmar CONFIRMAR_RESTAURACION
  echo "status=$status output=$output"
  [ "$status" -eq 0 ]
  run cat "$TMP/logs/restore.log"
  echo "$output"
  [[ "$output" != *"clave-secreta"* ]]
}

@test "la auditoria redige credenciales en URL y conninfo clave=valor" {
  respaldo
  [ "$status" -eq 0 ]
  c="$(carpeta)"

  clave_audit="audit-${BATS_TEST_NUMBER}-${RANDOM}"
  destino="host=localhost dbname=ordenia_prueba user=usuario password=${clave_audit}"

  run bash "$RAIZ/scripts/restaurar.sh" "$c" "$destino" --confirmar CONFIRMAR_RESTAURACION
  echo "status=$status output=$output"
  [ "$status" -eq 0 ]

  run cat "$TMP/logs/restore.log"
  echo "$output"
  [[ "$output" != *"$clave_audit"* ]]
  [[ "$output" == *"[REDACTED]"* ]]

  # El reporte de restauracion tampoco puede quedar con la contrasena.
  [ -f "$c/restore-report.json" ]
  run cat "$c/restore-report.json"
  echo "$output"
  [[ "$output" != *"$clave_audit"* ]]

  # Y debe seguir siendo JSON valido.
  node --input-type=module - "$c/restore-report.json" <<'NODE'
import {readFileSync} from 'node:fs';
const reporte=JSON.parse(readFileSync(process.argv[2],'utf8'));
if(reporte.resultado!=='ok') process.exit(1);
NODE
  [ "$?" -eq 0 ]
}

@test "la auditoria redige la contrasena de una URL sin usuario" {
  respaldo
  [ "$status" -eq 0 ]
  c="$(carpeta)"

  clave_audit="sin-usuario-${BATS_TEST_NUMBER}-${RANDOM}"
  destino="postgresql://:${clave_audit}@localhost/ordenia_prueba"

  run bash "$RAIZ/scripts/restaurar.sh" "$c" "$destino" --confirmar CONFIRMAR_RESTAURACION
  echo "status=$status output=$output"
  [ "$status" -eq 0 ]

  run cat "$TMP/logs/restore.log"
  echo "$output"
  [[ "$output" != *"$clave_audit"* ]]
  [[ "$output" == *"[REDACTED]"* ]]
}

@test "la auditoria sigue siendo JSON valido con comillas y barras en los campos" {
  respaldo
  [ "$status" -eq 0 ]
  c="$(carpeta)"

  origen_especial="$TMP/origen \"audit\"\\ruta"
  mv "$c" "$origen_especial"

  destino='host=localhost dbname=ordenia_prueba user=usuario application_name="audit campo"'

  run bash "$RAIZ/scripts/restaurar.sh" "$origen_especial" "$destino" --dry-run
  echo "status=$status output=$output"
  [ "$status" -eq 0 ]

  node --input-type=module - "$TMP/logs/restore.log" "$origen_especial" <<'NODE'
import {readFileSync} from 'node:fs';

const log=readFileSync(process.argv[2],'utf8').trim().split('\n').at(-1);
const esperado=process.argv[3];
const entrada=JSON.parse(log);

if(entrada.origen!==esperado) process.exit(1);
if(entrada.resultado!=='dry-run') process.exit(1);
NODE
  [ "$?" -eq 0 ]
}

@test "un pg_restore fallido deja auditoria con resultado error" {
  respaldo
  [ "$status" -eq 0 ]
  c="$(carpeta)"
  export STUB_PG_RESTORE_FAIL=1

  run bash "$RAIZ/scripts/restaurar.sh" "$c" \
    "host=localhost dbname=ordenia_prueba user=usuario" \
    --confirmar CONFIRMAR_RESTAURACION
  echo "status=$status output=$output"
  [ "$status" -ne 0 ]

  [ -f "$TMP/logs/restore.log" ]
  run tail -n 1 "$TMP/logs/restore.log"
  echo "$output"
  [[ "$output" == *'"resultado":"error"'* ]]
}
