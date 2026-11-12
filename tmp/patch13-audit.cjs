const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const env=require(path.join(root,'backend/node_modules/dotenv')).parse(fs.readFileSync(path.join(root,'backend/.env')));
const {Client}=require(path.join(root,'backend/node_modules/pg'));
async function main(){
 const url=new URL(env.DATABASE_URL);url.search='';
 const db=new Client({connectionString:url.toString(),connectionTimeoutMillis:5000});
 try{
 await db.connect();await db.query('BEGIN READ ONLY');
 const columns=await db.query(`SELECT table_name,column_name FROM information_schema.columns
 WHERE table_schema='public' AND ((table_name='Order' AND column_name IN ('reservationExpiresAt','reservationExpiredAt'))
 OR (table_name='Recipe' AND column_name='scalesWithSize') OR table_name='ToppingRecipe') ORDER BY table_name,column_name`);
 console.log('DB_COLUMNS',JSON.stringify(columns.rows));
 const migrations=await db.query('SELECT migration_name,checksum,finished_at,rolled_back_at FROM "_prisma_migrations" ORDER BY started_at');
 console.log('MIGRATIONS',JSON.stringify(migrations.rows.map(row=>{
 const file=path.join(root,'backend/prisma/migrations',row.migration_name,'migration.sql');
 return {name:row.migration_name,finished:!!row.finished_at,rolledBack:!!row.rolled_back_at,fileExists:fs.existsSync(file),checksumMatches:fs.existsSync(file)&&crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')===row.checksum};
 })));
 if(columns.rows.some(x=>x.table_name==='ToppingRecipe')){
 console.log('TOPPING_STOCK',JSON.stringify((await db.query('SELECT t."toppingCode",t.quantity,i.unit,i.stock FROM "ToppingRecipe" t JOIN "Ingredient" i ON i.id=t."ingredientId"')).rows));
 }
 await db.query('ROLLBACK');
 }finally{await db.end();}
 console.log('HOLD_CONFIG',JSON.stringify({minutes:env.ORDER_RESERVATION_MINUTES??'30 (default)',worker:env.ORDER_EXPIRY_WORKER_ENABLED??'true (default)'}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
