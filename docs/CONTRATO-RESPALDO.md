# Contrato de respaldo y restauracion de Ordenia

Este documento es **normativo** para este repositorio. Es el mismo contrato que
aplica al resto de los kits del flujo orquestado (por ejemplo
`hefesto-monitor-uptime-kuma` y `hefesto-respaldo-kopia`): ambos extremos
hablan el mismo idioma y un respaldo que no lo cumple no se restaura.

## 1. Las reglas

1. **Nombre de los scripts**: `scripts/respaldo.sh` (respaldo) y
   `scripts/restaurar.sh` (restauracion). Los dos extremos se reconocen por el
   contenido del respaldo, no por el nombre.
2. **Salida en `<destino>/<timestamp>/`** con, como minimo:
   - `data.dump`: el dump de PostgreSQL (`pg_dump --format=custom`).
   - `SHA256SUMS`: el sha256 de `data.dump`, en formato `sha256sum`.
   - `manifest.json`: la metadata del respaldo.
   - `env.vars`: los **nombres** de variable del `.env`, nunca los valores.
   - `env.age`: el `.env` cifrado con `age`, solo si hay receptor configurado.
3. **`manifest.json` contiene SIEMPRE** estas claves: `software`, `version`,
   `database`, `sha256`, `status`. Un respaldo sin las cinco no es un respaldo
   del flujo orquestado.
4. **`status` solo vale `completed`** si el proceso termino sin error. Cualquier
   otro valor significa que el respaldo **no se restaura**: la restauracion
   aborta antes de tocar el destino.
5. **El `.env` NUNCA se copia en claro.** Se documenta su ausencia en el
   manifiesto o se cifra con `age` usando la clave publica del receptor. Un
   `.env` en claro dentro de un respaldo es una credencial tendida en el disco
   donde aterriza el respaldo. Si hay receptor configurado y `age` no esta
   instalado, el respaldo **falla**: no hay modo degradado a texto plano.
6. **La restauracion valida, en este orden**: el `manifest.json` (software,
   version, base de datos y `status`), el checksum (`SHA256SUMS` y el `sha256`
   del manifiesto), la ausencia de material sensible en claro y que el
   **destino este vacio** (el esquema `ordenia` de la base destino no puede
   tener tablas). Nunca vacia ni sobrescribe datos existentes.
7. **La restauracion es explicita**: sin `--confirmar CONFIRMAR_RESTAURACION`
   no se restaura. El modo rapido `--dry-run` valida lo mismo y **no escribe
   nada** (simula la operacion y deja auditoria con resultado `dry-run`).
8. **Existe una prueba bats** (`tests/backup_restore.bats`) que ejercita el
   ciclo completo con **datos sinteticos** y en aislamiento: `pg_dump`,
   `pg_restore` y `psql` son stubs; ningun contenedor, ninguna base real.
9. **Existe un `.env.example` sin secretos** que documenta todas las variables
   que el compose exige.
10. **`gitleaks` corre en CI** sobre el repositorio y sobre el historial.
11. **El estado de despliegue no viaja en el repositorio**: los identificadores
    (uuid de la app, url publica, fechas) viven en Coolify, fuera del control
    de versiones.
12. **Cada restauracion deja rastro de auditoria**: origen, sha256 verificado,
    destino y resultado, en un log append-only (`logs/restore.log`, 0600). Sin
    valores de secretos: solo nombres y hashes. Las credenciales del destino no
    se escriben en el log.

## 2. Por que el `.env` no se copia en claro

El `.env` es lo que se lleva el acceso a la base de datos, a Supabase y a las
claves de integracion (WhatsApp, n8n, Bitwarden). Un respaldo vive en el disco,
se copia a otro equipo, se sube a un bucket y a veces termina en un ticket de
soporte. Si el `.env` viaja en claro, cada copia del respaldo es una copia de
las credenciales.

Lo que si puede viajar, y asi viaja:

- **Los nombres de las variables** (`env.vars`): sin valores, para saber que hay
  que rellenar en el destino.
- **El `.env` cifrado** (`env.age`), si hay receptor age configurado.

Si no hay receptor age, el respaldo sale **sin** el `.env` y el manifiesto lo
dice. No hay modo degradado a texto plano.

## 3. El receptor `age`: quien custodia la clave

La clave publica del receptor es un **insumo externo**. La privada vive en el
gestor de secretos (Vaultwarden, Infisical) o, si el cliente no tiene, en un
sobre cifrado fuera del servidor. Este repositorio solo usa la publica
(`AGE_RECIPIENTE`).

Consecuencias que hay que aceptar antes de cifrar:

- **Perder la clave privada implica regenerar los secretos y volver a
  desplegar.** Los respaldos anteriores quedan inservibles.
- **Rotar la clave obliga a volver a cifrar**: los respaldos viejos siguen
  ligados a la clave con que se hicieron.

## 4. Migrar respaldos que ya existen

Los respaldos hechos antes de este contrato **no se tocan**. La migracion es
manual, archivo por archivo, y nunca borra el original:

1. Cifrar con la clave del receptor **al lado** del original (`<archivo>.enc`).
2. Verificar que el descifrado devuelve el original byte a byte.
3. Recien entonces, borrar el original a mano.

Un respaldo viejo sin cifrar es un riesgo asumido y conocido: queda en el punto
5 del contrato como deuda.

## 5. Como se verifica el contrato

```bash
bats tests/backup_restore.bats    # ciclo completo con datos sinteticos y stubs
npm test                           # incluye la comprobacion del contrato
```

Y a mano, sobre un respaldo existente:

```bash
scripts/restaurar.sh --verificar /ruta/respaldo   # 0 integro, 2 invalido, 4 secreto en claro
```

## 6. Ley 21.719

El respaldo contiene datos personales del titular (notas, contactos, compras,
reglas). Consecuencias:

- El respaldo se cifra fuera del servidor antes de transportarlo.
- El log de auditoria no guarda valores de secretos ni contenidos de la base:
  solo origen, sha256, destino y resultado.
- La restauracion se hace en una base de prueba o en un destino vacio: nunca
  encima de datos de otra persona.
- La supresion de los datos de un titular (derecho de supresion) se resuelve en
  la aplicacion; el respaldo que lo contiene se destruye segun la politica de
  conservacion del operador.
