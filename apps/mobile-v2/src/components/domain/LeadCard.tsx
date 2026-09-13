import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Calendar, Clock, ChevronRight } from 'lucide-react-native';
import { useTheme } from '../../design-system/theme';
import { spacing, radius, typography } from '../../design-system/tokens';
import { Phone, MessageSquare, ArrowRightLeft, CalendarPlus } from 'lucide-react-native';
import { GSCard, GSAmountDisplay, GSBadge, GSButton, GSIconButton, GSAvatar } from '../ui';
import type { Lead } from '../../domain/types';
import { formatShortDate, formatPercentage } from '../../domain/formatters';

export interface LeadCardProps {
  lead: Lead;
  onPress?: () => void;
  onCall?: () => void;
  onWhatsApp?: () => void;
  onChangeStage?: () => void;
  onFollowUp?: () => void;
  showActions?: boolean;
}

export function LeadCard({
  lead,
  onPress,
  onCall,
  onWhatsApp,
  onChangeStage,
  onFollowUp,
  showActions = false,
}: LeadCardProps) {
  const { colors } = useTheme();

  const isOralConfirmation =
    lead.stage === 'NegotiationOralConfirmation' ||
    (lead.probability !== undefined && lead.probability >= 90);

  const hasActions = showActions && (onCall || onWhatsApp || onChangeStage || onFollowUp);

  const stageVariant =
    lead.stage === 'ClosedWon' || lead.stage === 'OrderClosedWon' || isOralConfirmation
      ? 'success'
      : lead.stage === 'ProposalsAndPriceQuote'
      ? 'info'
      : lead.stage === 'NegotiationOralConfirmation'
      ? 'brand'
      : lead.stage === 'ClosedLost' || lead.stage === 'NoRequirementOrCold' || lead.stage === 'TrialProblem'
      ? 'danger'
      : 'neutral';

  const stageLabel =
    lead.stage === 'NegotiationOralConfirmation'
      ? 'Oral Confirmation'
      : lead.stage || 'Lead';

  return (
    <GSCard
      onPress={onPress}
      variant="bordered"
      padding="sm"
      style={[
        styles.card,
        {
          backgroundColor: colors.surfaceElevated,
          borderColor: isOralConfirmation ? colors.brandBorder : colors.border,
        },
        isOralConfirmation && { borderLeftWidth: 3, borderLeftColor: colors.brand },
      ]}
      accessibilityLabel={`Lead for ${lead.customerName}, Value: ${lead.value}, Stage: ${lead.stage}`}
    >
      <View style={styles.cardContent}>
        {/* Left: Avatar with initials */}
        <GSAvatar name={lead.customerName} size="md" style={styles.avatar} />

        {/* Center: Details */}
        <View style={styles.infoCol}>
          {/* Top row: Customer Name & Chevron */}
          <View style={styles.nameRow}>
            <Text numberOfLines={1} style={[styles.customerName, { color: colors.textPrimary }]}>
              {lead.customerName}
            </Text>
            <ChevronRight size={16} color={colors.textTertiary} />
          </View>

          {/* Amount + Probability */}
          <View style={styles.amountProbRow}>
            <GSAmountDisplay
              amount={lead.value ?? lead.totalValue ?? 0}
              size="md"
              variant="default"
              showLakhs
            />
            <Text style={[styles.dotSeparator, { color: colors.textTertiary }]}>•</Text>
            <Text
              style={[
                styles.probText,
                { color: lead.probability >= 80 ? colors.brand : colors.textSecondary },
              ]}
            >
              {formatPercentage(lead.probability)}
            </Text>
          </View>

          {/* Stage badge pill */}
          <View style={styles.stageWrap}>
            <GSBadge
              label={stageLabel}
              variant={stageVariant}
              size="sm"
              showDot
            />
          </View>

          {/* Expected close date */}
          <View style={styles.metaRow}>
            <Text style={[styles.closeText, { color: colors.textTertiary }]}>
              Expected close: {formatShortDate(lead.expectedClose)}
            </Text>
          </View>
        </View>
      </View>

      {/* Contextual Actions if enabled */}
      {hasActions && (
        <View style={[styles.actionRow, { borderTopColor: colors.borderSubtle }]}>
          {onChangeStage && (
            <GSButton
              title="Stage"
              variant="outline"
              size="sm"
              leftIcon={<ArrowRightLeft size={12} color={colors.textPrimary} />}
              onPress={onChangeStage}
              style={{ flex: 1, marginRight: spacing[1] }}
            />
          )}
          {onFollowUp && (
            <GSButton
              title="Follow Up"
              variant="outline"
              size="sm"
              leftIcon={<CalendarPlus size={12} color={colors.textPrimary} />}
              onPress={onFollowUp}
              style={{ flex: 1, marginRight: spacing[1] }}
            />
          )}
          {onWhatsApp && (
            <GSIconButton
              icon={<MessageSquare size={13} color={colors.brand} />}
              variant="subtle"
              size="sm"
              accessibilityLabel="WhatsApp"
              onPress={onWhatsApp}
              style={styles.actionIconBtn}
            />
          )}
          {onCall && (
            <GSIconButton
              icon={<Phone size={13} color={colors.white} />}
              variant="brand"
              size="sm"
              accessibilityLabel="Call"
              onPress={onCall}
              style={styles.actionIconBtn}
            />
          )}
        </View>
      )}
    </GSCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing[2] + 2,
    borderWidth: 1,
    borderRadius: radius.lg,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing[1],
  },
  avatar: {
    marginRight: spacing[3],
    marginTop: 2,
  },
  infoCol: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  customerName: {
    fontSize: 15,
    fontFamily: typography.cardTitle.fontFamily,
    fontWeight: '700',
    lineHeight: 20,
    letterSpacing: -0.2,
    flex: 1,
    marginRight: spacing[1],
  },
  amountProbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  dotSeparator: {
    marginHorizontal: spacing[1] + 2,
    fontSize: 12,
  },
  probText: {
    fontSize: 14,
    fontFamily: typography.cardTitle.fontFamily,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  stageWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  closeText: {
    fontSize: 12,
    fontFamily: typography.caption.fontFamily,
    fontWeight: '400',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing[2],
    paddingTop: spacing[2],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionIconBtn: {
    width: 28,
    height: 28,
    marginLeft: spacing[1],
  },
});
