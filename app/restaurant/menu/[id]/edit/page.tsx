'use client';

import { useParams } from 'next/navigation';
import MenuItemEditorPage from '@/components/restaurant/MenuItemEditorPage';

export default function EditMenuItemPage() {
  const params = useParams();
  const id = (params?.id as string) || '';

  return <MenuItemEditorPage itemId={id} />;
}
