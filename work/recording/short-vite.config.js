import { defineConfig } from 'vite';
import { createWriteStream, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const project = fileURLToPath(new URL('../../',import.meta.url));
export default defineConfig({
  root:resolve(project,'recording-preview'),
  server:{host:'127.0.0.1',port:4196,strictPort:true},
  plugins:[{name:'local-short-recording',configureServer(server){
    server.middlewares.use('/save-recording',(req,res)=>{
      const format=new URL(req.url,'http://127.0.0.1:4196').searchParams.get('format');
      if(req.method!=='POST'||req.headers.origin!=='http://127.0.0.1:4196'||!['portrait','widescreen'].includes(format)){
        res.statusCode=403;res.end();return;
      }
      const dir=resolve(project,'recordings');mkdirSync(dir,{recursive:true});
      const file=createWriteStream(resolve(dir,`elder-${format}.h264`));
      writeFileSync(resolve(dir,`elder-${format}.json`),req.headers['x-video-metadata']||'{}');
      req.pipe(file);file.on('finish',()=>res.end('Saved locally'));
      file.on('error',()=>{res.statusCode=500;res.end('Save failed');});
    });
  }}],
});
