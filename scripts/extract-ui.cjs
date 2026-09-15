// One-time mechanical extraction: preserve the upstream HTML byte-for-byte.
const fs=require('node:fs');
const source=fs.readFileSync('src/index.js','utf8');
const a=source.indexOf('function getDefaultHTML() {');
const b=source.indexOf('\nasync function start()',a);
if(a<0||b<0)throw Error('UI extraction boundaries not found');
fs.mkdirSync('src/ui',{recursive:true});
fs.writeFileSync('src/ui/default-html.js','export '+source.slice(a,b).trimEnd()+'\n');
fs.writeFileSync('src/index.js',"import { getDefaultHTML } from './ui/default-html.js';\n"+source.slice(0,a)+source.slice(b));
