/**
 * Une carte par rendez-vous, sur l'onglet Rendez-vous de la fiche client.
 *
 * Dit le TYPE (icône + mot), l'OBJET en titre (à défaut, le titre), le lieu s'il
 * existe, l'heure de Paris. L'extrait du compte rendu n'apparaît que pour un
 * compte rendu VALIDÉ ; un rendez-vous passé sans compte rendu validé porte la
 * pastille « Compte rendu à relire » — jamais l'idée qu'il serait « envoyé ».
 * Teintes : prévu = bleu, a eu lieu = vert, à relire = terracotta ; toujours
 * une icône ET un mot. Composant serveur, texte brut uniquement.
 */

import Link from "next/link";
import {
  CalendarCheck,
  CalendarClock,
  Building2,
  FileSearch,
  MapPin,
  Phone,
  Video,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { LIBELLE_ETAT_EMAIL_SUIVI } from "@/features/dossier-client/etat-email-suivi";
import { LIBELLE_STATUT_RENCONTRE } from "@/features/dossier-client/libelles";
import { LIBELLE_TYPE_RENDEZ_VOUS } from "@/features/dossier-client/libelles-type-rendez-vous";
import type { RencontreDuDossier } from "@/features/dossier-client/queries";
import { formatDateFr, formatDateFrShort } from "@/lib/format-date-fr";
import type { RencontreType } from "../../../../../prisma/generated/client";

const ICONE_TYPE: Readonly<Record<RencontreType, LucideIcon>> = {
  visio: Video,
  telephone: Phone,
  presentiel: Building2,
  inconnu: CalendarClock,
};

const mutedCls = "text-[color:var(--color-admin-fg-muted)]";
const lienCls =
  "inline-flex min-h-[44px] items-center text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline";

const STATUTS_SANS_COMPTE_RENDU = new Set(["annule", "reporte", "absent"]);

/** Du prochain rendez-vous au plus ancien : les à-venir (le plus proche d'abord), puis les passés (le plus récent d'abord). */
export function rangerDuProchainAuPlusAncien(
  rencontres: ReadonlyArray<RencontreDuDossier>,
  maintenant: Date,
): RencontreDuDossier[] {
  const t = maintenant.getTime();
  const aVenir = rencontres
    .filter((r) => r.debutPrevu !== null && r.debutPrevu.getTime() > t)
    .sort((a, b) => a.debutPrevu!.getTime() - b.debutPrevu!.getTime());
  const reste = rencontres
    .filter((r) => !(r.debutPrevu !== null && r.debutPrevu.getTime() > t))
    .sort(
      (a, b) => (b.debutPrevu?.getTime() ?? -Infinity) - (a.debutPrevu?.getTime() ?? -Infinity),
    );
  return [...aVenir, ...reste];
}

export function CarteRendezVous({
  rencontre: r,
  prestationTitre,
  rendezVousBase,
  maintenant,
}: {
  rencontre: RencontreDuDossier;
  prestationTitre: string | null;
  rendezVousBase: string;
  maintenant: Date;
}): React.ReactElement {
  const aVenir = r.debutPrevu !== null && r.debutPrevu.getTime() > maintenant.getTime();
  const statutCle = r.statut ?? (aVenir ? "planifie" : r.issue === "absent" ? "absent" : "tenu");
  const prevu = aVenir && (r.statut === null || r.statut === "planifie");
  const datePassee = !aVenir && r.statut === "planifie";
  const sansCompteRendu = STATUTS_SANS_COMPTE_RENDU.has(statutCle);
  const aRelire = !aVenir && !sansCompteRendu && r.compteRenduValide === null;
  const Icone = ICONE_TYPE[r.type];
  const titre = r.objet !== null && r.objet.trim() !== "" ? r.objet : r.titre;
  const lien = `${rendezVousBase}/rencontres/${r.id}`;

  return (
    <li
      data-rencontre={r.id}
      className="border-b border-[color:var(--color-admin-border)] pb-[var(--space-admin-3)]"
    >
      <div className="flex flex-wrap items-center gap-[var(--space-admin-3)]">
        <h3 className="font-medium">{titre}</h3>
        {prevu ? (
          <AdminBadge tone="info">
            <CalendarClock size={14} aria-hidden="true" />
            Prévu
          </AdminBadge>
        ) : datePassee ? (
          <AdminBadge tone="outline">Date passée</AdminBadge>
        ) : statutCle === "tenu" ? (
          <AdminBadge tone="success">
            <CalendarCheck size={14} aria-hidden="true" />A eu lieu
          </AdminBadge>
        ) : (
          <AdminBadge tone="outline">{LIBELLE_STATUT_RENCONTRE[statutCle]}</AdminBadge>
        )}
        {aRelire ? (
          <span
            data-a-relire
            className="inline-flex items-center gap-[var(--space-admin-2)] rounded-full border border-[color:var(--color-admin-bloc-terracotta-border)] bg-[color:var(--color-admin-bloc-terracotta-bg)] px-[var(--space-admin-3)] py-[var(--space-admin-1)] text-[length:var(--text-admin-sm)] font-semibold text-[color:var(--color-admin-bloc-terracotta-title)]"
          >
            <FileSearch size={14} aria-hidden="true" />
            Compte rendu à relire
          </span>
        ) : null}
        {r.estTestInterne ? <AdminBadge tone="warning">test interne</AdminBadge> : null}
      </div>
      <p
        className={`mt-[var(--space-admin-1)] flex flex-wrap items-center gap-x-[var(--space-admin-3)] ${mutedCls}`}
      >
        <span className="inline-flex items-center gap-[var(--space-admin-1)]">
          <Icone size={14} aria-hidden="true" />
          {LIBELLE_TYPE_RENDEZ_VOUS[r.type]}
        </span>
        <span>{r.debutPrevu !== null ? formatDateFr(r.debutPrevu) : "date inconnue"}</span>
        {r.lieu !== null && r.lieu.trim() !== "" ? (
          <span className="inline-flex items-center gap-[var(--space-admin-1)]">
            <MapPin size={14} aria-hidden="true" />
            {r.lieu}
          </span>
        ) : null}
        {prestationTitre !== null ? <span>Prestation : {prestationTitre}</span> : null}
      </p>
      {r.objet !== null && r.objet.trim() !== "" && r.titre !== r.objet ? (
        <p className={`mt-[var(--space-admin-1)] ${mutedCls}`}>{r.titre}</p>
      ) : null}
      {r.compteRenduValide !== null ? (
        <p className="mt-[var(--space-admin-2)] whitespace-pre-line">
          <span className="font-medium">En bref : </span>
          {r.compteRenduValide.enBref ?? "(compte rendu validé, sans résumé)"}
        </p>
      ) : null}
      {r.emailsSuivi.map((e, i) => (
        <p key={i} className={`mt-[var(--space-admin-1)] ${mutedCls}`}>
          E-mail de suivi du {formatDateFrShort(e.creeLe)} : {LIBELLE_ETAT_EMAIL_SUIVI[e.etat]}
        </p>
      ))}
      <Link href={lien} className={lienCls}>
        {aRelire ? "Relire le compte rendu →" : "Compte rendu →"}
      </Link>
    </li>
  );
}
