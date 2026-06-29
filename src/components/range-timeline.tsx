import React, { useCallback, useRef, useState } from 'react'
import { makeStyles, shorthands, tokens } from '@fluentui/react-components'

const useStyles = makeStyles({
  container: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('6px'),
    userSelect: 'none',
  },
  trackWrap: {
    position: 'relative',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    touchAction: 'none',
  },
  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: '8px',
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.borderRadius('4px'),
  },
  rangeHighlight: {
    position: 'absolute',
    height: '8px',
    backgroundColor: tokens.colorBrandBackground,
    ...shorthands.borderRadius('4px'),
  },
  rangeHighlightDrag: {
    position: 'absolute',
    height: '8px',
    backgroundColor: tokens.colorBrandBackgroundPressed,
    ...shorthands.borderRadius('4px'),
  },
  progressMarker: {
    position: 'absolute',
    width: '3px',
    height: '16px',
    top: '12px',
    backgroundColor: tokens.colorPaletteRedForeground1,
    ...shorthands.borderRadius('1px'),
    pointerEvents: 'none',
  },
  handle: {
    position: 'absolute',
    width: '14px',
    height: '22px',
    marginLeft: '-7px',
    backgroundColor: tokens.colorNeutralBackground1,
    border: `2px solid ${tokens.colorBrandStroke1}`,
    ...shorthands.borderRadius('3px'),
    cursor: 'grab',
    top: '9px',
    zIndex: 2,
    transition: 'border-color 0.15s',
    ':hover': {
      ...shorthands.borderColor(tokens.colorBrandStroke2Pressed),
    },
    ':active': {
      cursor: 'grabbing',
      ...shorthands.borderColor(tokens.colorBrandStroke2Pressed),
    },
  },
  handleStart: {},
  handleStartPseudo: {
    '::after': {
      content: '""',
      position: 'absolute',
      top: '7px',
      left: '50%',
      transform: 'translateX(-50%)',
      width: '2px',
      height: '8px',
      backgroundColor: tokens.colorBrandStroke1,
    },
  },
  handleEnd: {},
  handleEndPseudo: {
    '::after': {
      content: '""',
      position: 'absolute',
      top: '7px',
      left: '50%',
      transform: 'translateX(-50%)',
      width: '2px',
      height: '8px',
      backgroundColor: tokens.colorBrandStroke1,
    },
  },
  labels: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontVariantNumeric: 'tabular-nums',
    fontSize: '13px',
  },
  label: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('4px'),
  },
  labelDot: {
    width: '8px',
    height: '8px',
    ...shorthands.borderRadius('50%'),
  },
  labelDotStart: {
    backgroundColor: tokens.colorBrandBackground,
  },
  labelDotEnd: {
    backgroundColor: tokens.colorBrandBackground,
  },
  labelDotCurrent: {
    backgroundColor: tokens.colorPaletteRedForeground1,
  },
  labelStart: {
    color: tokens.colorBrandForeground1,
    fontWeight: 600,
  },
  labelEnd: {
    color: tokens.colorBrandForeground1,
    fontWeight: 600,
  },
  labelCurrent: {
    color: tokens.colorPaletteRedForeground1,
  },
  labelDuration: {
    color: tokens.colorNeutralForeground3,
  },
})

export interface RangeTimelineProps {
  min: number
  max: number
  step?: number
  valueStart: number
  valueEnd: number
  current?: number
  disabled?: boolean
  onChangeStart: (value: number) => void
  onChangeEnd: (value: number) => void
}

type DragTarget = 'start' | 'end' | null

function formatTime(value: number) {
  const safeValue = Math.max(0, value)
  const minutes = Math.floor(safeValue / 60)
  const seconds = safeValue % 60
  return `${minutes}:${seconds.toFixed(1).padStart(4, '0')}`
}

