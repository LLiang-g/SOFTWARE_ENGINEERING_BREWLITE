// Dùng validator nhưng CHỈ copy source thực tế đã ghép, không overlay bản vá mẫu.
const fs=require('node:fs'),path=require('node:path');
const dir=path.resolve(__dirname,'../proposed-fixes/13-size-topping-reservation');
let code=fs.readFileSync(path.join(dir,'validate-patch.cjs'),'utf8');
code=code.replace("'patch13-validation'","'patch13-integrated-audit'");
code=code.replace("    copy(path.join(__dirname, app), path.join(stage, app));",'');
// SQL 13 đã được người dùng ghép vào init; không áp lần hai trên DB thử.
code=code.split('\n').filter(line=>!line.includes("backend/prisma/migrations/20261112180000_size_topping_reservation_expiry/migration.sql")).join('\n');
process.argv.push('--integration');
new Function('require','__dirname',code)(require,dir);
