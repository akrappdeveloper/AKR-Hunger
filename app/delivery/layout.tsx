import React from 'react';
import { DeliveryLayoutWrapper } from './DeliveryLayoutWrapper';

export const metadata = {
  verification: {
    google: "K8s0MzX1Az9Dc3Mh9SeLVJFVcqQH_LsLdlXgWLhbvHw",
  },
};

export default function DeliveryLayout({ children }: { children: React.ReactNode }) {
  return (
    <DeliveryLayoutWrapper>
      {children}
    </DeliveryLayoutWrapper>
  );
}
