import { createServer } from 'node:http';

const readings = [28, 49, 76];
let next = 0;

createServer((req, res) => {
  if (req.method !== 'GET' || req.url !== '/api/moisture') {
    res.writeHead(404).end();
    return;
  }
  const moisture = readings[next];
  next = (next + 1) % readings.length;
  res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify({ moisture, source: 'mock' }));
}).listen(8787, '127.0.0.1', () => console.log('Mock sensor at http://127.0.0.1:8787/api/moisture'));
