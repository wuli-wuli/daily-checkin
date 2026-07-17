const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const DATA_FILE = path.join(__dirname, 'data.json');
const PORT = process.env.PORT || 3456;

function loadData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const d = JSON.parse(raw);
    if (!d.projects || !d.records) throw new Error('invalid');
    return d;
  } catch (e) {
    const d = {
      projects: [{ id: 'default', name: '阅读', color: '#f59e0b', createdAt: new Date().toISOString() }],
      records: [],
      version: 0
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(d, null, 2));
    return d;
  }
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // API: get data
  if (req.method === 'GET' && req.url === '/api/data') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(loadData()));
    return;
  }

  // API: save data (with version check)
  if (req.method === 'POST' && req.url === '/api/data') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const incoming = JSON.parse(body);
        const current = loadData();
        if (incoming.version !== undefined && incoming.version < (current.version || 0)) {
          res.writeHead(409, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'conflict', serverVersion: current.version }));
          return;
        }
        incoming.version = (current.version || 0) + 1;
        incoming._updatedAt = new Date().toISOString();
        fs.writeFileSync(DATA_FILE, JSON.stringify(incoming, null, 2));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, version: incoming.version }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid' }));
      }
    });
    return;
  }

  // Serve static files
  let fp = req.url === '/' ? '/index.html' : req.url;
  fp = path.join(__dirname, fp);

  // Prevent directory traversal
  if (!fp.startsWith(__dirname)) { res.writeHead(403); res.end(); return; }

  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    const ext = path.extname(fp);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  Daily Check-in Server`);
  console.log(`  Local:   http://localhost:${PORT}`);
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        console.log(`  Network: http://${net.address}:${PORT}`);
      }
    }
  }
  console.log('');
});
