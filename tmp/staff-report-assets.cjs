const fs=require('node:fs');
let code=fs.readFileSync(__dirname+'/report-inventory-code-images.cjs','utf8').replace('Assignment-report/assets/inventory','Assignment-report/assets/staff');
const a=code.indexOf(' for(const spec of ['),b=code.indexOf(' ]){',a);
code=code.slice(0,a)+` for(const spec of [
 ['code-transition','backend/src/orders/orders.service.ts','      assertTransition(order.status, status);','      return tx.order.findUniqueOrThrow'],
 ['code-event','backend/src/realtime/orders.gateway.ts','    notifyOrdersChanged() {','\\n}'],
 ['code-refresh','frontend/src/features/orders/useOrdersLive.ts','        request.current?.abort();','    }, [load]);'],
`+code.slice(b);
new Function('require','__dirname',code)(require,__dirname);
