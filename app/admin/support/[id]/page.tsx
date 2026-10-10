'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function AdminTicketRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const ticketId = params.id as string;

  useEffect(() => {
    if (ticketId) {
      router.replace(`/admin/support?id=${ticketId}`);
    } else {
      router.replace('/admin/support');
    }
  }, [ticketId, router]);

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="text-muted-foreground text-sm">Opening ticket workspace...</div>
    </div>
  );
}
