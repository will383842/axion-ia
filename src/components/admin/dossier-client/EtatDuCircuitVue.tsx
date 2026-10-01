/**
 * « État du circuit » du dossier client (chantier visio, PR 4 ; plan §3.14,
 * modèle `webhook-battement.ts`) — un ONGLET de la page Rendez-vous
 * (`?vue=circuit`), pas une page de plus (cliquet de poids, ADR 0058).
 *
 * Tout est CALCULÉ par le site depuis la base, à l'affichage : le battement du
 * balayage (rouge au-delà de 30 minutes), le drapeau vu par le worker, les
 * pannes techniques (lues dans `AlerteSysteme`, codes `visio.*`), et les
 * rappels de travail. « Tenus sans compte rendu » est le compteur de la
 * pastille « À faire le point » existante, pas un second calcul (correction
 * anti-doublon A3). Telegram n'est qu'un doublon (PA-14). Le témoin de clé, les appareils, les enregistrements et les
 * étapes du circuit arrivent avec leur PR (5 et 6).
 *
 * La page appelante a DÉJÀ consulté le rôle (`peutVoirLesEchanges`, A2).
 */

import Link from "next/link";

import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { prisma } from "@/lib/prisma";
import { compterRendezVousAFaireLePoint } from "@/features/admin-rendezvous/suivi-queries";
import { lireEtatDuCircuit } from "@/server/visio/balayage";
import { BATTEMENT_ROUGE_MIN } from "@/server/visio/battement";
import { formatDateFrShort } from "@/lib/format-date-fr";
import { timeInParis } from "@/lib/calendar-grid";

const carteCls =
  "mb-[var(--space-admin-5)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]";
const titreCls =
  "mb-[var(--space-admin-3)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]";
const mutedCls = "text-[color:var(--color-admin-fg-muted)]";
const listeCls = "space-y-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]";
const lienCls = "text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline";

function Ligne({ libelle, valeur }: { libelle: string; valeur: React.ReactNode }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-[var(--space-admin-3)]">
      <span>{libelle}</span>
      <span className="font-medium tabular-nums">{valeur}</span>
    </li>
  );
}

export async function EtatDuCircuitVue({ rdvBase }: { rdvBase: string }) {
  const maintenant = new Date();
  const e = await lireEtatDuCircuit(prisma, maintenant);
  const aFaireLePoint = await compterRendezVousAFaireLePoint(maintenant);
  const b = e.battement;

  return (
    <>
      <section className={carteCls}>
        <h2 className={titreCls}>Le traitement automatique des comptes rendus</h2>
        <ul className={listeCls}>
          <Ligne
            libelle="Dernier passage"
            valeur={
              b.etat === "jamais" ? (
                <AdminBadge tone="neutral">
                  jamais — le traitement automatique est arrêté : prévenez Claude
                </AdminBadge>
              ) : (
                <AdminBadge tone={b.etat === "vert" ? "success" : "destructive"} dot>
                  il y a {b.ageMin} min
                  {b.etat === "rouge"
                    ? ` — rien depuis plus de ${BATTEMENT_ROUGE_MIN} min, le traitement semble arrêté : prévenez Claude`
                    : ""}
                </AdminBadge>
              )
            }
          />
          <Ligne
            libelle="Réglage de l'enregistrement (lu par le traitement)"
            valeur={e.drapeauVuParWorker ?? "—"}
          />
          <Ligne
            libelle="En service depuis"
            valeur={e.borne ? `${formatDateFrShort(e.borne)} à ${timeInParis(e.borne)}` : "—"}
          />
          <Ligne
            libelle="Comptes rendus en préparation en ce moment"
            valeur={
              e.etapesEnCours > 0 ? (
                <AdminBadge tone="warning">{e.etapesEnCours} en cours</AdminBadge>
              ) : (
                "aucune"
              )
            }
          />
        </ul>
      </section>

      <section className={carteCls}>
        <h2 className={titreCls}>À faire</h2>
        <ul className={listeCls}>
          <Ligne
            libelle="Rendez-vous où faire le point (la pastille de l'onglet)"
            valeur={
              aFaireLePoint > 0 ? (
                <Link href={rdvBase} className={lienCls}>
                  <AdminBadge tone="warning">{aFaireLePoint}</AdminBadge>
                </Link>
              ) : (
                "0"
              )
            }
          />
          <Ligne
            libelle="Comptes rendus à valider depuis plus de 3 jours"
            valeur={e.comptesRendusAValider}
          />
          <Ligne libelle="Suites échues" valeur={e.suitesEchues} />
          <Ligne libelle="Rendez-vous demain (à préparer)" valeur={e.veille} />
        </ul>
      </section>

      <section className={carteCls}>
        <h2 className={titreCls}>Visios client de ce mois</h2>
        <ul className={listeCls}>
          <Ligne libelle="Visios tenues" valeur={e.couverture.visios} />
          <Ligne
            libelle="Avec compte rendu d'enregistrement"
            valeur={e.couverture.avecCompteRendu}
          />
          <Ligne libelle="Avec une note manuelle" valeur={e.couverture.avecNote} />
          <Ligne libelle="Sans rien" valeur={e.couverture.sansRien} />
        </ul>
      </section>

      <section className={carteCls}>
        <h2 className={titreCls}>Pannes techniques signalées</h2>
        {e.alertesTechniques.length === 0 ? (
          <p className={`text-[length:var(--text-admin-sm)] ${mutedCls}`}>Aucune.</p>
        ) : (
          <ul className={listeCls}>
            <li className="font-medium">
              Une panne ne se répare pas d&apos;ici : prévenez Claude.
            </li>
            {e.alertesTechniques.map((a) => (
              <li key={a.id}>
                {a.titre}{" "}
                <span className={mutedCls}>
                  depuis le {formatDateFrShort(a.createdAt)} ·{" "}
                  <span className="font-mono text-[length:var(--text-admin-xs)]">{a.code}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
