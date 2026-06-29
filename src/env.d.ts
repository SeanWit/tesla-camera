declare interface Window {
  __TAURI_IPC__?: unknown
  showDirectoryPicker(): Promise<FileSystemDirectoryHandle>
}

declare module '*.css'

declare const process: {
  env: {
    PUBLIC_AMAP_KEY?: string
    PUBLIC_ASSET_PREFIX?: string
    TESLA_CAM_SAMPLE_DIR?: string
    [key: string]: string | undefined
  }
}
