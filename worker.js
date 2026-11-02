import { onRequest } from './api.js';
export default {
  fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith('/api/')) return onRequest({ request, env });
    return env.ASSETS.fetch(request);
  }
};
