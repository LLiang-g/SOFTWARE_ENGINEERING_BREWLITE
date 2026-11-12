const path=require('node:path');const {spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),frontend=path.join(root,'tmp/patch13-validation/frontend');
const {chromium}=require(path.join(root,'tmp/playwright-tools/package'));
const origin='http://localhost:4336';
const child=spawn(process.execPath,[path.join(frontend,'node_modules/next/dist/bin/next'),'start','-p','4336'],{cwd:frontend,windowsHide:true,stdio:'ignore'});
async function main(){let browser;try{
 for(let i=0;i<60;i++){try{if((await fetch(origin+'/login')).ok)break;}catch{}await new Promise(r=>setTimeout(r,500));}
 browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:430,height:900}});
 await page.goto(origin+'/login');await page.getByRole('heading',{name:'Đăng nhập',exact:true}).waitFor();
 await page.locator('form').screenshot({path:path.join(root,'Assignment-report/assets/auth/login-ui.png')});
}finally{await browser?.close();child.kill();}}
main().catch(e=>{console.error(e);process.exitCode=1;});
