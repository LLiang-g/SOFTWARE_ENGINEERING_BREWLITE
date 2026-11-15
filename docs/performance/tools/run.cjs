// Run from repository root. Requires backend dependencies, local PostgreSQL and CREATE DATABASE permission.
// No production rows are read or changed. A unique temporary DB and API process are used.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),os=require('node:os'),net=require('node:net');
const {performance}=require('node:perf_hooks');const {randomUUID,createHash}=require('node:crypto');
const root=path.resolve(__dirname,'../../..'),backend=path.join(root,'backend');
const {Client}=require(path.join(backend,'node_modules/pg'));
const dotenv=require(path.join(backend,'node_modules/dotenv'));
const config={products:50,users:20,ordersPerUser:5,itemsPerOrder:3,warmupSeconds:10,measurementSeconds:30,timeoutMs:5000,thresholdMs:500};
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const work=path.join(root,'tmp','performance-'+stamp),stage=path.join(work,'backend');
const output=path.join(root,'docs/performance',stamp);fs.mkdirSync(stage,{recursive:true});fs.mkdirSync(output,{recursive:true});
const sha=cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const sourceHash=createHash('sha256');
function hashTree(dir,rel=''){for(const e of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const f=path.join(dir,e.name),r=path.join(rel,e.name);if(e.isDirectory())hashTree(f,r);else sourceHash.update(r).update(fs.readFileSync(f));}}
hashTree(path.join(backend,'src'));sourceHash.update(fs.readFileSync(path.join(backend,'prisma/schema.prisma'))).update(fs.readFileSync(path.join(backend,'package-lock.json')));
const fingerprint=sourceHash.digest('hex');
for(const f of ['src','prisma','package.json','package-lock.json','prisma.config.ts','tsconfig.json','tsconfig.build.json','nest-cli.json'])fs.cpSync(path.join(backend,f),path.join(stage,f),{recursive:true});
fs.symlinkSync(path.join(backend,'node_modules'),path.join(stage,'node_modules'),'junction');
function cli(file,args,env){return cp.execFileSync(process.execPath,[path.join(backend,'node_modules',file),...args],{cwd:stage,env:{...process.env,...env},stdio:['ignore','pipe','pipe'],encoding:'utf8'});}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function freePort(){const s=net.createServer();await new Promise((r,j)=>s.once('error',j).listen(0,'127.0.0.1',r));const port=s.address().port;await new Promise(r=>s.close(r));return port;}
function quantile(sorted,p){return sorted[Math.max(0,Math.ceil(p*sorted.length)-1)]||0;}
function summarize(samples,elapsed){const values=samples.map(x=>x.ms).sort((a,b)=>a-b);return {requests:samples.length,errors:samples.filter(x=>!x.ok).length,errorRatePercent:100*samples.filter(x=>!x.ok).length/samples.length,elapsedSeconds:elapsed/1000,requestsPerSecond:samples.length/(elapsed/1000),minMs:values[0],meanMs:values.reduce((a,b)=>a+b,0)/values.length,p50Ms:quantile(values,.50),p90Ms:quantile(values,.90),p95Ms:quantile(values,.95),p99Ms:quantile(values,.99),maxMs:values.at(-1)};}
(async()=>{
 const local=dotenv.parse(fs.readFileSync(path.join(backend,'.env')));const base=new URL(local.DATABASE_URL);
 if(!['localhost','127.0.0.1','[::1]'].includes(base.hostname))throw Error('Only a local PostgreSQL server is accepted');
 const adminUrl=new URL(base);adminUrl.pathname='/postgres';const admin=new Client({connectionString:adminUrl.toString(),connectionTimeoutMillis:5000});await admin.connect();
 const name='perf30_'+Date.now()+'_'+randomUUID().replaceAll('-','').slice(0,8);let created=false,child,logStream;
 try{
  await admin.query(`CREATE DATABASE "${name}"`);created=true;const testUrl=new URL(base);testUrl.pathname='/'+name;
  const port=await freePort(),url='http://127.0.0.1:'+port;
  const env={DATABASE_URL:testUrl.toString(),PORT:String(port),NODE_ENV:'production',JWT_SECRET:randomUUID()+randomUUID(),VNPAY_ENABLED:'false',PAYMENT_MOCK_ENABLED:'true',ORDER_EXPIRY_WORKER_ENABLED:'false',ORDER_RESERVATION_MINUTES:'30'};
  console.log('Building a fresh source snapshot; database/API are isolated.');
  cli('prisma/build/index.js',['generate'],env);cli('@nestjs/cli/bin/nest.js',['build'],env);
  const db=new Client({connectionString:testUrl.toString()});await db.connect();
  let databaseMetadata,productIds=[];
  try{
   await db.query(fs.readFileSync(path.join(backend,'prisma/migrations/20261018081035_init/migration.sql'),'utf8'));
   databaseMetadata=(await db.query("SELECT version(),current_setting('max_connections') AS max_connections,current_setting('shared_buffers') AS shared_buffers")).rows[0];
   const ingredients=(await db.query(`INSERT INTO "Ingredient" (name,unit,stock) VALUES ('Performance coffee','g',1000000000),('Performance cup','piece',1000000000),('Performance topping','g',1000000000) RETURNING id`)).rows.map(x=>x.id);
   for(let i=0;i<config.products;i++){
    const id=(await db.query('INSERT INTO "Product" (name,price,"imageUrl") VALUES ($1,$2,$3) RETURNING id',['Performance product '+(i+1),35000+(i%5)*5000,'/test.jpg'])).rows[0].id;productIds.push(id);
    await db.query('INSERT INTO "Recipe" ("productId","ingredientId",quantity,"scalesWithSize") VALUES ($1,$2,20,true),($1,$3,1,false)',[id,ingredients[0],ingredients[1]]);
   }
   for(const code of ['KEM','TRAN_CHAU'])await db.query('INSERT INTO "ToppingRecipe" ("toppingCode","ingredientId",quantity) VALUES ($1,$2,20)',[code,ingredients[2]]);
  }finally{await db.end();}
  logStream=fs.createWriteStream(path.join(work,'api.log'));
  child=cp.spawn(process.execPath,['dist/main.js'],{cwd:stage,env:{...process.env,...env},stdio:['ignore','pipe','pipe']});
  child.stdout.pipe(logStream);child.stderr.pipe(logStream,{end:false});
  for(let attempt=0;;attempt++){
   if(child.exitCode!==null)throw Error('Isolated API exited; inspect temporary api.log');
   try{const r=await fetch(url+'/products',{signal:AbortSignal.timeout(2000)});if(r.ok)break;}catch{}
   if(attempt>40)throw Error('Isolated API startup timed out');await sleep(250);
  }
  async function setupPost(route,body,token){const response=await fetch(url+route,{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token,'idempotency-key':randomUUID()}: {})},body:JSON.stringify(body)});const data=await response.json();if(!response.ok)throw Error('Fixture setup failed: '+route+' HTTP '+response.status);return data;}
  const users=[];
  for(let i=0;i<config.users;i++){
   const account=await setupPost('/auth/register',{email:'perf-'+i+'@fixture.local',password:'temporary-fixture-password'});
   const user={token:account.accessToken,orders:[]};if(!user.token)throw Error('Auth token missing');
   for(let k=0;k<config.ordersPerUser;k++){
    const items=Array.from({length:config.itemsPerOrder},(_,j)=>({productId:productIds[(i*5+k*3+j)%productIds.length],size:['S','M','L'][j],toppings:j===1?['KEM']:[],qty:1}));
    const order=await setupPost('/orders',{items},user.token);user.orders.push(order.id);
   }users.push(user);
  }
  console.log(`Fixtures ready: ${productIds.length} products, ${users.length} users, ${users.length*config.ordersPerUser} orders; API production build on loopback.`);
  const cases=[
   {id:'products-list',endpoint:'GET /products',request:()=>({route:'/products'}),valid:x=>Array.isArray(x)&&x.length===config.products},
   {id:'product-detail',endpoint:'GET /products/:id',request:(i,n)=>{const id=productIds[(i+n)%productIds.length];return {route:'/products/'+id,id};},valid:(x,q)=>x.id===q.id},
   {id:'order-detail',endpoint:'GET /orders/:id',request:(i,n)=>{const u=users[i],id=u.orders[n%u.orders.length];return {route:'/orders/'+id,token:u.token,id};},valid:(x,q)=>x.id===q.id},
   {id:'orders-mine',endpoint:'GET /orders/me',request:i=>({route:'/orders/me',token:users[i].token}),valid:x=>Array.isArray(x)&&x.length===config.ordersPerUser},
  ];
  const results=[];
  for(const scenario of cases){
   async function phase(seconds,record){const samples=[],start=performance.now(),deadline=start+seconds*1000;
    await Promise.all(Array.from({length:config.users},async(_,i)=>{let seq=0;while(performance.now()<deadline){const q=scenario.request(i,seq++),t=performance.now();let status=0,ok=false,error='';
     try{const response=await fetch(url+q.route,{headers:q.token?{authorization:'Bearer '+q.token}:{},signal:AbortSignal.timeout(config.timeoutMs)});status=response.status;const body=await response.text();const elapsed=performance.now()-t;ok=status===200&&scenario.valid(JSON.parse(body),q);if(record)samples.push({ms:elapsed,status,ok,error:ok?'':'unexpected response'});}
     catch(e){if(record)samples.push({ms:performance.now()-t,status,ok:false,error:e.name});}
    }}));return {samples,elapsed:performance.now()-start};
   }
   console.log(`${scenario.endpoint}: warm-up ${config.warmupSeconds}s, then measure ${config.measurementSeconds}s with ${config.users} closed-loop users.`);
   await phase(config.warmupSeconds,false);const measured=await phase(config.measurementSeconds,true);const summary=summarize(measured.samples,measured.elapsed);
   summary.pass=summary.errors===0&&summary.p95Ms<=config.thresholdMs;
   results.push({id:scenario.id,endpoint:scenario.endpoint,...summary});
   fs.writeFileSync(path.join(output,scenario.id+'.csv'),'duration_ms,status,valid,error\n'+measured.samples.map(x=>[x.ms.toFixed(4),x.status,x.ok,x.error].join(',')).join('\n')+'\n');
   console.log(`${scenario.endpoint}: p95=${summary.p95Ms.toFixed(2)}ms, p99=${summary.p99Ms.toFixed(2)}ms, errors=${summary.errors}/${summary.requests}, RPS=${summary.requestsPerSecond.toFixed(1)}, ${summary.pass?'PASS':'FAIL'}`);
   fs.writeFileSync(path.join(output,'partial-results.json'),JSON.stringify(results,null,2));
  }
  const report={measuredAtUtc:new Date().toISOString(),gitCommit:sha,sourceSnapshotSha256:fingerprint,configuration:config,environment:{cpu:os.cpus()[0]?.model,logicalCpus:os.cpus().length,ramGiB:os.totalmem()/2**30,platform:os.platform(),osRelease:os.release(),node:process.version,database:databaseMetadata,apiMode:'fresh NestJS production build; dedicated local process',loadGenerator:'Node fetch / HTTP keep-alive; same host as API',network:'loopback API; PostgreSQL on localhost',traffic:'20 closed-loop users per endpoint, no think time; endpoints measured in separate phases'},results,pass:results.every(x=>x.pass),limitations:['One local run, not a guarantee for other hardware or Internet traffic.','Only GET endpoints; no VNPay/network gateway latency or browser rendering measured.','API and load generator share CPU; database host resources and other background workloads are not isolated.','This is a read workload with synthetic data, not a capacity limit or long-duration soak test.'],cleanup:'Temporary API/database removed after measurement.'};
  fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(report,null,2)+'\n');
  fs.rmSync(path.join(output,'partial-results.json'));
  console.log('RESULTS: '+path.relative(root,path.join(output,'results.json')));
 }finally{
  if(child&&child.exitCode===null){const ended=new Promise(r=>child.once('exit',r));child.kill();await ended;}
  if(logStream)logStream.end();
  if(created){if(!/^perf30_\d+_[a-f0-9]{8}$/.test(name))throw Error('Unexpected cleanup target');await admin.query(`DROP DATABASE "${name}"`);}
  await admin.end();
 }
})().catch(e=>{console.error(e.code||e.message);process.exitCode=1});
