// « Société & conformité » — le dossier qu'on envoie à un donneur d'ordre.
//
//   Identité              → lecture de l'identité légale déjà en base
//   Pièces légales        → Kbis, URSSAF, fiscale, RC pro, RIB, statuts…
//   Organisme de formation → récépissé DREETS, certificat Qualiopi, RI, livret
//   Commercial            → présentation, tarifs, CGV, fiches d'offre, NDA
//   Audit & méthode       → méthodologie, questionnaire amont, modèles
//   RGPD & sécurité       → registre art. 30, DPA, note de sécurité, politique IA
//
// Le layout ne porte que le cadre : les onglets sont rendus par chaque page,
// qui sait laquelle elle est (cf. `SocieteTabs`).

import type { Metadata } from "next";

import { AdminPageShell } from "@/components/admin/ui";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function SocieteLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return <AdminPageShell width="wide">{children}</AdminPageShell>;
}
