// Contacts admin — sous-onglet Messages (Sprint Notif Infra 2026-05-26).
//
// Réutilise EXACTEMENT le composant SubmissionsV2 existant. Aucune duplication
// — le path a juste été déplacé. Les anciens liens `/submissions` redirigent
// 301 vers `/contacts/messages` via les page.tsx legacy.

import { SubmissionsV2 } from "../../submissions/_v2/SubmissionsV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function ContactsMessagesPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  return <SubmissionsV2 adminPrefix={adminPrefix} searchParams={sp} />;
}
