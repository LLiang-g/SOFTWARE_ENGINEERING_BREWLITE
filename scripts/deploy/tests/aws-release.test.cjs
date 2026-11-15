const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../../..');
const bash=process.env.BASH_PATH || (process.platform==='win32'?'C:/Users/MSI-PC/Git/bin/bash.exe':'bash');
function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aws-release-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 fs.copyFileSync(path.join(root,'deploy/aws/deploy.sh'),path.join(dir,'deploy.sh'));
 fs.writeFileSync(path.join(dir,'.env'),'POSTGRES_USER=test\nPOSTGRES_DB=test\n');
 fs.writeFileSync(path.join(dir,'release.good.env'),'RELEASE_COMMIT=old\n');
 fs.mkdirSync(path.join(dir,'bin'));
 fs.writeFileSync(path.join(dir,'bin/docker'),`#!/usr/bin/env bash
set -eu
echo "$*" >> docker.calls
case "$*" in
  'login '*) cat >/dev/null; exit 0 ;;
  *'psql '*) echo 1; exit 0 ;;
  *'pg_dump '*) echo fake-dump; exit 0 ;;
  *'run --rm migrate'*) [[ "\${FAIL_MIGRATE:-0}" != 1 ]]; exit $? ;;
  *'up -d --remove-orphans'*)
    if [[ "\${FAIL_NEW_UP:-0}" == 1 ]] && grep -q '^RELEASE_COMMIT=new$' release.env; then exit 1; fi
    exit 0 ;;
  *'exec -T backend node'*) [[ "\${FAIL_HEALTH:-0}" != 1 ]]; exit $? ;;
esac
exit 0
`,{mode:0o755});
 const run=(args,extra={})=>spawnSync(bash,['-c','export PATH="$PWD/bin:$PATH"; bash ./deploy.sh "$@"','test',...args],{cwd:dir,input:'fake-token',encoding:'utf8',env:{...process.env,...extra}});
 const read=n=>fs.readFileSync(path.join(dir,n),'utf8');
 return {dir,run,read,deploy:(extra={})=>run(['deploy','backend','frontend','tools','new','test'],extra)};
}
test('internal success preserves old good until public confirmation',t=>{const f=fixture(t);const r=f.deploy();assert.equal(r.status,0,r.stderr);assert.equal(f.read('release.good.env'),'RELEASE_COMMIT=old\n');assert.match(f.read('release.pending.env'),/RELEASE_COMMIT=new/);});
test('public smoke failure: rollback restores old release and removes pending',t=>{const f=fixture(t);assert.equal(f.deploy().status,0);const r=f.run(['rollback']);assert.equal(r.status,0,r.stderr);assert.equal(f.read('release.env'),'RELEASE_COMMIT=old\n');assert.equal(fs.existsSync(path.join(f.dir,'release.pending.env')),false);assert.match(f.read('docker.calls'),/exec -T backend node/);});
test('confirmation after public success promotes correct commit',t=>{const f=fixture(t);assert.equal(f.deploy().status,0);const r=f.run(['confirm','new']);assert.equal(r.status,0,r.stderr);assert.match(f.read('release.good.env'),/RELEASE_COMMIT=new/);assert.equal(fs.existsSync(path.join(f.dir,'release.pending.env')),false);});
test('wrong commit cannot overwrite old good',t=>{const f=fixture(t);assert.equal(f.deploy().status,0);assert.notEqual(f.run(['confirm','other']).status,0);assert.equal(f.read('release.good.env'),'RELEASE_COMMIT=old\n');});
test('failed confirmation health preserves old good for rollback',t=>{const f=fixture(t);assert.equal(f.deploy().status,0);assert.notEqual(f.run(['confirm','new'],{FAIL_HEALTH:'1'}).status,0);assert.equal(f.read('release.good.env'),'RELEASE_COMMIT=old\n');assert.equal(f.run(['rollback']).status,0);});
test('unhealthy new stack rolls back but deploy remains failed',t=>{const f=fixture(t);assert.notEqual(f.deploy({FAIL_NEW_UP:'1'}).status,0);assert.equal(f.read('release.env'),'RELEASE_COMMIT=old\n');});
test('migration failure stops before app replacement and keeps old good',t=>{const f=fixture(t);assert.notEqual(f.deploy({FAIL_MIGRATE:'1'}).status,0);assert.equal(f.read('release.good.env'),'RELEASE_COMMIT=old\n');assert.doesNotMatch(f.read('docker.calls'),/up -d --remove-orphans/);});
test('first release cannot pretend rollback succeeded without previous good',t=>{const f=fixture(t);fs.unlinkSync(path.join(f.dir,'release.good.env'));assert.equal(f.deploy().status,0);assert.notEqual(f.run(['rollback']).status,0);assert.equal(fs.existsSync(path.join(f.dir,'release.good.env')),false);});
test('second deploy is refused while first is unconfirmed',t=>{const f=fixture(t);assert.equal(f.deploy().status,0);assert.notEqual(f.deploy().status,0);assert.equal(f.read('release.good.env'),'RELEASE_COMMIT=old\n');});
test('workflow orders public smoke before confirmation and gates release tests',()=>{
 const w=fs.readFileSync(path.join(root,'.github/workflows/brewlite.yml'),'utf8');
 assert(w.indexOf('id: smoke')<w.indexOf('id: confirm'));
 assert(w.includes("steps.confirm.outcome == 'failure'"));
 assert(w.includes('needs: [backend, frontend, docker, browser_e2e, aws_rollback_tests]'));
 assert(w.includes('needs: passed'));assert(w.includes('needs: publish'));
});
