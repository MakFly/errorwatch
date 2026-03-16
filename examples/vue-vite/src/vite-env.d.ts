/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ERRORWATCH_DSN: string
  readonly VITE_ERRORWATCH_API_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}
