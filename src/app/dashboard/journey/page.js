'use client';

import CustomerSearch from '@/components/CustomerSearch';

export default function CustomerTimelineLookupPage() {
  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold tracking-tight">Customer Timeline</h1>
      <p className="mb-4 text-sm text-muted-foreground md:mb-6">
        Find a customer by any part of their name or mobile number, then see everything they did across
        every store — visits, products seen, carts, purchases — with date and time.
      </p>
      <CustomerSearch autoFocus className="max-w-xl" />
    </div>
  );
}
