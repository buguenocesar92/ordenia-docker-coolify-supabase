// node scripts/import-sites.mjs export.json user-map.json
// export.json: {entries:[],rules:[],connections:[],deliveries:[]}
// user-map.json: {"old-Sites-user-id":"Supabase-auth-user-uuid"}
import {readFile} from 'node:fs/promises';import {Pool} from 'pg';
const [file,mapFile]=process.argv.slice(2);if(!file||!mapFile)throw Error('Indica export.json y user-map.json');
const data=JSON.parse(await readFile(file,'utf8')),map=JSON.parse(await readFile(mapFile,'utf8'));
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_SSL==='true'?{rejectUnauthorized:true}:undefined});const c=await pool.connect();
const tables={entries:['id','user_id','kind','title','original','date','time','done','created_at','category','recurrence','source'],rules:['id','user_id','keyword','category','kind'],connections:['user_id','phone','verified','code_hash','code_expires','vault_url'],deliveries:['id','user_id','created_at']};
try{await c.query('BEGIN');for(const newId of new Set(Object.values(map))){const r=await c.query('SELECT id FROM auth.users WHERE id=$1',[newId]);if(!r.rowCount)throw Error('Usuario destino no existe');}
for(const [table,columns] of Object.entries(tables)){for(const row of data[table]||[]){const old=row.user_id??row.userId;const user=map[old];if(!user)throw Error('Falta mapeo de un usuario');const values=columns.map(key=>{if(key==='user_id')return user;if(key==='verified')return false;if(['code_hash','code_expires'].includes(key))return null;if(key==='id'&&table==='deliveries')return user+':'+String(row.id).slice(String(old).length+1);const camel=key.replace(/_([a-z])/g,(_,x)=>x.toUpperCase());const value=row[key]??row[camel];if(key==='done')return Boolean(value);return value??null;});await c.query(`INSERT INTO ordenia.${table} (${columns.join(',')}) VALUES (${columns.map((_,i)=>'$'+(i+1)).join(',')})`,values);}}
await c.query('COMMIT');console.log('Importación completada. Vuelve a verificar los números de WhatsApp.');}catch{await c.query('ROLLBACK');console.error('Importación cancelada sin cambios: revisa mapeo, datos o conflictos.');process.exitCode=1;}finally{c.release();await pool.end();}
