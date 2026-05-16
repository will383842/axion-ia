/**
 * HoneypotField — champ leurre anti-bot rendu visuellement caché.
 *
 * Sprint Correctif S+1 (P0-S1-4 2026-05-16) — DRY pour les 6 forms publics.
 *
 * Pattern : `<input name="website">` est laissé vide par les humains et rempli
 * par les bots qui auto-remplissent tous les champs. Côté serveur, on rejette
 * toute submission où `formData.get("website")` n'est pas vide.
 *
 * Accessibilité : `tabIndex={-1}`, `aria-hidden="true"`, `autoComplete="off"`,
 * caché en CSS (off-screen + opacité 0). Les lecteurs d'écran l'ignorent.
 *
 * Doctrine : la valeur n'est PAS enregistrée via `register()` de react-hook-form
 * — l'input est natif HTML. Pour les forms RHF, le check serveur s'effectue
 * via FormData (handler côté serveur) OU via un wrapper qui injecte la valeur
 * lue depuis le DOM dans le payload.
 */

export function HoneypotField(): React.JSX.Element {
  return (
    <input
      type="text"
      name="website"
      tabIndex={-1}
      autoComplete="off"
      aria-hidden="true"
      style={{ position: "absolute", left: "-9999px", opacity: 0 }}
    />
  );
}
