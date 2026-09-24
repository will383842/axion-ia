// Le piège anti-bot laisse enfin une trace — et elle SURVIT au déploiement.
//
// ── LE PROBLÈME ─────────────────────────────────────────────────────────────
//
// Neuf formulaires publics portent le même champ leurre (`name="website"`,
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
// rien, et **personne ne le saura jamais**.
//
// Constaté le 2026-09-01 : quatre soumissions du formulaire guide n'ont créé
// AUCUN job d'e-mail. Il a fallu ouvrir la console, compter les jobs, relire
// l'action serveur et remonter le composant pour comprendre.
//
// ── 🔴 POURQUOI CE FICHIER CHANGE LE 2026-09-24 ─────────────────────────────
//
// La trace existait depuis le 01/09, mais **elle ne se lisait pas**. Elle
// partait sur la sortie standard du conteneur, et cette sortie est REMISE À
// ZÉRO à chaque déploiement. Mesuré le 24/09 : le conteneur applicatif tournait
// depuis 05 h 48, il portait **55 lignes** de journal en tout, et la commande
// qui compte les occurrences de `[honeypot]` rendait **0**.
//
// Ce zéro ne voulait rien dire. Il ne disait pas « aucune perte », il disait
// « je ne peux pas savoir ». Or ce site déploie plusieurs fois par semaine : la
// fenêtre de lecture se comptait en heures, et personne ne regarde dans cette
// fenêtre-là. Un garde-fou qu'on ne peut pas relire est un garde-fou qui
// n'existe pas — c'est exactement le défaut qu'il était censé réparer.
//
// ── CE QUE FAIT CE MODULE, ET CE QU'IL NE FAIT PAS ──────────────────────────
//
// Il NE DÉSARME PAS le piège : l'appelant sort exactement comme avant, avec le
// même succès silencieux côté visiteur.
//
// Il écrit désormais DEUX traces, et les deux ont leur raison d'être :
//   · `console.warn`, immédiat, lisible en direct pendant qu'on débogue ;
//   · une ligne dans `activity_logs`, qui survit aux redéploiements et se
//     compte en SQL sur trois mois.
//
// 🔑 AUCUNE MIGRATION. `ActivityLog` porte déjà tout ce qu'il faut — auteur
//    facultatif, action indexée, champ JSON libre, adresse IP, horodatage
//    indexé. Créer une table pour ça aurait ajouté une migration, donc un
//    risque de dérive de schéma, pour zéro colonne qui n'existe pas déjà.
//
// Il ne journalise NI l'adresse e-mail, NI la valeur saisie dans le leurre :
// la première est une donnée personnelle, la seconde peut en contenir une (un
// gestionnaire de mots de passe y verse ce qu'il croit être le site web de la
// personne). Seuls le formulaire concerné et la FORME de la valeur sont tracés
// — c'est ce qui permet de distinguer un robot d'un remplissage automatique.
//
// ── COMMENT LIRE LA TRACE, MAINTENANT ───────────────────────────────────────
//
//     SELECT date_trunc('day', created_at) AS jour,
//            changes->>'formulaire' AS formulaire,
//            changes->>'forme'      AS forme,
//            count(*)
//     FROM activity_logs
//     WHERE action = 'securite.honeypot.declenche'
//     GROUP BY 1, 2, 3 ORDER BY 1 DESC;
//
//   - quelques lignes par jour, forme `url` → des robots. Normal.
//   - un pic, ou des formes `domaine` / `email` / `telephone` → un remplissage
//     automatique attrape des HUMAINS. Il faut alors durcir `HoneypotField`
//     (renommer le champ, ajouter des marqueurs), jamais retirer le piège.

import { getClientIp } from "@/lib/client-ip";
import { prisma } from "@/lib/prisma";

/**
 * L'action sous laquelle la trace est rangée.
 *
 * Exportée pour que le SQL de lecture et les gardes ne la recopient pas : une
 * chaîne recopiée finit par diverger, et la requête rendrait alors zéro sans
 * que rien ne signale l'écart.
 */
export const ACTION_HONEYPOT = "securite.honeypot.declenche";

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
 * ⚠️ NE LÈVE JAMAIS. Un registre indisponible ne doit pas faire tomber la
 *    réponse d'un formulaire public : le visiteur verrait une erreur là où le
 *    piège est précisément censé ne rien laisser paraître. La sortie conteneur
 *    reste écrite en premier, donc la trace immédiate survit même si la base
 *    est injoignable.
 *
 * @param formulaire  Nom du formulaire, pour retrouver la source (« newsletter »).
 * @param valeur      Contenu du leurre. N'est PAS journalisé : seule sa forme l'est.
 */
export async function signalerHoneypot(
  formulaire: string,
  valeur: FormDataEntryValue | null,
): Promise<void> {
  const brut = typeof valeur === "string" ? valeur : "(fichier)";
  const forme = formeDe(brut);

  console.warn(
    `[honeypot] ${formulaire} : soumission rejetée, champ leurre rempli ` +
      `(forme : ${forme}). Le visiteur a reçu un succès silencieux et ` +
      `RIEN n'a été enregistré. Si ces lignes se multiplient ou portent une ` +
      `forme plausible, c'est un remplissage automatique qui attrape des ` +
      `humains — durcir HoneypotField, ne pas retirer le piège.`,
  );

  try {
    await prisma.activityLog.create({
      data: {
        action: ACTION_HONEYPOT,
        targetType: "FormulairePublic",
        changes: { formulaire, forme },
        ipAddress: await getClientIp(),
      },
    });
  } catch {
    // Silence volontaire : cf. l'avertissement ci-dessus. La ligne
    // `console.warn` est déjà partie, on ne perd donc pas l'information —
    // seulement sa durabilité, et c'est le moindre mal.
  }
}
