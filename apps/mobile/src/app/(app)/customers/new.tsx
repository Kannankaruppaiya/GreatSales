/** Create customer (modal). On success, returns to the list (which reloads). */
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { CustomerForm } from '@/components/customer-form';
import { Screen } from '@/components/ui/screen';
import { ApiError } from '@/lib/api/errors';
import { createCustomer, listIndustries } from '@/lib/api/customers-api';
import type { CustomerFormValues, IndustryDto } from '@/lib/api/customer-types';

export default function NewCustomerScreen() {
  const router = useRouter();
  const [industries, setIndustries] = useState<IndustryDto[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    listIndustries()
      .then(setIndustries)
      .catch(() => setIndustries([]));
  }, []);

  async function onSubmit(values: CustomerFormValues) {
    if (submitting) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await createCustomer(values);
      router.back();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.userMessage : 'Couldn’t create the customer.');
      setSubmitting(false);
    }
  }

  return (
    <Screen scroll>
      <CustomerForm
        industries={industries}
        submitting={submitting}
        formError={formError}
        submitLabel="Create customer"
        onSubmit={onSubmit}
      />
    </Screen>
  );
}
