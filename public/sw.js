// Service worker: what makes some browsers (Samsung Internet, older Chrome) offer to install
// the site as an app. It keeps nothing offline: every request goes to the network as usual.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || event.request.mode !== "navigate") return;
  // pages: network first; a short message when the connection is gone
  event.respondWith(
    fetch(event.request).catch(
      () =>
        new Response(
          '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Hors ligne</title><body style="font-family:sans-serif;background:#1b1410;color:#f5ead8;display:grid;place-items:center;height:100vh;margin:0;text-align:center"><div><p style="font-size:48px;margin:0">🎲</p><p>Pas de connexion Internet.<br>Reviens à la table dès que le réseau est de retour!</p></div>',
          { headers: { "Content-Type": "text/html; charset=utf-8" } },
        ),
    ),
  );
});
