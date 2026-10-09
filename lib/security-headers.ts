// Política de cabeceras de seguridad. Sin imports para poder probarla con node:test.
export function buildCsp(nonce:string,opts:{isDev:boolean;https:boolean}){
 const d=[
  "default-src 'self'",
  `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${opts.isDev?" 'unsafe-eval'":''}`,
  // Los atributos style={{}} de React no admiten nonce: se permite 'unsafe-inline' solo en estilos (no ejecuta código).
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
 ];
 if(opts.https)d.push('upgrade-insecure-requests');
 return d.join('; ');
}
export function isHttps(appUrl?:string){try{return !!appUrl&&new URL(appUrl).protocol==='https:'}catch{return false}}
export function securityHeaders(appUrl?:string){
 const h:Record<string,string>={
  'X-Content-Type-Options':'nosniff',
  'X-Frame-Options':'DENY',
  'Referrer-Policy':'strict-origin-when-cross-origin',
  'Permissions-Policy':'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  'Cross-Origin-Opener-Policy':'same-origin',
 };
 if(isHttps(appUrl))h['Strict-Transport-Security']='max-age=31536000; includeSubDomains';
 return h;
}
