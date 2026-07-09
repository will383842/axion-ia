// Hub Contacts — refonte UX 2026-07-09.
//
// La barre d'onglets interne (Messages / Commercial / RDV Calendly) est RETIRÉE :
// ces 3 canaux sont désormais de vrais items dans la sidebar (groupe « Contacts »,
// indépendant d'« Activité quotidienne »). Le layout ne fait plus que fournir le
// shell commun (la page Calendly ne pose pas son propre AdminPageShell).

import type { Metadata } from "next";
import { AdminPageShell } from "@/components/admin/ui";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function ContactsLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return <AdminPageShell width="wide">{children}</AdminPageShell>;
}
