// Le piège anti-bot laisse enfin une trace.
//
// ── LE PROBLÈME ─────────────────────────────────────────────────────────────
//
// Sept formulaires publics portent le même champ leurre (`name="website"`,
// cf. `components/forms/HoneypotField.tsx`) et, quand il est rempli, sortent
// tous de la même façon :
//
//     if (formData.get("website")) return { ok: true };   // succès SILENCIEUX
//
// C'est le bon comportement face à un robot : lui répondre « c'est envoyé »
// n'apprend rien à son auteur, là où une erreur lui indiquerait quoi corriger.
//
// 🔴 Mais c'est aussi, mot pour mot, ce que l'en-tête de `HoneypotField`
// désigne comme « le pire des deux modes de panne, et il ne laisse aucune
// trace » : si le piège se referme sur un HUMAIN — gestionnaire de mots de
// passe qui ignore les marqueurs `data-1p-ignore`, navigateur exotique,
// extension de remplissage — cette personne lit « c'est envoyé », ne reçoit
// rien, et **personne ne le saura jamais**. Ni journal, ni compteur, ni alerte.
//
// Constaté le 2026-09-01 : quatre soumissions du formulaire guide n'ont créé
// AUCUN job d'e-mail. Il a fallu ouvrir la console, compter les jobs, relire
// l'action serveur et remonter le composant pour comprendre. Un humain à qui
// ça arrive n'aura ni le temps ni les moyens de faire ça — il partira.
//
// ── CE QUE FAIT CE MODULE, ET CE QU'IL NE FAIT PAS ──────────────────────────
//
// Il NE DÉSARME PAS le piège : l'appelant sort exactement comme avant, avec le
// même succès silencieux côté visiteur. Il rend seulement l'événement VISIBLE
// côté serveur, sur la sortie standard du conteneur.
//
// Il ne journalise NI l'adresse e-mail, NI la valeur saisie dans le leurre :
// la première est une donnée personnelle, la seconde peut en contenir une (un
// gestionnaire de mots de passe y verse ce qu'il croit être le site web de la
// personne). Seuls le formulaire concerné et la forme de la valeur sont tracés
// — c'est ce qui permet de distinguer un robot d'un remplissage automatique.
//
// ── COMMENT LIRE LA TRACE ───────────────────────────────────────────────────
//
// Dans les journaux Coolify de l'application web, chercher `[honeypot]`.
//
//   - Quelques lignes par jour, valeurs en `url` → des robots. Normal.
//   - Un pic, ou des valeurs qui ressemblent à un domaine plausible → un
//     remplissage automatique attrape des humains. Il faut alors durcir
//     `HoneypotField` (renommer le champ, ajouter des marqueurs) plutôt que
//     retirer le piège.

/** Ce qu'on retient de la valeur, sans jamais la publier telle quelle. */
function formeDe(valeur: string): string {
  const v = valeur.trim();
  if (v === "") return "vide";
  if (/^https?:\/\//i.test(v)) return "url";
  if (/^[\w.-]+@[\w.-]+$/.test(v)) return "email";
  if (/^[\w-]+(\.[\w-]+)+$/.test(v)) return "domaine";
  if (/^\+?[\d\s().-]{6,}$/.test(v)) return "telephone";
  return `texte(${v.length})`;
}

/**
 * Signale qu'un formulaire a été rejeté par le champ leurre.
 *
 * À appeler JUSTE AVANT le `return` de succès silencieux — jamais à la place :
 * le comportement visible par l'appelant ne change pas.
 *
 * @param formulaire  Nom du formulaire, pour retrouver la source (« newsletter »).
 * @param valeur      Contenu du leurre. N'est PAS journalisé : seule sa forme l'est.
 */
export function signalerHoneypot(formulaire: string, valeur: FormDataEntryValue | null): void {
  const brut = typeof valeur === "string" ? valeur : "(fichier)";
  console.warn(
    `[honeypot] ${formulaire} : soumission rejetée, champ leurre rempli ` +
      `(forme : ${formeDe(brut)}). Le visiteur a reçu un succès silencieux et ` +
      `RIEN n'a été enregistré. Si ces lignes se multiplient ou portent une ` +
      `forme plausible, c'est un remplissage automatique qui attrape des ` +
      `humains — durcir HoneypotField, ne pas retirer le piège.`,
  );
}
