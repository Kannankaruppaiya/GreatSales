/**
 * 03E.4 — Activity Details.
 *
 * From the Penpot board of the same name: the activity's own heading and time,
 * its description, who performed it, and what it is related to.
 *
 * Two blocks on the board are not here, because nothing produces them:
 *
 * - **From → To stages.** A stage change is stored as one summary line, not as
 *   a pair of stages. Rendering a "From" by guessing the previous stage from
 *   the timeline would be a reconstruction presented as a record.
 * - **Additional Notes.** There is one text field on an activity; showing it
 *   twice under two headings does not make it two fields.
 *
 * The performer's job title is likewise absent from the row, so only the name
 * is shown rather than a title invented to fill the line.
 */
import React from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronRight } from "lucide-react-native";

import {
  AppBar,
  Avatar,
  Card,
  EmptyState,
  Panel,
  Screen,
  SkeletonList,
  Text,
} from "@/components/ui";
import { useData } from "@/data/provider";
import { color, radius, space } from "@/design/tokens";
import { longDate, timeOfDay } from "@/lib/format";
import { ACTIVITY_ICONS, activityGroup } from "@/lib/activity";
import { useAsync } from "@/lib/useAsync";

export default function ActivityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const source = useData();

  const state = useAsync(async () => {
    const activity = id ? await source.getActivity(id) : null;
    if (!activity) return { activity: null, lead: null, customer: null };
    const [lead, customer] = await Promise.all([
      activity.leadId ? source.getLead(activity.leadId) : null,
      source.getCustomer(activity.customerId),
    ]);
    return { activity, lead, customer };
  }, [source, id]);

  const activity = state.data?.activity ?? null;
  const lead = state.data?.lead ?? null;
  const customer = state.data?.customer ?? null;
  const Icon = activity ? ACTIVITY_ICONS[activityGroup(activity.kind)] : null;

  return (
    <Screen tabBarSpacing bleed>
      <AppBar title="Activity Details" />

      <View style={styles.body}>
        {state.loading ? (
          <SkeletonList rows={3} />
        ) : !activity ? (
          <EmptyState
            title="Activity not found"
            body="It may have been removed since this screen was opened."
            actionLabel="Go back"
            onAction={() => router.back()}
          />
        ) : (
          <>
            <Card style={styles.head}>
              <View style={styles.headRow}>
                {Icon ? (
                  <View style={styles.plate}>
                    <Icon size={20} color={color.primaryDark} strokeWidth={2} />
                  </View>
                ) : null}
                <View style={styles.headText}>
                  <Text variant="section" numberOfLines={2}>
                    {activity.kind}
                  </Text>
                  <Text variant="caption" tone="muted">
                    {longDate(activity.at)}, {timeOfDay(activity.at)}
                  </Text>
                </View>
              </View>
            </Card>

            <Section title="Description">
              <Panel>
                <Text variant="body">{activity.summary}</Text>
              </Panel>
            </Section>

            <Section title="Performed By">
              <Card style={styles.person}>
                <View style={styles.personRow}>
                  <Avatar name={activity.actorName} size={44} />
                  <Text
                    variant="cardTitle"
                    numberOfLines={1}
                    style={styles.personName}
                  >
                    {activity.actorName}
                  </Text>
                </View>
              </Card>
            </Section>

            {lead || customer ? (
              <Section title="Related To">
                <Card
                  onPress={
                    lead
                      ? () => router.push(`/lead/${lead.id}`)
                      : customer
                        ? () => router.push(`/customer/${customer.id}`)
                        : undefined
                  }
                  accessibilityLabel={
                    lead
                      ? `Opportunity, ${lead.customerName}`
                      : `Customer, ${customer?.name}`
                  }
                  style={styles.related}
                >
                  <View style={styles.relatedRow}>
                    <View style={styles.relatedText}>
                      <Text variant="cardTitle" numberOfLines={1}>
                        {lead?.products[0]?.productName ??
                          customer?.name ??
                          lead?.customerName ??
                          "Related record"}
                      </Text>
                      <Text variant="caption" tone="muted" numberOfLines={1}>
                        {lead?.customerName ?? customer?.area ?? ""}
                      </Text>
                    </View>
                    <ChevronRight
                      size={15}
                      color={color.muted2}
                      strokeWidth={2}
                    />
                  </View>
                </Card>
              </Section>
            ) : null}
          </>
        )}
      </View>
    </Screen>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text variant="section">{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.gutter, gap: space.xl },
  head: { paddingVertical: space.lg },
  headRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  plate: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: color.mintTint,
    alignItems: "center",
    justifyContent: "center",
  },
  headText: { flex: 1, gap: 2 },
  section: { gap: space.md },
  person: { paddingVertical: space.md },
  personRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  personName: { flex: 1 },
  related: { paddingVertical: space.md },
  relatedRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  relatedText: { flex: 1, gap: 2 },
});
