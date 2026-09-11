import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { AccountUser } from '@/entities/account'

import { AccountProfileForm } from './AccountProfileForm'

const accountUser: AccountUser = {
  id: 'user-1',
  name: '기존 이름',
  email: 'user@example.com',
}

describe('AccountProfileForm', () => {
  it('label과 input은 6px 간격이고 저장 버튼은 form 우측에 정렬한다', () => {
    render(
      <AccountProfileForm
        user={accountUser}
        onSubmit={vi.fn()}
        loading={false}
      />,
    )

    expect(screen.getByText('아이디').parentElement).toHaveClass('gap-[6px]')
    expect(screen.getByText('이름').parentElement).toHaveClass('gap-[6px]')
    expect(screen.getByRole('button', { name: '저장' })).toHaveClass('self-end')
  })

  it('아이디는 disabled이고 이름 저장 callback에는 trim된 값만 전달한다', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()

    render(
      <AccountProfileForm
        user={accountUser}
        onSubmit={onSubmit}
        loading={false}
      />,
    )

    const accountIdInput = screen.getByLabelText('아이디')

    expect(accountIdInput).toBeDisabled()
    expect(accountIdInput).toHaveAttribute('aria-invalid', 'false')
    expect(accountIdInput).not.toHaveAttribute('aria-describedby')
    await user.clear(screen.getByLabelText('이름'))
    await user.type(screen.getByLabelText('이름'), '  새 이름  ')
    await user.click(screen.getByRole('button', { name: '저장' }))

    expect(onSubmit).toHaveBeenCalledWith({ name: '새 이름' })
  })

  it('pristine form은 user prop의 최신 이름으로 동기화한다', () => {
    const { rerender } = render(
      <AccountProfileForm
        user={accountUser}
        onSubmit={vi.fn()}
        loading={false}
      />,
    )

    rerender(
      <AccountProfileForm
        user={{ ...accountUser, name: '서버에서 갱신된 이름' }}
        onSubmit={vi.fn()}
        loading={false}
      />,
    )

    expect(screen.getByLabelText('이름')).toHaveValue('서버에서 갱신된 이름')
  })

  it('dirty form은 user prop이 바뀌어도 편집 중인 이름을 보존한다', async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <AccountProfileForm
        user={accountUser}
        onSubmit={vi.fn()}
        loading={false}
      />,
    )

    await user.clear(screen.getByLabelText('이름'))
    await user.type(screen.getByLabelText('이름'), '편집 중인 이름')

    rerender(
      <AccountProfileForm
        user={{ ...accountUser, name: '서버에서 갱신된 이름' }}
        onSubmit={vi.fn()}
        loading={false}
      />,
    )

    expect(screen.getByLabelText('이름')).toHaveValue('편집 중인 이름')
  })

  it('공백 이름은 callback을 호출하지 않고 오류를 표시한다', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()

    render(
      <AccountProfileForm
        user={accountUser}
        onSubmit={onSubmit}
        loading={false}
      />,
    )

    await user.clear(screen.getByLabelText('이름'))
    await user.click(screen.getByRole('button', { name: '저장' }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText('이름을 입력해주세요')).toBeInTheDocument()
  })

  it('입력 오류와 서버 오류를 접근 가능한 방식으로 표시하고 저장 중 버튼을 비활성화한다', () => {
    render(
      <AccountProfileForm
        user={accountUser}
        onSubmit={vi.fn()}
        loading
        error="이름을 저장하지 못했어요"
      />,
    )

    expect(screen.getByLabelText('이름')).toHaveAttribute(
      'aria-invalid',
      'false',
    )
    expect(screen.getByRole('alert')).toHaveTextContent(
      '이름을 저장하지 못했어요',
    )
    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled()
  })
})
