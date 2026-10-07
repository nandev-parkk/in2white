import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'

it('초기 HTML만으로 한국어 공유 카드와 공개 PNG를 제공한다', () => {
  const html = new DOMParser().parseFromString(
    readFileSync(join(process.cwd(), 'index.html'), 'utf8'),
    'text/html',
  )
  const meta = (key: string) =>
    html
      .querySelector(`meta[property="${key}"], meta[name="${key}"]`)
      ?.getAttribute('content')

  expect(html.documentElement.lang).toBe('ko')
  expect(meta('og:title')).toBe('in2white | 실시간 협업 화이트보드')
  expect(meta('description')).toBeTruthy()
  expect(meta('og:description')).toBe(meta('description'))
  expect(meta('og:type')).toBe('website')
  expect(meta('og:site_name')).toBe('in2white')
  expect(meta('og:locale')).toBe('ko_KR')
  expect(meta('og:url')).toBe('https://whiteboard.in2wise.com/')
  expect(meta('twitter:card')).toBe('summary_large_image')
  expect(meta('twitter:title')).toBe(meta('og:title'))
  expect(meta('twitter:description')).toBe(meta('description'))
  expect(meta('twitter:image')).toBe(meta('og:image'))
  expect(meta('og:image:alt')).toBeTruthy()
  expect(meta('twitter:image:alt')).toBe(meta('og:image:alt'))

  const image = new URL(meta('og:image')!)
  expect(image.protocol).toBe('https:')
  expect(image.origin).toBe(new URL(meta('og:url')!).origin)
  expect(image.pathname).toBe('/og-image.png')
  expect(meta('og:image:type')).toBe('image/png')
  expect(meta('og:image:width')).toBe('1200')
  expect(meta('og:image:height')).toBe('630')

  const png = readFileSync(join(process.cwd(), 'public', image.pathname))
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
  expect(png.readUInt32BE(16)).toBe(1200)
  expect(png.readUInt32BE(20)).toBe(630)
})
