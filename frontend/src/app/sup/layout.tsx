import AppShell from '@/components/AppShell'

export default function SupLayout({ children }: { children: React.ReactNode }) {
  return <AppShell role="supervisor">{children}</AppShell>
}
