// Bouton « Rejoindre la visio » des appels réservés (2026-09-27).
//
// Composant SERVEUR, sans JavaScript : l'état « imminente » est calculé au rendu,
// et les pages qui l'affichent sont `force-dynamic`. Recharger la page suffit à
// le faire passer en évidence, ce qui ne vaut pas un bundle client.
//
// Un `<a>` et pas `AdminButton` : ce dernier rend un `next/link`, qui PRÉCHARGE
// sa cible. Précharger cette route, c'est la faire appeler Calendly à chaque
// affichage de la liste, pour un clic qui n'aura peut-être jamais lieu. Les
// classes sont les mêmes `.admin-button*`, donc le rendu est identique.

import { Video } from "lucide-react";
import { momentVisio, MINUTES_AVANT_VISIO } from "@/features/admin-rendezvous/visio";

export interface RejoindreVisioBoutonProps {
  /** Adresse de la route `/api/admin/appels/[id]/visio`. */
  readonly href: string;
  readonly debut: Date | null;
  readonly fin: Date | null;
  /** Instant du rendu, injectable pour les tests. */
  readonly maintenant?: Date;
  /** Gabarit compact pour les lignes de liste et la frise. */
  readonly compact?: boolean;
}

export function RejoindreVisioBouton({
  href,
  debut,
  fin,
  maintenant = new Date(),
  compact = false,
}: RejoindreVisioBoutonProps): React.ReactElement | null {
  const moment = momentVisio(debut, fin, maintenant);
  if (moment === "terminee") return null;
  const imminente = moment === "imminente";

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={[
        imminente ? "admin-button" : "admin-button-secondary",
        compact ? "admin-button-sm" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      title={
        imminente
          ? "La visio commence bientôt — elle s'ouvre sur le compte organisateur"
          : `Ouvre la visio sur le compte organisateur. Le bouton passe en évidence ${MINUTES_AVANT_VISIO} minutes avant l'heure.`
      }
      data-moment={moment}
    >
      <Video size={16} aria-hidden="true" className="shrink-0" />
      {imminente ? "Rejoindre maintenant" : "Rejoindre la visio"}
    </a>
  );
}
