/**
 * Admin — Qualiopi · 📁 Dossiers (pipeline) — refonte console phases 2 et 3.
 *
 * Répond à la deuxième question du plan (« À traiter » répond à la première) :
 * « où en est chaque affaire ? ». Avant cette page, un client vivait dans six
 * onglets sans lien — devis ici, session là, facture ailleurs — et reconstituer
 * l'état d'une affaire demandait une tournée complète de la console.
 *
 * UNE ligne par affaire, rangée dans une colonne de pipeline qui suit le cycle
 * de vie : 📥 Devis en attente → ✍️ Signature en attente → 📅 À préparer →
 * ▶️ En cours → 🧾 À solder → ✅ Soldés (30 derniers jours, pour ne pas noyer).
 *
 * Phase 3 (2026-08-01) — trois ajouts, zéro changement du comportement de base :
 * - Badge « ✅ Qualiopi » / « ⚙️ Hors périmètre » sur chaque ligne. Verdict de
 *   Will : « pas de distinction claire entre ce qui doit faire partie de
 *   Qualiopi ou pas » — la table de vérité vit dans UN SSOT
 *   (`src/server/qualiopi/perimetre.ts`), la ligne porte le booléen dérivé.
 * - Filtres par searchParams (`?activite=…`, `?perimetre=…`) : de simples
 *   LIENS rendus côté serveur — pas un octet de JS client, le filtre est dans
 *   l'URL donc partageable et revenable (bouton retour du navigateur).
 * - Archives (`?archives=1`) : les dossiers soldés au-delà de la fenêtre de
 *   30 jours, que la vue normale exclut volontairement. Ils restent
 *   consultables sans polluer le pipeline du quotidien.
 *
 * 🔴 Zéro logique propre : le statut est DÉRIVÉ par `lireDossiersPipeline()`
 * (cf. `src/server/admin/dossiers-pipeline.ts`, fonction pure + spec). Cette
 * page AFFICHE, elle ne décide rien — la règle « réalisée mais impayée n'est
 * pas soldée » vit dans le module et son spec, pas dans du JSX.
 *
 * Server Component — auth + redirect, force-dynamic, noindex (même idiome que
 * la page « À traiter » de la phase 1).
 */

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Archive, ArrowLeft, ArrowRight } from "lucide-react";

import { auth } from "@/auth";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import {
  lireDossiersPipeline,
  COLONNES_PIPELINE,
  ACTIVITE_LABELS,
  FENETRE_SOLDES_JOURS,
  type ActiviteDossier,
  type LigneDossier,
} from "@/server/admin/dossiers-pipeline";
import { libellerPerimetre, PERIMETRE_LABELS } from "@/server/qualiopi/perimetre";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Dossiers (pipeline) | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
  searchParams: Promise<{ activite?: string; perimetre?: string; archives?: string }>;
}

/** Valeurs admises de `?activite=` — alignées sur les badges de la vue. */
const ACTIVITES_FILTRABLES = ["formation", "coaching", "audit"] as const;

/** Valeurs admises de `?perimetre=`. */
type FiltrePerimetre = "qualiopi" | "hors";

/** Dates courtes FR — la machine est en UTC, une date de session s'affiche
 *  pareil à ±2 h près, pas besoin de fuseau explicite. */
const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

/** « 10 août 2026 → 11 août 2026 », ou une seule date, ou rien. */
function plage(dateDebut: Date | null, dateFin: Date | null): string | null {
  if (dateDebut && dateFin) {
    const debut = dateFmt.format(dateDebut);
    const fin = dateFmt.format(dateFin);
    return debut === fin ? debut : `${debut} → ${fin}`;
  }
  if (dateDebut) return dateFmt.format(dateDebut);
  if (dateFin) return dateFmt.format(dateFin);
  return null;
}

