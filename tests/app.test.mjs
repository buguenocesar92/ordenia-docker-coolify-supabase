import {test} from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';
test('Standalone: acceso anónimo, cabeceras falsas y origen ajeno',async()=>{
 const root='http://127.0.0.1:13009';const child=spawn(process.execPath,['.next/standalone/server.js'],{env:{...process.env,APP_URL:root,SUPABASE_URL:'http://127.0.0.1:14999',SUPABASE_PUBLISHABLE_KEY:'placeholder',DATABASE_URL:'',PORT:'13009',HOSTNAME:'127.0.0.1'},stdio:'ignore'});
 try{let ready=false;for(let i=0;i<80;i++){try{await fetch(root+'/api/health');ready=true;break;}catch{await new Promise(r=>setTimeout(r,50));}}assert.ok(ready);
 const r=await fetch(root,{redirect:'manual'});assert.equal(r.status,307);assert.equal(r.headers.get('location'),'/login');
 assert.equal((await fetch(root+'/login')).status,200);
 assert.equal((await fetch(root+'/api/entries',{headers:{'oai-authenticated-user-id':'forged','oai-authenticated-user-email':'forged@example.com'}})).status,401);
 assert.equal((await fetch(root+'/api/entries',{method:'POST',headers:{Origin:'https://attacker.invalid'},body:'[]'})).status,403);
 assert.equal((await fetch(root+'/api/health')).status,503);
 }finally{child.kill();}
});
