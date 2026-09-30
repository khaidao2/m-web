import { createElement } from 'react'
import {
  ArrowDownUp, BadgeCheck, ChartColumn, CalendarX, Coffee, DoorClosed, Droplet, Ear, Flame, Gift, GlassWater,
  HeartHandshake, Layers, LayoutGrid, ListOrdered, Megaphone, MessageCircleQuestion, Package, Receipt, Scale,
  SearchX, ShieldCheck, ShoppingBasket, ShoppingCart, Soup, Store, Tag, Timer, TrendingUp, TriangleAlert, Users,
  Wallet, Zap, type LucideIcon, UserRound, Boxes,
} from 'lucide-react'
import type { ScenarioGroup } from '@/lib/types'

/* Named icons used by content files (quiz visuals, brand cards). */
export const ICONS: Record<string, LucideIcon> = {
  'arrow-down-up': ArrowDownUp, 'badge-check': BadgeCheck, 'bar-chart-3': ChartColumn, 'calendar-x': CalendarX,
  coffee: Coffee, 'door-closed': DoorClosed, droplet: Droplet, ear: Ear, flame: Flame, gift: Gift,
  'glass-water': GlassWater, 'heart-handshake': HeartHandshake, layers: Layers, 'layout-grid': LayoutGrid,
  'list-ordered': ListOrdered, megaphone: Megaphone, 'message-circle-question': MessageCircleQuestion,
  package: Package, receipt: Receipt, scale: Scale, 'search-x': SearchX, 'shield-check': ShieldCheck,
  'shopping-basket': ShoppingBasket, 'shopping-cart': ShoppingCart, soup: Soup, store: Store, timer: Timer,
  'trending-up': TrendingUp, 'triangle-alert': TriangleAlert, users: Users, wallet: Wallet, zap: Zap,
}

export const iconFor = (name: string): LucideIcon => ICONS[name] ?? Package

export const GROUP_META: Record<ScenarioGroup, { icon: LucideIcon; tone: string; persona: string }> = {
  customer: { icon: UserRound, tone: 'red', persona: 'Khách hàng' },
  store_manager: { icon: Store, tone: 'dark', persona: 'Cửa hàng trưởng' },
  store_staff: { icon: Boxes, tone: 'blue', persona: 'Nhân viên cửa hàng' },
  promotion: { icon: Tag, tone: 'amber', persona: 'Khách hàng' },
  full_sale: { icon: ShoppingCart, tone: 'green', persona: 'Khách hàng' },
}

/** Renders a content-named icon (e.g. quiz visuals) without creating components during render. */
export function NamedIcon({ name, size, strokeWidth }: { name: string; size?: number; strokeWidth?: number }) {
  return createElement(iconFor(name), { size, strokeWidth })
}
