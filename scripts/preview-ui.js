// Isolated synthetic preview. Never sends telemetry to the user's normal listener.
import {spawn} from 'node:child_process';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import dgram from 'node:dgram';
import {createPacketFixture} from '../tests/helpers/packet-fixture.js';
const cwd=await mkdtemp(resolve(tmpdir(),'fh6-p3-preview-'));
const child=spawn(process.execPath,[resolve('src/index.js')],{cwd,env:{...process.env,PORT:'0',HTTP_PORT:process.env.PREVIEW_PORT || '3099'},stdio:['ignore','pipe','inherit']});
const udp=dgram.createSocket('udp4');
let timer, stopped=false;
child.stdout.on('data',chunk=>{
 process.stdout.write(chunk);
 const match=chunk.toString().match(/\[udp\] listening on .*:(\d+)/);
 if(match){let frame=0;timer=setInterval(()=>{const p=createPacketFixture();frame++;p.writeUInt32LE(frame*33,4);p.writeFloatLE(86/3.6,256);p.writeFloatLE(4200,16);p.writeUInt16LE(2,312);p.writeFloatLE(32.17,304);p.writeFloatLE(90+frame/30,308);udp.send(p,Number(match[1]),'127.0.0.1');},33);}
});
function stop(){if(stopped)return;stopped=true;clearInterval(timer);udp.close();if(child.exitCode===null)child.kill();}
child.once('exit',stop);
process.once('SIGINT',stop);process.once('SIGTERM',stop);
if(process.env.PREVIEW_KEEP_OPEN!=='1')setTimeout(stop,180000).unref();
console.log('SYNTHETIC PREVIEW ONLY — isolated session files:',cwd);
