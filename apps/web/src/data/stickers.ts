import anton from '../assets/stickers/anton.png'
import nastya from '../assets/stickers/nastya.png'
import partyMax from '../assets/stickers/party_max.png'
import sanya from '../assets/stickers/sanya.png'

export interface StickerTemplate {
  id: string
  name: string
  preview: {
    src: string
    darkSrc?: string
    framing?: {
      scale: number
      x: number
      y: number
    }
  }
}

export const stickers: readonly StickerTemplate[] = [
  { id: 'anton', name: 'Anton', preview: { src: anton, framing: { scale: 1.08, x: -10, y: -5 } } },
  { id: 'nastya', name: 'Nastya', preview: { src: nastya, framing: { scale: 1, x: 0, y: -3 } } },
  { id: 'party-max', name: 'Party Max', preview: { src: partyMax, framing: { scale: 1.2, x: 0, y: -7 } } },
  { id: 'sanya', name: 'Sanya', preview: { src: sanya, framing: { scale: 1.09, x: 0, y: 0 } } },
]
