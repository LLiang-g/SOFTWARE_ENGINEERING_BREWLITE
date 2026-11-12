const path=require('node:path');const {spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),frontend=path.join(root,'tmp/patch13-validation/frontend');
const {chromium}=require(path.join(root,'tmp/playwright-tools/package')), origin='http://localhost:4340';
const child=spawn(process.execPath,[path.join(frontend,'node_modules/next/dist/bin/next'),'start','-p','4340'],{cwd:frontend,windowsHide:true,stdio:'ignore'});
async function main(){let browser;try{
 for(let i=0;i<60;i++){try{if((await fetch(origin+'/barista')).ok)break;}catch{}await new Promise(r=>setTimeout(r,500));}
 browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1360,height:920}});
 await page.addInitScript(()=>localStorage.setItem('brewlite-auth',JSON.stringify({state:{token:'fixture-token',user:{id:7,email:'staff@example.test',role:'BARISTA',loyaltyPoints:0}},version:0})));
 const rows=['PAID','PREPARING','READY','COMPLETED'].map((status,i)=>({id:301+i,status,total:40000,amountDue:40000,creditApplied:0,discount:0,voucherCode:null,pointsEarned:4,pendingExchangeId:null,reservationExpiresAt:null,reservationExpiredAt:null,reservationTimedOut:false,expiryMessage:null,createdAt:new Date(Date.now()-(4-i)*60000).toISOString(),items:[{id:1,productId:1,name:['Americano','Cà phê sữa','Cappuccino','Trà đào'][i],qty:1,size:'S',toppings:[],toppingNames:[],lineTotal:40000}]}));
 await page.route('http://localhost:3001/**',route=>route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'*'},body:JSON.stringify(new URL(route.request().url()).pathname==='/staff/orders'?rows:[])}));
 await page.goto(origin+'/barista');await page.getByRole('heading',{name:'Đơn hàng tại quầy',exact:true}).waitFor();await page.getByRole('button',{name:'Pha xong',exact:true}).waitFor();
 await page.locator('main').screenshot({path:path.join(root,'Assignment-report/assets/staff/board-ui-fixture.png')});
}finally{await browser?.close();child.kill();}}
main().catch(e=>{console.error(e);process.exitCode=1});
