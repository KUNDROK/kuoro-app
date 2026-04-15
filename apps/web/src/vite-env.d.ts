/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Origen completo del API, incluyendo prefijo /api/v1. Ej.: https://api-staging.railway.app/api/v1 */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
