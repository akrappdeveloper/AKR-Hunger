import type { Metadata } from 'next';
import AIControlPanelClient from './AIControlPanelClient';

export const metadata: Metadata = {
  title: 'AI Control Panel — Hunger Admin',
  description: 'Configure local AI models, feature toggles, and observability settings.',
};

export default function AIConfigPage() {
  return <AIControlPanelClient />;
}
