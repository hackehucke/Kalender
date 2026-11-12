// Monatsblatt: macht die App offline nutzbar und plant Erinnerungen im Hintergrund nach.
const CACHE = 'monatsblatt-v12';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('monatsblatt-v') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  // nur eigene Dateien; Anfragen an ntfy.sh gehen direkt ins Netz
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  // Netz zuerst (damit Updates ankommen), sonst aus dem Cache
  e.respondWith(
    fetch(e.request).then(r => {
      if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return r;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
// Erinnerungen, die weiter als 3 Tage weg sind, plant die App beim nächsten Öffnen.
// Zusätzlich versucht Android ab und zu im Hintergrund, die nächsten 3 Tage nachzuplanen.
self.addEventListener('periodicsync', e => { if (e.tag === 'rem') e.waitUntil(remSync()); });
async function remSync() {
  const c = await caches.open('monatsblatt-rem');
  const r = await c.match('./__rem.json');
  if (!r) return;
  const q = await r.json();
  if (!q.topic) return;
  const now = Date.now(), lim = now + (72 - 1) * 36e5;
  for (const it of q.items || []) {
    if (it.at <= now + 20e3 || it.at > lim) continue;
    const p = new URLSearchParams({ delay: String(Math.floor(it.at / 1000)), title: it.title, priority: String(it.prio), tags: it.tags, click: q.click });
    try { await fetch('https://ntfy.sh/' + encodeURIComponent(q.topic) + '/' + it.seq + '?' + p, { method: 'POST', body: it.body }); } catch (err) {}
  }
}
