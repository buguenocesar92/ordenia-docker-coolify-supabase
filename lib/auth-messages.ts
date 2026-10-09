// Mensaje único de fallo: el texto crudo de Supabase distingue "credenciales inválidas", "usuario ya
// registrado", "email no confirmado"… y permitiría enumerar cuentas desde la URL.
export const GENERIC_FAILURE='No se pudo completar la solicitud. Revisa tus datos e inténtalo de nuevo.';
export const failureUrl=(path:string)=>path+'?message='+encodeURIComponent(GENERIC_FAILURE);
