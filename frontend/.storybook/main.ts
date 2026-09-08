import path from 'node:path'

import tailwindcss from '@tailwindcss/vite'
import type { StorybookConfig } from '@storybook/react-vite'

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  staticDirs: ['../public'],
  viteFinal: async (viteConfig) => {
    viteConfig.plugins = [...(viteConfig.plugins ?? []), tailwindcss()]
    viteConfig.resolve = {
      ...viteConfig.resolve,
      alias: {
        ...(viteConfig.resolve?.alias ?? {}),
        '@': path.resolve(import.meta.dirname, '../src'),
      },
    }

    return viteConfig
  },
}

export default config
