// Fiche d'un message — les pièces jointes envoyées avec le formulaire de
// contact (2026-10-15) : nom, taille, bouton Télécharger.
//
// Le bouton mène à la route admin authentifiée
// `contacts/messages/[id]/pieces-jointes/[pieceId]` — jamais à une URL R2.
// Rien ne s'affiche quand la demande est arrivée sans fichier.

import { listerPiecesJointes } from "@/server/contact/pieces-jointes";
import { tailleLisiblePieceJointe } from "@/lib/contact/pieces-jointes";

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
        {pieces.map((p) => (
          <li
            key={p.id}
            className="flex flex-wrap items-center justify-between gap-2 text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]"
          >
            <span className="min-w-0 break-all">
              <strong>{p.nomFichier}</strong>{" "}
              <span className="text-[color:var(--color-admin-fg-muted)]">
                · {tailleLisiblePieceJointe(p.tailleOctets)}
                {p.antivirus === "sain" ? null : " · antivirus non passé à la réception"}
              </span>
            </span>
            <a
              href={`/fr/${adminPrefix}/contacts/messages/${submissionId}/pieces-jointes/${p.id}`}
              className="admin-link"
              download
            >
              Télécharger
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
