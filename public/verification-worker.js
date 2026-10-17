self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('message', event => {
  const port = event.ports[0];
  if (!port || !event.source) return;
  if (event.data?.type === 'journas-verification-client') {
    port.postMessage({ clientId: event.source.id });
    return;
  }
  if (event.data?.type !== 'journas-email-verified' || new URL(event.source.url).pathname !== '/verify-email') return;
  event.waitUntil((async () => {
    let focused = false;
    let sameBrowser = false;
    let sessionToken;
    const client = typeof event.data.returnClientId === 'string' ? await self.clients.get(event.data.returnClientId) : null;
    if (client?.type === 'window' && new URL(client.url).origin === self.location.origin && new URL(client.url).pathname !== '/verify-email') {
      sameBrowser = true;
      client.postMessage({ type: 'journas-email-verified' });
      try { await client.focus(); focused = true; } catch { /* Browser may restrict automatic focus. */ }
      if (!focused && typeof event.data.email === 'string') {
        sessionToken = await new Promise(resolve => {
          const channel = new MessageChannel();
          const timer = setTimeout(() => finish(undefined), 10000);
          const finish = value => { clearTimeout(timer); channel.port1.close(); resolve(value); };
          channel.port1.onmessage = reply => finish(typeof reply.data?.sessionToken === 'string' ? reply.data.sessionToken : undefined);
          try { client.postMessage({ type: 'journas-verification-session', email: event.data.email }, [channel.port2]); }
          catch { finish(undefined); }
        });
      }
    }
    port.postMessage({ focused, sameBrowser, sessionToken });
  })());
});
