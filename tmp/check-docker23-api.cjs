const fs=require('fs'),path=require('path'),vm=require('vm'),http=require('http'),assert=require('assert');
const root=path.resolve(__dirname,'..'),ts=require(path.join(root,'frontend/node_modules/typescript'));
const file=path.join(root,'proposed-fixes/23-docker-full-stack/frontend/src/lib/api.ts');
const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const servers=[];
(async()=>{try{
 const urls=[];
 for(const label of ['server','browser']){
  const server=http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(req.url==='/products'?[{name:label}]:{name:label}));});servers.push(server);
  await new Promise(r=>server.listen(0,'127.0.0.1',r));urls.push('http://127.0.0.1:'+server.address().port);
 }
 const context={exports:{},process:{env:{SERVER_API_URL:urls[0],NEXT_PUBLIC_API_URL:urls[1]}},fetch};
 vm.createContext(context);vm.runInContext(code,context);
 assert.equal((await context.exports.getProducts())[0].name,'server');
 assert.equal((await context.exports.getProduct(1)).name,'server');
 context.window={};
 assert.equal((await context.exports.getProducts())[0].name,'browser');
 assert.equal((await context.exports.getProduct(1)).name,'browser');
 console.log('PASS: real HTTP requests route server catalog to internal URL and browser catalog to public URL.');
}finally{for(const server of servers)await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e.message);process.exitCode=1});
