import { redirect } from 'next/navigation';

export default function StaffLoginRedirect() {
  redirect('/restaurant/staff/dashboard/login');
}
