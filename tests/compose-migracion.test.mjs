import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
// Regla: la migración de producción nunca corre sola en el despliegue; se ejecuta a mano tras revisar el SQL.
for(const f of ['docker-compose.yml','docker-compose.coolify-whatsapp.yml']){
 test(f+': migrate solo bajo el perfil "migrate" y web no depende de él',()=>{
  const y=readFileSync(new URL('../'+f,import.meta.url),'utf8');
  const migrate=y.match(/^  migrate:\n((?:    .*\n|\n)+)/m)?.[1]||'';
  assert.ok(migrate,'servicio migrate presente');
  assert.match(migrate,/profiles:\s*\[\s*"migrate"\s*\]/);
  assert.doesNotMatch(y,/service_completed_successfully/);
  const web=y.match(/^  web:\n((?:    .*\n|\n)+)/m)[1];
  assert.doesNotMatch(web,/migrate/);
 });
}
