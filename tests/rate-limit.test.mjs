import {test} from 'node:test';import assert from 'node:assert/strict';
import {createLimiter,clientIp,tooManyRequests,readLimitEnv} from '../lib/rate-limit.ts';
test('Limitador: permite hasta el máximo, luego bloquea con retryAfter y reinicia al vencer la ventana',()=>{
 let t=1000;const l=createLimiter({max:2,windowMs:10000,now:()=>t});
 assert.equal(l.check('a').ok,true);assert.equal(l.check('a').ok,true);
 const r=l.check('a');assert.equal(r.ok,false);assert.equal(r.retryAfter,10);
 assert.equal(l.check('b').ok,true,'otra clave no se ve afectada');
 t+=4000;assert.equal(l.check('a').retryAfter,6);
 t+=6000;assert.equal(l.check('a').ok,true);
});
test('Limitador: purga claves vencidas para no crecer sin límite',()=>{
 let t=0;const l=createLimiter({max:1,windowMs:1000,now:()=>t,maxKeys:50});
 for(let i=0;i<40;i++)l.check('k'+i);t=5000;for(let i=0;i<40;i++)l.check('n'+i);
 assert.ok(l.size()<=50);
});
test('clientIp usa la última entrada de X-Forwarded-For (la que añadió el proxy de confianza)',()=>{
 assert.equal(clientIp(new Headers({'x-forwarded-for':'6.6.6.6, 10.0.0.9'})),'10.0.0.9');
 assert.equal(clientIp(new Headers()),'desconocida');
});
test('tooManyRequests responde 429 con Retry-After',async()=>{
 const r=tooManyRequests(7);assert.equal(r.status,429);assert.equal(r.headers.get('retry-after'),'7');
 assert.ok((await r.json()).error);
});
test('readLimitEnv: default sensato y valores inválidos ignorados',()=>{
 assert.deepEqual(readLimitEnv({},'X',5,60),{max:5,windowMs:60000});
 assert.deepEqual(readLimitEnv({X_MAX:'9',X_WINDOW_SECONDS:'30'},'X',5,60),{max:9,windowMs:30000});
 assert.deepEqual(readLimitEnv({X_MAX:'abc',X_WINDOW_SECONDS:'-1'},'X',5,60),{max:5,windowMs:60000});
});
