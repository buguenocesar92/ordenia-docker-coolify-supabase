// Configuracion plana de ESLint para Next.js (App Router) + TypeScript.
// eslint no esta declarado todavia como devDep (la instalacion de paquetes no esta
// autorizada en esta fase): el archivo queda preparado para cuando entre.
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
export default [
  ...nextVitals,
  ...nextTs,
  {ignores:['.next/**','node_modules/**','out/**','build/**','next-env.d.ts']},
];
