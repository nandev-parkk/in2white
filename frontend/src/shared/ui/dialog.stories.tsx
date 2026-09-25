import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { FolderX } from 'lucide-react'

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
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[440px] overflow-y-auto p-0 [&>div]:gap-0">
        <div className="flex flex-col px-6 py-7 text-center">
          <span className="bg-status-danger-subtle-bg text-status-danger flex size-12 items-center justify-center self-center rounded-full">
            <FolderX aria-hidden="true" className="size-6" />
          </span>
          <DialogTitle className="mt-4 text-[20px] leading-7 font-semibold">
            프로젝트를 삭제할까요?
          </DialogTitle>
          <DialogDescription className="mt-2">
            브랜드 리뉴얼 프로젝트와 모든 문서가 삭제됩니다. 이 작업은 되돌릴 수
            없습니다.
          </DialogDescription>
        </div>
        <DialogFooter className="border-border w-full border-t px-6 py-4">
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
          <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[440px] overflow-y-auto p-7">
            <div>
              <DialogTitle className="text-[20px] leading-7 font-semibold">
                새 프로젝트 만들기
              </DialogTitle>
              <DialogDescription className="mt-2">
                프로젝트 이름과 설명을 입력해 주세요.
              </DialogDescription>
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault()
                setOpen(false)
              }}
            >
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="project-name"
                    className="text-label text-foreground-default font-medium"
                  >
                    이름
                  </label>
                  <Input
                    id="project-name"
                    placeholder="예: 2026 브랜드 리뉴얼"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="project-description"
                    className="text-label text-foreground-default font-medium"
                  >
                    설명 (선택)
                  </label>
                  <Textarea
                    id="project-description"
                    placeholder="어떤 프로젝트인지 짧게 설명해주세요"
                  />
                </div>
              </div>
              <DialogFooter className="border-border mt-6 border-t pt-5">
                <DialogClose asChild>
                  <Button type="button" variant="tertiary">
                    취소
                  </Button>
                </DialogClose>
                <Button type="submit">만들기</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )
    }

    return <CreateProjectDialog />
  },
}
