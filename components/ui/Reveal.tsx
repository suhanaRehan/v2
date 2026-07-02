export default function Reveal({
  children,
  className = '',
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  // Animation removed per request — content now renders immediately with
  // no slide/fade-in motion. The `delay` prop is kept (and ignored) so
  // every existing call site (`<Reveal delay={100}>`) keeps working
  // without needing to touch every page that uses it.
  return <div className={className}>{children}</div>
}
