/**
 * Admin — Qualiopi · Alertes système (T15).
 *
 * Liste les alertes groupées par niveau (critique / important / info).
 * Badges de comptage par groupe. Bouton « Synchroniser » (server action).
 * Composants client : AlerteActions (résoudre / marquer lu) et
 * AlertesLiveBadge (compteur SSE temps réel).
 *
 * Server Component — auth + redirect, force-dynamic, noindex.
 */

import type { Metadata } from "next";
import Link from "next/link";

import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { countAlertesActives, listAlertes } from "@/server/qualiopi/alertes/alertes-service";
import { AlerteActions } from "@/components/admin/qualiopi/AlerteActions";
import { AlertesLiveBadge } from "@/components/admin/qualiopi/AlertesLiveBadge";
import {
  resoudreAlerteAction,
  marquerLuAction,
  marquerToutLuAction,
  synchroniserAlertesAction,
} from "@/server/actions/qualiopi/alertes";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { gardePage } from "@/server/auth/garde-page";

// Enum locale — miroir de AlerteNiveau Prisma (évite le chemin relatif depuis le routeur).
type AlerteNiveau = "critique" | "important" | "info";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Alertes système | Axion-IA Admin",
  robots: { index: false, follow: false },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const NIVEAU_LABELS: Record<AlerteNiveau, string> = {
  critique: "Critique",
  important: "Important",
  info: "Information",
};

const NIVEAU_ORDER: AlerteNiveau[] = ["critique", "important", "info"];

/**
 * Plafond de lignes rendues.
 *
 * 🔴 2026-09-02 (audit certificateur). `listAlertes({ resolue: false })` était
 * appelé SANS `limit` — le paramètre existe pourtant dans la signature. Mesuré
 * sur la base de recette : **1 589 alertes actives**, donc 1 589 cartes et
 * autant d'instances du composant CLIENT `AlerteActions` dans une seule page.
 * 531 Ko de texte rendu, ~50 s de chargement. Un écran qu'on ne peut pas ouvrir
 * ne signale rien.
 *
 * ⚠️ Un plafond n'est pas une pagination : il est ÉCRIT à l'écran, et l'écran
 * dit par quoi filtrer. Tronquer en silence ferait lire « voilà tout ce qui
 * reste » là où l'on n'a montré que les cent premières lignes — c'est la règle
 * déjà posée par le registre d'émargement, appliquée ici à son jumeau.
 */
const PLAFOND_ALERTES = 100;

// ─────────────────────────────────────────────────────────────────────────────
// Badge couleur par niveau
// ─────────────────────────────────────────────────────────────────────────────

