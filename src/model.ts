export enum TypeEnum {
  '所有',
  '事件',
  '哨兵',
  '行车记录仪'
}

export const CAMERA_IDS = [
  'front',
  'back',
  'left_repeater',
  'right_repeater',
  'left_pillar',
  'right_pillar',
] as const

export type CameraId = typeof CAMERA_IDS[number]

export interface CameraDefinition {
  id: CameraId
  label: string
  shortLabel: string
  shortcut?: string
}

export const CAMERAS: CameraDefinition[] = [
  { id: 'front', label: '前摄像头', shortLabel: '前', shortcut: 'W' },
  { id: 'back', label: '后摄像头', shortLabel: '后', shortcut: 'S' },
  { id: 'left_repeater', label: '左侧翼子板', shortLabel: '左侧', shortcut: 'A' },
  { id: 'right_repeater', label: '右侧翼子板', shortLabel: '右侧', shortcut: 'D' },
  { id: 'left_pillar', label: '左侧 B 柱', shortLabel: '左 B 柱', shortcut: 'Q' },
  { id: 'right_pillar', label: '右侧 B 柱', shortLabel: '右 B 柱', shortcut: 'E' },
]

export interface FileData {
  get(): Promise<{ url: string; name: string }>
  name: string
  path: string
}

export interface EventInfo {
  time: number
  city?: string
  lat?: string
  lon?: string
  reason?: string
  camera?: string
}

export interface OriginVideo {
  title: string
  time: number
  type: TypeEnum
  dir: string
  sources: Partial<Record<CameraId, FileData>>
  event?: EventInfo
}

export interface VideoSource {
  url: string
  name: string
  path: string
}

export interface Video {
  title: string
  time: number
  type: TypeEnum
  dir: string
  sources: Partial<Record<CameraId, VideoSource>>
  event?: EventInfo
}

export interface ModelState {
  type: TypeEnum
  current?: Video
  list: OriginVideo[]
  events: VideoFile[]
}

export interface VideoFile {
  fs: FileSystemFileHandle
  path: string
  dir: string
}

export interface EventJson {
  timestamp: string
  city: string
  est_lat: string
  est_lon: string
  reason: string
  camera: string
}

export interface TauriFile {
  name: string
  path: string
  children?: TauriFile[]
}
