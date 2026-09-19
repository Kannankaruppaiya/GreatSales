import {
  Activity, AlarmClock, ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight,
  Banknote, Bell, Briefcase, Building2, Calendar, CalendarCheck, ChartColumn,
  ChartPie, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp,
  ChevronsUpDown, CircleAlert, CircleCheckBig, CircleHelp, CirclePlus, CircleX,
  ClipboardList, Clock, CreditCard, Ellipsis, EllipsisVertical, ExternalLink,
  Eye, EyeOff, FileText, Filter, Flag, Flame, History, House, IndianRupee,
  Info, Layers, LayoutGrid, List, Lock, LogOut, Mail, Map, MapPin, Menu,
  MessageSquare, Minus, Navigation, Package, Percent, Phone, Plus, Receipt,
  RefreshCw, Route, Save, ScanLine, Search, Send, Settings, ShieldCheck,
  ShoppingCart, SlidersHorizontal, SquarePen, Star, Tag, Target, Trash2,
  TrendingDown, TrendingUp, TriangleAlert, Trophy, Truck, User, UserPlus,
  Users, Wallet, X,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

/**
 * The design's icon set, by the name the design calls each one.
 *
 * Board "07 — Icon Library (Lucide 24x24)" specifies exactly this: Lucide, 83
 * icons, at 24x24 with stroke 2 and round caps and joins. Those are already
 * lucide-react-native's defaults, so nothing here overrides them.
 *
 * Nothing is EXPORTED from Penpot for these. The board draws each icon as a
 * group of vector paths, but they are Lucide's own paths and the package is
 * already a dependency - exporting 83 PNGs would ship a fixed size, a fixed
 * colour and 83 files to replace something that is one import, scales to any
 * size and takes the theme's colour. The board is the specification; the
 * package is the implementation.
 *
 * Keys are the design's kebab names so a screen can be read against the board
 * it came from without translating in your head.
 */
export const ICONS = {
  // Navigation and chrome
  'house': House,
  'layout-grid': LayoutGrid,
  'users': Users,
  'ellipsis': Ellipsis,
  'ellipsis-vertical': EllipsisVertical,
  'menu': Menu,
  'bell': Bell,
  'x': X,
  'plus': Plus,
  'minus': Minus,
  'circle-plus': CirclePlus,

  // Movement
  'arrow-left': ArrowLeft,
  'arrow-right': ArrowRight,
  'arrow-up-right': ArrowUpRight,
  'arrow-down-right': ArrowDownRight,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'chevron-up': ChevronUp,
  'chevron-down': ChevronDown,
  'chevrons-up-down': ChevronsUpDown,
  'external-link': ExternalLink,

  // Finding
  'search': Search,
  /**
   * The design names this `funnel`; lucide-react-native 0.475 still calls it
   * `Filter`. Lucide renamed the export after that release, so the design is
   * ahead of the installed package by one name, not by one icon - the glyph is
   * the same. When the dependency is upgraded this becomes `Funnel`.
   */
  'funnel': Filter,
  'sliders-horizontal': SlidersHorizontal,
  'list': List,
  'layers': Layers,

  // State and feedback
  'check': Check,
  'circle-check-big': CircleCheckBig,
  'circle-alert': CircleAlert,
  'triangle-alert': TriangleAlert,
  'circle-x': CircleX,
  'info': Info,
  'circle-help': CircleHelp,

  // Identity and access
  'eye': Eye,
  'eye-off': EyeOff,
  'lock': Lock,
  'user': User,
  'user-plus': UserPlus,
  'shield-check': ShieldCheck,
  'log-out': LogOut,
  'settings': Settings,

  // Accounts and contact
  'building-2': Building2,
  'briefcase': Briefcase,
  'phone': Phone,
  'mail': Mail,
  'message-square': MessageSquare,
  'send': Send,

  // Place
  'map-pin': MapPin,
  'map': Map,
  'navigation': Navigation,
  'route': Route,

  // Time
  'calendar': Calendar,
  'calendar-check': CalendarCheck,
  'clock': Clock,
  'alarm-clock': AlarmClock,
  'history': History,

  // Numbers
  'trending-up': TrendingUp,
  'trending-down': TrendingDown,
  'target': Target,
  'chart-column': ChartColumn,
  'chart-pie': ChartPie,
  'activity': Activity,
  'percent': Percent,

  // Money
  'indian-rupee': IndianRupee,
  'wallet': Wallet,
  'credit-card': CreditCard,
  'banknote': Banknote,
  'receipt': Receipt,

  // Records and goods
  'file-text': FileText,
  'clipboard-list': ClipboardList,
  'package': Package,
  'truck': Truck,
  'shopping-cart': ShoppingCart,
  'scan-line': ScanLine,

  // Acting on a record
  'square-pen': SquarePen,
  'trash-2': Trash2,
  'refresh-cw': RefreshCw,
  'save': Save,

  // Marks
  'star': Star,
  'tag': Tag,
  'flame': Flame,
  'flag': Flag,
  'trophy': Trophy,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

/** Every name the design's board defines, for tests and pickers. */
export const ICON_NAMES = Object.keys(ICONS) as IconName[];
