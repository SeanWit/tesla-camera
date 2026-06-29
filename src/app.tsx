import { useState, useEffect, useRef } from 'react'
import cln from 'classnames'
import {
  makeStyles,
  shorthands,
  Tab,
  TabList,
  Divider,
  tokens,
  Tooltip,
  Button,
  Caption1Stronger,
  Badge,
} from '@fluentui/react-components'
import {
  Record24Regular, Code24Regular, BookQuestionMark24Regular,
} from '@fluentui/react-icons'
import Player from './components/player'
import DirectoryAccess from './components/directory-access'
import FsSystem from './components/fs-system'
import CheckUpdate from './components/check-update'
import {
  CAMERAS, TypeEnum, type CameraId, type ModelState, type OriginVideo, type Video,
  type VideoSource,
} from './model'
import { isTauri } from '@tauri-apps/api/core'
import dayjs from 'dayjs'

const useStyles = makeStyles({
  root: {
    display: 'flex',
    height: '100vh',
    minWidth: 0,
    '@media screen and (max-width: 900px)': {
      flexDirection: 'column',
    },
  },
  aside: {
    width: '330px',
    height: '100vh',
    backgroundColor: tokens.colorNeutralStroke3,
    display: 'flex',
    flexShrink: 0,
    flexDirection: 'column',
    '@media screen and (max-width: 900px)': {
      width: '100%',
      height: '180px',
    },
  },
  empty: {
    textAlign: 'center',
  },
  tabWrap: {
    alignItems: 'flex-start',
    display: 'flex',
    justifyContent: 'center',
    ...shorthands.padding('10px'),
    rowGap: '20px',
    flexShrink: 0,
  },
  menuWrap: {
    ...shorthands.padding('20px'),
    overflowY: 'auto',
    flexGrow: 1,
    display: 'flex',
    rowGap: '14px',
    flexDirection: 'column',
    '@media screen and (max-width: 900px)': {
      flexDirection: 'row',
      overflowX: 'auto',
      overflowY: 'hidden',
      ...shorthands.padding('10px', '20px'),
    },
  },
  eventTag: {
    flexGrow: '1',
    textAlign: 'right',
  },
  menuItem: {
    ...shorthands.padding('6px', '16px'),
    ...shorthands.borderRadius('4px'),
    ...shorthands.transition('all', '120ms'),
    backgroundColor: tokens.colorNeutralBackground1,
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    columnGap: '12px',
    color: tokens.colorNeutralForeground1,
    flexShrink: 0,
    ':hover': {
      color: tokens.colorCompoundBrandStrokePressed,
    },
  },
  menuItemIsActive: {
    color: tokens.colorPaletteRedBorderActive,
    ':hover': {
      color: tokens.colorPaletteRedBorderActive,
    },
  },
  content: {
    height: '100vh',
    ...shorthands.overflow('hidden', 'auto'),
    flexGrow: 1,
    minWidth: 0,
    backgroundColor: tokens.colorSubtleBackgroundHover,
    '@media screen and (max-width: 900px)': {
      height: 'calc(100vh - 180px)',
    },
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    ...shorthands.gap('10px'),
    ...shorthands.padding('20px'),
  },
  headerLeft: {
    ...shorthands.gap('10px'),
    display: 'flex',
  },
  headerRight: {
    ...shorthands.gap('10px'),
    display: 'flex',
    alignItems: 'center',
  },
  link: {
    color: 'inherit',
    '&:active': {
      color: 'inherit',
    },
  },
  player: {
    flexGrow: 1,
    minHeight: '1px',
    boxSizing: 'border-box',
    display: 'flex',
    justifyContent: 'center',
  },
})

const tabs = [
  {
    name: '所有',
    value: TypeEnum.所有,
  },
  {
    name: '事件',
    value: TypeEnum.事件,
  },
  {
    name: '哨兵',
    value: TypeEnum.哨兵,
  },
  {
    name: '记录仪',
    value: TypeEnum.行车记录仪,
  },
]

function getDevelopmentSample(): Video | undefined {
  if (!import.meta.env.DEV) return
  const samplePrefix = new URLSearchParams(window.location.search).get('sample')
  if (!samplePrefix) return
  const timeName = samplePrefix.split('/').pop()
  if (!timeName) return
  const time = dayjs(
    `${timeName.slice(0, 10)} ${timeName.slice(11, 13)}:${timeName.slice(14, 16)}:${timeName.slice(17, 19)}`,
  ).valueOf()
  return {
    title: dayjs(time).format('YYYY年MM月DD日 HH:mm:ss'),
    time,
    type: TypeEnum.行车记录仪,
    dir: samplePrefix.slice(0, samplePrefix.lastIndexOf('/') + 1),
    sources: Object.fromEntries(CAMERAS.map(camera => [
      camera.id,
      {
        name: `${timeName}-${camera.id}.mp4`,
        path: `${samplePrefix}-${camera.id}.mp4`,
        url: `${samplePrefix}-${camera.id}.mp4`,
      },
    ])),
  }
}

