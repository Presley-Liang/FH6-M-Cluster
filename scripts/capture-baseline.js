import fs from 'node:fs';
import crypto from 'node:crypto';
import {parse,toJSON} from '../src/parser.js';
import {getDefaultHTML} from '../src/ui/default-html.js';
const html=getDefaultHTML();
const manifest={capturedAt:new Date().toISOString(),kind:'P0 source contract inventory, not visual approval',
 sourceHashes:Object.fromEntries(['src/index.js','src/parser.js','src/session.js','src/buffer-utils.js'].map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')])),
 jsonFields:Object.keys(toJSON(parse(Buffer.alloc(324)))),
 domIds:[...new Set([...html.matchAll(/\bid="([\w-]+)"/g)].map(m=>m[1]))].sort(),
 limitations:['Synthetic zero packet used for field inventory.','No genuine game capture or user session provided.','DOM IDs describe old UI functional hooks, not v4 layout approval.']};
fs.mkdirSync('tests/fixtures',{recursive:true});
// Preserve the original P0 contract; later captures are comparison snapshots.
fs.writeFileSync('tests/fixtures/current-manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log('Captured',manifest.jsonFields.length,'JSON fields and',manifest.domIds.length,'DOM IDs');
