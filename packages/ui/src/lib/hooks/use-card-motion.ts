import { useReducedMotion, type MotionProps } from 'motion/react'

export type CardMotionProps = Pick<
  MotionProps,
  'whileHover' | 'whileTap' | 'transition'
>

/**
 * 목록 카드가 공유하는 hover·press 모션 props를 돌려준다.
 * 모션 감소 설정에서는 이동·축소를 생략하고 transition만 유지한다.
 */
export function useCardMotion(): CardMotionProps {
  const prefersReducedMotion = useReducedMotion()

  return {
    whileHover: prefersReducedMotion ? undefined : { y: -2 },
    whileTap: prefersReducedMotion ? undefined : { scale: 0.99 },
    transition: { type: 'tween', duration: 0.16, ease: 'easeOut' },
  }
}