function App() {
  const styles = useStyles()
  const selectionRequest = useRef(0)
  const [filterType, setFilterType] = useState(TypeEnum.所有)
  const [state, setState] = useState<ModelState>({
    type: TypeEnum.所有,
    current: getDevelopmentSample(),
    list: [],
    events: [],
  })
  useEffect(() => {
    document.onkeydown = (e: KeyboardEvent) => {
      if (e.code == 'Space') {
        e.preventDefault()
      }
    }
    return () => {
      document.onkeydown = null
    }
  }, [])
  function onFileSystemAccess(videos: OriginVideo[]) {
    setState(current => {
      Object.values(current.current?.sources ?? {}).forEach(source => URL.revokeObjectURL(source.url))
      return {
        ...current,
        current: undefined,
        list: videos,
      }
    })
  }
  async function onSelectVideo(origin: OriginVideo) {
    const requestId = ++selectionRequest.current
    const sourceEntries = Object.entries(origin.sources) as [CameraId, NonNullable<OriginVideo['sources'][CameraId]>][]
    const loadedEntries = await Promise.all(sourceEntries.map(async ([camera, source]) => {
      const loaded = await source.get()
      const videoSource: VideoSource = {
        url: loaded.url,
        name: loaded.name,
        path: source.path,
      }
      return [camera, videoSource] as const
    }))
    if (requestId !== selectionRequest.current) {
      loadedEntries.forEach(([, source]) => URL.revokeObjectURL(source.url))
      return
    }

    setState(current => {
      Object.values(current.current?.sources ?? {}).forEach(source => URL.revokeObjectURL(source.url))
      return {
        ...current,
        current: {
          ...origin,
          sources: Object.fromEntries(loadedEntries),
        },
      }
    })
  }
  const videoList = state.list
    .filter(({ type }) => type === filterType || filterType === TypeEnum.所有)
    .sort((a, b) => b.time - a.time)
  return (
    <>
      <div className={styles.root}>
        <div className={styles.aside}>
          <div>
            <div className={styles.tabWrap}>
              <TabList
                selectedValue={filterType}
                onTabSelect={(_, data) => setFilterType(data.value as TypeEnum)}
              >
                {
                  tabs.map(({ name, value }) => (
                    <Tab key={value} value={value}>{name}</Tab>
                  ))
                }
              </TabList>
            </div>
            <Divider />
          </div>
          <div className={styles.menuWrap}>
            {
              videoList.map((item) => (
                <div
                  className={cln(styles.menuItem, {
                    [styles.menuItemIsActive]: item.time === state.current?.time
                      && item.dir === state.current?.dir,
                  })}
                  key={`${item.dir}:${item.time}`}
                  onClick={() => void onSelectVideo(item)}
                  onKeyDown={(e) => {
                    e.preventDefault()
                  }}
                  onKeyUp={(e) => {
                    e.preventDefault()
                  }}
                >
                  <Record24Regular />
                  {item.title}
                  <div className={styles.eventTag}>
                    {item.event
                      ? (
                        <Tooltip
                          content={item.event.reason ?? '事件触发'}
                          relationship="label"
                        >
                          <Badge color="danger" size="extra-small" />
                        </Tooltip>
                      )
                      : null}
                  </div>
                </div>
              ))
            }
            {!videoList.length && <div className={styles.empty}>暂无数据</div>}
          </div>
        </div>
        <div className={styles.content}>
          <div className={styles.header}>
            <div className={styles.headerLeft}>
              {isTauri()
                ? <FsSystem onAccess={onFileSystemAccess} />
                : <DirectoryAccess onAccess={onFileSystemAccess} />}
            </div>
            <div className={styles.headerRight}>
              <CheckUpdate />
              <Tooltip
                content={<>查看源代码 (本项目<Caption1Stronger>不会上传</Caption1Stronger>您的隐私视频，并且接受公开的代码审查)</>}
                relationship="label"
              >
                <Button
                  icon={
                    <a
                      className={styles.link}
                      href="https://github.com/Mario34/tesla-camera"
                      rel="noreferrer"
                      target="_blank"
                    >
                      <Code24Regular />
                    </a>
                  }
                />
              </Tooltip>
              <Tooltip content={<>问题反馈</>} relationship="label">
                <Button
                  icon={
                    <a
                      className={styles.link}
                      href="https://github.com/Mario34/tesla-camera/issues/new?assignees=Mario34&labels=&template=%E6%84%8F%E8%A7%81%E6%88%96%E5%8F%8D%E9%A6%88.md&title=%E6%84%8F%E8%A7%81%E6%88%96%E5%8F%8D%E9%A6%88"
                      rel="noreferrer"
                      target="_blank"
                    >
                      <BookQuestionMark24Regular />
                    </a>
                  }
                />
              </Tooltip>
            </div>
          </div>
          <div className={styles.player}>
            <Player
              key={state.current ? `${state.current.dir}:${state.current.time}` : 'empty'}
              video={state.current}
            />
          </div>
        </div>
      </div>
    </>
  )
}

export default App
