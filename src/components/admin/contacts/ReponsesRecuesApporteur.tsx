// Fiche apporteur — les réponses reçues par e-mail (2026-09-27).
//
// La personne a répondu à son invitation dans la boîte Zoho Mail : le relevé
// (`reponses-entrantes-apporteur.ts`) l'a vu, ses rappels se sont arrêtés, et
// ce bloc le montre — date, objet, extrait, lien vers le message dans Zoho.
// Une réponse automatique (absence, accusé) est montrée, marquée comme telle :
// elle n'a rien arrêté.
//
// Information ACCESSOIRE : si la lecture échoue, la fiche s'affiche sans ce
// bloc. Et rien ne s'affiche tant qu'aucune réponse n'est arrivée — un bloc
// vide sur chaque fiche ne dirait rien.

import * as Sentry from "@sentry/nextjs";
import {
  lireReponsesRecues,
  type ReponseRecue,
} from "@/features/commercial-application/reponses-recues";
import { formatDateFrShort } from "@/lib/format-date-fr";
import { timeInParis } from "@/lib/calendar-grid";

export async function ReponsesRecuesApporteur({ submissionId }: { submissionId: string }) {
  let reponses: ReponseRecue[] = [];
  try {
    reponses = await lireReponsesRecues(submissionId);
  } catch (err) {
    Sentry.captureException(err, { tags: { ecran: "fiche-apporteur", etape: "reponses-recues" } });
    return null;
  }
  if (reponses.length === 0) return null;

  return (
    <div className="admin-card admin-card-wide" id="reponses-recues">
      <h2 className="admin-h2">Réponses reçues par e-mail</h2>
      <ul className="space-y-3">
        {reponses.map((r) => (
          <li key={r.id}>
            <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
              <strong>
                {formatDateFrShort(r.recueLe)} à {timeInParis(r.recueLe)}
              </strong>{" "}
              — {r.objet}
              {r.automatique ? (
                <span className="text-[color:var(--color-admin-fg-muted)]">
                  {" "}
                  · réponse automatique (les rappels continuent)
                </span>
              ) : null}
            </p>
            {r.extrait ? (
              <p
                className="mt-1 text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]"
                style={{ whiteSpace: "pre-wrap" }}
              >
                « {r.extrait} »
              </p>
            ) : null}
            <a href={r.lienZoho} target="_blank" rel="noopener noreferrer" className="admin-link">
              Ouvrir dans Zoho
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
