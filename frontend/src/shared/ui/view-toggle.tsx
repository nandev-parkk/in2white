import { LayoutGrid, List } from 'lucide-react'

type ListView = 'grid' | 'table'

type ViewToggleProps = {
  value: ListView
  onChange: (view: ListView) => void
  label: string
  gridLabel?: string
  tableLabel?: string
}

const BUTTON_CLASS =
  'focus-visible:ring-action-focus-ring aria-pressed:bg-background-default aria-pressed:ring-border flex size-7 items-center justify-center rounded-md outline-none focus-visible:ring-3 aria-pressed:shadow-sm aria-pressed:ring-1'

function ViewToggle({
  value,
  onChange,
  label,
  gridLabel = '카드 보기',
  tableLabel = '목록 보기',
}: ViewToggleProps) {
  return (
    <div
      className="bg-background-subtle flex h-9 items-center gap-0.5 rounded-lg p-1"
      role="group"
      aria-label={label}
    >
      <button
        type="button"
        aria-label={gridLabel}
        aria-pressed={value === 'grid'}
        onClick={() => onChange('grid')}
        className={BUTTON_CLASS}
      >
        <LayoutGrid className="size-3.5" />
      </button>
      <button
        type="button"
        aria-label={tableLabel}
        aria-pressed={value === 'table'}
        onClick={() => onChange('table')}
        className={BUTTON_CLASS}
      >
        <List className="size-3.5" />
      </button>
    </div>
  )
}

export { ViewToggle }
export type { ListView }
