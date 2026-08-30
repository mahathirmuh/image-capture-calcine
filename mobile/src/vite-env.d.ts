/// <reference types="vite/client" />

declare const __MOBILE_DEFAULT_API_BASE_URL__: string;
declare const __MOBILE_DEFAULT_API_KEY__: string;

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
