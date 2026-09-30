import AppShell from '@/components/AppShell'

export default function PgLayout({ children }: { children: React.ReactNode }) {
  return <AppShell role="pg">{children}</AppShell>
}
