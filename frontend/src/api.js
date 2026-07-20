// Central API base URL.
//
// Production (Vercel): set VITE_API_URL to the deployed backend's URL, e.g.
//   VITE_API_URL=https://prism-production-8655.up.railway.app
// Local dev: leave VITE_API_URL unset, calls go to the relative "/api" path,
// which the Vite dev server proxies to http://localhost:8000 (see vite.config.js).
export const API_BASE = import.meta.env.VITE_API_URL || "/api";

export const apiUrl = (path) => `${API_BASE}${path}`;
