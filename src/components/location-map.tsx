import React, { useEffect, useRef, useState } from 'react'
import { makeStyles, shorthands, tokens, Spinner, Caption1 } from '@fluentui/react-components'

const AMAP_KEY = process.env.PUBLIC_AMAP_KEY ?? ''
const AMAP_JS_URL = `https://webapi.amap.com/maps?v=2.0&key=${AMAP_KEY}&plugin=AMap.Scale`

const useStyles = makeStyles({
  root: {
    width: '100%',
    height: '100%',
    position: 'relative',
    ...shorthands.borderRadius('8px'),
    overflow: 'hidden',
    backgroundColor: tokens.colorNeutralBackground2,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  loading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    ...shorthands.gap('8px'),
    color: tokens.colorNeutralForeground3,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  empty: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    ...shorthands.gap('4px'),
    color: tokens.colorNeutralForeground3,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  attribution: {
    position: 'absolute',
    bottom: '2px',
    right: '4px',
    fontSize: '10px',
    color: tokens.colorNeutralForeground4,
    backgroundColor: 'rgba(255,255,255,0.7)',
    ...shorthands.padding('1px', '4px'),
    ...shorthands.borderRadius('2px'),
    pointerEvents: 'none',
  },
})

interface AMapInstance {
  destroy(): void
  setCenter(value: [number, number]): void
  setZoom(value: number): void
  addOverlay(overlay: unknown): void
  removeOverlay(overlay: unknown): void
}

interface AMapMarker {
  setMap(map: AMapInstance | null): void
}

interface AMapWindow {
  AMap: {
    Map: new (container: HTMLElement, config: {
      zoom?: number
      center?: [number, number]
      mapStyle?: string
      viewMode?: string
    }) => AMapInstance
    Marker: new (config: {
      position: [number, number]
      title?: string
    }) => AMapMarker
    Scale: new () => { addTo(map: AMapInstance): void }
  }
}

declare global {
  interface Window {
    AMap?: AMapWindow['AMap']
  }
}

let scriptPromise: Promise<void> | null = null

function loadAmapScript(): Promise<void> {
  if (window.AMap) return Promise.resolve()
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = AMAP_JS_URL
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      scriptPromise = null
      reject(new Error('高德地图加载失败'))
    }
    document.head.appendChild(script)
  })
  return scriptPromise
}

interface LocationMapProps {
  lat?: string
  lon?: string
  label?: string
}

const LocationMap: React.FC<LocationMapProps> = ({ lat, lon, label }) => {
  const styles = useStyles()
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<AMapInstance | null>(null)
  const markerRef = useRef<AMapMarker | null>(null)

  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'empty'>(
    () => {
      if (!lat || !lon) return 'empty'
      const lonNum = parseFloat(lon)
      const latNum = parseFloat(lat)
      if (!Number.isFinite(lonNum) || !Number.isFinite(latNum)) return 'empty'
      return 'loading'
    },
  )

  useEffect(() => {
    if (!lat || !lon || !containerRef.current) {
      return
    }

    let destroyed = false
    const lonNum = parseFloat(lon)
    const latNum = parseFloat(lat)

    if (!Number.isFinite(lonNum) || !Number.isFinite(latNum)) {
      return
    }
    loadAmapScript()
      .then(() => {
        if (destroyed || !containerRef.current || !window.AMap) return

        if (mapRef.current) {
          mapRef.current.destroy()
          mapRef.current = null
          markerRef.current = null
        }

        const map = new window.AMap.Map(containerRef.current, {
          zoom: 16,
          center: [lonNum, latNum],
          viewMode: '2D',
        })
        mapRef.current = map

        const marker = new window.AMap.Marker({
          position: [lonNum, latNum],
          title: label ?? '违章位置',
        })
        marker.setMap(map)
        markerRef.current = marker

        setStatus('ready')
      })
      .catch(() => {
        if (!destroyed) setStatus('error')
      })

    return () => {
      destroyed = true
      if (markerRef.current) {
        markerRef.current.setMap(null)
        markerRef.current = null
      }
      if (mapRef.current) {
        mapRef.current.destroy()
        mapRef.current = null
      }
    }
  }, [lat, lon, label])

  return (
    <div className={styles.root}>
      <div ref={containerRef} className={styles.map} />
      {status === 'loading' && (
        <div className={styles.loading}>
          <Spinner size="small" />
          <Caption1>地图加载中…</Caption1>
        </div>
      )}
      {status === 'empty' && (
        <div className={styles.empty}>
          <Caption1>无位置信息</Caption1>
        </div>
      )}
      {status === 'error' && (
        <div className={styles.empty}>
          <Caption1>地图加载失败</Caption1>
        </div>
      )}
      <div className={styles.attribution}>高德地图</div>
    </div>
  )
}

export default LocationMap
