import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import path from 'node:path';
const src=readFileSync(path.resolve(import.meta.dirname,'../proxy.ts'),'utf8');
test('El identificador de peticion del cliente se acepta solo con formato acotado',()=>{
 assert.ok(src.includes('/^[A-Za-z0-9_-]{1,64}$/'),'proxy.ts debe validar x-request-id');
 assert.doesNotMatch(src,/request\.headers\.get\('x-request-id'\)\|\|crypto\.randomUUID\(\)/,'no se acepta el valor del cliente sin validar');
});
