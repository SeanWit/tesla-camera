import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Button,
  Caption1,
  Checkbox,
  Field,
  Link,
  makeStyles,
  ProgressBar,
  shorthands,
  tokens,
} from '@fluentui/react-components'
import { Copy24Regular, Map24Regular, CheckmarkCircle24Regular, DismissCircle24Regular } from '@fluentui/react-icons'
import { isTauri } from '@tauri-apps/api/core'
import { save } from '@tauri-apps/plugin-dialog'
import { Command } from '@tauri-apps/plugin-shell'
import dayjs from 'dayjs'
import type { CameraId, EventInfo, Video } from '../model'
import { getCamera } from '../tesla-cam'
import { reverseGeocode } from '../utils/geocode'
import RangeTimeline from './range-timeline'
import LocationMap from './location-map'

interface EvidenceToolsProps {
  camera: CameraId
  currentTime: number
  duration: number
  getSelectedVideo: () => HTMLVideoElement | null
  video: Video
}

const useStyles = makeStyles({
  root: {
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderRadius('8px'),
    ...shorthands.padding('12px'),
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('10px'),
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    ...shorthands.gap('8px'),
  },
  title: {
    fontWeight: 600,
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    ...shorthands.gap('8px'),
    '@media screen and (max-width: 1100px)': {
      width: '100%',
    },
  },
  actionButton: {
    flexShrink: 0,
    whiteSpace: 'nowrap',
  },
  rangeTimeline: {
    ...shorthands.padding('4px', '0'),
  },
  bodyRow: {
    display: 'flex',
    ...shorthands.gap('12px'),
    flexWrap: 'wrap',
  },
  mapSection: {
    flex: '1 1 280px',
    minWidth: '240px',
    height: '200px',
    ...shorthands.borderRadius('8px'),
    overflow: 'hidden',
    flexShrink: 0,
  },
  reportSection: {
    flex: '1 1 300px',
    minWidth: '260px',
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('10px'),
  },
  summary: {
    color: tokens.colorNeutralForeground3,
    fontVariantNumeric: 'tabular-nums',
  },
  error: {
    color: tokens.colorPaletteRedForeground1,
  },
  reportCard: {
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.borderRadius('6px'),
    ...shorthands.padding('12px', '16px'),
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('6px'),
    fontVariantNumeric: 'tabular-nums',
  },
  reportRow: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('8px'),
    flexWrap: 'wrap',
  },
  reportLabel: {
    color: tokens.colorNeutralForeground3,
    minWidth: '48px',
  },
  reportActions: {
    display: 'flex',
    ...shorthands.gap('8px'),
    flexWrap: 'wrap',
    marginTop: '4px',
  },
  compliant: {
    color: tokens.colorPaletteGreenForeground1,
    fontWeight: 600,
  },
  nonCompliant: {
    color: tokens.colorPaletteRedForeground1,
    fontWeight: 600,
  },
})

