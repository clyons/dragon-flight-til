import { defineConfig } from 'vite';
import { createWriteStream, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export default defineConfig({
  optimizeDeps: { exclude: ['box3d-wasm/standard'] },
  server: { host: '127.0.0.1', port: 4180, strictPort: true },
  plugins: [{
    name: 'local-demo-recording',
    configureServer(server) {
      server.middlewares.use('/save-recording', (req, res) => {
        if (req.method !== 'POST' || req.headers.origin !== 'http://127.0.0.1:4180') {
          res.statusCode = 403; res.end(); return;
        }
        const dir = resolve('recordings');
        mkdirSync(dir, { recursive: true });
        const file = createWriteStream(resolve(dir, req.url?.includes('social') ? 'dragon-social-raw.webm' : 'dragon-demo-raw.webm'));
        writeFileSync(resolve(dir, 'last-recording-viewport.json'), req.headers['x-viewport'] || '{}');
        req.pipe(file);
        file.on('finish', () => { res.end('Saved locally'); });
        file.on('error', () => { res.statusCode = 500; res.end('Save failed'); });
      });
    },
  }],
});
