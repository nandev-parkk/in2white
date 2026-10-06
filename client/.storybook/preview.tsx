import { useEffect, type ReactNode } from 'react'
import type { Preview } from '@storybook/react-vite'

import '../src/app/styles/index.css'

type Theme = 'light' | 'dark'

// Storybook preview config exports a non-component default alongside this decorator.
// eslint-disable-next-line react-refresh/only-export-components
function ThemeDecorator({
  children,
  theme,
}: {
  children: ReactNode
  theme: Theme
}) {
  useEffect(() => {
    const documentElement = document.documentElement
    documentElement.classList.toggle('dark', theme === 'dark')

    return () => documentElement.classList.remove('dark')
  }, [theme])

  return (
    <div
      style={{
        backgroundColor: 'var(--background-canvas)',
        color: 'var(--foreground-default)',
      }}
    >
      {children}
    </div>
  )
}

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'canvas',
      values: [
        { name: 'canvas', value: 'var(--background-canvas)' },
        { name: 'default', value: 'var(--background-default)' },
      ],
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  globalTypes: {
    theme: {
      description: 'Global theme for components',
      defaultValue: 'light',
      toolbar: {
        title: '테마',
        icon: 'circlehollow',
        items: [
          { value: 'light', title: '라이트' },
          { value: 'dark', title: '다크' },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story, context) => {
      const theme: Theme = context.globals.theme === 'dark' ? 'dark' : 'light'

      return (
        <ThemeDecorator theme={theme}>
          <Story />
        </ThemeDecorator>
      )
    },
  ],
}

export default preview
