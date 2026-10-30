import {test,before,after} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import path from 'node:path';import pg from 'pg';
// Prueba contra Postgres de verdad: migraciones reales, rol de aplicacion real, sin superusuario.
// Necesita una base DESECHABLE: ORDENIA_TEST_DATABASE_URL (administrador). Sin ella se omite con motivo.
const URL_ADMIN=process.env.ORDENIA_TEST_DATABASE_URL;
const MOTIVO=URL_ADMIN?false:'sin ORDENIA_TEST_DATABASE_URL: se necesita un Postgres desechable';
const raiz=path.resolve(import.meta.dirname,'..');
const CLAVE='clave-solo-para-esta-prueba';
let admin,app;
const como=async(usuario,fn)=>{const c=await app.connect();try{await c.query('begin');if(usuario)await c.query("select set_config('app.user_id',$1,true)",[usuario]);const r=await fn(c);await c.query('commit');return r;}catch(e){await c.query('rollback');throw e;}finally{c.release();}};
before(async()=>{
 if(!URL_ADMIN)return;
 admin=new pg.Pool({connectionString:URL_ADMIN});
 await admin.query('drop schema if exists ordenia cascade');
 for(const r of ['anon','authenticated','ordenia_app'])await admin.query(`do $$ begin if not exists (select 1 from pg_roles where rolname='${r}') then create role ${r}; end if; end $$`);
 await admin.query(`alter role ordenia_app login nosuperuser nobypassrls password '${CLAVE}'`);
 for(const f of ['001_ordenia.sql','002_ordenia_rls.sql'])await admin.query(readFileSync(path.join(raiz,'supabase/migrations',f),'utf8'));
 await admin.query('grant usage on schema ordenia to ordenia_app');
 await admin.query('grant select,insert,update,delete on ordenia.entries,ordenia.rules to ordenia_app');
 await admin.query('grant select,insert,update on ordenia.connections to ordenia_app');
 await admin.query('grant select,insert on ordenia.deliveries to ordenia_app');
 await admin.query('grant execute on function ordenia.usuario_por_telefono_verificado(text) to ordenia_app');
 await admin.query('grant execute on function ordenia.enlace_por_codigo(text,text) to ordenia_app');
 const u=new URL(URL_ADMIN);u.username='ordenia_app';u.password=CLAVE;
 app=new pg.Pool({connectionString:u.toString()});
 await admin.query("insert into ordenia.entries(id,user_id,kind,title,original,created_at) values('e-a','a','note','t','o','2026'),('e-b','b','note','t','o','2026')");
 await admin.query("insert into ordenia.connections(user_id,phone,verified) values('a','56911111111',true)");
 await admin.query("insert into ordenia.connections(user_id,phone,verified,code_hash,code_expires) values('b','56922222222',false,'h','2099')");
});
after(async()=>{await app?.end();await admin?.end();});
test('El rol de aplicacion no es superusuario ni salta RLS',{skip:MOTIVO},async()=>{
 const {rows}=await app.query('select rolsuper,rolbypassrls from pg_roles where rolname=current_user');
 assert.deepEqual(rows[0],{rolsuper:false,rolbypassrls:false});
});
test('Sin app.user_id las politicas niegan: falla cerrado',{skip:MOTIVO},async()=>{
 const r=await como(null,c=>c.query('select id from ordenia.entries'));assert.equal(r.rowCount,0);
});
test('Cada usuario ve solo sus filas',{skip:MOTIVO},async()=>{
 const r=await como('a',c=>c.query('select id from ordenia.entries'));assert.deepEqual(r.rows,[{id:'e-a'}]);
});
test('Un usuario no puede escribir ni modificar filas de otro',{skip:MOTIVO},async()=>{
 await assert.rejects(como('a',c=>c.query("insert into ordenia.entries(id,user_id,kind,title,original,created_at) values('x','b','note','t','o','2026')")),/row-level security/);
 const r=await como('a',c=>c.query("update ordenia.entries set title='h' where id='e-b'"));assert.equal(r.rowCount,0);
 const d=await como('a',c=>c.query("delete from ordenia.entries where id='e-b'"));assert.equal(d.rowCount,0);
});
test('Upsert de reglas y reclamo de entrega funcionan bajo RLS con el rol de aplicacion',{skip:MOTIVO},async()=>{
 await como('a',c=>c.query("insert into ordenia.rules(id,user_id,keyword,category,kind) values('r1','a','k','c','note') on conflict (user_id,keyword) do update set category='c2'"));
 await como('a',c=>c.query("insert into ordenia.rules(id,user_id,keyword,category,kind) values('r2','a','k','c','note') on conflict (user_id,keyword) do update set category='c2'"));
 const f=await como('a',c=>c.query("select category from ordenia.rules where user_id='a'"));assert.deepEqual(f.rows,[{category:'c2'}]);
 const r=await como('a',c=>c.query("insert into ordenia.deliveries(id,user_id,created_at) values('a:m','a','2026') on conflict do nothing returning id"));assert.equal(r.rowCount,1);
});
test('El webhook resuelve al titular con la misma consulta que usa la ruta',{skip:MOTIVO},async()=>{
 const src=readFileSync(path.join(raiz,'app/api/ingest/route.ts'),'utf8');
 const sql=src.match(/query\('(select [^']*usuario_por_telefono_verificado\(\$1\)[^']*)'/)?.[1];
 assert.ok(sql,'no encuentro la consulta de usuarioPorTelefono en la ruta');
 assert.equal((await app.query(sql,['56911111111'])).rows[0].usuario_id,'a');
 assert.equal((await app.query(sql,['56900000000'])).rows[0]?.usuario_id??null,null);
});
test('El enlace por codigo devuelve solo lo minimo',{skip:MOTIVO},async()=>{
 const src=readFileSync(path.join(raiz,'app/api/ingest/route.ts'),'utf8');
 const sql=src.match(/query\('(select [^']*enlace_por_codigo\(\$1,\$2\)[^']*)'/)?.[1];
 assert.ok(sql);
 const {rows}=await app.query(sql,['56922222222','h']);
 assert.deepEqual(rows[0],{usuario_id:'b',vence:'2099',otro_verificado:false});
 assert.equal((await app.query(sql,['56922222222','mala'])).rows.length,0);
});
test('El rol de aplicacion no puede hacer DDL',{skip:MOTIVO},async()=>{
 await assert.rejects(app.query('create table ordenia.intrusa(id int)'),/permission denied/);
});
