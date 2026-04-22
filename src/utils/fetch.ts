import { fetch as undiciFetch } from 'undici';

export const fetchFn: typeof fetch =
  typeof fetch === 'function' ? fetch.bind(globalThis) : ((undiciFetch as unknown) as typeof fetch);

