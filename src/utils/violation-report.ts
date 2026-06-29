import dayjs from 'dayjs'
export type ViolationType =
  | 'emergency_lane'
  | 'bus_lane'
  | 'illegal_lane_change'
  | 'illegal_parking'
  | 'running_red_light'
  | 'wrong_way'
  | 'throwing_objects'
  | 'other'

export interface ViolationOption {
  value: ViolationType
  label: string
  description: string
  minVideoSeconds: number
  minPhotoCount: number
  photoIntervalSeconds: number
}

export const VIOLATION_TYPES: ViolationOption[] = [
  {
    value: 'emergency_lane',
    label: '占用应急车道',
    description: '机动车在非紧急情况下占用高速公路应急车道行驶或停车',
    minVideoSeconds: 5,
    minPhotoCount: 2,
    photoIntervalSeconds: 1,
  },
  {
    value: 'bus_lane',
    label: '违法占用公交车道',
    description: '机动车在公交专用车道行驶或停放',
    minVideoSeconds: 5,
    minPhotoCount: 2,
    photoIntervalSeconds: 1,
  },
  {
    value: 'illegal_lane_change',
    label: '压实线变道',
    description: '机动车压实线变更车道，不按规定依次排队',
    minVideoSeconds: 5,
    minPhotoCount: 2,
    photoIntervalSeconds: 1,
  },
  {
    value: 'illegal_parking',
    label: '违法停车',
    description: '机动车在禁止停车路段停车',
    minVideoSeconds: 12,
    minPhotoCount: 2,
    photoIntervalSeconds: 10,
  },
  {
    value: 'running_red_light',
    label: '闯红灯',
    description: '机动车违反交通信号灯规定通行',
    minVideoSeconds: 5,
    minPhotoCount: 2,
    photoIntervalSeconds: 1,
  },
  {
    value: 'wrong_way',
    label: '逆向行驶',
    description: '机动车在道路上逆向行驶',
    minVideoSeconds: 5,
    minPhotoCount: 2,
    photoIntervalSeconds: 1,
  },
  {
    value: 'throwing_objects',
    label: '车窗抛物',
    description: '机动车驾驶人或乘车人向车外抛洒物品',
    minVideoSeconds: 5,
    minPhotoCount: 2,
    photoIntervalSeconds: 1,
  },
  {
    value: 'other',
    label: '其他违法行为',
    description: '其他交通违法行为',
    minVideoSeconds: 5,
    minPhotoCount: 2,
    photoIntervalSeconds: 1,
  },
]

const TESLA_REASON_MAP: Record<string, ViolationType> = {
  sensed_hard_brake: 'illegal_lane_change',
  sensed_object_collision: 'other',
  user_initiated_honk: 'other',
  user_initiated_brake: 'other',
  collision_warning: 'other',
  disabled: 'other',
}

export function guessViolationType(reason?: string): ViolationType | undefined {
  if (!reason) return
  return TESLA_REASON_MAP[reason]
}

export interface ReportDescriptionParams {
  violationType: ViolationType
  plateNumber?: string
  eventTime: number
  location?: string
  reason?: string
}

export function generateReportDescription({
  violationType,
  plateNumber,
  eventTime,
  location,
}: ReportDescriptionParams): string {
  const option = VIOLATION_TYPES.find(v => v.value === violationType) ?? VIOLATION_TYPES[VIOLATION_TYPES.length - 1]
  const timeStr = dayjs(eventTime).format('YYYY-MM-DD HH:mm:ss')
  const plate = plateNumber ? `车牌号 ${plateNumber}，` : ''
  const loc = location ? `在${location}，` : ''

  return `${plate}${loc}于 ${timeStr}，实施${option.label}违法行为（${option.description}）。以上证据材料均含时间、地点水印，请予以查处。`
}

export function generateFullReportText({
  violationType,
  plateNumber,
  eventTime,
  location,
  reason,
  clipDuration,
}: ReportDescriptionParams & { clipDuration?: number }): string {
  const option = VIOLATION_TYPES.find(v => v.value === violationType) ?? VIOLATION_TYPES[VIOLATION_TYPES.length - 1]
  const lines: string[] = [
    `违法时间：${dayjs(eventTime).format('YYYY-MM-DD HH:mm:ss')}`,
  ]
  if (location) lines.push(`违法地点：${location}`)
  if (plateNumber) lines.push(`号牌号码：${plateNumber}`)
  lines.push(`违法行为：${option.label}`)
  lines.push(`违法描述：${generateReportDescription({ violationType, plateNumber, eventTime, location, reason })}`)
  if (clipDuration !== undefined && clipDuration > 0) {
    lines.push(`视频时长：${clipDuration.toFixed(1)} 秒`)
    if (clipDuration >= option.minVideoSeconds) {
      lines.push(`合规性：✓ 满足最低 ${option.minVideoSeconds} 秒要求`)
    } else {
      lines.push(`合规性：✗ 不足 ${option.minVideoSeconds} 秒，可能被驳回`)
    }
  }
  if (reason) lines.push(`Tesla事件原因：${reason}`)
  return lines.join('\n')
}

export function isCompliant(
  violationType: ViolationType,
  clipDuration: number,
): { compliant: boolean; minSeconds: number } {
  const option = VIOLATION_TYPES.find(v => v.value === violationType)
  const minSeconds = option?.minVideoSeconds ?? 5
  return { compliant: clipDuration >= minSeconds, minSeconds }
}

export function getPhotoTimestamps(
  clipDuration: number,
  violationType: ViolationType,
  count = 3,
): number[] {
  const option = VIOLATION_TYPES.find(v => v.value === violationType)
  const interval = option?.photoIntervalSeconds ?? 1
  const minCount = option?.minPhotoCount ?? 2
  const actualCount = Math.max(minCount, Math.min(count, 3))

  if (clipDuration <= 0) return []

  const step = Math.max(interval, clipDuration / actualCount)
  const timestamps: number[] = []
  const startOffset = Math.max(0.5, (clipDuration - step * (actualCount - 1)) / 2)
  for (let i = 0; i < actualCount; i++) {
    const t = startOffset + step * i
    if (t < clipDuration) timestamps.push(t)
  }
  if (timestamps.length < minCount && clipDuration > 0.5) {
    timestamps.push(clipDuration * 0.9)
  }
  return [...new Set(timestamps)].sort((a, b) => a - b)
}
