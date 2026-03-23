interface Props {
  count?: number
  height?: string
}

export function SkeletonList({ count = 3, height = 'h-16' }: Props) {
  return (
    <div className="space-y-3">
      {[...Array(count)].map((_, i) => (
        <div key={i} className={`${height} rounded-xl bg-gray-200 animate-pulse`} />
      ))}
    </div>
  )
}
