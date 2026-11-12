const fs=require('node:fs'),path=require('node:path');
let code=fs.readFileSync(path.join(__dirname,'report-inventory-code-images.cjs'),'utf8');
code=code.replace('Assignment-report/assets/inventory','Assignment-report/assets/exchange');
const a=code.indexOf(' for(const spec of ['),b=code.indexOf(' ]){',a);
code=code.slice(0,a)+` for(const spec of [
 ['code-quote','backend/src/orders/exchange.service.ts','          quotedTotal: quote.total,', '      });\n    });\n    this.events.notifyOrdersChanged();\n    return result;\n  }\n\n  async list'],
 ['code-replacement','backend/src/orders/exchange.service.ts','          await this.inventory.release(tx, source.id);', '          await tx.order.update({'],
 ['code-version','backend/src/orders/exchange.service.ts','          const changed = await tx.orderExchange.updateMany({', '        } else {'],
`+code.slice(b);
// End delimiters must remain JS string escapes, not literal line breaks.
code=code.replace(/'      \}\);\n    \}\);\n    this\.events\.notifyOrdersChanged\(\);\n    return result;\n  \}\n\n  async list'/,JSON.stringify('      });\n    });\n    this.events.notifyOrdersChanged();\n    return result;\n  }\n\n  async list'));
new Function('require','__dirname',code)(require,__dirname);
