import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {failureUrl,GENERIC_FAILURE} from '../lib/auth-messages.ts';
test('failureUrl es constante: no depende del error de Supabase',()=>{
 assert.equal(failureUrl('/login'),'/login?message='+encodeURIComponent(GENERIC_FAILURE));
 assert.equal(failureUrl('/reset-password'),'/reset-password?message='+encodeURIComponent(GENERIC_FAILURE));
 assert.doesNotMatch(GENERIC_FAILURE,/not found|invalid|registered|exist/i);
});
test('login/actions.ts no vuelca error.message de Supabase a la URL',()=>{
 const src=readFileSync(new URL('../app/login/actions.ts',import.meta.url),'utf8');
 assert.doesNotMatch(src,/error\??\.message/);
});
test('login/actions.ts aplica el limitador de intentos por IP y por correo',()=>{
 const src=readFileSync(new URL('../app/login/actions.ts',import.meta.url),'utf8');
 assert.match(src,/loginLimiter\(\)/);assert.match(src,/RATE_LIMITED/);
});
