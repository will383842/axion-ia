/**
 * Validation SIRET — module PUR et isomorphe (zéro dépendance, zéro I/O).
 *
 * Importable indifféremment depuis un composant "use client" et depuis une
 * server action. C'est délibéré, et c'est POUR CELA que Zod n'est pas importé
 * ici : trois formulaires admin tirent ce module côté navigateur, et embarquer
 * Zod dans le bundle pour valider 14 chiffres coûterait plus cher que la règle
 * elle-même (gate `size-limit` : +5 KB gz max vs main). Le champ Zod partagé
 * vit dans `src/lib/siret-schema.ts`, importé uniquement par les actions.
 *
 * PÉRIMÈTRE : format + clé de contrôle. L'EXISTENCE au répertoire SIRENE n'est
 * PAS vérifiée — cela demanderait un appel réseau, et une indisponibilité de
 * l'annuaire empêcherait alors d'enregistrer un client, donc d'émettre une
 * facture. Si la vérification d'existence est un jour souhaitée, elle doit
 * prendre la forme d'un bouton « Vérifier » qui PRÉ-REMPLIT (raison sociale,
 * NAF, adresse) depuis recherche-entreprises.api.gouv.fr — jamais d'un gate de
 * soumission.
 *
 * DEUX FAUSSES EXCEPTIONS, tranchées ici une fois pour toutes :
 * - « SIRET étranger » : cela n'existe pas. Le SIRET est un identifiant du
 *   répertoire SIRENE, tenu par l'INSEE, exclusivement français. Un client hors
 *   France laisse ce champ VIDE ; son identification passe par le n° de TVA
 *   intracommunautaire (`Client.tvaIntracom`, EN 16931 BT-48) et le pays.
 * - « Organisme public » : les personnes morales de droit public françaises
 *   (mairies, universités, CHU, collectivités) SONT immatriculées à SIRENE et
 *   portent un SIRET à clé valide. `Client.estPublic` ne sert qu'au routage
 *   Chorus Pro, il ne dispense d'aucun contrôle.
 * La seule exception RÉELLE est La Poste — cf. `laPosteValid`.
 *
 * ⚠️ Le SIRET reste FACULTATIF partout. Un prospect issu de Calendly ou du
 * formulaire de contact n'en fournit jamais (aucun formulaire public ne le
 * demande). On ne contrôle QUE les valeurs non vides : la seule façon d'être
 * refusé est de saisir quelque chose qui n'est pas un SIRET. Rendre le champ
 * obligatoire casserait tout le funnel d'entrée.
 */

/**
 * Séparateurs tolérés à la saisie : espaces (`\s` couvre déjà l'insécable
 * U+00A0 et la fine U+202F, celles que produit un copier-coller depuis un PDF),
 * points, et tirets Unicode. Un Kbis imprime « 732 829 320 00074 » : refuser
 * cette forme reviendrait à refuser le geste normal de l'administrateur.
 */
const SEPARATEURS = /[\s.‐-―-]/g;

/** Retire les séparateurs de présentation. N'altère jamais les chiffres. */
export function normalizeSiret(raw: string): string {
  return raw.replace(SEPARATEURS, "");
}

/**
 * Clé de Luhn, appliquée de droite à gauche. Vaut pour le SIREN (9 chiffres)
 * comme pour le SIRET (14).
 */
export function luhnValid(digits: string): boolean {
  let sum = 0;
  for (let i = digits.length - 1, rank = 0; i >= 0; i--, rank++) {
    let n = digits.charCodeAt(i) - 48;
    if (rank % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}

/**
 * Exception LA POSTE (SIREN 356 000 000) : ses établissements ne vérifient pas
 * Luhn. Règle INSEE de substitution : la somme des 14 chiffres est un multiple
 * de 5. Sans cette branche, un SIRET La Poste légitime serait refusé.
 *
 * 🔴 La garde sur le préfixe est INDISPENSABLE, pas cosmétique : la somme des
 * chiffres de `00000000000000` vaut 0, donc multiple de 5. Sans le test
 * `startsWith("356000000")`, cette exception rouvrirait exactement le trou que
 * `REPDIGIT` ferme.
 */
function laPosteValid(siret: string): boolean {
  if (!siret.startsWith("356000000")) return false;
  let sum = 0;
  for (let i = 0; i < siret.length; i++) sum += siret.charCodeAt(i) - 48;
  return sum % 5 === 0;
}

/**
 * 🔴 Luhn ACCEPTE `00000000000000` : la somme pondérée vaut 0, et 0 % 10 === 0
 * (vérifié par exécution). Une clé de contrôle seule laisserait donc passer
 * exactement la valeur trouvée en production sur AXI-CLI-002, celle qui a
 * motivé ce module. Ne JAMAIS supprimer ce garde-fou en le croyant redondant
 * avec Luhn — il ne l'est pas. Le test de caractérisation
 * `luhnValid("00000000000000") === true` est là pour figer cette raison.
 */
const REPDIGIT = /^(\d)\1{13}$/;

export type SiretCheckCode = "non_numerique" | "longueur" | "placeholder" | "cle";

export type SiretCheck =
  | { ok: true; value: string }
  | { ok: false; code: SiretCheckCode; message: string };

/**
 * Contrôle format + clé d'un SIRET NON VIDE. Le message est destiné à un
 * administrateur : il doit dire quoi faire, pas seulement que c'est faux.
 */
export function checkSiretFormat(raw: string): SiretCheck {
  const v = normalizeSiret(raw);

  if (!/^\d+$/.test(v)) {
    return {
      ok: false,
      code: "non_numerique",
      message:
        "SIRET : chiffres uniquement. Un n° de TVA intracommunautaire (FR…) n'est pas un SIRET.",
    };
  }
  if (v.length !== 14) {
    return {
      ok: false,
      code: "longueur",
      message: `SIRET : 14 chiffres attendus, ${v.length} saisis. Le SIREN fait 9 chiffres ; le SIRET y ajoute les 5 chiffres du NIC de l'établissement.`,
    };
  }
  if (REPDIGIT.test(v)) {
    return {
      ok: false,
      code: "placeholder",
      message:
        "SIRET : valeur de remplissage refusée. Laissez le champ vide tant que le SIRET réel n'est pas connu — il sera imprimé sur la convention et la facture.",
    };
  }
  if (!luhnValid(v) && !laPosteValid(v)) {
    return {
      ok: false,
      code: "cle",
      message:
        "SIRET : clé de contrôle invalide. Vérifiez la saisie sur annuaire-entreprises.data.gouv.fr. Client hors France : laissez le champ vide, le SIRET est un identifiant français.",
    };
  }
  return { ok: true, value: v };
}
