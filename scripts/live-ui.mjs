import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHTTP } from '../src/server/http.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const upstreamURL = process.env.TELEMETRY_UPSTREAM || 'http://127.0.0.1:3000';
const server = createHTTP({ root, upstreamURL });
server.listen(Number(process.env.HTTP_PORT || 3002), '127.0.0.1', () => {
  console.log(`Live UI http://127.0.0.1:${server.address().port} uses receiver ${upstreamURL}`);
});
server.on('error', error => { console.error(error); process.exitCode = 1; });
process.on('SIGINT', () => server.close());
process.on('SIGTERM', () => server.close());
