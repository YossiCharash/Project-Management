/// <reference types="vite/client" />

interface Window {
  _env_: {
    VITE_API_URL?: string
  }
}

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