function NiveauBadge({ niveau }: { niveau: AlerteNiveau }): React.ReactElement {
  const cls =
    niveau === "critique"
      ? "text-[color:var(--color-admin-error)]"
      : niveau === "important"
        ? "text-[color:var(--color-admin-warning-fg)]"
        : "text-[color:var(--color-admin-fg-muted)]";
  return (
    <span
      className={`inline-flex items-center rounded-[var(--radius-admin-sm)] border border-current px-[var(--space-admin-2)] py-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] font-semibold ${cls}`}
    >
      {NIVEAU_LABELS[niveau]}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Compteur par groupe
// ─────────────────────────────────────────────────────────────────────────────

function GroupeHeader({
  niveau,
  count,
}: {
  niveau: AlerteNiveau;
  count: number;
}): React.ReactElement {
  const bulletCls =
    niveau === "critique"
      ? "text-[color:var(--color-admin-error)]"
      : niveau === "important"
        ? "text-[color:var(--color-admin-warning-fg)]"
        : "text-[color:var(--color-admin-fg-muted)]";

  return (
    <div className="mb-[var(--space-admin-3)] flex items-center gap-[var(--space-admin-3)]">
      <h2 className={`text-[length:var(--text-admin-base)] font-semibold ${bulletCls}`}>
        {NIVEAU_LABELS[niveau]}
      </h2>
      <span
        className={`rounded-full px-[var(--space-admin-2)] py-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] font-medium ${
          niveau === "critique"
            ? "bg-[color:var(--color-admin-error-subtle)] text-[color:var(--color-admin-error)]"
            : niveau === "important"
              ? "bg-[color:var(--color-admin-warning-subtle)] text-[color:var(--color-admin-warning-fg)]"
              : "bg-[color:var(--color-admin-surface)] text-[color:var(--color-admin-fg-muted)]"
        }`}
      >
        {count}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
  searchParams: Promise<{ niveau?: string }>;
}

export default async function QualiopiAlertesPage({ params, searchParams }: PageProps) {
  const { locale, adminPrefix } = await params;
  const acces = await gardePage("consultation", `/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }

  const sp = await searchParams;
  const niveauFiltre = NIVEAU_ORDER.find((n) => n === sp.niveau);
  const self = `/${locale}/${adminPrefix}/qualiopi/alertes`;

  // Le COMPTE vient d'un compteur, l'AFFICHAGE d'une liste plafonnée : le total
  // annoncé reste exact même quand la liste est tronquée. Écrire le nombre de
  // lignes affichées à la place du total mentirait sur le registre lui-même.
  const [total, alertes] = await Promise.all([
    countAlertesActives(niveauFiltre),
    listAlertes({
      resolue: false,
      ...(niveauFiltre !== undefined ? { niveau: niveauFiltre } : {}),
      limit: PLAFOND_ALERTES,
    }),
  ]);
  const tronque = total > alertes.length;

  // Grouper par niveau
  const grouped = new Map<AlerteNiveau, typeof alertes>();
  for (const niveau of NIVEAU_ORDER) {
    grouped.set(
      niveau,
      alertes.filter((a) => a.niveau === niveau),
    );
  }

  // `nonLues` porte sur ce qui est AFFICHÉ : le dire autrement demanderait un
  // second compteur, et l'écran annonce déjà le total exact juste à côté.
  const nonLues = alertes.filter((a) => !a.lu).length;

  // Formater la date en français
  function fmtDate(d: Date): string {
    return d.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <AdminPageShell width="wide">
      {/* En-tête + badge SSE temps réel */}
      <div className="mb-[var(--space-admin-6)] flex flex-col gap-[var(--space-admin-3)] sm:flex-row sm:items-start sm:justify-between">
        <AdminPageHeader
          title="Alertes système"
          description="Surveillance en temps réel des obligations Qualiopi, documents manquants, financements et expirations."
        />
        <div className="flex shrink-0 flex-col items-end gap-[var(--space-admin-3)]">
          {/* Badge SSE — mis à jour en temps réel */}
          <AlertesLiveBadge initialCount={nonLues} />
          {/* Bouton synchroniser */}
          <AlerteActions mode="synchroniser" synchroniserAction={synchroniserAlertesAction} />
          {/* Bouton tout marquer comme lu */}
          {nonLues > 0 && (
            <AlerteActions mode="tout-lu" marquerToutLuAction={marquerToutLuAction} />
          )}
        </div>
      </div>

      {/* Résumé compteurs */}
      <div className="mb-[var(--space-admin-6)] flex flex-wrap gap-[var(--space-admin-4)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)]">
        <span>
          <span className="font-semibold text-[color:var(--color-admin-fg)]">{total}</span> alerte
          {total !== 1 ? "s" : ""} active{total !== 1 ? "s" : ""}
        </span>
        {nonLues > 0 && (
          <span className="text-[color:var(--color-admin-warning-fg)]">
            <span className="font-semibold">{nonLues}</span> non lue{nonLues !== 1 ? "s" : ""}
            {tronque ? " parmi les alertes affichées" : ""}
          </span>
        )}
      </div>

      {/* Filtre par niveau — liens serveur, aucun JS. C'est le recours que le
          plafond doit offrir : sans lui, « affinez par niveau » serait une
          consigne sans bouton. */}
      <nav
        aria-label="Filtrer les alertes par niveau"
        className="mb-[var(--space-admin-5)] flex flex-wrap gap-[var(--space-admin-2)]"
      >
        {[
          { cle: undefined as AlerteNiveau | undefined, libelle: "Tous les niveaux" },
          ...NIVEAU_ORDER.map((n) => ({ cle: n, libelle: NIVEAU_LABELS[n] })),
        ].map(({ cle, libelle }) => {
          const actif = niveauFiltre === cle;
          return (
            <Link
              key={libelle}
              href={cle === undefined ? self : `${self}?niveau=${cle}`}
              aria-current={actif ? "page" : undefined}
              className={`rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] px-[var(--space-admin-4)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] ${
                actif
                  ? "bg-[color:var(--color-admin-surface)] font-semibold text-[color:var(--color-admin-fg)]"
                  : "text-[color:var(--color-admin-fg-muted)] hover:text-[color:var(--color-admin-fg)]"
              }`}
            >
              {libelle}
            </Link>
          );
        })}
      </nav>

      {/* Une troncature muette se lit comme une liste complète : on dit le
          plafond LÀ où il mord, et par quoi le contourner. */}
      {tronque && (
        <p className="mb-[var(--space-admin-5)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)] px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)]">
          {`Liste plafonnée : ${total} alerte${total > 1 ? "s" : ""} active${total > 1 ? "s" : ""} au registre, ${alertes.length} affichée${alertes.length > 1 ? "s" : ""} ici, les plus récentes d'abord. Filtrez par niveau pour voir les autres.`}
        </p>
      )}

      {total === 0 ? (
        <div className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-6)] py-[var(--space-admin-8)] text-center">
          <p className="text-[length:var(--text-admin-base)] text-[color:var(--color-admin-fg-soft)]">
            Aucune alerte active. Tout est conforme.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-[var(--space-admin-8)]">
          {NIVEAU_ORDER.map((niveau) => {
            const items = grouped.get(niveau) ?? [];
            if (items.length === 0) return null;

            return (
              <section key={niveau}>
                <GroupeHeader niveau={niveau} count={items.length} />
                <div className="flex flex-col gap-[var(--space-admin-3)]">
                  {items.map((alerte) => (
                    <div
                      key={alerte.id}
                      className={`rounded-[var(--radius-admin-md)] border bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)] ${
                        !alerte.lu
                          ? "border-[color:var(--color-admin-accent)]"
                          : "border-[color:var(--color-admin-border)]"
                      }`}
                    >
                      {/* En-tête carte */}
                      <div className="mb-[var(--space-admin-2)] flex flex-wrap items-start justify-between gap-[var(--space-admin-3)]">
                        <div className="flex flex-wrap items-center gap-[var(--space-admin-2)]">
                          <NiveauBadge niveau={alerte.niveau} />
                          {!alerte.lu && (
                            <span className="rounded-full bg-[color:var(--color-admin-accent)] px-[var(--space-admin-2)] py-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] font-medium text-[color:var(--color-admin-accent-fg)]">
                              Nouveau
                            </span>
                          )}
                          <span className="font-mono text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                            {alerte.code}
                          </span>
                        </div>
                        <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                          {fmtDate(alerte.createdAt)}
                        </span>
                      </div>

                      {/* Titre + message */}
                      <p className="mb-[var(--space-admin-1)] text-[length:var(--text-admin-sm)] font-semibold text-[color:var(--color-admin-fg)]">
                        {alerte.titre}
                      </p>
                      <p className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)]">
                        {alerte.message}
                      </p>

                      {/* Cible si disponible */}
                      {alerte.cibleType && (
                        <p className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                          Cible&nbsp;: {alerte.cibleType}
                          {alerte.cibleId ? ` — ${alerte.cibleId}` : ""}
                        </p>
                      )}

                      {/* Actions */}
                      <AlerteActions
                        mode="item"
                        alerteId={alerte.id}
                        lu={alerte.lu}
                        resoudreAction={resoudreAlerteAction}
                        marquerLuAction={marquerLuAction}
                        synchroniserAction={synchroniserAlertesAction}
                      />
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </AdminPageShell>
  );
}
