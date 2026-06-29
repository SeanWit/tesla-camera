import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  makeStyles,
  shorthands,
  tokens,
  Slider,
  Button,
  Tooltip,
  Caption1,
} from '@fluentui/react-components'
import { Pause24Filled, Play24Filled, Copy24Regular } from '@fluentui/react-icons'
import dayjs from 'dayjs'
import MiniPlay from './mini-player'
import EvidenceTools from './evidence-tools'
import { type CameraId, type Video } from '../model'
import { getAvailableCameras } from '../tesla-cam'
import { reverseGeocode } from '../utils/geocode'

const useStyles = makeStyles({
  root: {
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    ...shorthands.padding(0, '20px', '20px'),
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('14px'),
  },
  cameraGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))',
    ...shorthands.gap('10px'),
    width: '100%',
  },
  statusRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    ...shorthands.gap('8px'),
  },
  timestamp: {
    color: tokens.colorNeutralForeground1,
    fontSize: '18px',
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: '1px',
  },
  location: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('4px'),
    color: tokens.colorNeutralForeground2,
  },
  locationIcon: {
    cursor: 'pointer',
    flexShrink: 0,
    ':active': {
      color: tokens.colorNeutralForeground3,
    },
  },
  cameraCount: {
    color: tokens.colorNeutralForeground3,
  },
  controlWrap: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('10px'),
  },
  slider: {
    flexGrow: 1,
  },
  sliderTime: {
    minWidth: '48px',
    textAlign: 'center',
    fontVariantNumeric: 'tabular-nums',
  },
  iconButton: {
    cursor: 'pointer',
    flexShrink: 0,
    ':active': {
      color: tokens.colorNeutralForeground2,
    },
  },
  empty: {
    ...shorthands.padding('40px'),
    textAlign: 'center',
    color: tokens.colorNeutralForeground3,
  },
})

interface PlayerProps {
  video?: Video
}

