// Aperçu d'e-mail du socle « dossier » (D0, PLAN-DESIGN-CLIENTS).
//
// Enveloppe du lecteur commun `LecteurEmail` (lot I0b-1), avec la même signature
// qu'avant : De, À, Objet, puis le corps dans le cadre ISOLÉ du lecteur
// (`sandbox=""`, CSP qui bloque les images distantes, jamais d'injection dans la
// page). L'ancien second cadre, qui laissait passer les images distantes, n'existe plus.
// Composant serveur.

import { LecteurEmail } from "@/components/admin/ui/LecteurEmail";

interface AdminApercuEmailProps {
  /** Expéditeur affiché (nom et adresse). */
  de: string;
  /** Destinataire(s) affiché(s). */
  a: string;
  objet: string;
  /** Corps HTML complet de l'e-mail, tel qu'il sera envoyé. */
  html: string;
  /** Titre accessible du cadre (défaut : « Aperçu de l'e-mail »). */
  titre?: string;
}

export function AdminApercuEmail({
  de,
  a,
  objet,
  html,
  titre = "Aperçu de l'e-mail",
}: AdminApercuEmailProps): React.ReactElement {
  return <LecteurEmail html={html} de={de} a={a} objet={objet} titre={titre} />;
}
