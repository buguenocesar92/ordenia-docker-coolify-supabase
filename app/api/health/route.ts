import {getPool} from '../../../db';
export const dynamic='force-dynamic';
export async function GET(){try{await getPool().query('select id from ordenia.entries limit 0');return Response.json({ok:true});}catch{return Response.json({ok:false},{status:503});}}
