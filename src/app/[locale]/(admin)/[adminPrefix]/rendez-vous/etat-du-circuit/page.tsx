/**
 * Admin — « État du circuit » du dossier client (chantier visio, PR 4 ; plan
 * §3.14, modèle `webhook-battement.ts`).
 *
 * Tout est CALCULÉ par le site depuis la base, à l'affichage : le battement
 * du balayage (rouge au-delà de 30 minutes), le drapeau vu par le worker, les
 * pannes techniques signalées, et les rappels de travail — rendez-vous tenus
 * sans compte rendu, comptes rendus à valider, suites échues, rendez-vous de
 * demain, couverture du mois. Telegram n'est qu'un doublon (PA-14).
 *
 * Les lignes du témoin de clé, des appareils, des enregistrements et des
 * étapes du circuit arrivent avec leur PR (5 et 6).
 *
 * Régime REFUS (décision A2) : `gardeLectureEchanges` est la PREMIÈRE instruction.
 */

import type { Metadata } from "next";
import Link from "next/link";

import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { gardeLectureEchanges } from "@/features/dossier-client/acces";
import { prisma } from "@/lib/prisma";
import { lireEtatDuCircuit } from "@/server/visio/balayage";
import { BATTEMENT_ROUGE_MIN } from "@/server/visio/battement";
import { formatDateFrShort } from "@/lib/format-date-fr";
import { timeInParis } from "@/lib/calendar-grid";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "État du circuit | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

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

export default async function EtatDuCircuitPage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  // 🔴 Première instruction : la garde, AVANT toute lecture.
  const acces = await gardeLectureEchanges(`/${locale}/${adminPrefix}/login`);
  const rdvBase = `/${locale}/${adminPrefix}/rendez-vous`;
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={rdvBase} />;
  }
  const maintenant = new Date();
  const e = await lireEtatDuCircuit(prisma, maintenant);
  const b = e.battement;

  return (
    <AdminPageShell width="wide">
      <div className="mb-[var(--space-admin-4)]">
        <Link href={rdvBase} className={`text-[length:var(--text-admin-xs)] ${lienCls}`}>
          ← Rendez-vous
        </Link>
      </div>
      <AdminPageHeader
        title="État du circuit"
        description="Ce que le balayage du dossier client surveille, calculé à l'instant depuis la base."
      />

      <section className={carteCls}>
        <h2 className={titreCls}>Le balayage</h2>
        <ul className={listeCls}>
          <Ligne
            libelle="Dernier passage"
            valeur={
              b.etat === "jamais" ? (
                <AdminBadge tone="neutral">jamais — le balayage n&apos;est pas allumé</AdminBadge>
              ) : (
                <AdminBadge tone={b.etat === "vert" ? "success" : "destructive"} dot>
                  il y a {b.ageMin} min
                  {b.etat === "rouge" ? ` (au-delà de ${BATTEMENT_ROUGE_MIN} min : arrêté ?)` : ""}
                </AdminBadge>
              )
            }
          />
          <Ligne libelle="Drapeau vu par le worker" valeur={e.drapeauVuParWorker ?? "—"} />
          <Ligne
            libelle="En service depuis"
            valeur={e.borne ? `${formatDateFrShort(e.borne)} à ${timeInParis(e.borne)}` : "—"}
          />
          <Ligne
            libelle="Étapes du circuit en cours"
            valeur={
              e.etapesEnCours > 0 ? (
                <AdminBadge tone="warning">
                  {e.etapesEnCours} — ne pas fusionner maintenant si ça peut attendre
                </AdminBadge>
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
            libelle="Rendez-vous tenus sans compte rendu ni note"
            valeur={e.f1.length > 0 ? <AdminBadge tone="warning">{e.f1.length}</AdminBadge> : "0"}
          />
          <Ligne
            libelle="Comptes rendus à valider depuis plus de 3 jours"
            valeur={e.comptesRendusAValider}
          />
          <Ligne libelle="Suites échues" valeur={e.suitesEchues} />
          <Ligne libelle="Rendez-vous demain (à préparer)" valeur={e.veille} />
        </ul>
        {e.f1.length > 0 ? (
          <ul className={`mt-[var(--space-admin-3)] ${listeCls}`}>
            {e.f1.slice(0, 20).map((x) => (
              <li key={x.rencontreId}>
                <Link href={`${rdvBase}/${x.rencontreId}/apres-l-appel#note`} className={lienCls}>
                  {x.attendu === "note"
                    ? "Appel téléphonique : écrire la note"
                    : "Visio : compte rendu ou note à écrire"}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
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
            {e.alertesTechniques.map((a) => (
              <li key={a.cle}>
                <span className="font-mono text-[length:var(--text-admin-xs)]">{a.cle}</span>{" "}
                <span className={mutedCls}>
                  depuis le {formatDateFrShort(a.premiereLe)} ·{" "}
                  {a.envoyeeLe ? "signalée sur Telegram" : "pas encore partie sur Telegram"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AdminPageShell>
  );
}
