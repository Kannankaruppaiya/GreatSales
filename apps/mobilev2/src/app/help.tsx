/**
 * 11D — Help & Support.
 *
 * Answers to the questions this app actually raises, and one way to reach a
 * person. The spec warned against inventing a ticket-management system when
 * the backend has none, and it has none: there is no ticket endpoint in
 * `apps/api/src`. So "Report an issue" opens an email rather than pretending
 * to file something, and there is no ticket list, status or history.
 *
 * The address is configuration (`extra.supportEmail` in app.json), not a
 * literal: a support inbox belongs to whoever operates the deployment. With
 * none configured the screen sends the person to their administrator instead
 * of to an address nobody reads.
 *
 * The answers are about how this app behaves — why payments are read-only, why
 * a closed month cannot be edited — because those are what a salesperson using
 * it will actually ask.
 */
import React, { useState } from "react";
import { Alert, Linking, Pressable, StyleSheet, View } from "react-native";
import {
  ChevronDown,
  ChevronRight,
  Mail,
  MessageSquare,
} from "lucide-react-native";

import Constants from "expo-constants";

import { AppBar, Button, Card, Panel, Screen, Text } from "@/components/ui";
import { color, space } from "@/design/tokens";
import { APP_NAME, APP_VERSION } from "@/lib/app-info";

const SUPPORT_EMAIL: string | null =
  (Constants.expoConfig?.extra as { supportEmail?: string } | undefined)
    ?.supportEmail || null;

const FAQS: { q: string; a: string }[] = [
  {
    q: "Why can't I record a payment?",
    a: "Payments are read-only for a sales role. You can see every invoice, what is pending and how overdue it is, but recording, editing or importing a payment happens in the web console, where the accounts team works.",
  },
  {
    q: "Why can't I edit last month's projection?",
    a: "Once a month is closed its projections are kept as the record of what was committed, so nothing in it can be changed or deleted. Open the current month to plan ahead.",
  },
  {
    q: "What does an unpriced mapping mean?",
    a: "It means the customer is mapped to that product but no agreed price is set, so quotes and orders fall back to the list price. Open the mapping and set the agreed price to fix it.",
  },
  {
    q: "Why is a product on my deal flagged as not mapped?",
    a: "There is no customer mapping for it, so the price on the deal is not one the customer has agreed to. Products & Assignment on the opportunity links straight to creating the mapping.",
  },
  {
    q: "Why does search feel split by module?",
    a: "Each module is searched separately, so results are ranked within a group rather than against each other. A single ranked search needs a server-side search endpoint, which does not exist yet.",
  },
  {
    q: "Why can't I sign in to the web console with this app's account?",
    a: "You can — the same email and password work at your company's GreatSales address. The mobile app is the salesperson's tool; administration and reports live on the web.",
  },
  {
    q: "Why does a follow-up have a day but no time?",
    a: "Follow-ups are planned by the day, the same as on the web console and the dashboard, so a task shows as due for the whole of its day rather than at an hour nobody else can see.",
  },
];

export default function HelpScreen() {
  const [open, setOpen] = useState<number | null>(0);

  async function mail(subject: string) {
    if (!SUPPORT_EMAIL) return;
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
    try {
      if (!(await Linking.canOpenURL(url))) throw new Error("unsupported");
      await Linking.openURL(url);
    } catch {
      Alert.alert(
        "No mail app",
        `Write to ${SUPPORT_EMAIL} from wherever you read email.`,
      );
    }
  }

  return (
    <Screen tabBarSpacing bleed>
      <AppBar title="Help & Support" />

      <View style={styles.body}>
        <Text variant="section">Common questions</Text>

        {FAQS.map((faq, index) => {
          const expanded = open === index;
          return (
            <Card key={faq.q} style={styles.faq} flush>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                accessibilityLabel={faq.q}
                onPress={() => setOpen(expanded ? null : index)}
                style={styles.faqHead}
              >
                <Text variant="cardTitle" style={styles.faqQuestion}>
                  {faq.q}
                </Text>
                {expanded ? (
                  <ChevronDown size={16} color={color.muted2} strokeWidth={2} />
                ) : (
                  <ChevronRight
                    size={16}
                    color={color.muted2}
                    strokeWidth={2}
                  />
                )}
              </Pressable>
              {expanded ? (
                <Text variant="body" tone="muted" style={styles.faqAnswer}>
                  {faq.a}
                </Text>
              ) : null}
            </Card>
          );
        })}

        <Text variant="section" style={styles.heading}>
          Still stuck
        </Text>

        {SUPPORT_EMAIL ? (
          <>
            <Button
              label="Email Support"
              block
              icon={
                <Mail size={16} color={color.surfaceWhite} strokeWidth={2} />
              }
              onPress={() => mail(`${APP_NAME} support`)}
            />
            <Button
              label="Report an Issue"
              variant="secondary"
              block
              icon={
                <MessageSquare
                  size={16}
                  color={color.primary}
                  strokeWidth={2}
                />
              }
              onPress={() => mail(`${APP_NAME} ${APP_VERSION} — issue report`)}
            />

            <Text variant="caption" tone="muted2">
              Support is by email. Include what you were doing and what you
              expected instead — it is the fastest route to a fix.
            </Text>
          </>
        ) : (
          <Panel>
            <Text variant="body" tone="muted">
              Your company's GreatSales administrator manages your account —
              passwords, access and anything that looks wrong in your data.
              Contact them directly.
            </Text>
          </Panel>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.gutter, gap: space.md },
  faq: {},
  faqHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.lg,
  },
  faqQuestion: { flex: 1 },
  faqAnswer: { paddingHorizontal: space.lg, paddingBottom: space.lg },
  heading: { marginTop: space.lg },
});
