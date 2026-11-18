/**
 * Badge « E-mail à valider » d'un devis (B2, PR 5). Composant serveur, lecture seule : le lien
 * mène à l'écran des e-mails à valider ; `href` est construit par la page (préfixe d'administration).
 */

import Link from "next/link";

import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import {
  TEXTE_BADGE_ANCIEN,
  TEXTE_BADGE_A_VALIDER,
  badgeEmailDevis,
} from "@/server/qualiopi/devis/badge-email-devis";

export function BadgeEmailDevis({
  statut,
  enAttente,
  href,
}: {
  statut: string;
  enAttente: boolean;
  href: string;
}): React.ReactElement | null {
  const etat = badgeEmailDevis(statut, enAttente);
  if (etat === null) return null;
  return (
    <Link href={href} data-testid="badge-email-devis" className="no-underline">
      <AdminBadge tone="warning" dot>
        {etat === "a_valider" ? TEXTE_BADGE_A_VALIDER : TEXTE_BADGE_ANCIEN}
      </AdminBadge>
    </Link>
  );
}
