import type { Metadata } from 'next';
import StudentModeClient from './StudentModeClient';

export const metadata: Metadata = {
  title: '🎓 Student Mode — Hunger',
  description: 'Budget meals, student-only deals, hostel delivery, and meal subscriptions starting from ₹99. Hunger Student Mode.',
};

export default function StudentPage() {
  return <StudentModeClient />;
}
