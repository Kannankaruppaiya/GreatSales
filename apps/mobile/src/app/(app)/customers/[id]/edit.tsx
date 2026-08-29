/** Edit customer (modal). Loads the record, saves, returns to detail (reloads). */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { CustomerForm } from '@/components/customer-form';
import { Screen } from '@/components/ui/screen';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { ApiError } from '@/lib/api/errors';
import { getCustomer, listIndustries, updateCustomer } from '@/lib/api/customers-api';
import type { CustomerDetail, CustomerFormValues, IndustryDto } from '@/lib/api/customer-types';

export default function EditCustomerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [industries, setIndustries] = useState<IndustryDto[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let active = true;
    setStatus('loading');
    Promise.all([getCustomer(id), listIndustries().catch(() => [] as IndustryDto[])])
      .then(([c, inds]) => {
        if (!active) return;
        setCustomer(c);
        setIndustries(inds);
        setStatus('ready');
      })
      .catch(() => active && setStatus('error'));
    return () => {
      active = false;
    };
  }, [id]);

  async function onSubmit(values: CustomerFormValues) {
    if (!id || submitting) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await updateCustomer(id, values);
      router.back();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.userMessage : 'Couldn’t save changes.');
      setSubmitting(false);
    }
  }

  if (status === 'loading') {
    return (
      <Screen center>
        <LoadingState label="Loading…" />
      </Screen>
    );
  }
  if (status === 'error' || !customer) {
    return (
      <Screen center>
        <ErrorState title="Couldn’t load this customer" onRetry={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <CustomerForm
        industries={industries}
        submitting={submitting}
        formError={formError}
        submitLabel="Save changes"
        onSubmit={onSubmit}
        initial={{
          name: customer.name,
          category: customer.category ?? undefined,
          payZone: customer.payZone ?? undefined,
          paymentTerms: customer.paymentTerms ?? undefined,
          industryId: customer.industryId ?? undefined,
          subIndustry: customer.subIndustry ?? undefined,
          area: customer.area ?? undefined,
        }}
      />
    </Screen>
  );
}