const RangeTimeline: React.FC<RangeTimelineProps> = ({
  min,
  max,
  step = 0.1,
  valueStart,
  valueEnd,
  current,
  disabled = false,
  onChangeStart,
  onChangeEnd,
}) => {
  const styles = useStyles()
  const trackRef = useRef<HTMLDivElement>(null)
  const [dragTarget, setDragTarget] = useState<DragTarget>(null)

  const range = max - min
  const safeRange = range > 0 ? range : 1

  const pct = (value: number) => {
    const clamped = Math.min(max, Math.max(min, value))
    return ((clamped - min) / safeRange) * 100
  }

  const snap = useCallback(
    (rawValue: number) => {
      const clamped = Math.min(max, Math.max(min, rawValue))
      const snapped = Math.round(clamped / step) * step
      return Math.min(max, Math.max(min, snapped))
    },
    [min, max, step],
  )

  const valueFromPointer = useCallback(
    (clientX: number) => {
      const el = trackRef.current
      if (!el) return min
      const rect = el.getBoundingClientRect()
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
      return min + ratio * range
    },
    [min, range],
  )

  const onPointerDownHandle = (target: DragTarget) => (e: React.PointerEvent) => {
    if (disabled || !target) return
    e.preventDefault()
    e.stopPropagation()
    setDragTarget(target)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragTarget || disabled) return
      const raw = valueFromPointer(e.clientX)
      const snapped = snap(raw)
      if (dragTarget === 'start') {
        onChangeStart(Math.min(snapped, valueEnd - step))
      } else {
        onChangeEnd(Math.max(snapped, valueStart + step))
      }
    },
    [dragTarget, disabled, valueFromPointer, snap, valueEnd, valueStart, step, onChangeStart, onChangeEnd],
  )

  const onPointerUp = (e: React.PointerEvent) => {
    if (dragTarget) {
      setDragTarget(null)
      try {
        ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
      } catch {
        // ignore
      }
    }
  }

  const onTrackClick = (e: React.PointerEvent) => {
    if (disabled) return
    const raw = valueFromPointer(e.clientX)
    const snapped = snap(raw)
    const distToStart = Math.abs(snapped - valueStart)
    const distToEnd = Math.abs(snapped - valueEnd)
    if (distToStart <= distToEnd) {
      onChangeStart(Math.min(snapped, valueEnd - step))
    } else {
      onChangeEnd(Math.max(snapped, valueStart + step))
    }
  }

  const startPct = pct(valueStart)
  const endPct = pct(valueEnd)
  const currentPct = current != null ? pct(current) : null

  const highlightClass = dragTarget ? styles.rangeHighlightDrag : styles.rangeHighlight

  return (
    <div className={styles.container}>
      <div
        className={styles.trackWrap}
        onPointerDown={onTrackClick}
        style={disabled ? { opacity: 0.5, pointerEvents: 'none' } : undefined}
      >
        <div className={styles.track} ref={trackRef} />

        <div
          className={highlightClass}
          style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }}
        />

        {currentPct != null && (
          <div
            className={styles.progressMarker}
            style={{ left: `${currentPct}%` }}
          />
        )}

        <div
          className={`${styles.handle} ${styles.handleStart} ${styles.handleStartPseudo}`}
          style={{ left: `${startPct}%` }}
          onPointerDown={onPointerDownHandle('start')}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          role="slider"
          aria-label="截取起点"
          aria-valuenow={valueStart}
          aria-valuemin={min}
          aria-valuemax={valueEnd}
          tabIndex={0}
        />

        <div
          className={`${styles.handle} ${styles.handleEnd} ${styles.handleEndPseudo}`}
          style={{ left: `${endPct}%` }}
          onPointerDown={onPointerDownHandle('end')}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          role="slider"
          aria-label="截取终点"
          aria-valuenow={valueEnd}
          aria-valuemin={valueStart}
          aria-valuemax={max}
          tabIndex={0}
        />
      </div>

      <div className={styles.labels}>
        <div className={styles.label}>
          <span className={`${styles.labelDot} ${styles.labelDotStart}`} />
          <span className={styles.labelStart}>起点 {formatTime(valueStart)}</span>
        </div>
        <div className={styles.labelDuration}>
          截取 {formatTime(valueEnd - valueStart)}
        </div>
        <div className={styles.label}>
          <span className={`${styles.labelDot} ${styles.labelDotEnd}`} />
          <span className={styles.labelEnd}>终点 {formatTime(valueEnd)}</span>
        </div>
      </div>
    </div>
  )
}

export default RangeTimeline
