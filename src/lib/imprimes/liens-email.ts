import "server-only";

/**
 * LES LIENS À INSÉRER DANS UN MESSAGE ÉCRIT À LA MAIN — pour le composeur de
 * réponse (candidats, et demain d'autres composeurs de la même famille).
 *
 * ## Le défaut que ce module ferme
 *
 * Le composeur n'accepte AUCUNE pièce jointe (doctrine du dépôt : « une pièce
 * jointe de 10 Mo pousse l'e-mail vers les indésirables, un lien suit la
 * dernière version du document »). Le corps accepte le markdown léger, dont
 * `[texte](url)` — mais Will doit retenir les adresses de tête pour s'en
 * servir, donc en pratique il n'en met jamais.
 *
 * ## 🔴 LES CHEMINS NE SE RECOPIENT PAS
 *
 * `src/content/imprimes.ts` est déjà la SOURCE unique de ce qui part sur du
 * papier ET de ce qui est servi sous `public/` (`IMPRIMES[].fichiersPublics`).
 * Une seconde liste ici diverger dès qu'un fichier serait renommé — exactement
 * le défaut que ce fichier documente pour lui-même en tête. On DÉRIVE donc les
 * trois chemins depuis `IMPRIMES`, par `id` : si un id disparaît ou perd son
 * premier fichier public, le lien correspondant disparaît du composeur au lieu
 * de pointer vers un 404.
 *
 * Vérifié par mutation dans `liens-email.spec.ts` : chercher un `id` qui n'a
 * jamais existé dans `IMPRIMES` rend `null`, jamais un lien inventé.
 */

import { IMPRIMES } from "@/content/imprimes";
import { SITE_URL } from "@/lib/site-url";
import { estLienCalendlyValide } from "@/lib/calendly/lien-valide";

export interface LienInsertion {
  readonly id: string;
  readonly label: string;
  readonly url: string;
}

/** Le chemin PUBLIC du premier fichier d'un imprimé, ou `null` s'il n'existe pas. */
function cheminPublic(id: string): string | null {
  return IMPRIMES.find((i) => i.id === id)?.fichiersPublics[0]?.chemin ?? null;
}

/** Les trois imprimés proposés au composeur, avec leur libellé d'insertion. */
const IMPRIMES_PROPOSES: ReadonlyArray<{ id: string; label: string }> = [
  { id: "depliant-formations", label: "Catalogue des prestations" },
  { id: "flyer-a5", label: "Flyer A5" },
  { id: "devenir-apporteur", label: "Devenir apporteur" },
];

/**
 * Les liens d'imprimés à proposer au composeur — un par imprimé RÉELLEMENT
 * présent dans le référentiel, avec un fichier public. Jamais de lien mort :
 * un id qui disparaîtrait de `IMPRIMES` (renommage, retrait) fait disparaître
 * son bouton plutôt que d'insérer une URL qui 404.
 */
export function liensImprimesPourEmail(origine: string = SITE_URL): readonly LienInsertion[] {
  const base = origine.replace(/\/+$/, "");
  const liens: LienInsertion[] = [];
  for (const spec of IMPRIMES_PROPOSES) {
    const chemin = cheminPublic(spec.id);
    if (!chemin) continue;
    liens.push({ id: spec.id, label: spec.label, url: `${base}/${chemin}` });
  }
  return liens;
}

/**
 * Le lien « Réserver un échange », s'il est CONFIGURÉ et VALIDE — jamais un
 * bouton qui insérerait un lien vide ou mal formé.
 *
 * 🔑 Réutilise `CALENDLY_APPORTEUR_URL` : c'est le seul lien Calendly que la
 * plateforme connaît aujourd'hui (décision Will, 2026-09-23) — en poser un
 * second, dédié au recrutement, aurait dupliqué un secret de configuration
 * pour un seul et même usage : proposer un échange de vive voix.
 */
export function lienCalendlyPourEmail(
  url: string | undefined,
  valide: (u: string) => boolean = estLienCalendlyValide,
): LienInsertion | null {
  if (!url || !valide(url)) return null;
  return { id: "calendly-echange", label: "Réserver un échange", url };
}

/** Les liens d'insertion complets, imprimés + Calendly (si configuré). */
export function liensInsertionComposeur(calendlyUrl: string | undefined): readonly LienInsertion[] {
  const calendly = lienCalendlyPourEmail(calendlyUrl);
  return calendly ? [...liensImprimesPourEmail(), calendly] : liensImprimesPourEmail();
}
