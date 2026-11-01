import {test} from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {existsSync} from 'node:fs';import path from 'node:path';
// El arranque standalone necesita el build: `npm run build` genera .next/standalone/server.js.
// Sin build no hay nada que arrancar, y una prueba que no puede correr no se marca verde:
// se omite con el motivo explicito.
const BUILD=path.resolve(import.meta.dirname,'../.next/standalone/server.js');
const MOTIVO=existsSync(BUILD)?false:'falta el build standalone (.next/standalone/server.js): ejecuta `npm run build` antes de esta prueba';
test('Standalone: acceso anónimo, cabeceras falsas y origen ajeno',{skip:MOTIVO},async()=>{
 const root='http://127.0.0.1:13009';const child=spawn(process.execPath,['.next/standalone/server.js'],{env:{...process.env,APP_URL:root,SUPABASE_URL:'http://127.0.0.1:14999',SUPABASE_PUBLISHABLE_KEY:'placeholder',DATABASE_URL:'',PORT:'13009',HOSTNAME:'127.0.0.1'},stdio:['ignore','pipe','pipe']});
 let stderr='';child.stderr.on('data',d=>{stderr+=String(d)});
 try{let ready=false;for(let i=0;i<80;i++){try{await fetch(root+'/api/health');ready=true;break;}catch{await new Promise(r=>setTimeout(r,50));}}
 assert.ok(ready,'el servidor standalone no levanto: '+stderr.slice(0,500));
 const r=await fetch(root,{redirect:'manual'});assert.equal(r.status,307);assert.equal(r.headers.get('location'),'/login');
 const login=await fetch(root+'/login');assert.equal(login.status,200);
 assert.match(login.headers.get('content-security-policy')||'',/default-src 'self'/,'la CSP debe viajar en todas las rutas');
 assert.equal((await fetch(root+'/api/entries',{headers:{'oai-authenticated-user-id':'forged','oai-authenticated-user-email':'forged@example.com'}})).status,401);
 assert.equal((await fetch(root+'/api/entries',{method:'POST',headers:{Origin:'https://attacker.invalid'},body:'[]'})).status,403);
 assert.equal((await fetch(root+'/api/health')).status,503);
 }finally{child.kill();}
});
