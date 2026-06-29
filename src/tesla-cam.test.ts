import { describe, expect, it } from 'vitest'
import { CAMERAS, type CameraId } from './model'
import {
  assignCameraSource,
  getAvailableCameras,
  parseVideoFileName,
} from './tesla-cam'

const timeName = '2026-06-29_10-04-22'

describe('parseVideoFileName', () => {
  it.each(CAMERAS.map(camera => camera.id))('识别 %s 摄像头', (camera) => {
    expect(parseVideoFileName(`${timeName}-${camera}.mp4`)).toEqual({
      timeName,
      camera,
    })
  })

  it('拒绝非 TeslaCam 视频和近似名称', () => {
    expect(parseVideoFileName('event.json')).toBeUndefined()
    expect(parseVideoFileName(`${timeName}-left_pillar.mp4.tmp`)).toBeUndefined()
    expect(parseVideoFileName(`${timeName}-unknown.mp4`)).toBeUndefined()
  })
})

describe('四路和六路兼容', () => {
  it('旧四路录像只暴露实际存在的四个视角', () => {
    const sources: Partial<Record<CameraId, string>> = {}
    const cameras: CameraId[] = ['front', 'back', 'left_repeater', 'right_repeater']
    cameras.forEach(camera => assignCameraSource(
      sources,
      `${timeName}-${camera}.mp4`,
      camera,
    ))

    expect(Object.keys(sources)).toEqual(cameras)
    expect(getAvailableCameras({
      title: '',
      time: 0,
      type: 0,
      dir: '',
      sources: Object.fromEntries(
        Object.entries(sources).map(([camera, name]) => [
          camera,
          { name, path: name, get: async () => ({ name, url: name }) },
        ]),
      ),
    }).map(camera => camera.id)).toEqual(cameras)
  })

  it('新六路录像包含左右 B 柱且顺序稳定', () => {
    const sources: Partial<Record<CameraId, string>> = {}
    CAMERAS.forEach(({ id }) => assignCameraSource(
      sources,
      `${timeName}-${id}.mp4`,
      id,
    ))

    expect(getAvailableCameras({
      title: '',
      time: 0,
      type: 0,
      dir: '',
      sources: Object.fromEntries(
        Object.entries(sources).map(([camera, name]) => [
          camera,
          { name, path: name, get: async () => ({ name, url: name }) },
        ]),
      ),
    }).map(camera => camera.id)).toEqual(CAMERAS.map(camera => camera.id))
  })
})
