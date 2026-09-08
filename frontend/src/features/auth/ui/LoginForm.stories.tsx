import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterContextProvider, type AnyRouter } from '@tanstack/react-router'
import type { Meta, StoryObj } from '@storybook/react-vite'

import { LoginForm } from './LoginForm'

const storyQueryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
})

const storyRouter = {
  navigate: () => Promise.resolve(),
  options: {},
} as unknown as AnyRouter

const meta = {
  title: 'Features/Auth/Login Form',
  component: LoginForm,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <RouterContextProvider router={storyRouter}>
        <QueryClientProvider client={storyQueryClient}>
          <div className="bg-background-default flex min-h-80 w-full items-center justify-center p-8">
            <div className="w-(--layout-container-auth-shell-max-width)">
              <Story />
            </div>
          </div>
        </QueryClientProvider>
      </RouterContextProvider>
    ),
  ],
} satisfies Meta<typeof LoginForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
