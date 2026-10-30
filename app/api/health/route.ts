import {getPool} from '../../../db';
import {APP_VERSION} from '../../../lib/version';
export const dynamic='force-dynamic';
const INICIO=Date.now();
// Salud sin credenciales ni nombres de host: solo estado, version y antiguedad del proceso.
export async function GET(){let db:'up'|'down'='down';try{await getPool().query('select id from ordenia.entries limit 0');db='up';}catch{}return Response.json({ok:db==='up',version:APP_VERSION,uptime_s:Math.floor((Date.now()-INICIO)/1000),db},{status:db==='up'?200:503});}
