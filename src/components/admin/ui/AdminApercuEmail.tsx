// Aperçu d'e-mail du socle « dossier » (D0, PLAN-DESIGN-CLIENTS).
//
// Enveloppe De / À / Objet, puis le corps HTML dans un cadre ISOLÉ :
// `sandbox=""` (aucune permission : ni script, ni formulaire, origine opaque,
// pas d'accès à la page ; un lien peut encore faire naviguer le cadre lui-même) et `srcDoc`. Le HTML d'un e-mail n'est donc JAMAIS
// injecté dans la page (pas de dangerouslySetInnerHTML).
//
// Hauteur FIXE (720 px, 560 sous 640 px) : le cadre ne fait pas sauter la page
// (CLS 0). La bascule Ordinateur / Téléphone est en CSS seul (deux boutons
// radio), sans JavaScript client. Composant serveur.

import { useId } from "react";

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
  const nom = useId();
  return (
    <div className="admin-apercu-email" data-bloc="apercu-email">
      <dl className="admin-apercu-email-enveloppe">
        <dt>De</dt>
        <dd>{de}</dd>
        <dt>À</dt>
        <dd>{a}</dd>
        <dt>Objet</dt>
        <dd>{objet}</dd>
      </dl>
      <div className="admin-apercu-email-bascule" role="group" aria-label="Largeur de l'aperçu">
        <input type="radio" name={nom} id={`${nom}-ordi`} value="ordinateur" defaultChecked />
        <label htmlFor={`${nom}-ordi`}>Ordinateur</label>
        <input type="radio" name={nom} id={`${nom}-tel`} value="telephone" />
        <label htmlFor={`${nom}-tel`}>Téléphone</label>
      </div>
      <iframe
        className="admin-apercu-email-cadre"
        title={titre}
        sandbox=""
        referrerPolicy="no-referrer"
        srcDoc={html}
      />
    </div>
  );
}
