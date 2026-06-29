import Tesseract from 'tesseract.js'

export interface PlateRecognitionResult {
  rawText: string
  plateNumber: string | null
  confidence: number
}

const PLATE_PATTERN = /[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤川青藏琼宁][A-HJ-NP-Z][A-HJ-NP-Z0-9]{4,5}[A-HJ-NP-Z0-9]/

function extractPlate(text: string): string | null {
  const cleaned = text.replace(/\s+/g, '').replace(/[·•・]/g, '')
  const match = cleaned.match(PLATE_PATTERN)
  return match ? match[0] : null
}

export async function recognizePlate(
  canvas: HTMLCanvasElement,
  onProgress?: (progress: number) => void,
): Promise<PlateRecognitionResult> {
  const result = await Tesseract.recognize(canvas, 'chi_sim+eng', {
    logger: (m: { status: string; progress?: number }) => {
      if (m.status === 'recognizing text' && m.progress !== undefined && onProgress) {
        onProgress(m.progress)
      }
    },
  })

  const rawText = result.data.text
  const plateNumber = extractPlate(rawText)
  const confidence = result.data.confidence

  return { rawText, plateNumber, confidence }
}

export function cropCenterRegion(
  source: HTMLVideoElement | HTMLCanvasElement,
  srcWidth: number,
  srcHeight: number,
  cropRatio = 0.4,
): HTMLCanvasElement {
  const cropW = Math.round(srcWidth * cropRatio)
  const cropH = Math.round(srcHeight * 0.25)
  const cropX = Math.round((srcWidth - cropW) / 2)
  const cropY = Math.round((srcHeight - cropH) / 2)

  const canvas = document.createElement('canvas')
  canvas.width = cropW
  canvas.height = cropH
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  ctx.drawImage(source, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH)
  return canvas
}

export function enhanceForOCR(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const { width, height } = canvas
  const enhanced = document.createElement('canvas')
  enhanced.width = width
  enhanced.height = height
  const ctx = enhanced.getContext('2d')
  if (!ctx) return canvas

  ctx.drawImage(canvas, 0, 0)
  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data
  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
    const threshold = gray > 140 ? 255 : 0
    data[i] = threshold
    data[i + 1] = threshold
    data[i + 2] = threshold
  }
  ctx.putImageData(imageData, 0, 0)
  return enhanced
}