function fmtTime(time: number) {
  const safeTime = Math.max(0, time)
  const minutes = Math.floor(safeTime / 60)
  const seconds = Math.floor(safeTime % 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

const Player: React.FC<PlayerProps> = ({ video }) => {
  const styles = useStyles()
  const availableCameras = useMemo(
    () => video ? getAvailableCameras(video) : [],
    [video],
  )
  const [currentCamera, setCurrentCamera] = useState<CameraId>(
    availableCameras[0]?.id ?? 'front',
  )
  const [currentTime, setCurrentTime] = useState(0)
  const [paused, setPaused] = useState(true)
  const [durations, setDurations] = useState<Partial<Record<CameraId, number>>>({})
  const [resolvedLocation, setResolvedLocation] = useState<string | undefined>(undefined)
  const [eventKey, setEventKey] = useState(`${video?.event?.lat ?? ''},${video?.event?.lon ?? ''}`)
  const currentEventKey = `${video?.event?.lat ?? ''},${video?.event?.lon ?? ''}`
  if (eventKey !== currentEventKey) {
    setEventKey(currentEventKey)
    setResolvedLocation(undefined)
  }
  const videoRefs = useRef<Partial<Record<CameraId, HTMLVideoElement | null>>>({})
  const playerRootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    if (!video?.event?.lat || !video?.event?.lon) return
    reverseGeocode(video.event.lat, video.event.lon, video.event.city)
      .then(resolved => {
        if (!cancelled) setResolvedLocation(resolved.description)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [video?.event?.lat, video?.event?.lon, video?.event?.city])

  const displayLocation = resolvedLocation
    ?? (video?.event?.city
      ? `${video.event.city}${video.event.lat && video.event.lon ? ` (${video.event.lat}, ${video.event.lon})` : ''}`
      : video?.event?.lat && video?.event?.lon
        ? `${video.event.lat}, ${video.event.lon}`
        : undefined)

  const durationValues = Object.values(durations).filter(
    (value): value is number => typeof value === 'number' && Number.isFinite(value),
  )
  const duration = durationValues.length ? Math.min(...durationValues) : 0

  const syncAll = (time: number) => {
    availableCameras.forEach(({ id }) => {
      const element = videoRefs.current[id]
      if (!element || !Number.isFinite(element.duration)) return
      element.currentTime = Math.min(time, element.duration)
    })
  }

  const play = async () => {
    syncAll(currentTime)
    const results = await Promise.allSettled(
      availableCameras.map(({ id }) => videoRefs.current[id]?.play()),
    )
    if (results.some(result => result.status === 'fulfilled')) {
      setPaused(false)
    }
  }

  const pause = () => {
    availableCameras.forEach(({ id }) => videoRefs.current[id]?.pause())
    setPaused(true)
  }

  const onSeek = (value: number) => {
    const nextTime = Math.min(value, duration)
    syncAll(nextTime)
    setCurrentTime(nextTime)
  }

  const onSelectCamera = (camera: CameraId) => {
    setCurrentCamera(camera)
    playerRootRef.current?.focus()
  }

  const onTimeUpdate = (camera: CameraId, element: HTMLVideoElement) => {
    if (camera !== currentCamera) return
    const nextTime = Math.min(element.currentTime, duration || element.currentTime)
    setCurrentTime(nextTime)
    availableCameras.forEach(({ id }) => {
      if (id === camera) return
      const other = videoRefs.current[id]
      if (!other || Math.abs(other.currentTime - nextTime) <= 0.2) return
      other.currentTime = Math.min(nextTime, other.duration || nextTime)
    })
  }

  const onKeyUp = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.target instanceof HTMLInputElement) return
    if (event.code === 'Space') {
      event.preventDefault()
      if (paused) void play()
      else pause()
      return
    }
    const shortcut = event.key.toUpperCase()
    const camera = availableCameras.find(item => item.shortcut === shortcut)
    if (camera) onSelectCamera(camera.id)
  }

  if (!video || !availableCameras.length) {
    return <div className={styles.empty}>暂无可播放的视频数据</div>
  }

  return (
    <div
      className={styles.root}
      ref={playerRootRef}
      tabIndex={0}
      onKeyUp={onKeyUp}
    >
      <div className={styles.statusRow}>
        <div className={styles.timestamp}>
          {dayjs(video.time + currentTime * 1000).format('YYYY年MM月DD日 HH:mm:ss')}
        </div>
        <div className={styles.location}>
          {displayLocation
            ? (
              <>
                <Caption1>{displayLocation}</Caption1>
                <Tooltip content="复制地点信息" relationship="label">
                  <Button
                    appearance="subtle"
                    className={styles.locationIcon}
                    icon={<Copy24Regular />}
                    onClick={() => void navigator.clipboard.writeText(displayLocation)}
                  />
                </Tooltip>
              </>
            )
            : null}
        </div>
        <div className={styles.cameraCount}>
          当前片段包含 {availableCameras.length} 路摄像头，点击画面选择取证视角
        </div>
      </div>

      <div className={styles.cameraGrid}>
        {availableCameras.map(camera => (
          <MiniPlay
            camera={camera}
            key={camera.id}
            selected={currentCamera === camera.id}
            source={video.sources[camera.id]!}
            registerRef={(element) => {
              videoRefs.current[camera.id] = element
            }}
            onEnded={pause}
            onLoadedMetadata={(cameraDuration) => {
              setDurations(current => ({ ...current, [camera.id]: cameraDuration }))
            }}
            onSelect={() => onSelectCamera(camera.id)}
            onTimeUpdate={element => onTimeUpdate(camera.id, element)}
          />
        ))}
      </div>

      <div className={styles.controlWrap}>
        {paused
          ? (
              <Button
                appearance="subtle"
                aria-label="播放全部画面"
                className={styles.iconButton}
                icon={<Play24Filled />}
                onClick={() => void play()}
              />
            )
          : (
              <Button
                appearance="subtle"
                aria-label="暂停全部画面"
                className={styles.iconButton}
                icon={<Pause24Filled />}
                onClick={pause}
              />
            )}
        <div className={styles.sliderTime}>{fmtTime(currentTime)}</div>
        <Slider
          className={styles.slider}
          max={duration}
          min={0}
          step={0.1}
          value={currentTime}
          onChange={(_, data) => onSeek(data.value)}
        />
        <div className={styles.sliderTime}>{fmtTime(duration)}</div>
      </div>

      <EvidenceTools
        camera={currentCamera}
        currentTime={currentTime}
        duration={duration}
        getSelectedVideo={() => videoRefs.current[currentCamera] ?? null}
        video={video}
      />
    </div>
  )
}

export default Player
