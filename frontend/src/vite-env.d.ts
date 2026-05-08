/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_SENTRY_TEST_ERROR_ON_BOOT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
