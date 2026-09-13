import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ShieldCheck } from 'lucide-react-native';
import { useTheme } from '../src/design-system/theme';
import { spacing, radius, typography } from '../src/design-system/tokens';
import { useCurrentUser } from '../src/hooks';

export default function Index() {
  const { colors } = useTheme();
  const router = useRouter();
  const { data: user, isLoading } = useCurrentUser();

  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => {
        if (user) {
          router.replace('/(app)/today');
        } else {
          router.replace('/(auth)/login');
        }
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [user, isLoading]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.centerContent}>
        {/* Brand Shield Logo */}
        <View
          style={[
            styles.logoCircle,
            {
              backgroundColor: colors.brandSoft,
              borderColor: colors.brand,
            },
          ]}
        >
          <ShieldCheck size={48} color={colors.brand} strokeWidth={2.2} />
        </View>

        <Text style={[styles.brandTitle, { color: colors.textPrimary }]}>
          GreatSales
        </Text>
        <Text style={[styles.brandSubtitle, { color: colors.textSecondary }]}>
          Field Sales Command Center
        </Text>
      </View>

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.textTertiary }]}>
          Enterprise CRM • v2.0
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[6],
    width: '100%',
    height: '100%',
  },
  centerContent: {
    alignItems: 'center',
  },
  logoCircle: {
    width: 96,
    height: 96,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[4],
  },
  brandTitle: {
    fontSize: typography.display.fontSize,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: spacing[1],
  },
  brandSubtitle: {
    fontSize: typography.body.fontSize,
    fontWeight: '500',
  },
  footer: {
    position: 'absolute',
    bottom: spacing[8],
  },
  footerText: {
    fontSize: typography.micro.fontSize,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});

