/**
 * Fiche candidat — les RÉPONSES REÇUES par e-mail (lot L3, 2026-10-07).
 *
 * Composant SERVEUR, sans état : le relevé de la boîte Zoho Mail
 * (`reponses-entrantes-candidature.ts`) a enregistré la réponse ; ce bloc la
 * montre — date, objet, court extrait, « Ouvrir dans Zoho » pour le message
 * entier et ses pièces jointes, qui ne sont JAMAIS copiés chez nous (décision
 * de Will n° 11). Une réponse automatique (absence) est montrée, marquée comme
 * telle : elle n'a rien déclenché.
 *
 * Mêmes briques que la frise juste en dessous (filet à gauche, ligne d'en-tête,
 * badge) — la maquette validée le 07/10 marque ces lignes « lu
 * automatiquement ». Le fil unique « Échanges » viendra au lot L7.
 *
 * Information ACCESSOIRE : si la lecture échoue, la fiche s'affiche sans ce
 * bloc. Et rien ne s'affiche tant qu'aucune réponse n'est arrivée.
 */

import * as Sentry from "@sentry/nextjs";
import { AdminBadge } from "@/components/admin/ui";
import {
  lireReponsesRecuesCandidat,
  type ReponseRecueCandidat,
} from "@/features/admin-job-applications/reponses-recues";

const DATE_FR = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  dateStyle: "medium",
  timeStyle: "short",
});

export async function ReponsesRecuesCandidat({
  applicationId,
  role,
}: {
  applicationId: string;
  role: string | null | undefined;
}): Promise<React.ReactElement | null> {
  let reponses: ReponseRecueCandidat[] = [];
  try {
    reponses = await lireReponsesRecuesCandidat(applicationId, { role });
  } catch (err) {
    Sentry.captureException(err, { tags: { ecran: "fiche-candidat", etape: "reponses-recues" } });
    return null;
  }
  if (reponses.length === 0) return null;

  return (
    <section id="reponses-recues" className="mb-[var(--space-admin-4)]">
      <h4 className="admin-meta-small mb-[var(--space-admin-2)] font-semibold">
        Réponses reçues par e-mail
      </h4>
      <ol className="m-0 list-none p-0">
        {reponses.map((r) => (
          <li
            key={r.id}
            className="border-l-2 border-l-[color:var(--color-admin-info)] pb-[var(--space-admin-3)] pl-[var(--space-admin-4)] last:pb-0"
          >
            <div className="flex flex-wrap items-baseline gap-x-[var(--space-admin-3)]">
              <span className="text-[length:var(--text-admin-sm)] font-semibold">Reçu</span>
              <span className="admin-meta-small">{DATE_FR.format(r.recueLe)}</span>
              <AdminBadge tone="info">lu automatiquement</AdminBadge>
              {r.automatique ? <AdminBadge tone="neutral">réponse automatique</AdminBadge> : null}
            </div>
            <p className="text-[length:var(--text-admin-sm)]">{r.objet}</p>
            {r.extrait ? (
              <p className="admin-meta-small whitespace-pre-wrap">« {r.extrait} »</p>
            ) : null}
            <a
              href={r.lienZoho}
              target="_blank"
              rel="noopener noreferrer"
              className="admin-link inline-flex min-h-[44px] items-center"
            >
              Ouvrir dans Zoho
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}
