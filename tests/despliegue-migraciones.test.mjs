import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import path from 'node:path';
const raiz=path.resolve(import.meta.dirname,'..');
const leer=(p)=>readFileSync(path.join(raiz,p),'utf8');
// La guia de despliegue es la que se sigue en produccion: si ofrece una via que en realidad no
// aplica 002, el webhook de WhatsApp se queda sin funciones y responde 500 a todo mensaje.
test('scripts/migrate.mjs solo aplica 001, y la guia lo dice',()=>{
 const src=leer('scripts/migrate.mjs');
 assert.match(src,/001_ordenia/,'el script aplica 001');
 assert.doesNotMatch(src,/002_ordenia_rls/,'el script no aplica 002');
 const doc=leer('docs/DESPLIEGUE-COOLIFY-SUPABASE.md');
 assert.match(doc,/no\*{0,2} aplica `002`/,'la guia debe decir que el script no aplica 002');
});
test('La guia aplica 002 con psql y una URL de administracion, no con el script',()=>{
 const doc=leer('docs/DESPLIEGUE-COOLIFY-SUPABASE.md');
 assert.match(doc,/Para `002_ordenia_rls\.sql`[\s\S]*?psql/,'002 se aplica con la via de psql');
 assert.match(doc,/URL de administraci/,'la via de psql es con una URL de administracion');
});
test('La guia exige comprobar las funciones de resolucion antes de desplegar',()=>{
 const doc=leer('docs/DESPLIEGUE-COOLIFY-SUPABASE.md');
 assert.match(doc,/\\df ordenia\.usuario_por_telefono_verificado/,'falta la comprobacion previa al despliegue');
 assert.match(doc,/ordenia\.enlace_por_codigo/);
});
test('La migracion 002 no dice que sea solo para base de prueba',()=>{
 const sql=leer('supabase/migrations/002_ordenia_rls.sql');
 assert.doesNotMatch(sql,/Aplicar SOLO en base de prueba/,'contradice el orden obligatorio de despliegue');
 assert.match(sql,/antes de desplegar/);
});
test('El rol de aplicacion se activa despues de aplicar 002',()=>{
 const doc=leer('docs/ROL-DE-APLICACION.md');
 const seccion=doc.slice(doc.indexOf('## Como se activa'));
 const i002=seccion.indexOf('002_ordenia_rls.sql');
 const iGrant=seccion.indexOf('Crear el rol y aplicar los `GRANT`');
 assert.ok(i002>=0&&iGrant>=0,'faltan los pasos de activacion');
 assert.ok(i002<iGrant,'002 se aplica antes de crear el rol y aplicar los GRANT: si no, el GRANT EXECUTE falla');
});
