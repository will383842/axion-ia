/**
 * Admin — Qualiopi · Conformité & mode auditeur (fusion phase 2, 2026-08-01).
 *
 * Page canonique de la matrice des 32 indicateurs RNQ V9. Fusionne l'ancienne
 * « Conformité » (tableaux denses + stat cards) et le « Mode auditeur »
 * (manifeste, documents, exports) qui affichaient la même évaluation sous
 * deux entrées de nav (`genererManifesteAudit()` wrappe `evaluerConformite()`).
 *
 * Deux vues via searchParam `?vue=` (0 KB JS, page force-dynamic) :
 *   - `tableau` (défaut) — balayage rapide pour le pilotage quotidien ;
 *   - `manifeste` — cartes + comptes de documents, pour l'auditrice.
 * /qualiopi/conformite redirige ici en 308.
 */

import type { Metadata } from "next";
import Link from "next/link";

import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminStatCard } from "@/components/admin/ui/AdminStatCard";
import { ExportManifesteButton } from "@/components/admin/qualiopi/ExportManifesteButton";
import {
  MatriceIndicateurs,
  type MatriceVue,
} from "@/components/admin/qualiopi/MatriceIndicateurs";
import { genererManifesteAudit } from "@/server/qualiopi/conformite/audit-dossier";
import { Gauge, CheckCircle2, Hourglass } from "lucide-react";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { gardePage } from "@/server/auth/garde-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Conformité & mode auditeur | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
  searchParams: Promise<{ vue?: string }>;
}

