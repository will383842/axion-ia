// Fiche d'un message — les pièces jointes envoyées avec le formulaire de
// contact (2026-10-15) : nom, taille, bouton Télécharger.
//
// Le bouton mène à la route admin authentifiée
// `contacts/messages/[id]/pieces-jointes/[pieceId]` — jamais à une URL R2.
// Une pièce annoncée mais NON reçue (envoi échoué, refusée au contrôle) reste
// listée, sans bouton : Will sait qu'un fichier manque et peut le réclamer.
// Rien ne s'affiche quand la demande est arrivée sans fichier.

import { listerPiecesJointes } from "@/server/contact/pieces-jointes";
import {
  FORMATS_A_OUVRIR_AVEC_PRUDENCE,
  tailleLisiblePieceJointe,
} from "@/lib/contact/pieces-jointes";

/** Affiché à côté d'un CSV, d'un tableur ou d'une archive (relecture du 2026-10-15). */
export const MENTION_PRUDENCE = "Fichier envoyé par un visiteur : ouvrez-le avec prudence";

const LIBELLE_STATUT: Readonly<Record<string, string>> = {
  attendue: "envoi en cours",
  controle: "contrôle en cours",
  refusee: "pièce non reçue (refusée au contrôle)",
  non_recue: "pièce non reçue",
};

export async function PiecesJointesMessage({
  adminPrefix,
  submissionId,
}: {
  adminPrefix: string;
  submissionId: string;
}) {
  const pieces = await listerPiecesJointes(submissionId);
  if (pieces.length === 0) return null;
  return (
    <div className="admin-card admin-card-wide" id="pieces-jointes">
      <h2 className="admin-h2">Pièces jointes</h2>
      <ul className="space-y-2">
        {pieces.map((p) => {
          const recue = p.statut === "recue";
          return (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-2 text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]"
            >
              <span className="min-w-0 break-all">
                <strong>{p.nomFichier}</strong>{" "}
                <span className="text-[color:var(--color-admin-fg-muted)]">
                  · {tailleLisiblePieceJointe(p.tailleOctets)}
                  {recue && p.antivirus !== "sain" ? " · antivirus non passé à la réception" : null}
                  {recue ? null : ` · ${LIBELLE_STATUT[p.statut] ?? "pièce non reçue"}`}
                </span>
                {recue && FORMATS_A_OUVRIR_AVEC_PRUDENCE.has(p.format) ? (
                  <span className="block text-[color:var(--color-admin-fg-muted)]">
                    {MENTION_PRUDENCE}
                  </span>
                ) : null}
              </span>
              {recue ? (
                <a
                  href={`/fr/${adminPrefix}/contacts/messages/${submissionId}/pieces-jointes/${p.id}`}
                  className="admin-link"
                  download
                >
                  Télécharger
                </a>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
