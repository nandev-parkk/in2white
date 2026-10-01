import { Card, CardDescription, CardTitle } from '@in2white/ui/card'

type MetricCardProps = {
  label: string
  value: number
  /** 정지·삭제된 수처럼 총계만으로는 오해할 수 있는 숫자. */
  detail?: string
}

function MetricCard({ label, value, detail }: MetricCardProps) {
  return (
    <Card className="gap-1">
      <CardDescription className="text-[14px] leading-[1.429]">
        {label}
      </CardDescription>
      <CardTitle className="text-[28px] leading-[1.3] font-bold tracking-[-0.4px]">
        {value.toLocaleString('ko-KR')}
      </CardTitle>
      <CardDescription className="text-foreground-tertiary text-[12px] leading-[1.4]">
        {detail ?? ''}
      </CardDescription>
    </Card>
  )
}

export { MetricCard }
