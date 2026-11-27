/**
 * Aperçu exact d'un e-mail d'apporteur (vrai gabarit, rien n'est envoyé).
 *
 * 🔴 Ce module importe `server-only` (via `./apercu-masque`) : il ne doit JAMAIS être atteint
 * par le worker BullMQ (tsx, hors de Next). C'est pourquoi `apercu()` n'est pas dans `./envois`,
 * que le cron des apporteurs charge (Sentry AXION-IA-25).
 */
import "server-only";

import type { ApercuLecteur } from "@/lib/email/apercu-lecteur";
import { texteParDefaut } from "@/lib/email/templates/apporteur-demarrage";
import type { ApercuRendu as ApercuRenduMonde } from "@/server/email/envoi-monde";

import { apercuMasque } from "./apercu-masque";
import { avecLienEspace, type EnvoiApporteur, type GabaritApporteur } from "./envois";

/**
 * L'aperçu exact d'un e-mail, plus (si modifiable) son texte par défaut en texte brut.
 * 🔴 `html` et `apercu` sont MASQUÉS (aucun jeton ; liens personnels sans `href`) : ils quittent le serveur.
 */
export type ApercuRendu = ApercuRenduMonde<GabaritApporteur> & { apercu: ApercuLecteur };

/**
 * Rend avec le vrai destinataire et la charge EXACTE que `envoyer` met en file (lien d'espace
 * recalculé compris), par `renderEmailTemplate` comme le worker ; puis masque et rend inerte.
 */
export async function apercu(
  e: Pick<
    EnvoiApporteur,
    "gabarit" | "destinataire" | "payload" | "entityType" | "entityId" | "attachments"
  >,
): Promise<ApercuRendu> {
  const payload = await avecLienEspace(e as EnvoiApporteur);
  const rendu = await apercuMasque(e.gabarit, "fr", payload, e.destinataire, e.attachments);
  // Le texte par défaut se calcule SANS le texte réécrit : « Texte d'origine » reste possible.
  const { texteLibre: _ignore, ...sansTexte } = e.payload;
  const texteDefaut = texteParDefaut(e.gabarit, sansTexte);
  return {
    gabarit: e.gabarit,
    sujet: rendu.sujet,
    html: rendu.html,
    destinataire: e.destinataire,
    apercu: rendu.apercu,
    ...(typeof texteDefaut === "string" ? { texteDefaut } : {}),
  };
}
