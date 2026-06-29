interface AmapRegeoResponse {
  status: string
  info: string
  regeocode?: {
    formatted_address?: string
    addressComponent?: {
      province?: string
      city?: string | []
      district?: string
      township?: string
    }
    roads?: Array<{
      name: string
      direction?: string
      distance?: number
    }>
    roadinters?: Array<{
      first_name: string
      second_name: string
      direction?: string
      distance?: number
    }>
  }
}

export interface ResolvedLocation {
  description: string
  raw: { lat: string; lon: string; city?: string }
}

const AMAP_KEY = process.env.PUBLIC_AMAP_KEY ?? ''
const cache = new Map<string, ResolvedLocation>()

function formatDirection(direction?: string): string {
  if (!direction) return ''
  const map: Record<string, string> = {
    North: '从南往北方向',
    South: '从北往南方向',
    East: '从西往东方向',
    West: '从东往西方向',
    Northeast: '从西南往东北方向',
    Northwest: '从东南往西北方向',
    Southeast: '从西北往东南方向',
    Southwest: '从东北往西南方向',
  }
  return map[direction] ?? direction
}

export async function reverseGeocode(lat: string, lon: string, city?: string): Promise<ResolvedLocation> {
  const cacheKey = `${lat},${lon}`
  const cached = cache.get(cacheKey)
  if (cached) return cached

  const fallback: ResolvedLocation = {
    description: city ? `${city} ${lat},${lon}` : `${lat},${lon}`,
    raw: { lat, lon, city },
  }

  if (!AMAP_KEY) return fallback

  try {
    const url = `https://restapi.amap.com/v3/geocode/regeo?key=${AMAP_KEY}&location=${lon},${lat}&extensions=all&radius=50&output=json`
    const response = await fetch(url)
    if (!response.ok) return fallback
    const data: AmapRegeoResponse = await response.json()
    if (data.status !== '1' || !data.regeocode) return fallback

    const roads = data.regeocode.roads ?? []
    const roadinters = data.regeocode.roadinters ?? []
    const district = data.regeocode.addressComponent?.district
    const township = data.regeocode.addressComponent?.township

    const parts: string[] = []
    if (district && typeof district === 'string') parts.push(district)

    const nearestRoad = roads.length
      ? roads.reduce((a, b) => (Number(a.distance) <= Number(b.distance) ? a : b))
      : undefined
    if (nearestRoad?.name) {
      const dir = formatDirection(nearestRoad.direction)
      parts.push(dir ? `${nearestRoad.name} ${dir}` : nearestRoad.name)
    }

    const nearestInter = roadinters.length
      ? roadinters.reduce((a, b) => (Number(a.distance) <= Number(b.distance) ? a : b))
      : undefined
    if (nearestInter && nearestInter.first_name && nearestInter.second_name) {
      parts.push(`${nearestInter.first_name}与${nearestInter.second_name}交叉口`)
    } else if (township && typeof township === 'string' && !nearestRoad?.name) {
      parts.push(township)
    }

    if (!parts.length && data.regeocode.formatted_address) {
      parts.push(data.regeocode.formatted_address)
    }

    parts.push(`(${lat}, ${lon})`)

    const result: ResolvedLocation = {
      description: parts.join(' '),
      raw: { lat, lon, city },
    }
    cache.set(cacheKey, result)
    return result
  } catch {
    return fallback
  }
}
