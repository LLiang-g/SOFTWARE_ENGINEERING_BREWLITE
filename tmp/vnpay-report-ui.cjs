// Screenshot actual built UI with a marked, non-chargeable API fixture.
const path=require('node:path'),fs=require('node:fs');
const {spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const {chromium}=require(path.join(root,'tmp/playwright-tools/package'));
const frontend=path.join(root,'tmp/patch13-validation/frontend'), origin='http://localhost:4334';
const child=spawn(process.execPath,[path.join(frontend,'node_modules/next/dist/bin/next'),'start','-p','4334'],{cwd:frontend,windowsHide:true,stdio:'ignore'});
async function main(){let browser;
 try{
  for(let i=0;i<60;i++){try{if((await fetch(origin+'/orders/901')).ok)break;}catch{}await new Promise(r=>setTimeout(r,500));}
  browser=await chromium.launch({channel:'msedge',headless:true});
  const context=await browser.newContext({viewport:{width:430,height:930}});
  await context.addInitScript(()=>localStorage.setItem('brewlite-auth',JSON.stringify({state:{token:'fixture-token',user:{id:7,email:'fixture@example.test',role:'CUSTOMER',loyaltyPoints:0}},version:0})));
  const now=new Date(), expiry=new Date(now.getTime()+10*60000).toISOString();
  const order={id:901,status:'PENDING',total:40000,creditApplied:0,amountDue:40000,discount:0,voucherCode:null,pointsEarned:0,createdAt:now.toISOString(),pendingExchangeId:null,
   reservationExpiresAt:new Date(now.getTime()+30*60000).toISOString(),reservationExpiredAt:null,reservationTimedOut:false,expiryMessage:null,
   items:[{id:1,productId:1,name:'Cà phê sữa',size:'M',qty:1,toppings:[],toppingNames:[],lineTotal:40000}]};
  const attempt={id:1,orderId:901,txnRef:'REPORT_FIXTURE_901',amount:40000,status:'PENDING',expiresAt:expiry,paidAt:null,responseCode:null,reviewReason:null,createdAt:now.toISOString(),paymentUrl:'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_TxnRef=REPORT_FIXTURE_901'};
  await context.route('http://localhost:3001/**',async route=>{
   const p=new URL(route.request().url()).pathname;
   const data=p==='/orders/901'?order:p==='/payments/vnpay/config'?{enabled:true,mockEnabled:false}:p==='/payments/vnpay/orders/901'?{orderStatus:'PENDING',attempts:[attempt]}:[];
   await route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'*'},body:JSON.stringify(data)});
  });
  const page=await context.newPage();await page.goto(origin+'/orders/901');
  await page.getByRole('link',{name:'Chuyển đến trang thanh toán VNPay',exact:true}).waitFor();
  const panel=page.locator('section[aria-labelledby="vnpay-title"]');
  await panel.screenshot({path:path.join(root,'Assignment-report/assets/vnpay/payment-ui-fixture.png')});
 }finally{await browser?.close();child.kill();}
}
main().catch(e=>{console.error(e);process.exitCode=1});
