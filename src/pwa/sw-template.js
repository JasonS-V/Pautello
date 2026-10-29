/**
 * Service worker del build web de Pautello.
 *
 * No es código de la aplicación: es la plantilla que el plugin
 * `pautello/service-worker` de vite.config.ts copia a `dist/sw.js` rellenando
 * los dos marcadores de abajo con los datos reales del build. Los nombres con
 * hash que emite Vite solo se conocen al compilar, por eso la lista se inyecta
 * en lugar de escribirse aquí. (Los marcadores llevan nombres que no aparecen
 * en ninguna otra parte del archivo: si se repitieran en este comentario, la
 * primera sustitución caería aquí en vez de en la constante.)
 *
 * Estrategia:
 *   - Al instalar, precarga el código de la app (incluidos los chunks de los
 *     modales diferidos, que si no quedarían sin cachear y fallarían sin
 *     conexión). Las tipografías no se precargan: cada familia trae decenas de
 *     subconjuntos por `unicode-range` y solo se usan unos pocos; se cachean a
 *     medida que el navegador las pide.
 *   - Al activar, borra las cachés de versiones anteriores.
 *   - Navegación: primero la red, con la copia precargada como respaldo.
 *   - Recursos: la copia en caché manda, porque el hash del nombre garantiza
 *     que el contenido no cambia.
 */

const VERSION = '__SW_VERSION__';
const CACHE = `pautello-${VERSION}`;
const PRECACHE = __SW_PRECACHE__;
const OMR = __SW_OMR__;
const OMR_CACHE = `pautello-omr-${VERSION}`;

async function matchesHash(response, hash) {
  if (!response?.ok) return false;
  const digest = await crypto.subtle.digest('SHA-256', await response.arrayBuffer());
  const actual = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
  return Array.isArray(hash) ? hash.includes(actual) : actual === hash;
}

async function omrReady() {
  const cache = await caches.open(OMR_CACHE);
  for (const resource of OMR) {
    if (!(await matchesHash(await cache.match(resource.url), resource.sha256))) return false;
  }
  return true;
}

self.addEventListener('message', (event) => {
  if (!['OMR_STATUS', 'OMR_PREPARE'].includes(event.data?.type) || !event.ports[0]) return;
  const port = event.ports[0];
  event.waitUntil(
    (async () => {
      try {
        if (event.data.type === 'OMR_STATUS') {
          port.postMessage({ ready: await omrReady(), total: OMR.length });
          return;
        }
        const cache = await caches.open(OMR_CACHE);
        for (const [index, resource] of OMR.entries()) {
          if (!(await matchesHash(await cache.match(resource.url), resource.sha256))) {
            const response = await fetch(resource.url, { cache: 'reload' });
            if (!(await matchesHash(response.clone(), resource.sha256))) {
              throw new Error(`Recurso OMR incompleto o alterado: ${resource.url}`);
            }
            await cache.put(resource.url, response);
          }
          port.postMessage({ completed: index + 1, total: OMR.length });
        }
        const keys = await caches.keys();
        await Promise.all(
          keys
            .filter((key) => key.startsWith('pautello-omr-') && key !== OMR_CACHE)
            .map((key) => caches.delete(key))
        );
        port.postMessage({ ready: true, total: OMR.length });
      } catch (error) {
        port.postMessage({
          ready: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })()
  );
});

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith('pautello-') && !key.startsWith('pautello-omr-') && key !== CACHE
            )
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  let sameOrigin = false;
  try {
    sameOrigin = new URL(request.url).origin === self.location.origin;
  } catch {
    sameOrigin = false;
  }
  if (!sameOrigin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put('./index.html', copy));
          return response;
        })
        .catch(() =>
          caches
            .open(CACHE)
            .then((cache) =>
              cache
                .match('./index.html', { ignoreVary: true })
                .then((cached) => cached || cache.match('./', { ignoreVary: true }))
            )
            .then((cached) => cached || Response.error())
        )
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE).then(async (appCache) => {
      const cached =
        (await appCache.match(request, { ignoreVary: true })) ||
        (await (await caches.open(OMR_CACHE)).match(request, { ignoreVary: true }));
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
