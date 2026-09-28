import { renderHook } from '@testing-library/react'
import { useReducedMotion } from 'motion/react'

import { useCardMotion } from './use-card-motion'

vi.mock('motion/react', () => ({
  useReducedMotion: vi.fn(),
}))

const useReducedMotionMock = vi.mocked(useReducedMotion)

describe('useCardMotion', () => {
  beforeEach(() => {
    useReducedMotionMock.mockReturnValue(false)
  })

  it('기본 상태에서 hover 상승과 press 축소 모션을 돌려준다', () => {
    const { result } = renderHook(() => useCardMotion())

    expect(result.current.whileHover).toEqual({ y: -2 })
    expect(result.current.whileTap).toEqual({ scale: 0.99 })
    expect(result.current.transition).toEqual({
      type: 'tween',
      duration: 0.16,
      ease: 'easeOut',
    })
  })

  it('모션 감소 설정에서는 hover와 press 모션을 생략한다', () => {
    useReducedMotionMock.mockReturnValue(true)

    const { result } = renderHook(() => useCardMotion())

    expect(result.current.whileHover).toBeUndefined()
    expect(result.current.whileTap).toBeUndefined()
    expect(result.current.transition).toBeDefined()
  })
})
