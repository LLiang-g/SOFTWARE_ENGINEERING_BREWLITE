// Run the current backend against a disposable local database; never migrate the application database.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),backend=path.join(root,'backend');
const {Client}=require(path.join(backend,'node_modules/pg'));
const env=require(path.join(backend,'node_modules/dotenv')).parse(fs.readFileSync(path.join(backend,'.env')));
(async()=>{
 const original=new URL(env.DATABASE_URL);
 if(!['localhost','127.0.0.1'].includes(original.hostname))throw Error('A local PostgreSQL server is required');
 const adminUrl=new URL(original);adminUrl.pathname='/postgres';
 const admin=new Client({connectionString:adminUrl.toString()});await admin.connect();
 const name='report_verify_'+Date.now()+'_'+crypto.randomBytes(4).toString('hex');let created=false;
 try{
  await admin.query(`CREATE DATABASE "${name}"`);created=true;
  const url=new URL(original);url.pathname='/'+name;
  const db=new Client({connectionString:url.toString()});await db.connect();
  try{await db.query(fs.readFileSync(path.join(backend,'prisma/migrations/20261018081035_init/migration.sql'),'utf8'));}finally{await db.end();}
  const child=cp.spawn(process.execPath,[path.join(backend,'node_modules/vitest/vitest.mjs'),'run','--config','vitest.config.e2e.mts','--reporter=json','--outputFile='+path.join(__dirname,'api-results.json')],{cwd:backend,windowsHide:true,env:{...process.env,DATABASE_URL:url.toString(),JWT_SECRET:'report-local-test-only-not-production',ORDER_EXPIRY_WORKER_ENABLED:'false'},stdio:['ignore','pipe','pipe']});
  let log='';for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>log+=chunk.toString());
  const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',resolve);});
  fs.writeFileSync(path.join(__dirname,'api-run.log'),log);
  console.log(log.slice(-1800));process.exitCode=code;
 }finally{
  if(created&&/^report_verify_\d+_[0-9a-f]{8}$/.test(name))await admin.query(`DROP DATABASE "${name}"`);
  await admin.end();
 }
})().catch(error=>{console.error(error.code||error.message);process.exitCode=1;});
