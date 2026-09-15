import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const target = resolve(process.cwd(), 'dist', 'fh6-telemetry.exe');
mkdirSync(dirname(target), { recursive: true });
copyFileSync(process.execPath, target);
console.log(`[sea] copied Node runtime to ${target}`);