function formatSeconds(value: number) {
  const safeValue = Math.max(0, value)
  const minutes = Math.floor(safeValue / 60)
  const seconds = safeValue % 60
  return `${minutes}:${seconds.toFixed(1).padStart(4, '0')}`
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function toFfmpegTime(value: number) {
  return Math.max(0, value).toFixed(3)
}

async function runFfmpeg(
  args: string[],
  expectedDuration: number,
  onProgress: (progress: number) => void,
) {
  const command = Command.sidecar('binaries/ffmpeg', args)
  let stderr = ''

  command.stdout.on('data', (line) => {
    const match = line.trim().match(/^out_time_(?:ms|us)=(\d+)$/)
    if (!match || expectedDuration <= 0) return
    const currentSeconds = Number(match[1]) / 1_000_000
    onProgress(clamp(currentSeconds / expectedDuration, 0, 1))
  })
  command.stderr.on('data', (line) => {
    stderr += `${line}\n`
  })

  await new Promise<void>((resolve, reject) => {
    command.on('close', ({ code }) => {
      if (code === 0) {
        onProgress(1)
        resolve()
      } else {
        reject(new Error(stderr.trim() || `FFmpeg 退出码：${code}`))
      }
    })
    command.on('error', error => reject(new Error(error)))
    command.spawn().catch(reject)
  })
}

function formatLocation(event?: EventInfo): string | undefined {
  if (!event) return
  if (event.city && event.lat && event.lon) return `${event.city} ${event.lat},${event.lon}`
  if (event.city) return event.city
  if (event.lat && event.lon) return `${event.lat},${event.lon}`
  return
}

function escapeFfmpegText(text: string): string {
  return text.replace(/'/g, "\\'").replace(/:/g, '\\:')
}

function timestampFilter(baseTimeSeconds: number, camera: CameraId, location?: string) {
  const filters = [
    `drawtext=fontsize=48:fontcolor=white:box=1:boxborderw=10:x=16:y=16:boxcolor=black@0.55:text='%{pts\\:localtime\\:${baseTimeSeconds}}'`,
    `drawtext=fontsize=28:fontcolor=white:box=1:boxborderw=8:x=16:y=h-th-16:boxcolor=black@0.55:text='${camera}'`,
  ]
  if (location) {
    filters.push(
      `drawtext=fontsize=28:fontcolor=white:box=1:boxborderw=8:x=w-tw-16:y=16:boxcolor=black@0.55:text='${escapeFfmpegText(location)}'`,
    )
  }
  return filters.join(',')
}

const EvidenceTools: React.FC<EvidenceToolsProps> = ({
  camera,
  currentTime,
  duration,
  getSelectedVideo,
  video,
}) => {
  const styles = useStyles()
  const [rangeStart, setRangeStart] = useState(0)
  const [rangeEnd, setRangeEnd] = useState(0)
  const [busy, setBusy] = useState<'screenshot' | 'clip' | null>(null)
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [withLocation, setWithLocation] = useState(true)
  const [resolvedLocation, setResolvedLocation] = useState<string | undefined>(undefined)
  const [eventKey, setEventKey] = useState(`${video.event?.lat ?? ''},${video.event?.lon ?? ''}`)
  const currentEventKey = `${video.event?.lat ?? ''},${video.event?.lon ?? ''}`
  if (eventKey !== currentEventKey) {
    setEventKey(currentEventKey)
    setResolvedLocation(undefined)
  }
  const [reportCard, setReportCard] = useState<{
    time: number
    duration: number
    location?: string
    reason?: string
  } | null>(null)
  const previousVideoTime = useRef(video.time)
  const source = video.sources[camera]
  const cameraDefinition = getCamera(camera)

  useEffect(() => {
    let cancelled = false
    if (!video.event?.lat || !video.event?.lon) return
    reverseGeocode(video.event.lat, video.event.lon, video.event.city)
      .then(resolved => {
        if (!cancelled) setResolvedLocation(resolved.description)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [video.event?.lat, video.event?.lon, video.event?.city])

  const displayLocation = resolvedLocation ?? formatLocation(video.event)

  useEffect(() => {
    if (previousVideoTime.current !== video.time) {
      previousVideoTime.current = video.time
      setRangeStart(0)
      setRangeEnd(duration)
      return
    }
    setRangeEnd(current => current === 0 ? duration : Math.min(current, duration))
  }, [duration, video.time])

  const clipDuration = useMemo(
    () => Math.max(0, rangeEnd - rangeStart),
    [rangeEnd, rangeStart],
  )

  const resetFeedback = () => {
    setError('')
    setMessage('')
    setProgress(0)
    setReportCard(null)
  }

  const takeBrowserScreenshot = async (fileName: string) => {
    const selectedVideo = getSelectedVideo()
    if (!selectedVideo || selectedVideo.readyState < 2) {
      throw new Error('当前画面尚未加载完成')
    }
    const canvas = document.createElement('canvas')
    canvas.width = selectedVideo.videoWidth
    canvas.height = selectedVideo.videoHeight
    const context = canvas.getContext('2d')
    if (!context) throw new Error('无法创建截图画布')

    context.drawImage(selectedVideo, 0, 0, canvas.width, canvas.height)
    const text = `${dayjs(video.time + currentTime * 1000).format('YYYY-MM-DD HH:mm:ss')}  ${cameraDefinition.label}`
    const fontSize = Math.max(22, Math.round(canvas.width / 42))
    context.font = `600 ${fontSize}px sans-serif`
    const textWidth = context.measureText(text).width
    context.fillStyle = 'rgba(0, 0, 0, 0.62)'
    context.fillRect(20, 20, textWidth + 28, fontSize + 24)
    context.fillStyle = '#fff'
    context.fillText(text, 34, 20 + fontSize + 4)

    if (withLocation) {
      const locationText = displayLocation
      if (locationText) {
        const locFontSize = Math.max(16, Math.round(canvas.width / 56))
        context.font = `600 ${locFontSize}px sans-serif`
        const locWidth = context.measureText(locationText).width
        context.fillStyle = 'rgba(0, 0, 0, 0.62)'
        context.fillRect(canvas.width - locWidth - 48, 20, locWidth + 28, locFontSize + 24)
        context.fillStyle = '#fff'
        context.fillText(locationText, canvas.width - locWidth - 34, 20 + locFontSize + 4)
      }
    }

    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
    if (!blob) throw new Error('截图生成失败')
    downloadBlob(blob, fileName)
  }

  const takeScreenshot = async () => {
    if (!source) return
    resetFeedback()
    setBusy('screenshot')
    const baseName = source.name.replace(/\.mp4$/i, '')
    const fileName = `${baseName}-${toFfmpegTime(currentTime)}s.png`
    try {
      if (!isTauri()) {
        await takeBrowserScreenshot(fileName)
      } else {
        const outputPath = await save({
          defaultPath: fileName,
          filters: [{ name: 'PNG 图片', extensions: ['png'] }],
        })
        if (!outputPath) return
        await runFfmpeg([
          '-y',
          '-ss', toFfmpegTime(currentTime),
          '-i', source.path,
          '-frames:v', '1',
          '-vf', timestampFilter(
            video.time / 1000 + currentTime,
            camera,
            withLocation ? displayLocation : undefined,
          ),
          outputPath,
        ], 1, setProgress)
      }
      setMessage('截图已保存，画面包含拍摄时间和摄像头视角。')
      setReportCard({
        time: video.time + currentTime * 1000,
        duration: 0,
        location: displayLocation,
        reason: video.event?.reason,
      })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(null)
    }
  }

  const exportClip = async (start: number, end: number) => {
    if (!source || !isTauri()) {
      setError('视频截取需要在 TeslaCamera 桌面版中使用。')
      return
    }
    const outputDuration = end - start
    if (outputDuration < 0.1) {
      setError('截取区间至少需要 0.1 秒。')
      return
    }

    resetFeedback()
    setBusy('clip')
    const baseName = source.name.replace(/\.mp4$/i, '')
    const fileName = `${baseName}-${toFfmpegTime(start)}-${toFfmpegTime(end)}s-evidence.mp4`
    try {
      const outputPath = await save({
        defaultPath: fileName,
        filters: [{ name: 'MP4 视频', extensions: ['mp4'] }],
      })
      if (!outputPath) return
      await runFfmpeg([
        '-y',
        '-ss', toFfmpegTime(start),
        '-i', source.path,
        '-t', toFfmpegTime(outputDuration),
        '-vf', timestampFilter(
          video.time / 1000 + start,
          camera,
          withLocation ? displayLocation : undefined,
        ),
        '-an',
        '-movflags', '+faststart',
        '-progress', 'pipe:1',
        '-nostats',
        outputPath,
      ], outputDuration, setProgress)
      setMessage(`视频片段已保存，共 ${outputDuration.toFixed(1)} 秒。`)
      setReportCard({
        time: video.time + start * 1000,
        duration: outputDuration,
        location: displayLocation,
        reason: video.event?.reason,
      })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className={styles.root} aria-label="举报取证工具">
      <div className={styles.header}>
        <div>
          <span className={styles.title}>举报取证</span>
          {' · '}
          {cameraDefinition.label}
        </div>
        <div className={styles.actions}>
          <Button
            className={styles.actionButton}
            disabled={Boolean(busy)}
            onClick={() => setRangeStart(clamp(currentTime, 0, rangeEnd))}
          >
            当前设为起点
          </Button>
          <Button
            className={styles.actionButton}
            disabled={Boolean(busy)}
            onClick={() => setRangeEnd(clamp(currentTime, rangeStart, duration))}
          >
            当前设为终点
          </Button>
          <Button className={styles.actionButton} disabled={Boolean(busy)} onClick={takeScreenshot}>
            截图
          </Button>
          <Button
            className={styles.actionButton}
            appearance="primary"
            disabled={Boolean(busy) || clipDuration < 0.1}
            onClick={() => exportClip(rangeStart, rangeEnd)}
          >
            导出所选片段
          </Button>
          <Button
            className={styles.actionButton}
            disabled={Boolean(busy) || duration < 0.1}
            onClick={() => exportClip(0, duration)}
          >
            导出完整单段
          </Button>
        </div>
      </div>

      <div className={styles.rangeTimeline}>
        <RangeTimeline
          min={0}
          max={duration}
          step={0.1}
          valueStart={rangeStart}
          valueEnd={rangeEnd}
          current={currentTime}
          disabled={Boolean(busy)}
          onChangeStart={(value) => setRangeStart(value)}
          onChangeEnd={(value) => setRangeEnd(value)}
        />
      </div>

      <div className={styles.summary}>
        当前播放 {formatSeconds(currentTime)}，截取长度 {clipDuration.toFixed(1)} 秒
      </div>
      {video.event && (
        <Checkbox
          checked={withLocation}
          disabled={Boolean(busy)}
          label="烧录位置水印（城市 + 经纬度）"
          onChange={(_, data) => setWithLocation(data.checked as boolean)}
        />
      )}
      {busy && (
        <Field validationMessage={busy === 'clip' ? `正在导出 ${Math.round(progress * 100)}%` : '正在生成截图'}>
          <ProgressBar value={progress} />
        </Field>
      )}
      {message && <div>{message}</div>}

      <div className={styles.bodyRow}>
        {video.event?.lat && video.event?.lon && (
          <div className={styles.mapSection}>
            <LocationMap
              lat={video.event.lat}
              lon={video.event.lon}
              label={displayLocation}
            />
          </div>
        )}
        {reportCard && (
          <div className={styles.reportSection}>
            <div className={styles.reportCard}>
          <div className={styles.reportRow}>
            <span className={styles.reportLabel}>时间</span>
            <Caption1>{dayjs(reportCard.time).format('YYYY-MM-DD HH:mm:ss')}</Caption1>
          </div>
          {reportCard.location && (
            <div className={styles.reportRow}>
              <span className={styles.reportLabel}>地点</span>
              <Caption1>{reportCard.location}</Caption1>
            </div>
          )}
          {reportCard.reason && (
            <div className={styles.reportRow}>
              <span className={styles.reportLabel}>事件</span>
              <Caption1>{reportCard.reason}</Caption1>
            </div>
          )}
          {reportCard.duration > 0 && (
            <div className={styles.reportRow}>
              <span className={styles.reportLabel}>片段</span>
              <Caption1>{reportCard.duration.toFixed(1)} 秒</Caption1>
              {reportCard.duration >= 5
                ? (
                  <span className={styles.compliant}>
                    <CheckmarkCircle24Regular /> 满足行车违法 ≥5s
                  </span>
                )
                : (
                  <span className={styles.nonCompliant}>
                    <DismissCircle24Regular /> 不足 5s，可能被驳回
                  </span>
                )}
            </div>
          )}
          <div className={styles.reportActions}>
            <Button
              size="small"
              icon={<Copy24Regular />}
              onClick={() => void navigator.clipboard.writeText(
                [
                  `时间：${dayjs(reportCard.time).format('YYYY-MM-DD HH:mm:ss')}`,
                  reportCard.location ? `地点：${reportCard.location}` : null,
                  reportCard.reason ? `事件：${reportCard.reason}` : null,
                  reportCard.duration > 0 ? `片段：${reportCard.duration.toFixed(1)} 秒` : null,
                ].filter(Boolean).join('\n'),
              )}
            >
              复制全部
            </Button>
            {video.event?.lat && video.event?.lon && (
              <Link
                href={`https://uri.amap.com/marker?position=${video.event.lon},${video.event.lat}`}
                target="_blank"
                rel="noreferrer"
              >
                <Button size="small" icon={<Map24Regular />}>打开地图</Button>
              </Link>
            )}
          </div>
        </div>
          </div>
        )}
      </div>

      {error && <div className={styles.error}>{error}</div>}
    </section>
  )
}

export default EvidenceTools
