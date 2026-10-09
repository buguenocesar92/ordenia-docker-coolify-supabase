import {test} from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';
test('Standalone: /api/ingest limita por IP y responde 429 con Retry-After',async()=>{
 const base='http://127.0.0.1:13012';
 const child=spawn(process.execPath,['.next/standalone/server.js'],{env:{...process.env,APP_URL:base,SUPABASE_URL:'http://127.0.0.1:14999',SUPABASE_PUBLISHABLE_KEY:'placeholder',DATABASE_URL:'',N8N_INGEST_TOKEN:'token-ficticio-de-prueba',RATE_LIMIT_INGEST_MAX:'3',RATE_LIMIT_INGEST_WINDOW_SECONDS:'60',PORT:'13012',HOSTNAME:'127.0.0.1'},stdio:'ignore'});
 try{let ready=false;for(let i=0;i<80;i++){try{await fetch(base+'/api/health');ready=true;break;}catch{await new Promise(r=>setTimeout(r,50));}}assert.ok(ready);
 const call=()=>fetch(base+'/api/ingest',{method:'POST',headers:{Authorization:'Bearer mal','Content-Type':'application/json'},body:'{}'});
 for(let i=0;i<3;i++)assert.equal((await call()).status,401);
 const r=await call();assert.equal(r.status,429);assert.ok(Number(r.headers.get('retry-after'))>=1);
 }finally{child.kill();}
});
