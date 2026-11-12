const fs=require('fs'),path=require('path'),cp=require('child_process');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'tmp/docker23-validation'),patch=path.join(root,'proposed-fixes/23-docker-full-stack');
for(const app of ['backend','frontend']){
 const dest=path.join(stage,app);fs.mkdirSync(dest,{recursive:true});
 for(const f of fs.readdirSync(path.join(root,app))){
  if(['node_modules','.next','dist','.git'].includes(f)||f.startsWith('.env')||f.endsWith('.tsbuildinfo'))continue;
  fs.cpSync(path.join(root,app,f),path.join(dest,f),{recursive:true});
 }
 if(!fs.existsSync(path.join(dest,'node_modules')))fs.symlinkSync(path.join(root,app,'node_modules'),path.join(dest,'node_modules'),'junction');
}
for(const f of ['frontend/src/lib/api.ts','frontend/next.config.ts'])fs.copyFileSync(path.join(patch,f),path.join(stage,f));
// Validation only: node_modules is a junction outside the staged Turbopack root.
const nextConfig=path.join(stage,'frontend/next.config.ts');
fs.writeFileSync(nextConfig,fs.readFileSync(nextConfig,'utf8').replace('turbopack: {',`turbopack: {\n    root: ${JSON.stringify(root)},`).replace('output: "standalone",',`output: "standalone",\n  outputFileTracingRoot: ${JSON.stringify(root)},`));
const app=process.argv[2];
if(!['frontend','backend'].includes(app))throw Error('Pass frontend or backend');
const cli=app==='backend'?path.join(root,'backend/node_modules/@nestjs/cli/bin/nest.js'):path.join(root,'frontend/node_modules/next/dist/bin/next');
const child=cp.spawn(process.execPath,[cli,'build'],{cwd:path.join(stage,app),env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:'inherit'});
child.on('exit',code=>process.exitCode=code||0);
