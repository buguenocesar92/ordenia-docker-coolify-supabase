import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync,statSync} from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';
const raiz=path.resolve(import.meta.dirname,'..');
const leer=(p)=>readFileSync(path.join(raiz,p),'utf8');
test('El contrato de respaldo esta documentado y es normativo',()=>{
 assert.ok(existsSync(path.join(raiz,'docs/CONTRATO-RESPALDO.md')),'falta docs/CONTRATO-RESPALDO.md');
 const doc=leer('docs/CONTRATO-RESPALDO.md');
 for(const clave of ['software','version','database','sha256','status'])assert.ok(doc.includes(clave),'el manifiesto debe declarar '+clave);
 assert.match(doc,/\.env/);
 assert.match(doc,/destino/i);
 assert.match(doc,/auditor/i);
 assert.match(doc,/dry-run|modo rapido/i);
 assert.match(doc,/gitleaks/);
});
test('Los scripts de respaldo y restauracion existen, son ejecutables y fallan cerrado',()=>{
 for(const s of ['scripts/respaldo.sh','scripts/restaurar.sh']){
  assert.ok(existsSync(path.join(raiz,s)),'falta '+s);
  assert.ok((statSync(path.join(raiz,s)).mode&0o111)!==0,s+' debe ser ejecutable');
  const src=leer(s);
  assert.match(src,/set -euo pipefail/,s+' debe fallar cerrado');
 }
 const respaldo=leer('scripts/respaldo.sh');
 assert.match(respaldo,/pg_dump/);
 assert.match(respaldo,/env\.vars/,'solo los nombres de variable');
 assert.match(respaldo,/env\.age/,'el .env cifrado con age');
 assert.doesNotMatch(respaldo,/cat\s+"?\$?\{?ENV_FILE\}?"?\s*>/,'el .env no se copia en claro');
 const restaurar=leer('scripts/restaurar.sh');
 assert.match(restaurar,/CONFIRMAR_RESTAURACION/,'la restauracion exige confirmacion explicita');
 assert.match(restaurar,/--dry-run/,'existe el modo rapido de simulacion');
 assert.match(restaurar,/restore\.log/,'deja rastro de auditoria');
 assert.match(restaurar,/exit 4|4;/,'el material sensible en claro se reporta con codigo 4');
});
test('La suite bats ejercita el ciclo backup -> restore con datos sinteticos',{skip:(()=>{try{return spawnSync('bats',['--version']).status===0?false:'bats no disponible en este entorno';}catch{return 'bats no disponible en este entorno';}})()},()=>{
 assert.ok(existsSync(path.join(raiz,'tests/backup_restore.bats')),'falta tests/backup_restore.bats');
 const r=spawnSync('bats',['tests/backup_restore.bats'],{cwd:raiz,encoding:'utf8'});
 assert.equal(r.status,0,(r.stdout||'')+(r.stderr||''));
 assert.match(r.stdout||'',/ok 1/);
});
