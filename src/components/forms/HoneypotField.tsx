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
      // 🔴 `readOnly` + les marqueurs d'ignorance des gestionnaires de mots de
      // passe. Sans eux, ce champ est un PIÈGE À HUMAINS : il s'appelle
      // « website », il est de type texte, il vit dans un formulaire qui
      // demande nom / email / téléphone — exactement la forme qu'un
      // gestionnaire (1Password, LastPass, Dashlane) ou un profil de
      // remplissage automatique reconnaît comme « site web » et remplit. Or
      // toutes les actions serveur traitent un « website » non vide comme un
      // bot et répondent SUCCÈS SILENCIEUX : la personne lit « Candidature
      // envoyée 🎉 » et rien n'est enregistré. Personne ne s'en plaindra jamais
      // — c'est le pire des deux modes de panne, et il ne laisse aucune trace.
      //
      // `readOnly` ferme la porte au remplissage automatique et au gestionnaire
      // sans désarmer le piège : les robots de formulaire écrivent la valeur en
      // JS (`input.value = …`) ou postent directement le champ, et `readOnly`
      // n'empêche ni l'un ni l'autre.
      readOnly
      data-lpignore="true"
      data-1p-ignore
      data-form-type="other"
      style={{ position: "absolute", left: "-9999px", opacity: 0 }}
    />
  );
}
