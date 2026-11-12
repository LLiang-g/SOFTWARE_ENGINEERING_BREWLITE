const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),patch=path.join(root,'proposed-fixes/23-docker-full-stack');
for(const f of ['frontend/src/lib/api.ts','frontend/next.config.ts']){
 let text=fs.readFileSync(path.join(root,f),'utf8');
 if(f.endsWith('next.config.ts')) text=text.replace('const nextConfig: NextConfig = {','const nextConfig: NextConfig = {\n  output: "standalone",');
 else {
  const marker='export async function getProducts()';
  text=text.replace(marker,`// Server Components use the Docker network; the browser uses the public URL.\nfunction catalogApiUrl(): string {\n    return typeof window === 'undefined'\n        ? process.env.SERVER_API_URL ?? API_URL\n        : API_URL;\n}\n\n${marker}`);
  text=text.replace('`${API_URL}/products`','`${catalogApiUrl()}/products`').replace('`${API_URL}/products/${id}`','`${catalogApiUrl()}/products/${id}`');
 }
 const dest=path.join(patch,f);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,text);
}
console.log('Prepared two frontend replacement files.');
