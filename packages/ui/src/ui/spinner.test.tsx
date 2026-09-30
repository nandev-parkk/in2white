import { render, screen } from '@testing-library/react'
import { Spinner } from './spinner'

it('로딩 상태를 스크린 리더에 알린다', () => {
  render(<Spinner />)
  expect(screen.getByRole('status')).toHaveAccessibleName('로딩 중')
})

/*
 * 이 저장소의 `cn`은 tailwind-merge에 `text-body` 같은 타이포 토큰을 font-size로
 * 등록해 색상 유틸과 충돌하지 않게 한다. 확장 없는 병합기를 쓰면 타이포 토큰을
 * 색상으로 오인해 둘 중 하나를 버린다.
 */
it('타이포 토큰과 색상 유틸을 함께 남긴다', () => {
  render(<Spinner className="text-body" />)
  const spinner = screen.getByRole('status')
  expect(spinner).toHaveClass('text-body')
  expect(spinner).toHaveClass('text-foreground-strong')
})
