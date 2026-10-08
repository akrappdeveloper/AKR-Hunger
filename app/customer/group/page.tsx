import type { Metadata } from 'next';
import GroupOrderClient from './GroupOrderClient';

export const metadata: Metadata = {
  title: 'Group Order — Hunger',
  description: 'Order together with friends, split the bill easily. Create or join a group order on Hunger.',
};

export default function GroupOrderPage() {
  return <GroupOrderClient />;
}
