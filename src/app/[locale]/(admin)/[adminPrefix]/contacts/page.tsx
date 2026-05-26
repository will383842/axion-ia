// Contacts admin — racine, redirige vers Messages (Sprint Notif Infra 2026-05-26).

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
}

export default async function ContactsRootPage({ params }: PageProps): Promise<never> {
  const { adminPrefix } = await params;
  redirect(`/fr/${adminPrefix}/contacts/messages`);
}
