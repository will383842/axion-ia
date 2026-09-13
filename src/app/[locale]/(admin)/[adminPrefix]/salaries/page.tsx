/**
 * Admin — Salariés : la vue EMPLOYEUR, tous postes confondus.
 *
 * ## 🔴 Pourquoi cet écran existe, et pourquoi il n'est PAS dans Qualiopi
 *
 * Un contrat de travail est une affaire d'ENTREPRISE, pas de certification. Le
 * contrat d'un développeur web ou d'une secrétaire n'a rien à voir avec le
 * référentiel qualité — et Axion-IA ne fait pas que de la formation.
 *
 * Jusqu'ici les contrats ne vivaient que sur la fiche de chaque personne, rangée
 * sous « Qualiopi → Formateurs ». Deux conséquences :
 *
 *   · pour savoir qui était sous contrat, signé ou non, remis ou non, il fallait
 *     ouvrir les fiches UNE PAR UNE. Sur trois personnes c'est tenable ; sur
 *     douze, personne ne le fait ;
 *   · et il n'y avait aucune place pour quelqu'un qui n'enseigne pas.
 *
 * ## ⚠️ TOUT LE MONDE DANS LA MÊME LISTE
 *
 * Formateur salarié, secrétaire, responsable marketing, développeur : même
 * contrat, même délai de remise, même conséquence en cas de manquement. Deux
 * listes obligeraient à savoir dans laquelle chercher avant de chercher.
 *
 * « Qualiopi → Formateurs » reste la vue PÉDAGOGIQUE — habilitations, sessions,
 * preuves d'audit. Une même personne peut figurer dans les deux : c'est le même
 * humain vu sous deux angles, pas deux dossiers.
 *
 * Server Component : aucune ligne de JavaScript client.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, BadgeCheck, FileWarning, PenLine, Users } from "lucide-react";

import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminStatCard } from "@/components/admin/ui/AdminStatCard";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { AdminEmptyState } from "@/components/admin/ui/AdminEmptyState";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { gardePage } from "@/server/auth/garde-page";
import { listSalaries, synthetiserSalaries, type EtatContrat } from "@/server/rh/salaries-pilotage";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Salariés | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

/**
 * Un mot par état, et le mot dit le GESTE à faire — pas l'état du système.
 *
 * ⚠️ « À établir » plutôt que « aucun document » : le premier se lit comme une
 * tâche, le second comme un constat. Sur un tableau de pilotage, on lit ce qu'il
 * reste à faire.
 */
const LIBELLE_ETAT: Readonly<Record<EtatContrat, string>> = {
  sans_objet: "Mandat social",
  a_etablir: "À établir",
  a_signer: "À signer",
  partiel: "Une signature sur deux",
  signe: "Signé",
};

const TON_ETAT: Readonly<Record<EtatContrat, "neutral" | "warning" | "success" | "destructive">> = {
  // 🔑 Le mandat social n'est ni un retard ni une réussite : c'est hors sujet.
  // Le peindre en rouge apprendrait à ignorer les rouges, et en vert ferait
  // croire à une pièce obtenue.
  sans_objet: "neutral",
  a_etablir: "destructive",
  a_signer: "warning",
  partiel: "warning",
  signe: "success",
};

const jour = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeZone: "Europe/Paris" });

