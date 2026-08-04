// Refonte admin mai 2026 — PR 8 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 8).
//
// Helper V2 partagé pour les 9 sous-pages stub image-bank
// (analytics, bulk-import, categories, licensing, seo-audit, settings,
// sitemap-status, tags, taxonomy). Migre AdminStubPage vers primitives
// admin/ui (AdminPageShell + AdminPageHeader + AdminCard).

import { ArrowLeft } from "lucide-react";
import { AdminPageShell, AdminPageHeader, AdminCard, AdminButton } from "@/components/admin/ui";

interface Props {
  title: string;
  description: string;
  back: string;
}

/**
 * 🔴 CE COMPOSANT SERT NEUF PAGES, ET CHACUNE MONTRAIT SON DÉFAUT NEUF FOIS
 * (audit du code, 2026-08-03) :
 *
 * - les neuf appelants passaient le SEGMENT DE ROUTE ANGLAIS EN MINUSCULES
 *   comme titre de page — « analytics », « bulk import », « seo audit »,
 *   « taxonomy »… Les titres sont désormais en français et alignés sur les
 *   libellés de la barre latérale ;
 * - le lien de retour disait « ← Retour image-bank overview » : une flèche en
 *   caractère, un nom de dossier du dépôt et un anglicisme, en trois mots ;
 * - l'encart annonçait « Cette section est prévue Sprint 2.x » et « l'ancre
 *   route et la nav admin sont déjà câblées ». Un numéro de sprint interne et
 *   du vocabulaire de développement, pour dire à l'utilisateur une seule chose
 *   utile : cet écran n'existe pas encore.
 */
export function AdminStubPageV2({ title, description, back }: Props): React.ReactElement {
  return (
    <AdminPageShell>
      <AdminPageHeader
        title={title}
        description={description}
        actions={
          <AdminButton href={back} variant="ghost" icon={ArrowLeft}>
            Retour à la banque d&apos;images
          </AdminButton>
        }
      />
      <AdminCard className="border-l-4 border-l-[color:var(--color-admin-warning)]">
        <p className="admin-meta-block">
          Cet écran n&apos;est pas encore disponible. L&apos;entrée de menu existe déjà pour que
          vous sachiez ce qui est prévu, mais il n&apos;y a rien à y faire pour l&apos;instant.
        </p>
      </AdminCard>
    </AdminPageShell>
  );
}
