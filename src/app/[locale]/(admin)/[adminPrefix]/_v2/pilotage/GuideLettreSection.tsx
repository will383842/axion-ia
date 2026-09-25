// Tableau de bord de pilotage — la lettre et le guide (lot L3, 2026-09-24).
//
// Avant ce lot, l'accueil de la console n'affichait AUCUN chiffre de la lettre
// (audit du 24/09, `console-admin.md` §1). Trois chiffres, et le troisième est
// le seul qui réclame un geste : une demande du formulaire restée sans envoi
// depuis plus d'une heure veut dire que le rattrapage n'a pas pu la reprendre
// (coupe-circuit, plafond, file indisponible).
//
// Une TUILE, pas une alerte : même parti pris que « Apporteurs en attente »,
// juste au-dessus. Elle reste visible quand tout va bien, et le dit.

import Link from "next/link";

import { AdminCard, AdminBadge } from "@/components/admin/ui";
import type { TuileGuideLettre } from "@/server/newsletter/console";

interface Props {
  adminPrefix: string;
  tuile: TuileGuideLettre;
}

function Chiffre({ valeur, libelle }: { valeur: number; libelle: string }): React.ReactElement {
  return (
    <div className="flex items-baseline gap-[var(--space-admin-3)]">
      <span className="text-[length:var(--text-admin-2xl)] font-semibold text-[color:var(--color-admin-fg)]">
        {valeur}
      </span>
      <span className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
        {libelle}
      </span>
    </div>
  );
}

export function GuideLettreSection({ adminPrefix, tuile }: Props): React.ReactElement {
  const base = `/fr/${adminPrefix}`;
  return (
    <AdminCard className="mb-[var(--space-admin-6)]">
      <div className="mb-[var(--space-admin-4)] flex items-center justify-between gap-[var(--space-admin-4)]">
        <h2 className="text-[length:var(--text-admin-lg)] font-semibold text-[color:var(--color-admin-fg)]">
          Lettre et guide
        </h2>
        <Link href={`${base}/newsletter`} className="admin-button-ghost">
          Ouvrir la lettre →
        </Link>
      </div>
      <div className="flex flex-wrap items-baseline gap-[var(--space-admin-6)]">
        <Chiffre
          valeur={tuile.abonnesConfirmes}
          libelle={tuile.abonnesConfirmes > 1 ? "abonnés" : "abonné"}
        />
        <Chiffre
          valeur={tuile.demandes30j}
          libelle={`demande${tuile.demandes30j > 1 ? "s" : ""} du guide sur 30 jours`}
        />
        {/* Le lien ouvre les demandes « pas encore parties » : la liste montre
            AUSSI celles de la dernière heure, que le compte ne retient pas
            (elles sont normales). Les plus anciennes y sont en bas. */}
        {tuile.demandesEnSouffrance === 0 ? (
          <AdminBadge tone="success" dot>
            Aucun guide en retard
          </AdminBadge>
        ) : (
          <Link href={`${base}/newsletter/demandes-guide?etat=non-envoyees`}>
            <AdminBadge tone="warning" dot>
              {tuile.demandesEnSouffrance} guide{tuile.demandesEnSouffrance > 1 ? "s" : ""} pas
              encore parti{tuile.demandesEnSouffrance > 1 ? "s" : ""} après une heure
            </AdminBadge>
          </Link>
        )}
      </div>
    </AdminCard>
  );
}
