const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
let code=fs.readFileSync(path.join(__dirname,'report-inventory-code-images.cjs'),'utf8');
code=code.replace('Assignment-report/assets/inventory','Assignment-report/assets/vnpay');
const a=code.indexOf(' for(const spec of ['); const b=code.indexOf(' ]){',a);
code=code.slice(0,a)+` for(const spec of [
 ['code-canonical','backend/src/payments/vnpay.crypto.ts','export function canonical(', 'export function readCallback('],
 ['code-return','backend/src/payments/vnpay.service.ts','    async returnUrl(', '    private async apply('],
 ['code-settlement','backend/src/payments/vnpay.service.ts','                if (canFulfill) {', '                await tx.paymentAudit.create'],
`+code.slice(b);
new Function('require','__dirname',code)(require,__dirname);
