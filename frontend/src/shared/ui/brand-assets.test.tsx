import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { AppShellHeader } from './app-shell-header'

describe('Brand assets', () => {
  it('uses the in2white logo mark in the app shell header', () => {
    render(
      <AppShellHeader
        workspaceName="인투화이트 디자인팀"
        searchPlaceholder="프로젝트 검색"
        userName="김민지"
      />,
    )

    expect(screen.getByAltText('in2white')).toHaveAttribute(
      'src',
      '/logo-mark.png',
    )
  })
})
