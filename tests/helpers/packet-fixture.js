// Synthetic baseline only. This is NOT a packet captured from FH6 and does
// not establish the game's units, valid ranges, or real packet compatibility.
export function createPacketFixture() {
  const buf = Buffer.alloc(324);
  const floats = {
    8: 8000, 12: 850, 16: 5000,
    20: -2.5, 24: 9.75, 28: 4.5,
    56: 1.25, 60: -0.125, 64: 0.0625,
    68: 0.25, 72: 0.5, 76: 0.75, 80: 1,
    84: -0.25, 88: 0.5, 92: 0.75, 96: 1.25,
    164: -0.5, 168: 0.25, 172: 0.75, 176: 1,
    180: 0.125, 184: 0.25, 188: 0.5, 192: 0.75,
    196: 0.0625, 200: 0.125, 204: 0.25, 208: 0.5,
    236: 2.5, 240: 1200,
    244: -1234.5, 248: 87.25, 252: 4321.75,
    256: 25, 260: 250000, 264: 550,
    268: 32, 272: 122, 276: 212, 280: 77,
    284: 1.5, 288: 0.75, 292: 12345.5,
    296: 60.25, 300: 61.5, 304: 12.75, 308: 135.5,
  };
  for (const [offset, value] of Object.entries(floats)) buf.writeFloatLE(value, Number(offset));
  buf.writeInt32LE(1, 0);
  buf.writeUInt32LE(4000000000, 4);
  for (const [offset, value] of [[212, 1234], [216, 5], [220, 900], [224, 2], [228, 8]]) {
    buf.writeInt32LE(value, offset);
  }
  buf.writeUInt32LE(3000000000, 232);
  buf.writeUInt16LE(513, 312);
  [3, 255, 128, 64, 32, 5].forEach((value, index) => { buf[314 + index] = value; });
  buf.writeInt8(-127, 320);
  buf.writeInt8(63, 321);
  buf.writeInt8(-64, 322);
  buf[323] = 0xa5;
  return buf;
}
