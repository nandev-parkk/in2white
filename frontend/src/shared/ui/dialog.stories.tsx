import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'

import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Textarea } from '@/shared/ui/textarea'

function DialogExample({ initialOpen = false }: { initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>프로젝트 삭제</Button>
      </DialogTrigger>
      <DialogContent>
        <div>
          <DialogTitle>프로젝트를 삭제할까요?</DialogTitle>
          <DialogDescription className="mt-2">
            브랜드 리뉴얼 프로젝트와 모든 문서가 삭제됩니다. 이 작업은 되돌릴 수
            없습니다.
          </DialogDescription>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="tertiary">취소</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button variant="destructive">삭제하기</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const meta = {
  title: 'Shared UI/Compositions/Dialog',
  component: Dialog,
  parameters: { layout: 'centered' },
  render: () => <DialogExample />,
} satisfies Meta<typeof Dialog>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Open: Story = {
  render: () => <DialogExample initialOpen />,
}

export const CreateProject: Story = {
  render: () => {
    function CreateProjectDialog() {
      const [open, setOpen] = useState(false)

      return (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>새 프로젝트</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>새 프로젝트 만들기</DialogTitle>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="project-name"
                className="text-label text-foreground-default"
              >
                이름
              </label>
              <Input id="project-name" placeholder="예: 2026 브랜드 리뉴얼" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="project-description"
                className="text-label text-foreground-default"
              >
                설명 (선택)
              </label>
              <Textarea
                id="project-description"
                placeholder="어떤 프로젝트인지 짧게 설명해주세요"
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="tertiary">취소</Button>
              </DialogClose>
              <Button onClick={() => setOpen(false)}>만들기</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )
    }

    return <CreateProjectDialog />
  },
}
