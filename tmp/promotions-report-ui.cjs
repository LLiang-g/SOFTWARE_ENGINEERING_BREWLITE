const path=require('node:path');const {spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),frontend=path.join(root,'tmp/patch13-validation/frontend');
const {chromium}=require(path.join(root,'tmp/playwright-tools/package'));const origin='http://localhost:4338';
const child=spawn(process.execPath,[path.join(frontend,'node_modules/next/dist/bin/next'),'start','-p','4338'],{cwd:frontend,windowsHide:true,stdio:'ignore'});
async function main(){let browser;try{
 for(let i=0;i<60;i++){try{if((await fetch(origin+'/cart')).ok)break;}catch{}await new Promise(r=>setTimeout(r,500));}
 browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:430,height:980}});
 await page.addInitScript(()=>{
  localStorage.setItem('brewlite-auth',JSON.stringify({state:{token:'fixture',user:{id:7,email:'fixture@example.test',role:'CUSTOMER',loyaltyPoints:0}},version:0}));
  localStorage.setItem('brewlite-cart',JSON.stringify({state:{items:[{key:'1|S|',productId:1,name:'Americano',size:'S',toppings:[],toppingNames:[],unitPrice:40000,qty:3}]},version:0}));
 });
 await page.route('http://localhost:3001/**',route=>route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'*'},body:JSON.stringify({code:'BREW10',discountPercent:10,expiresAt:'2030-12-31T00:00:00Z'})}));
 await page.goto(origin+'/cart');await page.getByRole('textbox',{name:'Mã giảm giá',exact:true}).fill('BREW10');
 await page.getByRole('button',{name:'Áp dụng',exact:true}).click();
 await page.getByText('Mã BREW10: giảm 10%',{exact:true}).waitFor();
 await page.screenshot({path:path.join(root,'Assignment-report/assets/promotions/voucher-ui-fixture.png'),fullPage:true});
}finally{await browser?.close();child.kill();}}
main().catch(e=>{console.error(e);process.exitCode=1});
