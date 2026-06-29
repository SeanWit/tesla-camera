import { CAMERAS, type CameraDefinition, type CameraId, type OriginVideo, type Video } from './model'

const VIDEO_FILE_PATTERN = /^(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})-(front|back|left_repeater|right_repeater|left_pillar|right_pillar)\.mp4$/i

export interface ParsedVideoFileName {
  timeName: string
  camera: CameraId
}

export function parseVideoFileName(name: string): ParsedVideoFileName | undefined {
  const match = VIDEO_FILE_PATTERN.exec(name)
  if (!match) return
  return {
    timeName: match[1],
    camera: match[2].toLowerCase() as CameraId,
  }
}

export function assignCameraSource<T>(
  sources: Partial<Record<CameraId, T>>,
  name: string,
  source: T,
): ParsedVideoFileName | undefined {
  const parsed = parseVideoFileName(name)
  if (!parsed) return
  sources[parsed.camera] = source
  return parsed
}

export function getCamera(camera: CameraId): CameraDefinition {
  return CAMERAS.find(item => item.id === camera)!
}

export function getAvailableCameras(video: OriginVideo | Video): CameraDefinition[] {
  return CAMERAS.filter(camera => Boolean(video.sources[camera.id]))
}
