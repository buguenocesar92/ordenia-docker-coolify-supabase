import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync} from 'node:fs';import path from 'node:path';
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
