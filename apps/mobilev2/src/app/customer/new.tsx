/**
 * 05L / 05M / 05N / 05O — Add Customer.
 *
 * Entry, form, review and confirmation as three steps on one route. The form
 * itself is `CustomerFields`, shared with the create-customer branch inside
 * New Sales Lead, so a customer created either way carries the same fields.
 */
import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import {
  AppBar,
  KeyValueRow,
  Panel,
  RowDivider,
  Screen,
  Text,
} from "@/components/ui";
import {
  CustomerFields,
  EMPTY_CUSTOMER_DRAFT,
  StepFooter,
  SuccessScreen,
  WizardHeader,
  customerDraftToInput,
  isCustomerDraftReady,
  type CustomerDraft,
} from "@/components/form";
import { useData } from "@/data/provider";
import { describeError } from "@/data/http";
import { space } from "@/design/tokens";
import { CUSTOMER_CATEGORY_LABELS, PAYMENT_TERMS_LABELS } from "@/lib/labels";

const STEPS = ["Details", "Review"];

export default function NewCustomerScreen() {
  const router = useRouter();
  const source = useData();

  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<CustomerDraft>(EMPTY_CUSTOMER_DRAFT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; name: string } | null>(
    null,
  );

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const row = await source.createCustomer(customerDraftToInput(draft));
      setCreated({ id: row.id, name: row.name });
    } catch (e) {
      setError(describeError(e));
    } finally {
      setSaving(false);
    }
  }

  if (created) {
    return (
      <SuccessScreen
        title="Customer created"
        reference={created.name}
        facts={[
          {
            label: "Contact",
            value: draft.contactName.trim() || "Not added yet",
          },
          { label: "Area", value: draft.area.trim() || "Not set" },
          {
            label: "Payment terms",
            value: draft.paymentTerms
              ? PAYMENT_TERMS_LABELS[draft.paymentTerms]
              : "Not set",
          },
        ]}
        actions={[
          {
            label: "View Customer",
            onPress: () => router.replace(`/customer/${created.id}`),
          },
          {
            label: "Create Opportunity",
            onPress: () => router.replace(`/lead/new?customerId=${created.id}`),
          },
          {
            label: "Back to Customers",
            onPress: () => router.replace("/(tabs)/customers"),
            variant: "tertiary",
          },
        ]}
      />
    );
  }

  return (
    <Screen tabBarSpacing bleed>
      <AppBar title="Add Customer" />

      <View style={styles.body}>
        <WizardHeader steps={STEPS} current={step} />

        {step === 0 ? (
          <CustomerFields value={draft} onChange={setDraft} />
        ) : (
          <View style={styles.review}>
            <Panel style={styles.panel}>
              <KeyValueRow label="Name" value={draft.name.trim()} />
              <RowDivider />
              <KeyValueRow
                label="Industry"
                value={draft.industry?.name ?? null}
                emptyText="Not set"
              />
              <RowDivider />
              <KeyValueRow
                label="Area"
                value={draft.area.trim()}
                emptyText="Not set"
              />
              <RowDivider />
              <KeyValueRow
                label="Category"
                value={
                  draft.category
                    ? CUSTOMER_CATEGORY_LABELS[draft.category]
                    : null
                }
                emptyText="Not categorised"
              />
              <RowDivider />
              <KeyValueRow
                label="Payment terms"
                value={
                  draft.paymentTerms
                    ? PAYMENT_TERMS_LABELS[draft.paymentTerms]
                    : null
                }
                emptyText="Not set"
              />
            </Panel>

            <Panel style={styles.panel}>
              <KeyValueRow
                label="Contact"
                value={draft.contactName.trim()}
                emptyText="No contact added"
              />
              <RowDivider />
              <KeyValueRow
                label="Designation"
                value={draft.contactDesignation.trim()}
                emptyText="Not set"
              />
              <RowDivider />
              <KeyValueRow
                label="Phone"
                value={draft.contactPhone.trim()}
                emptyText="Not set"
              />
              <RowDivider />
              <KeyValueRow
                label="Email"
                value={draft.contactEmail.trim()}
                emptyText="Not set"
              />
            </Panel>

            {error ? (
              <Text variant="caption" tone="red">
                {error}
              </Text>
            ) : null}
          </View>
        )}

        <StepFooter
          onBack={step > 0 ? () => setStep(0) : undefined}
          onNext={step === 0 ? () => setStep(1) : submit}
          nextLabel={step === 0 ? "Review" : "Create Customer"}
          nextDisabled={!isCustomerDraftReady(draft)}
          busy={saving}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.gutter },
  review: { gap: space.lg },
  panel: { paddingVertical: space.xs },
});