export default async function DossiersPage({ params, searchParams }: PageProps) {
  const { locale, adminPrefix } = await params;
  const session = await auth();
  const role = session?.user?.role;
  // Même garde que le reste de la console Qualiopi (à-traiter, alertes, sessions).
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }

  const base = `/${locale}/${adminPrefix}`;
  const cheminPage = `${base}/qualiopi/dossiers`;

  // ── Lecture des filtres — une valeur inconnue est IGNORÉE (pas d'erreur) :
  // une URL trafiquée ou périmée retombe sur la vue complète, jamais sur un 500.
  const sp = await searchParams;
  const filtreActivite: ActiviteDossier | null = (
    ACTIVITES_FILTRABLES as readonly string[]
  ).includes(sp.activite ?? "")
    ? (sp.activite as ActiviteDossier)
    : null;
  const filtrePerimetre: FiltrePerimetre | null =
    sp.perimetre === "qualiopi" || sp.perimetre === "hors" ? sp.perimetre : null;
  const modeArchives = sp.archives === "1";

  // Le mode archives est le SEUL cas où l'on demande les soldés hors fenêtre —
  // la lecture par défaut reste strictement celle de la phase 2.
  const lecture = modeArchives
    ? await lireDossiersPipeline(new Date(), { avecArchives: true })
    : await lireDossiersPipeline();
  const pipeline = lecture.colonnes;

  /** La ligne passe-t-elle les filtres actifs (et le bon mode de vue) ? */
  const correspondFiltres = (l: LigneDossier): boolean =>
    (!filtreActivite || l.activite === filtreActivite) &&
    (!filtrePerimetre || l.qualiopi === (filtrePerimetre === "qualiopi")) &&
    // En vue normale, ne montrer QUE le pipeline vivant ; en archives, QUE les
    // archivés (les soldés récents restent dans la vue normale, pas ici).
    l.archive === modeArchives;

  /**
   * URL de la page avec les filtres voulus. `null` efface un filtre, absent le
   * conserve — chaque lien-filtre ne touche donc qu'à SA dimension et les
   * combinaisons (activité × périmètre × archives) marchent toutes seules.
   */
  const urlAvec = (patch: {
    activite?: ActiviteDossier | null;
    perimetre?: FiltrePerimetre | null;
    archives?: boolean;
  }): string => {
    const activite = patch.activite !== undefined ? patch.activite : filtreActivite;
    const perimetre = patch.perimetre !== undefined ? patch.perimetre : filtrePerimetre;
    const archives = patch.archives !== undefined ? patch.archives : modeArchives;
    const query = new URLSearchParams();
    if (activite) query.set("activite", activite);
    if (perimetre) query.set("perimetre", perimetre);
    if (archives) query.set("archives", "1");
    const qs = query.toString();
    return qs ? `${cheminPage}?${qs}` : cheminPage;
  };

  const lignesArchivees = modeArchives
    ? COLONNES_PIPELINE.flatMap((c) => pipeline[c.id]).filter(correspondFiltres)
    : [];
  const totalAffaires = modeArchives
    ? lignesArchivees.length
    : COLONNES_PIPELINE.reduce((n, c) => n + pipeline[c.id].filter(correspondFiltres).length, 0);

  // Mêmes classes que la page « À traiter » — 100 % tokens admin, aucun hex.
  const carte =
    "mb-[var(--space-admin-6)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)] p-[var(--space-admin-4)]";
  const titreCarte =
    "mb-[var(--space-admin-3)] flex items-center gap-[var(--space-admin-2)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]";
  const pastille =
    "inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-[color:var(--color-admin-error)] px-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] font-bold text-white";
  const ligne =
    "flex flex-wrap items-center justify-between gap-[var(--space-admin-2)] border-b border-[color:var(--color-admin-border)] py-[var(--space-admin-2)] last:border-b-0";
  const badge =
    "inline-flex items-center rounded-full border border-[color:var(--color-admin-border)] px-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]";
  // Liens-filtres : même pilule dans les deux états, seule la surface change —
  // l'actif est plein (accent), l'inactif est bordé. Aucun hex, que des tokens.
  const filtreInactif =
    "inline-flex items-center rounded-full border border-[color:var(--color-admin-border)] px-[var(--space-admin-3)] py-[var(--space-admin-1)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)] hover:underline";
  const filtreActif =
    "inline-flex items-center rounded-full border border-[color:var(--color-admin-accent)] bg-[color:var(--color-admin-accent)] px-[var(--space-admin-3)] py-[var(--space-admin-1)] text-[length:var(--text-admin-sm)] font-semibold text-white";
  const groupeFiltres =
    "flex flex-wrap items-center gap-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]";

  /** Une ligne d'affaire — identique en vue pipeline et en vue archives. */
  const rendreLigne = (l: LigneDossier) => {
    const dates = plage(l.dateDebut, l.dateFin);
    return (
      <li key={l.cle} className={ligne}>
        <span className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
          <span className={badge}>{ACTIVITE_LABELS[l.activite]}</span>{" "}
          <span className={badge}>{libellerPerimetre(l.qualiopi)}</span> <strong>{l.client}</strong>{" "}
          — {l.intitule}
          {l.reference ? ` · ${l.reference}` : ""}
          {dates ? ` · ${dates}` : ""}
          <span className="block text-[color:var(--color-admin-fg-muted)]">
            {l.prochaineAction}
          </span>
        </span>
        <AdminButton
          href={`${base}${l.cheminFiche}`}
          variant="ghost"
          size="sm"
          iconAfter={ArrowRight}
        >
          Ouvrir
        </AdminButton>
      </li>
    );
  };

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Dossiers"
        description="Où en est chaque affaire ? Une ligne par dossier client, groupée par étape du pipeline — du devis envoyé au solde encaissé. Le statut est dérivé des données existantes : rien à tenir à jour."
      />

      {/*
        🔴 L'AVEU DE TRONCATURE.
        Cette vue lit au plus 200 lignes PAR SOURCE, triées par activité récente.
        Le module promet pourtant qu'« une prestation réalisée mais impayée ne
        sort JAMAIS de la vue, quel que soit son âge » : au-delà du plafond,
        c'est faux, et rien ne le disait. Un écran qui montre 200 lignes sur
        1 187 sans le dire ne se lit pas comme incomplet — il se lit comme
        exhaustif.
        On DIT ce qu'on n'a pas lu, et on distingue « rien de plus » de
        « je n'ai pas pu savoir ».
      */}
      {lecture.tronquee || lecture.sources.some((s) => !s.fiable) ? (
        <div
          role="status"
          className="mb-[var(--space-admin-4)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)] p-[var(--space-admin-3)] text-[length:var(--text-admin-sm)]"
        >
          {lecture.sources
            .filter((s) => s.tronquee)
            .map((s) => (
              <p key={s.source}>
                <strong>
                  {s.lues} {s.label} lus sur {s.total}
                </strong>{" "}
                — affinez les filtres pour voir le reste. Les plus récemment actifs sont affichés en
                premier&nbsp;: une affaire dormante peut donc manquer ici.
              </p>
            ))}
          {lecture.sources
            .filter((s) => !s.fiable)
            .map((s) => (
              <p key={s.source}>
                Lecture des {s.label} indisponible&nbsp;: cette vue est incomplète, et on ne sait
                pas de combien.
              </p>
            ))}
        </div>
      ) : null}

      {modeArchives && (
        <div className={carte}>
          <p className="mb-[var(--space-admin-2)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
            <Archive
              size={16}
              aria-hidden="true"
              className="mr-[var(--space-admin-2)] inline-block align-[-3px]"
            />
            Archives — dossiers soldés de plus de {FENETRE_SOLDES_JOURS} jours
          </p>
          <p className="mb-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
            Ces dossiers sont terminés et payés : ils sortent du pipeline du quotidien mais restent
            consultables ici (rien n&apos;est supprimé).
          </p>
          <AdminButton
            href={urlAvec({ archives: false })}
            variant="ghost"
            size="sm"
            icon={ArrowLeft}
          >
            Retour au pipeline
          </AdminButton>
        </div>
      )}

      {/* Rangée de filtres — de simples liens : le filtre vit dans l'URL,
          rendu 100 % serveur, zéro JS client. */}
      <div className="mb-[var(--space-admin-6)] flex flex-col gap-[var(--space-admin-2)]">
        <div className={groupeFiltres}>
          <span>Activité :</span>
          <Link
            href={urlAvec({ activite: null })}
            className={filtreActivite === null ? filtreActif : filtreInactif}
          >
            Toutes
          </Link>
          {ACTIVITES_FILTRABLES.map((a) => (
            <Link
              key={a}
              href={urlAvec({ activite: a })}
              className={filtreActivite === a ? filtreActif : filtreInactif}
            >
              {ACTIVITE_LABELS[a]}
            </Link>
          ))}
        </div>
        <div className={groupeFiltres}>
          <span>Périmètre :</span>
          <Link
            href={urlAvec({ perimetre: null })}
            className={filtrePerimetre === null ? filtreActif : filtreInactif}
          >
            Tout
          </Link>
          <Link
            href={urlAvec({ perimetre: "qualiopi" })}
            className={filtrePerimetre === "qualiopi" ? filtreActif : filtreInactif}
          >
            {PERIMETRE_LABELS.qualiopi}
          </Link>
          <Link
            href={urlAvec({ perimetre: "hors" })}
            className={filtrePerimetre === "hors" ? filtreActif : filtreInactif}
          >
            {PERIMETRE_LABELS.hors}
          </Link>
        </div>
      </div>

      {totalAffaires === 0 && (
        <div className={carte}>
          <p className="text-[length:var(--text-admin-base)] text-[color:var(--color-admin-fg)]">
            {modeArchives
              ? "Aucun dossier archivé ne correspond à ces filtres."
              : filtreActivite || filtrePerimetre
                ? "Aucune affaire ne correspond à ces filtres."
                : "Aucune affaire dans le pipeline — pas de devis en attente, pas de session vivante, rien à solder."}
          </p>
        </div>
      )}

      {modeArchives ? (
        lignesArchivees.length > 0 && (
          <div className={carte}>
            <h2 className={titreCarte}>
              <Archive size={18} aria-hidden="true" className="shrink-0" />
              Dossiers archivés <span className={pastille}>{lignesArchivees.length}</span>
            </h2>
            <ul>{lignesArchivees.map(rendreLigne)}</ul>
          </div>
        )
      ) : (
        <>
          {COLONNES_PIPELINE.map((colonne) => {
            const lignes = pipeline[colonne.id].filter(correspondFiltres);
            // Les colonnes vides sont masquées : afficher six cadres dont quatre
            // vides redonnerait exactement le bruit que la refonte veut supprimer.
            if (lignes.length === 0) return null;
            return (
              <div key={colonne.id} className={carte}>
                <h2 className={titreCarte}>
                  {colonne.label} <span className={pastille}>{lignes.length}</span>
                </h2>
                <p className="mb-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
                  {colonne.description}
                </p>
                <ul>{lignes.map(rendreLigne)}</ul>
              </div>
            );
          })}
          {/* Lien discret vers les archives — en bas : c'est une vue de
              consultation, pas une étape du pipeline. */}
          <p className="text-[length:var(--text-admin-sm)]">
            <Link
              href={urlAvec({ archives: true })}
              className="text-[color:var(--color-admin-fg-muted)] hover:underline"
            >
              Voir les archives (dossiers soldés de plus de {FENETRE_SOLDES_JOURS} jours) →
            </Link>
          </p>
        </>
      )}
    </AdminPageShell>
  );
}
