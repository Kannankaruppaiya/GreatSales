import { describe, it, expect, vi } from 'vitest';
import board from '../../design/icon-library.json';

/**
 * The icon map against the board it came from.
 *
 * Board "07 — Icon Library" names 83 icons; src/design-system/icons.tsx maps
 * each of those names to a component. Two things can quietly break that and
 * neither shows up in a typecheck of a screen: a name dropped from the map,
 * and a Lucide upgrade renaming an export. `funnel` is already an instance of
 * the second - lucide-react-native 0.475 still calls it Filter - so this is
 * not hypothetical.
 *
 * lucide-react-native is mocked because importing it pulls in react-native,
 * which vite cannot parse. That means this checks the NAMES, not that each
 * component renders; a missing export would fail the app's own build.
 */
vi.mock('lucide-react-native', () => {
  // A plain object, not a catch-all Proxy: vitest probes the module namespace
  // during ESM interop and a Proxy that answers every `get` hangs the run.
  const stub = () => null;
  return {
    Activity: stub,
    AlarmClock: stub,
    ArrowDownRight: stub,
    ArrowLeft: stub,
    ArrowRight: stub,
    ArrowUpRight: stub,
    Banknote: stub,
    Bell: stub,
    Briefcase: stub,
    Building2: stub,
    Calendar: stub,
    CalendarCheck: stub,
    ChartColumn: stub,
    ChartPie: stub,
    Check: stub,
    ChevronDown: stub,
    ChevronLeft: stub,
    ChevronRight: stub,
    ChevronUp: stub,
    ChevronsUpDown: stub,
    CircleAlert: stub,
    CircleCheckBig: stub,
    CircleHelp: stub,
    CirclePlus: stub,
    CircleX: stub,
    ClipboardList: stub,
    Clock: stub,
    CreditCard: stub,
    Ellipsis: stub,
    EllipsisVertical: stub,
    ExternalLink: stub,
    Eye: stub,
    EyeOff: stub,
    FileText: stub,
    Filter: stub,
    Flag: stub,
    Flame: stub,
    History: stub,
    House: stub,
    IndianRupee: stub,
    Info: stub,
    Layers: stub,
    LayoutGrid: stub,
    List: stub,
    Lock: stub,
    LogOut: stub,
    Mail: stub,
    Map: stub,
    MapPin: stub,
    Menu: stub,
    MessageSquare: stub,
    Minus: stub,
    Navigation: stub,
    Package: stub,
    Percent: stub,
    Phone: stub,
    Plus: stub,
    Receipt: stub,
    RefreshCw: stub,
    Route: stub,
    Save: stub,
    ScanLine: stub,
    Search: stub,
    Send: stub,
    Settings: stub,
    ShieldCheck: stub,
    ShoppingCart: stub,
    SlidersHorizontal: stub,
    SquarePen: stub,
    Star: stub,
    Tag: stub,
    Target: stub,
    Trash2: stub,
    TrendingDown: stub,
    TrendingUp: stub,
    TriangleAlert: stub,
    Trophy: stub,
    Truck: stub,
    User: stub,
    UserPlus: stub,
    Users: stub,
    Wallet: stub,
    X: stub,
  };
});

const { ICONS, ICON_NAMES } = await import('../../src/design-system/icons');

describe('icon library', () => {
  it('maps every icon the design board defines', () => {
    const missing = board.names.filter((n) => !(n in ICONS));
    expect(missing, 'icons in the design with no entry in the map').toEqual([]);
  });

  it('defines nothing the design board does not', () => {
    const extra = ICON_NAMES.filter((n) => !board.names.includes(n));
    // An icon nobody specified is one somebody picked mid-screen, which is how
    // a set of 83 becomes a set of 140 that no longer reads as one family.
    expect(extra, 'icons in the map with no entry in the design').toEqual([]);
  });

  it('covers the board exactly', () => {
    expect(ICON_NAMES).toHaveLength(board.names.length);
    expect(board.names).toHaveLength(83);
  });
});
