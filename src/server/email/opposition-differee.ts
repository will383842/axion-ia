// Jeton d'opposition DIFFÉRÉ — chantier e-mails, fiche I2-0 (2026-11-18).
//
// Les réponses écrites à la main figent leur corps (HTML + texte) en base au moment de la
// saisie. Y écrire le vrai jeton d'opposition, c'est écrire l'adresse de la personne en clair
// (`op1` = base64url) hors de la colonne chiffrée. À la place, le rendu pose un REPÈRE neutre,
// et le worker le remplace, au départ seulement, par le jeton du destinataire déchiffré.
//
// Module PUR : il n'importe rien (pas de `server-only`), il tourne dans le worker.
// Il ne journalise rien : ni jeton, ni adresse.

/**
 * Majuscules seulement : ni React, ni html-to-text, ni `encodeURIComponent` ne le transforment.
 * Sans préfixe `op1.` / `op2.` : parti tel quel, `/api/unsubscribe` répondrait « lien invalide ».
 */
export const REPERE_JETON_OPPOSITION = "AXIONREPEREOPPOSITIONAUDEPART";

/** Même base que `urlOpposition` (un test garde l'alignement). */
export function urlRepereOpposition(): string {
  const siteUrl = process.env["NEXT_PUBLIC_SITE_URL"] ?? "https://axion-ia.com";
  return `${siteUrl}/api/unsubscribe?token=${REPERE_JETON_OPPOSITION}`;
}

/**
 * Remplace chaque `token=<repère>` par `token=<jeton encodé>`. `split/join` et non `replace` :
 * un jeton ne doit jamais être lu comme un motif de remplacement (`$&`). Sans repère, rend le
 * corps à l'identique (`poses: 0`) ; idempotente, un jeton ne contenant jamais le repère.
 */
export function poserJetonOpposition(
  corps: { html: string; text: string },
  jeton: string,
): { html: string; text: string; poses: number } {
  const motif = `token=${REPERE_JETON_OPPOSITION}`;
  const par = `token=${encodeURIComponent(jeton)}`;
  const html = corps.html.split(motif);
  const text = corps.text.split(motif);
  return {
    html: html.join(par),
    text: text.join(par),
    poses: html.length - 1 + (text.length - 1),
  };
}
