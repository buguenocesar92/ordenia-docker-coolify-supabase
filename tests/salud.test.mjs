import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import path from 'node:path';
import {logLine,newRequestId} from '../lib/log.ts';
const raiz=path.resolve(import.meta.dirname,'..');
const leer=(p)=>readFileSync(path.join(raiz,p),'utf8');
test('El log es una linea JSON con ts, level, msg y requestId',()=>{
 const linea=logLine('info','request',{requestId:'abc',method:'GET',path:'/',status:200,ms:12});
 const obj=JSON.parse(linea);
 assert.equal(obj.level,'info');assert.equal(obj.msg,'request');assert.equal(obj.requestId,'abc');
 assert.equal(obj.method,'GET');assert.equal(obj.path,'/');assert.equal(obj.status,200);assert.equal(obj.ms,12);
 assert.ok(obj.ts&&!Number.isNaN(Date.parse(obj.ts)),'ts debe ser una fecha ISO');
});
test('El log no filtra valores de secretos: solo nombres y hashes',()=>{
 const linea=logLine('warn','origen no autorizado',{requestId:'x1',path:'/api/ingest'});
 const obj=JSON.parse(linea);
 assert.deepEqual(Object.keys(obj).sort(),['level','msg','path','requestId','ts']);
 assert.doesNotMatch(linea,/password|token|secret/i,'no debe aparecer el nombre de un secreto en el log');
});
test('Cada peticion lleva requestId',()=>{
 const id=newRequestId();
 assert.match(id,/^[0-9a-f-]{36}$/);
 assert.notEqual(newRequestId(),id);
});
test('El borde devuelve x-request-id y registra la peticion',()=>{
 const src=leer('proxy.ts');
 assert.match(src,/x-request-id/,'la cabecera x-request-id debe viajar');
 assert.match(src,/log\.(info|warn)/,'el borde debe registrar la peticion');
});
test('La salud expone version, uptime y estado de la base sin credenciales',()=>{
 const src=leer('app/api/health/route.ts');
 assert.match(src,/version/);assert.match(src,/uptime_s/);assert.match(src,/\bdb\b/);
 assert.doesNotMatch(src,/DATABASE_URL|process\.env\.[A-Z_]*PASSWORD/,'la salud no expone credenciales');
 const pkg=JSON.parse(leer('package.json'));
 assert.ok(pkg.version,'el paquete debe declarar la version');
 assert.match(leer('lib/version.ts'),/package\.json/,'la version sale del paquete');
 assert.match(src,/APP_VERSION/,'la salud usa la version del paquete');
});
