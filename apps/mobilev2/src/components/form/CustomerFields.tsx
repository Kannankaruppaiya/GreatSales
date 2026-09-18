/**
 * The customer form, shared by 05M (Add Customer) and 04B (the create-customer
 * branch inside New Sales Lead).
 *
 * Shared rather than written twice because they are the same record: a field
 * that appears in one and not the other produces customers whose completeness
 * depends on which screen made them.
 *
 * Only fields `CustomerRow` actually carries are offered. There is no
 * free-text "notes" here for that reason — the row has nowhere to put one.
 */
import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { MapPin, Phone, User } from "lucide-react-native";
import type {
  CustomerCategoryValue,
  ContactRow,
  PaymentTermsValue,
} from "@greatsales/shared";

import { Input } from "../ui/Input";
import { Text } from "../ui/Text";
import { color, space } from "@/design/tokens";
import { CUSTOMER_CATEGORY_LABELS, PAYMENT_TERMS_LABELS } from "@/lib/labels";

import { OptionSheet } from "./OptionSheet";
import { PickerField } from "./PickerField";

export interface CustomerDraft {
  name: string;
  area: string;
  industryName: string;
  category: CustomerCategoryValue | null;
  paymentTerms: PaymentTermsValue | null;
  contactName: string;
  contactDesignation: string;
  contactPhone: string;
  contactEmail: string;
}

export const EMPTY_CUSTOMER_DRAFT: CustomerDraft = {
  name: "",
  area: "",
  industryName: "",
  category: null,
  paymentTerms: null,
  contactName: "",
  contactDesignation: "",
  contactPhone: "",
  contactEmail: "",
};

/** A draft is saveable once it has the one field the record cannot exist without. */
export function isCustomerDraftReady(draft: CustomerDraft): boolean {
  return draft.name.trim().length > 1;
}

/**
 * The draft as `createCustomer` wants it. The contact becomes the primary
 * contact when a name was given; a phone number with no name attached is not
 * a contact and is dropped rather than saved as an unnamed one.
 */
export function customerDraftToInput(draft: CustomerDraft) {
  const contacts: ContactRow[] = draft.contactName.trim()
    ? [
        {
          id: "contact-new",
          name: draft.contactName.trim(),
          designation: draft.contactDesignation.trim() || null,
          phone: draft.contactPhone.trim() || null,
          whatsapp: null,
          sameAsMobile: false,
          email: draft.contactEmail.trim() || null,
          isPrimary: true,
        },
      ]
    : [];

  return {
    name: draft.name.trim(),
    area: draft.area.trim() || null,
    industryName: draft.industryName.trim() || null,
    category: draft.category,
    paymentTerms: draft.paymentTerms,
    contacts,
  };
}

export interface CustomerFieldsProps {
  value: CustomerDraft;
  onChange: (next: CustomerDraft) => void;
}

export function CustomerFields({ value, onChange }: CustomerFieldsProps) {
  const [sheet, setSheet] = useState<"category" | "terms" | null>(null);
  const set = <K extends keyof CustomerDraft>(key: K, next: CustomerDraft[K]) =>
    onChange({ ...value, [key]: next });

  return (
    <View style={styles.root}>
      <Text variant="section">Business</Text>

      <Input
        label="Customer name"
        value={value.name}
        onChangeText={(t) => set("name", t)}
        placeholder="Registered or trading name"
        autoCapitalize="words"
      />
      <Input
        label="Industry"
        value={value.industryName}
        onChangeText={(t) => set("industryName", t)}
        placeholder="What they make or do"
        hint="Optional"
      />
      <Input
        label="Area"
        value={value.area}
        onChangeText={(t) => set("area", t)}
        placeholder="Industrial area or locality"
        icon={<MapPin size={16} color={color.muted} strokeWidth={2} />}
        hint="Optional"
      />
      <PickerField
        label="Category"
        value={value.category ? CUSTOMER_CATEGORY_LABELS[value.category] : null}
        placeholder="Not categorised"
        onPress={() => setSheet("category")}
        hint="Optional"
      />
      <PickerField
        label="Payment terms"
        value={
          value.paymentTerms ? PAYMENT_TERMS_LABELS[value.paymentTerms] : null
        }
        placeholder="Not set"
        onPress={() => setSheet("terms")}
        hint="Optional"
      />

      <Text variant="section" style={styles.heading}>
        Primary contact
      </Text>

      <Input
        label="Name"
        value={value.contactName}
        onChangeText={(t) => set("contactName", t)}
        placeholder="Who you deal with"
        autoCapitalize="words"
        icon={<User size={16} color={color.muted} strokeWidth={2} />}
      />
      <Input
        label="Designation"
        value={value.contactDesignation}
        onChangeText={(t) => set("contactDesignation", t)}
        placeholder="Plant head, purchase manager"
        hint="Optional"
      />
      <Input
        label="Phone"
        value={value.contactPhone}
        onChangeText={(t) => set("contactPhone", t)}
        placeholder="Mobile number"
        keyboardType="phone-pad"
        icon={<Phone size={16} color={color.muted} strokeWidth={2} />}
      />
      <Input
        label="Email"
        value={value.contactEmail}
        onChangeText={(t) => set("contactEmail", t)}
        placeholder="name@company.com"
        keyboardType="email-address"
        autoCapitalize="none"
        hint="Optional"
      />

      <OptionSheet
        visible={sheet === "category"}
        onClose={() => setSheet(null)}
        title="Category"
        options={(
          Object.keys(CUSTOMER_CATEGORY_LABELS) as CustomerCategoryValue[]
        ).map((v) => ({ value: v, label: CUSTOMER_CATEGORY_LABELS[v] }))}
        value={value.category}
        onChange={(next) => set("category", next)}
        clearLabel="Not categorised"
        onClear={() => set("category", null)}
      />
      <OptionSheet
        visible={sheet === "terms"}
        onClose={() => setSheet(null)}
        title="Payment terms"
        options={(Object.keys(PAYMENT_TERMS_LABELS) as PaymentTermsValue[]).map(
          (v) => ({
            value: v,
            label: PAYMENT_TERMS_LABELS[v],
          }),
        )}
        value={value.paymentTerms}
        onChange={(next) => set("paymentTerms", next)}
        clearLabel="Not set"
        onClear={() => set("paymentTerms", null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.lg },
  heading: { marginTop: space.md },
});
