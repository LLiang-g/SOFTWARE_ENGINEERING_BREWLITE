const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),backend=path.join(root,'backend');
const target=path.join(root,'proposed-fixes/22-single-init/migration.sql');
const original=fs.readFileSync(target,'utf8');
if(!original.startsWith('-- BrewLite:')){
 const prior=fs.readFileSync(path.join(root,'proposed-fixes/21-migration-repair/backend/prisma/migrations/20261112000000_align_current_schema/migration.sql'),'utf8');
 const checks=prior.slice(prior.indexOf('ALTER TABLE "Ingredient" ADD CONSTRAINT'),prior.lastIndexOf('COMMIT;'));
 if(!checks.includes('OrderExchange_one_requested'))throw Error('Missing checks');
 fs.writeFileSync(target,'-- BrewLite: complete initialization for an EMPTY database only.\nBEGIN;\n'+original+'\n'+checks+'\nCOMMIT;\n');
}
const {Client}=require(path.join(backend,'node_modules/pg'));
const env=require(path.join(backend,'node_modules/dotenv')).parse(fs.readFileSync(path.join(backend,'.env')));
(async()=>{
 const source=new URL(env.DATABASE_URL);if(!['localhost','127.0.0.1'].includes(source.hostname))throw Error('Local server required');
 const adminUrl=new URL(source);adminUrl.pathname='/postgres';
 const admin=new Client({connectionString:adminUrl.toString()});await admin.connect();
 const name='patch22_'+Date.now()+'_'+crypto.randomBytes(3).toString('hex');let created=false;
 try{
  await admin.query(`CREATE DATABASE "${name}"`);created=true;
  const url=new URL(source);url.pathname='/'+name;const db=new Client({connectionString:url.toString()});await db.connect();
  try{
   await db.query(fs.readFileSync(target,'utf8'));
   const config=path.join(root,'tmp/single-init-prisma.config.ts');
   fs.writeFileSync(config,`export default {schema:${JSON.stringify(path.join(backend,'prisma/schema.prisma'))},datasource:{url:process.env.DATABASE_URL}};`);
   cp.execFileSync(process.execPath,[path.join(backend,'node_modules/prisma/build/index.js'),'migrate','diff','--config',config,'--from-config-datasource','--to-schema',path.join(backend,'prisma/schema.prisma'),'--exit-code'],{cwd:backend,env:{...process.env,DATABASE_URL:url.toString()},stdio:'pipe'});
   cp.execFileSync(process.execPath,[path.join(backend,'node_modules/tsx/dist/cli.mjs'),'prisma/seed.ts'],{cwd:backend,env:{...process.env,DATABASE_URL:url.toString()},stdio:'pipe'});
   const counts=(await db.query('SELECT (SELECT count(*)::int FROM "Product") products,(SELECT count(*)::int FROM "Recipe") recipes,(SELECT count(*)::int FROM "ToppingRecipe") topping_recipes')).rows[0];
   if(counts.products!==4||counts.recipes!==12||counts.topping_recipes!==2)throw Error('Seed failed');
   try{await db.query('UPDATE "Ingredient" SET stock=-1');throw Error('Negative stock accepted');}catch(e){if(e.code!=='23514')throw e;}
   console.log('PASS: empty database initialization; schema diff empty; seed '+JSON.stringify(counts)+'; negative stock rejected.');
  }finally{await db.end();}
 }finally{
  if(created&&/^patch22_\d+_[0-9a-f]+$/.test(name))await admin.query(`DROP DATABASE "${name}"`);
  await admin.end();
 }
})().catch(e=>{console.error(e.code||e.message);process.exitCode=1});
