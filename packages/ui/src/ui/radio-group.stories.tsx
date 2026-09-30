import { useState, type ComponentProps } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'

import { RadioGroup, RadioGroupItem } from './radio-group'

const OPTIONS = [
  { value: 'daily', label: '매일' },
  { value: 'weekly', label: '매주' },
  { value: 'monthly', label: '매월' },
]

function RadioGroupExample({
  defaultValue = 'weekly',
  ...args
}: ComponentProps<typeof RadioGroup>) {
  const [value, setValue] = useState(defaultValue)

  return (
    <RadioGroup {...args} value={value} onValueChange={setValue}>
      {OPTIONS.map((option) => (
        <label
          key={option.value}
          className="text-body flex cursor-pointer items-center gap-2"
        >
          <RadioGroupItem value={option.value} />
          {option.label}
        </label>
      ))}
    </RadioGroup>
  )
}

const meta = {
  title: 'Shared UI/Controls/Radio Group',
  component: RadioGroup,
  parameters: { layout: 'centered' },
  args: { defaultValue: 'weekly' },
  render: (args) => <RadioGroupExample {...args} />,
} satisfies Meta<typeof RadioGroup>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Disabled: Story = {
  args: { disabled: true },
}

export const WithDisabledOption: Story = {
  render: () => (
    <RadioGroup defaultValue="viewer">
      <label className="text-body flex items-center gap-2">
        <RadioGroupItem value="viewer" /> 보기 가능
      </label>
      <label className="text-body flex items-center gap-2">
        <RadioGroupItem value="editor" /> 편집 가능
      </label>
      <label className="text-body text-foreground-disabled flex items-center gap-2">
        <RadioGroupItem value="owner" disabled /> 소유자 전용
      </label>
    </RadioGroup>
  ),
}
