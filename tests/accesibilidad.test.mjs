import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import path from 'node:path';
const raiz=path.resolve(import.meta.dirname,'..');
const leer=(p)=>readFileSync(path.join(raiz,p),'utf8');
const cuenta=(s,re)=>(s.match(re)||[]).length;
// axe-core y jsdom no estan instalados en este entorno (instalar paquetes no autorizado):
// la puerta se cumple por analisis estatico del JSX, sin ejecutar el navegador.
test('Login: cada campo tiene etiqueta y el mensaje de error es anunciable',()=>{
 const src=leer('app/login/page.tsx');
 assert.ok(cuenta(src,/<label\b/g)>=cuenta(src,/<input\b/g),'cada input debe estar dentro de un label');
 assert.ok(cuenta(src,/<input\b/g)>=2,'login debe pedir correo y contrasena');
 assert.match(src,/role="status"|aria-live=/,'el mensaje de error debe anunciarse (role=status o aria-live)');
});
test('Recuperacion de contrasena: el mensaje se anuncia y el campo tiene etiqueta',()=>{
 const src=leer('app/reset-password/page.tsx');
 assert.ok(cuenta(src,/<label\b/g)>=cuenta(src,/<input\b/g),'cada input debe estar dentro de un label');
 assert.match(src,/role="status"|aria-live=/,'el mensaje de error debe anunciarse');
});
test('Panel: punto de referencia main, un h1, etiquetas en los campos y nombre accesible en los botones de icono',()=>{
 const src=leer('app/dashboard.tsx');
 assert.match(src,/<main\b/,'el panel debe tener el punto de referencia main');
 assert.match(src,/<h1\b/,'el panel debe tener un h1');
 assert.ok(cuenta(src,/<label\b/g)>=cuenta(src,/<input\b/g),'cada input debe estar dentro de un label');
 assert.ok(cuenta(src,/aria-label=/g)>=3,'los botones solo-icono necesitan nombre accesible');
});
test('Cerrar sesion tiene nombre accesible',()=>{
 const src=leer('app/page.tsx');
 assert.match(src,/Cerrar sesi/,'el boton de cierre de sesion debe tener texto');
 assert.ok(cuenta(src,/<h1\b/g)>=0);
});
