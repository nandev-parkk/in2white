import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu'

function DropdownMenuExample() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>메뉴 열기</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>이름 변경</DropdownMenuItem>
        <DropdownMenuItem variant="danger">삭제</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

it('열림과 강조 상태를 즉시 바꾸지 않고 전환한다', async () => {
  const user = userEvent.setup()
  render(<DropdownMenuExample />)

  await user.click(screen.getByRole('button', { name: '메뉴 열기' }))
  const content = await screen.findByRole('menu')

  expect(content).toHaveClass('data-[state=open]:fade-in-0')
  expect(content).toHaveClass('data-[state=open]:zoom-in-95')
  expect(content).toHaveClass('data-[state=closed]:fade-out-0')
  expect(content).toHaveClass('data-[state=closed]:zoom-out-95')
  expect(content).toHaveClass('motion-reduce:!animate-none')

  const item = screen.getByRole('menuitem', { name: '이름 변경' })

  expect(item).toHaveClass('data-[highlighted]:bg-background-subtle')
  expect(item).toHaveClass('transition-colors', 'duration-150', 'ease-out')
  expect(item).toHaveClass('motion-reduce:transition-none')
})
