const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const {chromium}=require(path.join(root,'tmp/playwright-tools/package'));
const out=path.join(root,'Assignment-report/assets/inventory');
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
async function main(){
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
 for(const spec of [
  ['code-demand','backend/src/products/ingredient-demand.ts','    for (const item of items)', '    return result;'],
  ['code-reserve','backend/src/products/inventory.service.ts','        const ids =', '\n    /** Hoàn'],
  ['code-release','backend/src/products/inventory.service.ts','    async release(', '\n}\n'],
  ['code-expiry','backend/src/orders/reservation-expiry.service.ts','    async expireOne(', '\n    async sweep('],
 ]){
  const [name,file,start,end]=spec; const text=fs.readFileSync(path.join(root,file),'utf8');
  const a=text.indexOf(start);if(a<0)throw Error(start);
  let b=text.indexOf(end,a);if(b<0)b=text.length;
  const number=text.slice(0,a).split('\n').length;
  const lines=text.slice(a,b).trimEnd().split('\n');
  const page=await browser.newPage({viewport:{width:1120,height:1200},deviceScaleFactor:1.5});
  await page.setContent(`<html><meta charset="utf-8"><style>body{margin:0;padding:22px;background:white;color:#172332;font-family:Consolas,monospace}.card{border:1px solid #b7c6d3;border-radius:10px;overflow:hidden}.head{background:#e9f0f5;padding:15px 20px;font-size:19px;font-weight:bold;border-bottom:1px solid #b7c6d3}.body{padding:15px 0;background:#fbfcfe}.line{display:flex;font-size:24px;line-height:1.35;white-space:pre-wrap;overflow-wrap:anywhere}.num{width:58px;flex-shrink:0;color:#65758a;text-align:right;padding-right:20px;border-right:1px solid #dce3ec;margin-right:18px}.code{padding-right:20px;flex:1;min-width:0}.comment{color:#356744}</style><div class="card"><div class="head">${esc(file)} · lines ${number}–${number+lines.length-1}</div><div class="body">${lines.map((line,i)=>`<div class="line"><span class="num">${number+i}</span><span class="code ${line.trim().startsWith('//')?'comment':''}">${esc(line)||' '}</span></div>`).join('')}</div></div></html>`);
  await page.locator('.card').screenshot({path:path.join(out,name+'.png')});
  await page.close();
 }
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1});