export default async function SalariesPage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  const acces = await gardePage("consultation", `/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }

  const lignes = await listSalaries();
  const synthese = synthetiserSalaries(lignes);
  const ficheBase = `/${locale}/${adminPrefix}/qualiopi/formateurs`;

  const cellCls =
    "px-[var(--space-admin-3)] py-[var(--space-admin-2)] align-top text-[length:var(--text-admin-sm)]";
  const headCls =
    "px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-left text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)]";

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Salariés"
        description="Tous les contrats de travail, quel que soit le poste — formateur ou non. Un contrat engage l'entreprise, pas la certification."
      />

      <div className="mb-[var(--space-admin-6)] grid grid-cols-1 gap-[var(--space-admin-5)] sm:grid-cols-4">
        <AdminStatCard label="Salariés actifs" value={synthese.actifs} icon={Users} />
        <AdminStatCard
          label="Contrat à établir"
          value={synthese.sansContrat}
          icon={FileWarning}
          tone={synthese.sansContrat > 0 ? "destructive" : "success"}
        />
        <AdminStatCard
          label="En attente de signature"
          value={synthese.enAttenteDeSignature}
          icon={PenLine}
          tone={synthese.enAttenteDeSignature > 0 ? "warning" : "success"}
        />
        {/*
          🔴 Le seul compteur VRAIMENT urgent de l'écran. Un CDD non remis dans
          les deux jours ouvrables suivant l'embauche est requalifiable en CDI
          (art. L.1242-13 et L.1245-1) — cela ne se rattrape pas en payant.
        */}
        <AdminStatCard
          label="Remise de CDD en retard"
          value={synthese.remisesUrgentes}
          icon={AlertTriangle}
          tone={synthese.remisesUrgentes > 0 ? "destructive" : "success"}
        />
      </div>

      {synthese.remisesUrgentes > 0 && (
        <div className="admin-alert admin-alert-error mb-[var(--space-admin-5)]" role="alert">
          <strong>
            {synthese.remisesUrgentes === 1
              ? "Un CDD établi n'a pas été remis."
              : `${synthese.remisesUrgentes} CDD établis n'ont pas été remis.`}
          </strong>{" "}
          Un CDD doit être transmis au salarié dans les <strong>deux jours ouvrables</strong>{" "}
          suivant son embauche. Au-delà, il est requalifiable en contrat à durée indéterminée.
          Remettez l&apos;exemplaire, puis consignez la date sur sa fiche.
        </div>
      )}

      {lignes.length === 0 ? (
        <AdminEmptyState
          icon={<Users size={24} />}
          title="Aucun salarié enregistré"
          description="Les salariés et le dirigeant apparaissent ici dès qu'ils sont créés. Un contrat de travail se prépare depuis leur fiche."
        />
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)]">
          <table className="w-full border-collapse text-[color:var(--color-admin-fg)]">
            <caption className="sr-only">
              Salariés, poste, nature du contrat et état de son circuit de signature
            </caption>
            <thead className="border-b border-[color:var(--color-admin-border)]">
              <tr>
                <th scope="col" className={headCls}>
                  Nom
                </th>
                <th scope="col" className={headCls}>
                  Poste
                </th>
                <th scope="col" className={headCls}>
                  Contrat
                </th>
                <th scope="col" className={headCls}>
                  Entrée en fonction
                </th>
                <th scope="col" className={headCls}>
                  État
                </th>
                <th scope="col" className={headCls}>
                  Remis
                </th>
                <th scope="col" className={headCls}>
                  <span className="sr-only">Ouvrir la fiche</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((l) => (
                <tr
                  key={l.trainerId}
                  className="border-b border-[color:var(--color-admin-border)] last:border-0"
                >
                  <td className={cellCls}>
                    <div className="font-medium">{l.nomComplet}</div>
                    <div className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                      {l.email}
                      {/* ⚠️ Un compte désactivé reste listé : un contrat non remis
                          ne cesse pas de l'être parce qu'on a fermé l'accès. */}
                      {!l.actif && " · compte désactivé"}
                    </div>
                  </td>
                  <td className={cellCls}>
                    {l.poste ?? <span className="text-[color:var(--color-admin-fg-muted)]">—</span>}
                  </td>
                  <td className={cellCls}>
                    {l.contratType === null ? (
                      <span className="text-[color:var(--color-admin-fg-muted)]">—</span>
                    ) : (
                      l.contratType.toUpperCase()
                    )}
                    {l.numeroPiece !== null && (
                      <div className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                        {l.numeroPiece}
                        {/* Une pièce marquée SPÉCIMEN n'est pas opposable et le
                            service de signature la refuse : le taire ferait
                            attendre une signature qui ne viendra jamais. */}
                        {l.estSpecimen && " · SPÉCIMEN"}
                      </div>
                    )}
                  </td>
                  <td className={cellCls}>
                    {l.dateEmbauche === null ? (
                      <span className="text-[color:var(--color-admin-fg-muted)]">—</span>
                    ) : (
                      jour.format(l.dateEmbauche)
                    )}
                  </td>
                  <td className={cellCls}>
                    <AdminBadge tone={TON_ETAT[l.etat]} dot>
                      {LIBELLE_ETAT[l.etat]}
                    </AdminBadge>
                    {l.etat === "partiel" && (
                      <div className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                        {l.signatures}/2
                      </div>
                    )}
                  </td>
                  <td className={cellCls}>
                    {/*
                      🔴 LE ROUGE EST RÉSERVÉ À CE QUI EST ENCORE UNE TÂCHE.

                      Recette du 13/09 : la ligne se peignait en rouge « ⚠ non
                      remis » pour TOUT LE MONDE, pendant que le compteur
                      « Remise de CDD en retard » juste au-dessus ne compte que
                      les actifs. Sur un compte désactivé, l'écran affichait donc
                      0 EN VERT et une ligne EN ROUGE, sur la même page. Un
                      tableau qui se contredit lui-même n'apprend rien : il
                      apprend à ne plus lire le chiffre.

                      ⚠️ ARBITRAGE, et c'est le sens INVERSE qui a été écarté :
                      on aurait pu compter les inactifs dans le chiffre. Mais
                      l'alerte `contrat_cdd_non_remis` ne vise, elle aussi, que
                      les actifs — et l'étendre ferait crier indéfiniment sur
                      d'anciens salariés dont plus personne ne peut honnêtement
                      dater la remise. Une alerte qui réclame un geste que nul ne
                      peut poser apprend à ignorer la famille entière.

                      Le fait reste DIT, il cesse seulement d'être crié.
                    */}
                    {l.remiseUrgente && l.actif ? (
                      <span className="font-semibold text-[color:var(--color-admin-danger)]">
                        ⚠ non remis
                      </span>
                    ) : l.remiseUrgente ? (
                      <span className="text-[color:var(--color-admin-fg-muted)]">
                        non remis · compte désactivé
                      </span>
                    ) : l.remisAt !== null ? (
                      <span className="inline-flex items-center gap-1">
                        <BadgeCheck size={14} aria-hidden />
                        {jour.format(l.remisAt)}
                      </span>
                    ) : (
                      <span className="text-[color:var(--color-admin-fg-muted)]">—</span>
                    )}
                  </td>
                  <td className={cellCls}>
                    <Link
                      href={`${ficheBase}/${l.trainerId}`}
                      className="text-[color:var(--color-admin-accent)] underline"
                    >
                      Ouvrir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/*
        ⚠️ DIT EXPLICITEMENT OÙ SE FAIT LE GESTE. Un tableau de pilotage qui
        montre un manque sans dire où le combler fait chercher — et la fiche est
        encore rangée sous Qualiopi, ce qui n'est pas devinable.
      */}
      <p className="mt-[var(--space-admin-4)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
        La saisie du contrat, sa relecture, les deux signatures et la consignation de la remise se
        font depuis la fiche de chaque personne (« Ouvrir »).
      </p>
    </AdminPageShell>
  );
}
