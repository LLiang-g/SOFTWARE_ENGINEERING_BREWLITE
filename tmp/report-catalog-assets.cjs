const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),out=path.join(root,'Assignment-report/assets/catalog-cart');
let code=fs.readFileSync(path.join(__dirname,'report-inventory-code-images.cjs'),'utf8').replace('Assignment-report/assets/inventory','Assignment-report/assets/catalog-cart');
const a=code.indexOf(' for(const spec of ['),b=code.indexOf(' ]){',a);
code=code.slice(0,a)+` for(const spec of [
 ['code-key','frontend/src/features/cart/cart.store.ts','function makeKey(', 'export const useCartStore'],
 ['code-intent','frontend/src/features/cart/checkout-intent.ts','    const key = makeKey();', '\\n}'],
 ['code-submit','frontend/src/features/cart/CartView.tsx','            const order = await createOrder(', '        } catch (err) {'],
`+code.slice(b);
new Function('require','__dirname',code)(require,__dirname);
const {chromium}=require(path.join(root,'tmp/playwright-tools/package'));
(async()=>{fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:1100,height:850},deviceScaleFactor:1.3});
 await page.goto('http://localhost:4342/',{waitUntil:'networkidle'});
 await page.screenshot({path:path.join(out,'ui-menu.png')});
 await page.goto('http://localhost:4342/products/3',{waitUntil:'networkidle'});
 await page.screenshot({path:path.join(out,'ui-detail.png'),fullPage:true});
 const add=page.getByRole('button',{name:/Thêm vào giỏ/});
 if(await add.isEnabled()){await add.click();}else{throw Error('Catalog product unavailable; no cart screenshot captured');}
 await page.goto('http://localhost:4342/cart',{waitUntil:'networkidle'});
 await page.screenshot({path:path.join(out,'ui-cart.png'),fullPage:true});
 console.log('Captured public menu/detail and browser-local cart; no order submitted.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
