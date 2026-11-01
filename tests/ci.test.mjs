import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync} from 'node:fs';import path from 'node:path';
import {parseYaml,ErrorYaml} from './yaml-mini.mjs';
const raiz=path.resolve(import.meta.dirname,'..');
const leer=(p)=>readFileSync(path.join(raiz,p),'utf8');
const pkg=JSON.parse(leer('package.json'));
test('Existe el workflow de CI con las puertas del proyecto',()=>{
 assert.ok(existsSync(path.join(raiz,'.github/workflows/ci.yml')),'falta .github/workflows/ci.yml');
 const yml=leer('.github/workflows/ci.yml');
 assert.match(yml,/lint/,'falta la puerta de lint');
 assert.match(yml,/typecheck|npm run check/,'falta la puerta de typecheck');
 assert.match(yml,/npm (ci|test)/,'falta la puerta de tests');
 assert.match(yml,/npm run build/,'falta la puerta de build');
 assert.match(yml,/gitleaks/,'falta el escaneo de secretos');
 assert.match(yml,/node-version:\s*'?22/,'la CI debe correr Node 22');
});
test('La CI no despliega, no aplica migraciones y no publica secretos',()=>{
 const yml=leer('.github/workflows/ci.yml');
 assert.doesNotMatch(yml,/coolify\s+deploy|deploy\s*:\s*true|environment:\s*production/,'la CI no despliega');
 assert.doesNotMatch(yml,/scripts\/migrate\.mjs|db:migrate/,'la CI no aplica migraciones');
 assert.doesNotMatch(yml,/secrets\.(?!GITHUB_TOKEN)/,'la CI no usa secretos del repositorio');
});
test('package.json declara los scripts de calidad',()=>{
 assert.equal(pkg.scripts.test,'node --test tests/*.test.mjs');
 assert.ok(pkg.scripts.check,'debe mantenerse el script check');
 assert.ok(pkg.scripts.typecheck,'falta el alias typecheck');
 assert.ok(pkg.scripts.lint,'falta el script lint');
});
test('El repositorio tiene configuracion de gitleaks versionada',()=>{
 assert.ok(existsSync(path.join(raiz,'.gitleaks.toml')),'falta .gitleaks.toml');
 const g=leer('.gitleaks.toml');
 assert.match(g,/useDefault\s*=\s*true/,'gitleaks debe partir de la configuracion por defecto');
});
test('El workflow es una estructura que GitHub puede ejecutar',()=>{
 const w=parseYaml(leer('.github/workflows/ci.yml'));
 assert.ok(w&&typeof w==='object'&&!Array.isArray(w),'el workflow debe ser un mapa');
 assert.deepEqual(Object.keys(w).sort(),['jobs','name','on','permissions'],'claves de nivel superior inesperadas');
 assert.ok(w.name,'el workflow debe tener nombre');
 assert.ok(w.on&&typeof w.on==='object','"on" debe ser un mapa de disparadores');
 assert.ok(w.on.push,'falta el disparador push');
 assert.ok('pull_request' in w.on,'falta el disparador pull_request');
 assert.equal(w.permissions.contents,'read','la CI solo debe leer el repositorio');
 assert.ok(w.jobs&&typeof w.jobs==='object'&&Object.keys(w.jobs).length>0,'debe haber al menos un job');
 for(const [id,job] of Object.entries(w.jobs)){
  assert.ok(job['runs-on'],`el job ${id} no declara runs-on`);
  assert.ok(Array.isArray(job.steps)&&job.steps.length>0,`el job ${id} no tiene pasos`);
  for(const [n,paso] of job.steps.entries()){
   const donde=`job ${id}, paso ${n+1}`;
   assert.ok(paso&&typeof paso==='object'&&!Array.isArray(paso),`${donde}: el paso no es un mapa`);
   assert.ok(paso.name,`${donde}: el paso no tiene nombre`);
   const tieneUses=typeof paso.uses==='string';
   const tieneRun=typeof paso.run==='string';
   assert.ok(tieneUses!==tieneRun,`${donde}: el paso debe usar "uses" o "run", no ambos`);
   if(tieneUses) assert.match(paso.uses,/@v\d+(\.\d+){0,2}$/i,`${donde}: la accion debe ir fijada a una version (${paso.uses})`);
   if(tieneRun) assert.ok(paso.run.trim().length>0,`${donde}: el paso "run" esta vacio`);
  }
 }
});
test('El escaneo de secretos cubre la historia completa del repositorio',()=>{
 const w=parseYaml(leer('.github/workflows/ci.yml'));
 const pasos=w.jobs.calidad.steps;
 const checkout=pasos.find((p)=>typeof p.uses==='string'&&p.uses.startsWith('actions/checkout'));
 assert.ok(checkout,'falta el paso de actions/checkout');
 assert.ok(checkout.with,'checkout debe declarar "with"');
 assert.equal(String(checkout.with['fetch-depth']),'0','gitleaks escanea el historial: checkout debe traer fetch-depth 0');
});
test('El validador del workflow no es vacioso',()=>{
 assert.throws(()=>parseYaml('jobs:\n  a: 1\n  a: 2\n'),ErrorYaml,'una clave duplicada debe rechazarse');
 assert.throws(()=>parseYaml('jobs:\n\t a: 1\n'),ErrorYaml,'la indentacion con tabulador debe rechazarse');
 assert.throws(()=>parseYaml('jobs:\n  a: 1\n   b: 2\n'),ErrorYaml,'una indentacion inconsistente debe rechazarse');
});
