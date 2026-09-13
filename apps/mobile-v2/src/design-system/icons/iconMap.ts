import React from 'react';
import {
  LayoutDashboard,
  GitFork,
  Plus,
  CalendarCheck,
  MoreHorizontal,
  Search,
  Bell,
  User,
  Users,
  UserPlus,
  ShoppingBag,
  CreditCard,
  Receipt,
  Tag,
  BarChart2,
  BarChart3,
  TrendingUp,
  Target,
  Phone,
  MessageSquare,
  Mail,
  Calendar,
  CalendarPlus,
  Clock,
  MapPin,
  Building2,
  AlertTriangle,
  AlertCircle,
  Check,
  CheckCircle2,
  CheckCheck,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ArrowRight,
  ArrowUpRight,
  SlidersHorizontal,
  Filter,
  Shield,
  Settings,
  LogOut,
  X,
  type LucideIcon,
  type LucideProps,
} from 'lucide-react-native';

export const ICONS = {
  // Navigation
  today: LayoutDashboard,
  pipeline: GitFork,
  create: Plus,
  followUps: CalendarCheck,
  more: MoreHorizontal,

  // General & Utility
  search: Search,
  notifications: Bell,
  user: User,
  users: Users,
  addUser: UserPlus,
  settings: Settings,
  security: Shield,
  logout: LogOut,
  close: X,
  filter: Filter,
  sort: SlidersHorizontal,

  // Business Modules
  order: ShoppingBag,
  payment: CreditCard,
  invoice: Receipt,
  mapping: Tag,
  report: BarChart3,
  projection: TrendingUp,
  target: Target,
  analytics: BarChart2,

  // Contact & Communication
  phone: Phone,
  whatsapp: MessageSquare,
  email: Mail,
  location: MapPin,
  building: Building2,

  // Temporal & Tasks
  calendar: Calendar,
  addCalendar: CalendarPlus,
  clock: Clock,

  // Indicators & Arrows
  warning: AlertTriangle,
  alert: AlertCircle,
  check: Check,
  checkCircle: CheckCircle2,
  checkAll: CheckCheck,
  chevronRight: ChevronRight,
  chevronLeft: ChevronLeft,
  chevronDown: ChevronDown,
  arrowRight: ArrowRight,
  arrowUpRight: ArrowUpRight,
} as const;

export type IconName = keyof typeof ICONS;

export interface GSIconProps extends LucideProps {
  name: IconName;
}

export function GSIcon({ name, size = 20, color, strokeWidth = 2, ...props }: GSIconProps) {
  const IconComponent = ICONS[name] as LucideIcon;
  if (!IconComponent) return null;
  return React.createElement(IconComponent, { size, color, strokeWidth, ...props });
}
