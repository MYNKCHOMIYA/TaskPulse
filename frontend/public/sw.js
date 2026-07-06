self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Bypass service worker for Vercel SSO redirects, manifests, and api calls
  if (
    url.includes('vercel.com') ||
    url.includes('manifest.webmanifest') ||
    url.includes('/api/') ||
    url.includes('/auth/') ||
    url.includes('onrender.com') ||
    url.includes('/tasks/')
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request).catch((err) => {
      // Return a basic fallback response to prevent uncaught promise rejection crash loops
      console.warn('Fetch failed inside service worker:', err);
      return new Response('Network error occurred', { status: 480 });
    })
  );
});
