/**
 * One opportunity in a list, per the Penpot board "03.1 Pipeline Overview"
 * (layer `opp-row`), which 02D.1 Hot Opportunities repeats.
 *
 * A 14-radius card with a hairline and a whisper of shadow: a 36 avatar, the
 * account at 13/700 with the deal value at 13/800 opposite, the first product
 * under it at 11/500, and a meta line of stage pill, probability and expected
 * close. The chevron says the row opens something.
 *
 * `probability` is optional because only the projections carry one; a row
 * without it simply leaves it out rather than showing a made-up figure.
 */
import React from "react";
import { StyleSheet, View } from "react-native";
import { CalendarDays, ChevronRight } from "lucide-react-native";

import type { Lead } from "@/data/source";
import { color, font, space } from "@/design/tokens";
import { longDate, moneyShort } from "@/lib/format";
import { DEAL_STAGE_LABELS, DEAL_STAGE_TONES } from "@/lib/labels";

import { Avatar } from "./Avatar";
import { Chip } from "./Chip";
import { PressScale } from "./PressScale";
import { Text } from "./Text";

export function DealRow({
  lead,
  probability,
  onPress,
}: {
  lead: Lead;
  probability?: number | null;
  onPress: () => void;
}) {
  return (
    <PressScale
      onPress={onPress}
      scaleTo={0.98}
      accessibilityRole="button"
      accessibilityLabel={`${lead.customerName}, ${moneyShort(lead.totalValue)}, ${DEAL_STAGE_LABELS[lead.stage]}`}
      style={styles.card}
    >
      <Avatar name={lead.customerName} size={36} />
      <View style={styles.body}>
        <View style={styles.line}>
          <Text style={styles.name} numberOfLines={1}>
            {lead.customerName}
          </Text>
          <Text style={styles.amount}>{moneyShort(lead.totalValue)}</Text>
        </View>
        <View style={styles.line}>
          <Text style={styles.deal} numberOfLines={1}>
            {lead.products[0]?.productName ?? lead.area ?? "No products yet"}
          </Text>
          <ChevronRight size={14} color={color.muted2} strokeWidth={2} />
        </View>
        <View style={styles.meta}>
          <Chip
            label={DEAL_STAGE_LABELS[lead.stage]}
            tone={DEAL_STAGE_TONES[lead.stage]}
          />
          {probability != null ? (
            <Text style={styles.pct}>{Math.round(probability)}%</Text>
          ) : null}
          {lead.expClose ? (
            <View style={styles.date}>
              <CalendarDays size={12} color={color.muted} strokeWidth={2} />
              <Text style={styles.dateText}>{longDate(lead.expClose)}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    gap: space.md,
    minHeight: 78,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.surfaceWhite,
    boxShadow: "0px 2px 8px 0px rgba(15,50,68,0.05)",
  },
  body: { flex: 1, gap: 2 },
  line: { flexDirection: "row", alignItems: "center", gap: space.sm },
  name: { flex: 1, fontFamily: font.bold, fontSize: 13, color: color.ink },
  amount: { fontFamily: font.extrabold, fontSize: 13, color: color.ink },
  deal: { flex: 1, fontFamily: font.medium, fontSize: 11, color: color.muted },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    marginTop: 4,
  },
  pct: { fontFamily: font.extrabold, fontSize: 10, color: color.ink },
  date: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: "auto",
  },
  dateText: { fontFamily: font.medium, fontSize: 10, color: color.muted },
});
