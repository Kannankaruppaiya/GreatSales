/**
 * The app's icons.
 *
 * These used to be drawn by hand: a `House` was the text character `⌂`, a
 * building was the emoji `🏢`, and a bar chart was three `View`s of different
 * heights. That is what made the interface read as unfinished — glyphs sit on a
 * text baseline rather than an icon grid, they change shape between Android and
 * iOS, and an emoji ignores the colour you pass it entirely.
 *
 * Every icon here is now a real SVG from Phosphor, drawn on one 256px grid.
 * Phosphor was picked over Lucide for one reason that matters to this app: it
 * ships six weights of the same icon, so a tab can render `regular` when
 * inactive and `fill` when active without needing a second icon set or a dot
 * underneath it. `duotone` is there for the rare hero moment.
 *
 * The export names are unchanged from the hand-drawn set, so call sites did not
 * have to move.
 */
import {
  ArrowRight,
  Buildings,
  CalendarBlank,
  CaretRight,
  ChartBar,
  Check,
  CheckCircle,
  Clock,
  House,
  MagnifyingGlass,
  MapPin,
  PaperPlaneTilt,
  Phone,
  Plus,
  Receipt,
  Sparkle,
  SquaresFour,
  Target,
  TrendUp,
  Wallet,
  WarningCircle,
  WhatsappLogo,
  X,
  type IconWeight,
} from 'phosphor-react-native';

export type { IconWeight };

interface IconProps {
  size?: number;
  color?: string;
  /**
   * `regular` for rest, `fill` for the selected state, `duotone` when an icon is
   * carrying a screen rather than labelling a row.
   */
  weight?: IconWeight;
}

export function HomeIcon({ size = 20, color = '#0f172a', weight = 'regular' }: IconProps) {
  return <House size={size} color={color} weight={weight} />;
}

export function ChartIcon({ size = 20, color = '#0f172a', weight = 'regular' }: IconProps) {
  return <ChartBar size={size} color={color} weight={weight} />;
}

export function TargetIcon({ size = 20, color = '#0f172a', weight = 'regular' }: IconProps) {
  return <Target size={size} color={color} weight={weight} />;
}

export function CheckCircleIcon({ size = 20, color = '#0f172a', weight = 'regular' }: IconProps) {
  return <CheckCircle size={size} color={color} weight={weight} />;
}

export function GridIcon({ size = 20, color = '#0f172a', weight = 'regular' }: IconProps) {
  return <SquaresFour size={size} color={color} weight={weight} />;
}

export function WalletIcon({ size = 20, color = '#0f172a', weight = 'regular' }: IconProps) {
  return <Wallet size={size} color={color} weight={weight} />;
}

export function PhoneIcon({ size = 16, color = '#0f172a', weight = 'fill' }: IconProps) {
  return <Phone size={size} color={color} weight={weight} />;
}

/** Keeps WhatsApp's own green by default — it is a brand mark, not a UI icon. */
export function WhatsAppIcon({ size = 16, color = '#25D366', weight = 'fill' }: IconProps) {
  return <WhatsappLogo size={size} color={color} weight={weight} />;
}

export function SearchIcon({ size = 16, color = '#64748b', weight = 'bold' }: IconProps) {
  return <MagnifyingGlass size={size} color={color} weight={weight} />;
}

export function PlusIcon({ size = 16, color = '#ffffff', weight = 'bold' }: IconProps) {
  return <Plus size={size} color={color} weight={weight} />;
}

export function CalendarIcon({ size = 14, color = '#64748b', weight = 'regular' }: IconProps) {
  return <CalendarBlank size={size} color={color} weight={weight} />;
}

export function TrendUpIcon({ size = 16, color = '#059669', weight = 'bold' }: IconProps) {
  return <TrendUp size={size} color={color} weight={weight} />;
}

export function BuildingIcon({ size = 16, color = '#64748b', weight = 'regular' }: IconProps) {
  return <Buildings size={size} color={color} weight={weight} />;
}

export function SparklesIcon({ size = 16, color = '#d97706', weight = 'fill' }: IconProps) {
  return <Sparkle size={size} color={color} weight={weight} />;
}

/** Row affordance. `bold` so it still reads at 16px against a muted colour. */
export function ChevronRightIcon({ size = 16, color = '#94a3b8', weight = 'bold' }: IconProps) {
  return <CaretRight size={size} color={color} weight={weight} />;
}

/** Clears a search field. Replaces the `✕` character the screens used to print. */
export function CloseIcon({ size = 14, color = '#64748b', weight = 'bold' }: IconProps) {
  return <X size={size} color={color} weight={weight} />;
}

/** Replaces the `✓` character. */
export function CheckIcon({ size = 14, color = '#059669', weight = 'bold' }: IconProps) {
  return <Check size={size} color={color} weight={weight} />;
}

export function MapPinIcon({ size = 16, color = '#64748b', weight = 'fill' }: IconProps) {
  return <MapPin size={size} color={color} weight={weight} />;
}

export function ClockIcon({ size = 14, color = '#64748b', weight = 'regular' }: IconProps) {
  return <Clock size={size} color={color} weight={weight} />;
}

export function WarningIcon({ size = 16, color = '#dc2626', weight = 'fill' }: IconProps) {
  return <WarningCircle size={size} color={color} weight={weight} />;
}

export function ReceiptIcon({ size = 16, color = '#64748b', weight = 'regular' }: IconProps) {
  return <Receipt size={size} color={color} weight={weight} />;
}

export function PaperPlaneIcon({ size = 16, color = '#ffffff', weight = 'fill' }: IconProps) {
  return <PaperPlaneTilt size={size} color={color} weight={weight} />;
}

export function ArrowRightIcon({ size = 16, color = '#ffffff', weight = 'bold' }: IconProps) {
  return <ArrowRight size={size} color={color} weight={weight} />;
}
