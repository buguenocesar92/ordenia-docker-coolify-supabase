import {test} from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';
test('Standalone: cabeceras de seguridad y nonce distinto por petición',async()=>{
 const root='https://127.0.0.1:13010';const base='http://127.0.0.1:13010';
 const child=spawn(process.execPath,['.next/standalone/server.js'],{env:{...process.env,APP_URL:root,SUPABASE_URL:'http://127.0.0.1:14999',SUPABASE_PUBLISHABLE_KEY:'placeholder',DATABASE_URL:'',PORT:'13010',HOSTNAME:'127.0.0.1'},stdio:'ignore'});
 try{let ready=false;for(let i=0;i<80;i++){try{await fetch(base+'/api/health');ready=true;break;}catch{await new Promise(r=>setTimeout(r,50));}}assert.ok(ready);
 const nonces=[];
 for(const p of ['/login','/api/health']){
  const r=await fetch(base+p);const csp=r.headers.get('content-security-policy');
  assert.ok(csp,p+' sin CSP');assert.match(csp,/frame-ancestors 'none'/);
  assert.equal(r.headers.get('x-content-type-options'),'nosniff');assert.equal(r.headers.get('x-frame-options'),'DENY');
  assert.ok(r.headers.get('referrer-policy'));assert.ok(r.headers.get('permissions-policy'));
  assert.match(r.headers.get('strict-transport-security')||'',/max-age/);
  nonces.push(csp.match(/'nonce-([^']+)'/)[1]);
  if(p==='/login'){const html=await r.text();assert.ok(html.includes('nonce="'+nonces[0]+'"'),'los scripts de Next llevan el nonce');}
 }
 assert.notEqual(nonces[0],nonces[1]);
 const r403=await fetch(base+'/api/entries',{method:'POST',headers:{Origin:'https://attacker.invalid'},body:'[]'});
 assert.equal(r403.status,403);assert.ok(r403.headers.get('content-security-policy'));
 }finally{child.kill();}
});
