// Fiche apporteur — les échanges réservés, rattachés à ce dossier (2026-09-19).
//
// Le rattachement automatique (`server/calendly/rattachement-apporteur.ts`)
// pose le lien entre l'échange de 15 minutes et le dossier ; sans ce bloc, il
// ne se voyait que depuis l'agenda. Depuis la fiche, on sait désormais si la
// personne a réservé, quand, et si l'échange a eu lieu.
//
// 🔒 RÉGIME « FILTRE » de `features/admin-calendly/acces.ts` : la fiche reste
// ouverte à tout rôle de consultation, mais ce bloc — qui porte l'horaire et le
// lien vers la fiche d'appel — n'est rendu qu'aux rôles qui voient les appels.
// La décision est prise AVANT la lecture : un rôle non habilité ne déclenche
// aucune requête sur `calendly_events`.

import Link from "next/link";
import * as Sentry from "@sentry/nextjs";
import { listRendezVousDeFiche } from "@/features/admin-rendezvous/queries";
import { RDV_STATUS_LABELS, type UnifiedRdv } from "@/features/admin-rendezvous/types";
import { peutVoirLesAppels } from "@/features/admin-calendly/acces";
import { LIBELLE_CANAL } from "@/server/calendly/canal";
import { formatDateFrShort } from "@/lib/format-date-fr";
import { timeInParis } from "@/lib/calendar-grid";

export async function RendezVousApporteur({
  submissionId,
  role,
}: {
  submissionId: string;
  role: string | null | undefined;
}) {
  if (!peutVoirLesAppels(role)) return null;

  // Information ACCESSOIRE : si la lecture échoue, la fiche s'affiche sans ce
  // bloc — elle ne tombe jamais pour ça.
  let rdvs: UnifiedRdv[] = [];
  try {
    rdvs = await listRendezVousDeFiche(submissionId);
  } catch (err) {
    Sentry.captureException(err, { tags: { ecran: "fiche-apporteur", etape: "rendez-vous" } });
    return null;
  }

  return (
    <div className="admin-card admin-card-wide" id="rendez-vous">
      <h2 className="admin-h2">Échange réservé</h2>
      {rdvs.length === 0 ? (
        <p className="admin-help">
          Aucun rendez-vous rattaché à ce dossier. Un échange réservé avec la même adresse e-mail
          s&apos;y rattache tout seul.
        </p>
      ) : (
        <ul className="space-y-2">
          {rdvs.map((r) => (
            <li key={r.key}>
              <Link href={r.detailHref} className="admin-link">
                {formatDateFrShort(r.dayKey)}
                {r.timeConfirmed && r.startTime ? ` à ${timeInParis(r.startTime)}` : " (heure ?)"}
              </Link>{" "}
              — {r.title} · {LIBELLE_CANAL[r.format]} · {RDV_STATUS_LABELS[r.status]}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
