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

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // Uno a uno y tolerando fallos: si un solo archivo no responde, `addAll`
      // abortaría la instalación entera y la app se quedaría sin modo offline.
      .then((cache) => Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => undefined))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
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
            .match('./index.html')
            .then((cached) => cached || caches.match('./'))
            .then((cached) => cached || Response.error())
        )
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
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
