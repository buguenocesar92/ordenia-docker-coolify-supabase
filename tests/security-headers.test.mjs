import {test} from 'node:test';import assert from 'node:assert/strict';
import {buildCsp,securityHeaders} from '../lib/security-headers.ts';
test('CSP: nonce, strict-dynamic, sin unsafe-inline/eval en script y frame-ancestors none',()=>{
 const csp=buildCsp('abc123',{isDev:false,https:true});
 const script=csp.split(';').map(s=>s.trim()).find(s=>s.startsWith('script-src'));
 assert.match(script,/'nonce-abc123'/);assert.match(script,/'strict-dynamic'/);
 assert.doesNotMatch(script,/unsafe-inline|unsafe-eval/);
 for(const d of ["default-src 'self'","object-src 'none'","base-uri 'self'","form-action 'self'","frame-ancestors 'none'","upgrade-insecure-requests"])assert.ok(csp.includes(d),d);
});
test('CSP: unsafe-eval solo en desarrollo; upgrade-insecure-requests solo con https',()=>{
 assert.match(buildCsp('n',{isDev:true,https:false}),/unsafe-eval/);
 assert.doesNotMatch(buildCsp('n',{isDev:false,https:false}),/unsafe-eval|upgrade-insecure/);
});
test('Cabeceras: nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy; HSTS solo con APP_URL https',()=>{
 const h=securityHeaders('https://ordenia.example.cl');
 assert.equal(h['X-Content-Type-Options'],'nosniff');assert.equal(h['X-Frame-Options'],'DENY');
 assert.equal(h['Referrer-Policy'],'strict-origin-when-cross-origin');
 assert.match(h['Permissions-Policy'],/camera=\(\)/);assert.match(h['Strict-Transport-Security'],/max-age=\d+/);
 assert.equal(securityHeaders('http://127.0.0.1:3000')['Strict-Transport-Security'],undefined);
 assert.equal(securityHeaders(undefined)['Strict-Transport-Security'],undefined);
 assert.equal(securityHeaders('no es url')['Strict-Transport-Security'],undefined);
});
