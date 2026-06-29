import { existsSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CAMERA_IDS } from './model'
import { parseVideoFileName } from './tesla-cam'

const sampleDir = process.env.TESLA_CAM_SAMPLE_DIR ?? ''

describe.runIf(Boolean(sampleDir) && existsSync(sampleDir))('真实 TeslaCam 六路样本', () => {
  it('每个时间片都包含完整六路摄像头', () => {
    const groups = new Map<string, Set<string>>()
    readdirSync(sampleDir).forEach((name) => {
      const parsed = parseVideoFileName(name)
      if (!parsed) return
      const cameras = groups.get(parsed.timeName) ?? new Set<string>()
      cameras.add(parsed.camera)
      groups.set(parsed.timeName, cameras)
    })

    expect(groups.size).toBeGreaterThan(0)
    groups.forEach((cameras) => {
      expect([...cameras].sort()).toEqual([...CAMERA_IDS].sort())
    })
  })
})
