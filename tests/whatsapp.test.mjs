import {test} from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {createHmac} from 'node:crypto';
test('Webhook: challenge, rechazo de firma y aceptación de evento válido',async()=>{
 const port=18789,secret='test-secret';const child=spawn(process.execPath,['integrations/whatsapp-gateway.mjs'],{env:{...process.env,PORT:String(port),META_APP_SECRET:secret,META_VERIFY_TOKEN:'test-verify',META_ACCESS_TOKEN:'test-token',WHATSAPP_PHONE_NUMBER_ID:'test-phone-id',WHATSAPP_GRAPH_VERSION:'v25.0',ORDENIA_URL:'http://localhost:1',N8N_INGEST_TOKEN:'test-ingest'},stdio:'ignore'});
 try{let ready=false;for(let i=0;i<40;i++){try{await fetch(`http://127.0.0.1:${port}/health`);ready=true;break;}catch{await new Promise(r=>setTimeout(r,50));}}assert.ok(ready);
 const url=`http://127.0.0.1:${port}/webhooks/whatsapp`;
 const challenge=await fetch(url+'?hub.mode=subscribe&hub.verify_token=test-verify&hub.challenge=123');assert.equal(challenge.status,200);assert.equal(await challenge.text(),'123');
 assert.equal((await fetch(url+'?hub.mode=subscribe&hub.verify_token=wrong')).status,403);
 assert.equal((await fetch(url,{method:'POST',body:'{}'})).status,401);
 const body=JSON.stringify({object:'whatsapp_business_account',entry:[]});const signature='sha256='+createHmac('sha256',secret).update(body).digest('hex');
 assert.equal((await fetch(url,{method:'POST',headers:{'x-hub-signature-256':signature},body})).status,200);
 }finally{child.kill();}
});
