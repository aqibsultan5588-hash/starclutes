import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const GAME_DIR = path.join(__dirname, 'game');

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

const server = http.createServer((req, res) => {
  let filePath = path.join(GAME_DIR, req.url === '/' ? 'index.html' : req.url);
  const ext = path.extname(filePath);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n⭐ Star Catcher Game Server`);
  console.log(`   Local:   http://localhost:${PORT}`);
  try {
    const lt = spawn('npx', ['localtunnel', '--port', String(PORT), '--subdomain', 'star-catcher-kids-game'], { stdio: 'inherit' });
    lt.on('error', () => {});
    lt.on('exit', () => process.exit());
  } catch(e) {}
});
