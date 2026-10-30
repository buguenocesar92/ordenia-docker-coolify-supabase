import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync} from 'node:fs';import path from 'node:path';
const raiz=path.resolve(import.meta.dirname,'..');
const leer=(p)=>readFileSync(path.join(raiz,p),'utf8');
test('El rol de aplicacion esta documentado sin BYPASSRLS y sin politicas USING (true)',()=>{
 assert.ok(existsSync(path.join(raiz,'docs/ROL-DE-APLICACION.md')),'falta docs/ROL-DE-APLICACION.md');
 const doc=leer('docs/ROL-DE-APLICACION.md');
 assert.match(doc,/NOBYPASSRLS/,'el rol debe ser NOBYPASSRLS');
 assert.doesNotMatch(doc,/USING\s*\(\s*true\s*\)/i,'ninguna politica USING (true)');
 assert.doesNotMatch(doc,/WITH CHECK\s*\(\s*true\s*\)/i,'ninguna politica WITH CHECK (true)');
 for(const t of ['entries','rules','connections','deliveries'])assert.ok(doc.includes('ordenia.'+t),'falta '+t);
});
test('La migracion no deja politicas permisivas ni concede BYPASSRLS',()=>{
 const sql=leer('supabase/migrations/002_ordenia_rls.sql');
 assert.doesNotMatch(sql,/USING\s*\(\s*true\s*\)/i);
 assert.doesNotMatch(sql,/BYPASSRLS\s*\)?\s*(;|$)/i,'no se crea un rol con BYPASSRLS');
 assert.match(sql,/GRANT EXECUTE ON FUNCTION ordenia\.usuario_por_telefono_verificado/,'el rol de la app necesita ejecutar la funcion de resolucion');
});
test('El documento explica que el aislamiento se activa al cambiar DATABASE_URL al rol',()=>{
 const doc=leer('docs/ROL-DE-APLICACION.md');
 assert.match(doc,/DATABASE_URL/);
 assert.match(doc,/app\.user_id/,'el rol debe ver como se fija la identidad por transaccion');
});
