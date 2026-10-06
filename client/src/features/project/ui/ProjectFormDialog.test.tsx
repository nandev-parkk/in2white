import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ProjectFormDialog } from './ProjectFormDialog'

describe('ProjectFormDialog', () => {
  it('입력 목적을 접근 가능한 설명으로 제공한다', () => {
    render(
      <ProjectFormDialog
        open
        title="새 프로젝트 만들기"
        submitLabel="만들기"
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    )

    expect(
      screen.getByRole('dialog', { name: '새 프로젝트 만들기' }),
    ).toHaveAccessibleDescription('프로젝트 이름과 설명을 입력해 주세요.')
  })

  it('이름이 비어 있으면 제출하지 않고 필수 오류를 표시한다', async () => {
    const onSubmit = vi.fn()
    render(
      <ProjectFormDialog
        open
        title="새 프로젝트 만들기"
        submitLabel="만들기"
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: '만들기' }))

    expect(screen.getByText('프로젝트 이름을 입력해주세요')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('이름과 설명은 공백을 제거해 제출한다', async () => {
    const onSubmit = vi.fn()
    render(
      <ProjectFormDialog
        open
        title="새 프로젝트 만들기"
        submitLabel="만들기"
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
      />,
    )

    await userEvent.type(screen.getByLabelText('이름'), '  홈페이지 개편  ')
    await userEvent.type(
      screen.getByLabelText(/설명/),
      '  소개 페이지 프로젝트  ',
    )
    await userEvent.click(screen.getByRole('button', { name: '만들기' }))

    expect(onSubmit).toHaveBeenCalledWith({
      name: '홈페이지 개편',
      description: '소개 페이지 프로젝트',
    })
  })

  it('설명이 비어 있으면 null로 제출한다', async () => {
    const onSubmit = vi.fn()
    render(
      <ProjectFormDialog
        open
        title="프로젝트 수정"
        submitLabel="저장"
        initialName="기존 프로젝트"
        initialDescription={null}
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: '저장' }))

    expect(onSubmit).toHaveBeenCalledWith({
      name: '기존 프로젝트',
      description: null,
    })
  })

  it('이름이 50자를 초과하면 제출하지 않는다', async () => {
    const onSubmit = vi.fn()
    render(
      <ProjectFormDialog
        open
        title="새 프로젝트 만들기"
        submitLabel="만들기"
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
      />,
    )

    const nameInput = screen.getByLabelText('이름')
    fireEvent.change(nameInput, { target: { value: 'a'.repeat(51) } })
    await userEvent.click(screen.getByRole('button', { name: '만들기' }))

    expect(
      screen.getByText('프로젝트 이름은 50자 이하로 입력해주세요'),
    ).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('설명이 200자를 초과하면 제출하지 않는다', async () => {
    const onSubmit = vi.fn()
    render(
      <ProjectFormDialog
        open
        title="새 프로젝트 만들기"
        submitLabel="만들기"
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
      />,
    )

    fireEvent.change(screen.getByLabelText(/설명/), {
      target: { value: 'a'.repeat(201) },
    })
    await userEvent.type(screen.getByLabelText('이름'), '프로젝트')
    await userEvent.click(screen.getByRole('button', { name: '만들기' }))

    expect(
      screen.getByText('프로젝트 설명은 200자 이하로 입력해주세요'),
    ).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('수정 모드에서는 기존 값을 표시한다', () => {
    render(
      <ProjectFormDialog
        open
        title="프로젝트 수정"
        submitLabel="저장"
        initialName="기존 프로젝트"
        initialDescription="기존 설명"
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    )

    expect(screen.getByLabelText('이름')).toHaveValue('기존 프로젝트')
    expect(screen.getByLabelText(/설명/)).toHaveValue('기존 설명')
  })

  it('취소하면 모달을 닫는다', async () => {
    const onOpenChange = vi.fn()
    render(
      <ProjectFormDialog
        open
        title="새 프로젝트 만들기"
        submitLabel="만들기"
        onOpenChange={onOpenChange}
        onSubmit={vi.fn()}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: '취소' }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('저장 중에는 입력과 버튼을 비활성화한다', () => {
    render(
      <ProjectFormDialog
        open
        title="프로젝트 수정"
        submitLabel="저장"
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
        loading
      />,
    )

    expect(screen.getByLabelText('이름')).toBeDisabled()
    expect(screen.getByLabelText(/설명/)).toBeDisabled()
    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '취소' })).toBeDisabled()
  })

  it('서버 오류를 모달 안에 표시한다', () => {
    render(
      <ProjectFormDialog
        open
        title="새 프로젝트 만들기"
        submitLabel="만들기"
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
        error="프로젝트를 만들지 못했어요"
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent(
      '프로젝트를 만들지 못했어요',
    )
  })
})
