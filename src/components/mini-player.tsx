import React from 'react'
import { makeStyles, shorthands, tokens } from '@fluentui/react-components'
import cls from 'classnames'
import type { CameraDefinition, VideoSource } from '../model'

interface MiniPlayProps {
  camera: CameraDefinition
  selected: boolean
  source: VideoSource
  onEnded: () => void
  onLoadedMetadata: (duration: number) => void
  onSelect: () => void
  onTimeUpdate: (element: HTMLVideoElement) => void
  registerRef: (element: HTMLVideoElement | null) => void
}

const useStyles = makeStyles({
  root: {
    position: 'relative',
    minWidth: 0,
    aspectRatio: '16 / 10',
    cursor: 'pointer',
    backgroundColor: tokens.colorNeutralBackground5Selected,
    ...shorthands.borderRadius('8px'),
    ...shorthands.overflow('hidden'),
    ...shorthands.border('3px', 'solid', 'transparent'),
    transitionProperty: 'border-color, transform',
    transitionDuration: '120ms',
    ':hover': {
      transform: 'translateY(-1px)',
    },
  },
  selected: {
    ...shorthands.borderColor(tokens.colorBrandStroke1),
  },
  video: {
    display: 'block',
    height: '100%',
    width: '100%',
    objectFit: 'contain',
    backgroundColor: '#050505',
  },
  name: {
    position: 'absolute',
    bottom: '8px',
    left: '8px',
    color: '#fff',
    fontWeight: 600,
    pointerEvents: 'none',
    backgroundColor: 'rgba(0, 0, 0, 0.62)',
    ...shorthands.padding('4px', '8px'),
    ...shorthands.borderRadius('4px'),
  },
  shortcut: {
    opacity: 0.72,
    marginLeft: '6px',
    fontWeight: 400,
  },
})

const MiniPlay: React.FC<MiniPlayProps> = ({
  camera,
  onEnded,
  onLoadedMetadata,
  onSelect,
  onTimeUpdate,
  registerRef,
  selected,
  source,
}) => {
  const styles = useStyles()

  return (
    <div
      className={cls(styles.root, { [styles.selected]: selected })}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      aria-label={`选择${camera.label}`}
      aria-pressed={selected}
      onKeyUp={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onSelect()
      }}
    >
      <video
        muted
        playsInline
        preload="metadata"
        className={styles.video}
        ref={registerRef}
        src={source.url}
        onEnded={onEnded}
        onLoadedMetadata={event => onLoadedMetadata(event.currentTarget.duration)}
        onTimeUpdate={event => onTimeUpdate(event.currentTarget)}
      />
      <span className={styles.name}>
        {camera.label}
        {camera.shortcut && <span className={styles.shortcut}>{camera.shortcut}</span>}
      </span>
    </div>
  )
}

export default MiniPlay
