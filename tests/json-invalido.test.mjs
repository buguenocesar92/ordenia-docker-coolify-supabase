import {test} from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';
import {readJson} from '../lib/http.ts';
test('readJson devuelve undefined ante JSON inválido o vacío',async()=>{
 assert.deepEqual(await readJson(new Request('http://x',{method:'POST',body:'{"a":1}'})),{a:1});
 assert.equal(await readJson(new Request('http://x',{method:'POST',body:'{roto'})),undefined);
 assert.equal(await readJson(new Request('http://x',{method:'POST',body:''})),undefined);
 assert.equal(await readJson(new Request('http://x',{method:'POST',body:'null'})),undefined);
});
test('Standalone: /api/ingest con JSON inválido responde 400, no 500',async()=>{
 const base='http://127.0.0.1:13011';
 const child=spawn(process.execPath,['.next/standalone/server.js'],{env:{...process.env,APP_URL:base,SUPABASE_URL:'http://127.0.0.1:14999',SUPABASE_PUBLISHABLE_KEY:'placeholder',DATABASE_URL:'',N8N_INGEST_TOKEN:'token-ficticio-de-prueba',PORT:'13011',HOSTNAME:'127.0.0.1'},stdio:'ignore'});
 try{let ready=false;for(let i=0;i<80;i++){try{await fetch(base+'/api/health');ready=true;break;}catch{await new Promise(r=>setTimeout(r,50));}}assert.ok(ready);
 const r=await fetch(base+'/api/ingest',{method:'POST',headers:{Authorization:'Bearer token-ficticio-de-prueba','Content-Type':'application/json'},body:'{roto'});
 assert.equal(r.status,400);assert.ok((await r.json()).error);
 }finally{child.kill();}
});