export default async function QualiopiModeAuditeurPage({ params, searchParams }: PageProps) {
  const { locale, adminPrefix } = await params;
  const acces = await gardePage("consultation", `/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }

  const sp = await searchParams;
  const vue: MatriceVue = sp.vue === "manifeste" ? "manifeste" : "tableau";
  const self = `/${locale}/${adminPrefix}/qualiopi/mode-auditeur`;

  const manifeste = await genererManifesteAudit();
  const indicateurs = manifeste.json.indicateurs;

  const nbCouverts = manifeste.json.meta.nbCouverts;
  const nbApplicables = manifeste.json.meta.nbApplicables;
  const scorePct = manifeste.json.meta.scorePct;
  const toneBilan = scorePct >= 80 ? "success" : scorePct >= 60 ? "warning" : "destructive";

  const ongletBase =
    "rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] px-[var(--space-admin-4)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]";
  const ongletActif = `${ongletBase} bg-[color:var(--color-admin-surface)] font-semibold text-[color:var(--color-admin-fg)]`;
  const ongletInactif = `${ongletBase} text-[color:var(--color-admin-fg-muted)] hover:text-[color:var(--color-admin-fg)]`;

  return (
    <AdminPageShell width="wide">
      {/*
        🔴 2026-09-02 (audit certificateur) — LES EXPORTS SORTENT DE L'EN-TÊTE.
        `AdminPageHeader` met ses actions en `sm:shrink-0 sm:flex-nowrap` : les
        boutons ne rétrécissent jamais, donc c'est le titre et la description qui
        s'écrasent. Mesuré à 1 145 px de fenêtre : la colonne de description
        tombait à 299 px et la phrase se rendait sur CINQ lignes, la moitié
        droite de l'écran restant vide.
        Et surtout, `ExportManifesteButton` ne rend pas que deux boutons : il
        rend AUSSI le verdict d'export, qui énumère les preuves manquantes du
        dossier remis. Cette liste n'a rien à faire dans une gouttière d'en-tête.
      */}
      <AdminPageHeader
        title="Conformité & mode auditeur"
        description={`État de couverture des 32 indicateurs du Référentiel National Qualité (${manifeste.json.meta.version}). Vue tableau pour le pilotage, vue manifeste (preuves + documents) pour l'auditrice — exports JSON, Markdown et dossier ZIP.`}
      />

      <div className="mb-[var(--space-admin-6)]">
        <ExportManifesteButton />
      </div>

      {/*
        Le registre des signatures répond à une question que le manifeste ne
        couvre pas : « cette pièce est-elle signée, par qui, et sa preuve
        tient-elle ? ». Sans ce lien, la page existe sans être trouvable — et
        une page qu'on ne trouve pas ne sert à personne le jour du contrôle.
      */}
      <p className="mb-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]">
        <Link href={`${self}/signatures`} className="underline">
          Registre des signatures de pièces — qui a signé quoi, et si la preuve tient
        </Link>
      </p>
      {/*
        🔴 `D3-3-05` — ce second registre n'existait pas, et la remarque
        ci-dessus s'appliquait à lui plus encore : la preuve de PRÉSENCE est la
        première pièce qu'un contrôle demande, et elle n'avait aucune surface.
        Une page qu'on ne trouve pas ne sert à personne le jour du contrôle ; une
        page qui n'existe pas laisse une signature erronée définitive.
      */}
      <p className="mb-[var(--space-admin-6)] text-[length:var(--text-admin-sm)]">
        <Link href={`${self}/emargement`} className="underline">
          Registre des signatures d&apos;émargement — la preuve de présence, chaîne par chaîne
        </Link>
      </p>

      {/* ── Score global (repris de l'ancienne page Conformité) ────────────
          🔴 Cette tuile s'appelait « Score de conformité » et affichait « 100 % »
          comme un fait. Or elle mesure une COUVERTURE DOCUMENTAIRE : un
          indicateur est « couvert » parce que des pièces existent, pas parce
          qu'un volume de preuves a été jugé suffisant. Sur l'écran destiné à
          l'auditrice, « 100 % de conformité » se lisait comme un verdict
          d'audit — il n'en est pas un. */}
      <div className="mb-[var(--space-admin-6)] grid grid-cols-1 gap-[var(--space-admin-5)] sm:grid-cols-3">
        <AdminStatCard
          label="Couverture documentaire"
          value={`${scorePct} %`}
          meta={`${nbCouverts} indicateur${nbCouverts > 1 ? "s" : ""} couvert${nbCouverts > 1 ? "s" : ""} sur ${nbApplicables} applicable${nbApplicables > 1 ? "s" : ""} · ne préjuge pas du volume de preuves par indicateur`}
          tone={toneBilan}
          icon={Gauge}
        />
        <AdminStatCard
          label="Indicateurs couverts"
          value={nbCouverts}
          tone="success"
          icon={CheckCircle2}
        />
        <AdminStatCard
          label="À compléter"
          value={nbApplicables - nbCouverts}
          tone={nbApplicables - nbCouverts > 0 ? "warning" : "success"}
          icon={Hourglass}
        />
      </div>

      {/* ── Commutateur de vue (liens serveur, aucun JS) ─────────────────── */}
      <nav
        aria-label="Vue de la matrice"
        className="mb-[var(--space-admin-6)] flex gap-[var(--space-admin-2)]"
      >
        <Link
          href={self}
          className={vue === "tableau" ? ongletActif : ongletInactif}
          aria-current={vue === "tableau" ? "page" : undefined}
        >
          Vue tableau
        </Link>
        <Link
          href={`${self}?vue=manifeste`}
          className={vue === "manifeste" ? ongletActif : ongletInactif}
          aria-current={vue === "manifeste" ? "page" : undefined}
        >
          Vue manifeste (preuves & documents)
        </Link>
      </nav>

      <MatriceIndicateurs
        indicateurs={indicateurs}
        vue={vue}
        baseHref={`/${locale}/${adminPrefix}`}
      />

      {/* ── Markdown brut (aperçu) ────────────────────────────────────── */}
      {vue === "manifeste" && manifeste.markdown.length > 0 && (
        <details className="mt-[var(--space-admin-8)]">
          <summary className="cursor-pointer text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-fg-soft)] transition-colors hover:text-[color:var(--color-admin-fg)]">
            Aperçu Markdown du manifeste
          </summary>
          <pre className="mt-[var(--space-admin-4)] max-h-96 overflow-auto rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)] p-[var(--space-admin-4)] font-mono text-[length:var(--text-admin-xs)] whitespace-pre-wrap text-[color:var(--color-admin-fg)]">
            {manifeste.markdown}
          </pre>
        </details>
      )}
    </AdminPageShell>
  );
}
