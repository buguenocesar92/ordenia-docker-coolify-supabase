import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync,readdirSync,existsSync} from 'node:fs';import path from 'node:path';
const raiz=path.resolve(import.meta.dirname,'..');
const leer=(p)=>readFileSync(path.join(raiz,p),'utf8');
const tablas=['entries','rules','connections','deliveries'];
test('La migracion 002 activa y FUERZA RLS y crea una politica por tabla',()=>{
 assert.ok(existsSync(path.join(raiz,'supabase/migrations/002_ordenia_rls.sql')),'falta 002_ordenia_rls.sql');
 const sql=leer('supabase/migrations/002_ordenia_rls.sql');
 for(const t of tablas){
  assert.match(sql,new RegExp(`ALTER TABLE ordenia\\.${t} ENABLE ROW LEVEL SECURITY`),t);
  assert.match(sql,new RegExp(`ALTER TABLE ordenia\\.${t} FORCE ROW LEVEL SECURITY`),t);
  assert.match(sql,new RegExp(`CREATE POLICY \\w+ ON ordenia\\.${t}\\b`),t);
 }
 assert.equal((sql.match(/CREATE POLICY/g)||[]).length,tablas.length,'una politica por tabla');
 assert.ok(sql.includes("current_setting('app.user_id', true)"),'las politicas se atan a app.user_id');
 assert.doesNotMatch(sql,/USING\s*\(\s*true\s*\)/i,'ninguna politica USING (true): no aislan');
});
test('db/index.ts fija app.user_id por transaccion (set_config local)',()=>{
 const src=leer('db/index.ts');
 assert.match(src,/export async function withUser/,'falta withUser');
 assert.match(src,/set_config\('app\.user_id'/,'falta set_config');
 assert.match(src,/true\)/,'set_config debe ser local a la transaccion');
 assert.match(src,/\.transaction\(/,'withUser debe abrir una transaccion');
});
test('Ninguna ruta de app/api/** consulta ordenia.* fuera de withUser',()=>{
 const rutas=[];const recorrer=(dir)=>{for(const e of readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())recorrer(p);else if(e.name==='route.ts')rutas.push(p);}};
 recorrer(path.join(raiz,'app/api'));
 assert.ok(rutas.length>=6,'se esperaban las rutas de la API');
 for(const r of rutas){
  const src=readFileSync(r,'utf8');
  const rel=path.relative(raiz,r);
  assert.doesNotMatch(src,/getDb\(\)\.(select|insert|update|delete)/,`${rel} consulta fuera de withUser`);
  if(/getDb\(\)/.test(src))assert.match(src,/withUser\(/,`${rel} usa getDb() sin withUser`);
 }
});
test('El webhook de ingest resuelve el titular por funciones SECURITY DEFINER, no por SELECT libre',()=>{
 const src=leer('app/api/ingest/route.ts');
 assert.match(src,/usuario_por_telefono_verificado/,'debe usar la funcion del administrador');
 assert.match(src,/enlace_por_codigo/,'debe usar la funcion del administrador');
 assert.doesNotMatch(src,/getDb\(\)\.select\(\)\.from\(connections\)/,'no puede leer connections de otro usuario');
 const sql=leer('supabase/migrations/002_ordenia_rls.sql');
 assert.match(sql,/SECURITY DEFINER/,'las funciones de resolucion son SECURITY DEFINER');
 assert.match(sql,/REVOKE ALL ON FUNCTION ordenia\.usuario_por_telefono_verificado/);
});
