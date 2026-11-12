const fs=require('node:fs');
let code=fs.readFileSync(__dirname+'/report-inventory-code-images.cjs','utf8').replace('Assignment-report/assets/inventory','Assignment-report/assets/promotions');
const a=code.indexOf(' for(const spec of ['),b=code.indexOf(' ]){',a);
code=code.slice(0,a)+` for(const spec of [
 ['code-validation','backend/src/promotions/promotions.service.ts','        if (!voucher) {', '        return voucher;'],
 ['code-calculation','backend/src/promotions/discount.ts','export const POINT_UNIT', '__END__'],
 ['code-ledger','backend/src/promotions/loyalty.service.ts','            await tx.loyaltyTransaction.create({', '        return points;'],
`+code.slice(b);
new Function('require','__dirname',code)(require,__dirname);
