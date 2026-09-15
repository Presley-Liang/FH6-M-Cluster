// Latest telemetry wins under backpressure; slow clients cannot queue every frame.
export class SSEHub {
  constructor() { this.clients = new Map(); }
  get size() { return this.clients.size; }
  add(req, res) {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.flushHeaders();
    const client = { blocked: false, pending: new Map() };
    this.clients.set(res, client);
    res.on('drain', () => {
      try {
        client.blocked = false;
        for (const [key, text] of client.pending) {
          client.pending.delete(key);
          if (!res.write(text)) { client.blocked = true; break; }
        }
      } catch { this.clients.delete(res); res.destroy(); }
    });
    const remove = () => this.clients.delete(res);
    res.on('error', remove); res.on('close', remove);
  }
  broadcast(data, event = '') {
    const text = (event ? `event: ${event}\n` : '') + `data: ${JSON.stringify(data)}\n\n`;
    for (const [res, client] of this.clients) {
      try {
        if (client.blocked) client.pending.set(event, text);
        else client.blocked = !res.write(text);
      } catch { this.clients.delete(res); res.destroy(); }
    }
  }
  close() { for (const res of this.clients.keys()) res.end(); this.clients.clear(); }
}
