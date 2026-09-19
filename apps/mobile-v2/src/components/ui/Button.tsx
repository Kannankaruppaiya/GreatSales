import { Pressable, Text, View, ActivityIndicator } from 'react-native';
import type { PressableProps } from 'react-native';
import { ICONS, type IconName } from '../../design-system/icons';

/**
 * Buttons, from board "08 — Buttons".
 *
 * The board's own rule, verbatim: "One primary action per screen · 44px
 * minimum touch target · label 13/700, never sentence case." The first part is
 * a screen's job; the second and third are this component's, and they are why
 * `size` and `label` are not free-form.
 *
 * Every number below is measured off the board rather than chosen.
 */

type Variant = 'primary' | 'secondary' | 'tertiary' | 'destructive';

/**
 * The default is 46/12, because that is what the SCREENS use.
 *
 * Board 08 demonstrates its variants at 44 and lists "Large · 46",
 * "Medium · 40", "Small · 32". Counting the brand-filled button rectangles
 * across all 56 screens instead: every real primary action - "Update Stage",
 * "Apply Filters", "Change Stage", "Add Follow-up" - is 46 high at radius 12
 * with a 13/700 label. The board's default 44 appears on no screen at all, and
 * neither 40/11 nor 32/9 appears anywhere.
 *
 * So the board is right about the RULES (44px minimum target, label 13/700 -
 * 46 clears the first and matches the second) and wrong about which of its
 * sizes anyone reached for. Where the two disagree the screens win: they are
 * the product, the board is a description of it.
 *
 * md and sm are kept because the board defines them and a dense row may yet
 * want one, but they sit below the 44px minimum and are not for a screen's
 * primary action.
 */
const SIZES = {
  default: { height: 46, radius: 12, text: 'text-13', icon: 20 },
  md: { height: 40, radius: 11, text: 'text-13', icon: 18 },
  sm: { height: 32, radius: 9, text: 'text-11', icon: 16 },
} as const;

/**
 * Pressed is a real fill in the design, not an opacity: primary goes from
 * #17a45e to #0e7a4a. Fading a button to 70% would have shown the canvas
 * through it and read as disabled instead.
 */
const VARIANTS = {
  primary: {
    base: 'bg-brand-light',
    pressed: 'bg-brand',
    border: '',
    label: 'text-white',
  },
  secondary: {
    base: 'bg-surface',
    pressed: 'bg-brand-soft',
    border: 'border-[1.5px] border-brand-light',
    label: 'text-brand',
  },
  tertiary: {
    base: 'bg-surface',
    pressed: 'bg-brand-soft',
    border: '',
    label: 'text-brand',
  },
  destructive: {
    base: 'bg-danger-soft',
    pressed: 'bg-danger-border',
    border: 'border-[1.5px] border-danger-line',
    label: 'text-danger-strong',
  },
} as const;

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  variant?: Variant;
  size?: keyof typeof SIZES;
  /** Sits before the label, at the size's icon size. */
  icon?: IconName;
  loading?: boolean;
  /** Fills its container's width; otherwise the button hugs its label. */
  block?: boolean;
}

export function Button({
  label,
  variant = 'primary',
  size = 'default',
  icon,
  loading = false,
  block = false,
  disabled,
  ...rest
}: ButtonProps) {
  const s = SIZES[size];
  const v = VARIANTS[variant];
  // A button that is working is not pressable, and says so the same way a
  // disabled one does rather than staying bright and ignoring taps.
  const inert = disabled || loading;
  const Icon = icon ? ICONS[icon] : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inert, busy: loading }}
      disabled={inert}
      style={{ height: s.height, borderRadius: s.radius }}
      className={[
        'flex-row items-center justify-center px-4',
        block ? 'w-full' : 'self-start',
        inert ? 'bg-disabled' : v.base,
        inert ? '' : v.border,
      ].join(' ')}
      {...rest}
    >
      {({ pressed }) => (
        <View className="flex-row items-center justify-center gap-1.5">
          {loading ? (
            <ActivityIndicator size="small" />
          ) : Icon ? (
            <Icon
              size={s.icon}
              // The icon takes the label's colour; the design never pairs a
              // white label with a coloured glyph or the reverse.
              color={LABEL_COLOURS[inert ? 'disabled' : variant]}
            />
          ) : null}
          <Text
            className={[
              s.text,
              'font-bold',
              inert ? 'text-disabled-ink' : v.label,
              // Pressed only repaints the surface; the label does not move.
              pressed && !inert ? 'opacity-95' : '',
            ].join(' ')}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

/**
 * Icon colours have to be literal because react-native-svg takes a colour
 * prop, not a class. They mirror VARIANTS[*].label exactly - if one changes,
 * both do.
 */
const LABEL_COLOURS: Record<Variant | 'disabled', string> = {
  primary: '#ffffff',
  secondary: '#0e7a4a',
  tertiary: '#0e7a4a',
  destructive: '#c22b30',
  disabled: '#9db0bb',
};

/**
 * The square icon buttons and the FAB, which the board draws separately from
 * the labelled variants because they have their own sizes and fills.
 *
 * mint  44x44 r10 on #e8f6ee with a 1px #d6ede0 border, glyph 20
 * ghost 44x44 r10 on #ffffff with a 1px #e6eff3 border, glyph 20
 * fab   56 round on #17a45e, glyph 24
 */
export function IconButton({
  icon,
  tone = 'ghost',
  ...rest
}: { icon: IconName; tone?: 'mint' | 'ghost' } & Omit<PressableProps, 'children' | 'style'>) {
  const Icon = ICONS[icon];
  return (
    <Pressable
      accessibilityRole="button"
      style={{ width: 44, height: 44, borderRadius: 10 }}
      className={[
        'items-center justify-center border',
        tone === 'mint' ? 'bg-brand-soft border-mintLine' : 'bg-surface border-line',
      ].join(' ')}
      {...rest}
    >
      <Icon size={20} color="#0f3244" />
    </Pressable>
  );
}

export function Fab({
  icon = 'plus',
  ...rest
}: { icon?: IconName } & Omit<PressableProps, 'children' | 'style'>) {
  const Icon = ICONS[icon];
  return (
    <Pressable
      accessibilityRole="button"
      style={{ width: 56, height: 56, borderRadius: 28 }}
      className="items-center justify-center bg-brand-light"
      {...rest}
    >
      <Icon size={24} color="#ffffff" />
    </Pressable>
  );
}
