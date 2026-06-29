import React from 'react'
import {
  Tooltip,
  Body1Strong,
  Button,
} from '@fluentui/react-components'
import { FolderAdd24Regular } from '@fluentui/react-icons'
import dayjs from 'dayjs'
import {
  type OriginVideo, TypeEnum, type VideoFile, type EventJson, type FileData,
} from '../model'
import { assignCameraSource, parseVideoFileName } from '../tesla-cam'

interface DirectoryAccessProps {
  onAccess: (accessFile: OriginVideo[]) => void
}

async function getDirFiles(fs: FileSystemDirectoryHandle, path = '') {
  const files: VideoFile[] = []
  const fsHandles = await fs.values()
  for await (const fsHandle of fsHandles) {
    const currentPath = `${path}/${fsHandle.name}`
    if (fsHandle.kind === 'file') {
      files.push({ fs: fsHandle, path: currentPath, dir: `${path}/` })
    }
    if (fsHandle.kind === 'directory') {
      files.push(...await getDirFiles(fsHandle, currentPath))
    }
  }
  return files
}

function pathToType(path: string) {
  if (path.includes('SavedClips')) {
    return TypeEnum.事件
  }
  if (path.includes('RecentClips')) {
    return TypeEnum.行车记录仪
  }
  if (path.includes('SentryClips')) {
    return TypeEnum.哨兵
  }
  return TypeEnum.所有
}

function nameToTime(name: string): number {
  const date = name.slice(0, 10)
  const hours = name.slice(11, 13)
  const minutes = name.slice(14, 16)
  const seconds = name.slice(17, 19)
  return dayjs(`${date} ${hours}:${minutes}:${seconds}`).valueOf()
}

function nameToTitle(name: string): string {
  const time = nameToTime(name)
  return dayjs(time).format('YYYY年MM月DD日 HH:mm:ss')
}

function convertFiles(videoFiles: VideoFile[]): OriginVideo[] {
  const videos: Record<string, OriginVideo> = {}
  videoFiles.forEach(({ fs, path, dir }) => {
    const parsed = parseVideoFileName(fs.name)
    if (!parsed) return
    const { timeName } = parsed
    const key = `${dir}|${timeName}`
    let exists = videos[key]
    if (!exists) {
      exists = {
        title: nameToTitle(timeName),
        time: nameToTime(timeName),
        type: pathToType(path),
        dir,
        sources: {},
      }
      videos[key] = exists
    }
    const fsData: FileData = {
      async get() {
        return {
          url: URL.createObjectURL(await fs.getFile()),
          name: fs.name,
        }
      },
      name: fs.name,
      path,
    }
    assignCameraSource(exists.sources, fs.name, fsData)
  })
  return Object.values(videos)
}

const DirectoryAccess: React.FC<React.PropsWithChildren<DirectoryAccessProps>> = props => {
  async function onSelectFile() {
    const dirHandle = await window.showDirectoryPicker()
    const files = await getDirFiles(dirHandle)
    const videos = convertFiles(files)
    const eventsFiles = files.filter(({ path }) => /.+event.json$/.test(path))
    let events: EventJson[] = []
    for (let i = 0; i < eventsFiles.length; i++) {
      const file = await eventsFiles[i].fs.getFile()
      events.push(JSON.parse(await file.text()))
    }
    events = events.sort((a, b) => dayjs(a.timestamp).valueOf() - dayjs(b.timestamp).valueOf())
    const newVideos = videos.sort((a, b) => a.time - b.time)
    newVideos.forEach((item, vIndex) => {
      const eIndex = events.findIndex(({ timestamp }) => item.time > dayjs(timestamp).valueOf())
      if (eIndex > -1) {
        const event = events[eIndex]
        events.splice(eIndex, 1)
        if (newVideos[vIndex - 1]) {
          newVideos[vIndex - 1].event = {
            time: dayjs(event.timestamp).valueOf(),
            city: event.city,
            lat: event.est_lat,
            lon: event.est_lon,
            reason: event.reason,
            camera: event.camera,
          }
        }
      }
    })
    props.onAccess(newVideos)
  }
  return (
    <Tooltip content={<>选择车载U盘中的<Body1Strong>TeslaCam</Body1Strong>目录，或者是<Body1Strong>TeslaCam</Body1Strong>文件目录的拷贝</>} relationship="label">
      <Button icon={<FolderAdd24Regular />} size="large" onClick={() => onSelectFile()} />
    </Tooltip>
  )
}

export default DirectoryAccess
