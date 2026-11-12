const fs=require('node:fs'),path=require('node:path');
let code=fs.readFileSync(path.join(__dirname,'report-inventory-code-images.cjs'),'utf8');
code=code.replace('Assignment-report/assets/inventory','Assignment-report/assets/auth');
const a=code.indexOf(' for(const spec of ['),b=code.indexOf(' ]){',a);
code=code.slice(0,a)+` for(const spec of [
 ['code-register','backend/src/auth/auth.service.ts','    async register(', '    async login('],
 ['code-strategy','backend/src/auth/jwt.strategy.ts','    async validate(', '\\n}'],
 ['code-role','backend/src/auth/roles.guard.ts','    canActivate(', '\\n}'],
`+code.slice(b);
new Function('require','__dirname',code)(require,__dirname);
