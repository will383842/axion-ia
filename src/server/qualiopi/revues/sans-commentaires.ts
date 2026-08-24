/**
 * Retire les commentaires d'une source TypeScript, en conservant les littéraux
 * de chaîne.
 *
 * ## Pourquoi ce module existe, et pourquoi il n'est pas dans un `.spec.ts`
 *
 * Les gardes STATIQUES de ce dépôt lisent du code source et y cherchent des
 * formes. Elles se sont fait piéger quatre fois par la même chose : le
 * commentaire du correctif **cite le défaut corrigé** — c'est la pratique
 * constante ici, pour que le prochain lecteur sache ce qui a été payé. Une
 * garde qui cherche dans le fichier entier rougit donc sur la documentation
 * du correctif lui-même. Une garde qui interdit de CITER le défaut interdit
 * de le documenter.
 *
 * Et le sens inverse est plus grave : sans ce filtre, une garde de délégation
 * se satisfait d'un fichier qui se contente de **mentionner** une fonction dans
 * une phrase, sans jamais l'appeler. Retirer les commentaires ne relâche pas une
 * garde — **elle la resserre**.
 *
 * Les littéraux de chaîne sont conservés : un libellé de preuve **est** du code,
 * et c'est précisément lui qu'on surveille.
 *
 * ## Pourquoi il est partagé
 *
 * Deux gardes en ont besoin (`off32-ne-peut-pas-verdir-a-vide.spec.ts` et
 * `tout-manque-off32-est-saisissable.spec.ts`). Un analyseur recopié diverge :
 * ce dépôt l'a payé quatre fois sur des prédicats métier, et il n'y a aucune
 * raison de rejouer le motif sur un analyseur lexical. Un seul exemplaire, ici.
 *
 * Module PUR : aucune I/O, aucune dépendance.
 */
export function sansCommentaires(source: string): string {
  let out = "";
  let i = 0;
  let contexte: "code" | "ligne" | "bloc" | "'" | '"' | "`" = "code";

  while (i < source.length) {
    const c = source[i] as string;
    const suivant = source[i + 1];

    if (contexte === "code") {
      if (c === "/" && suivant === "/") {
        contexte = "ligne";
        i += 2;
        continue;
      }
      if (c === "/" && suivant === "*") {
        contexte = "bloc";
        i += 2;
        continue;
      }
      if (c === "'" || c === '"' || c === "`") contexte = c;
      out += c;
      i += 1;
      continue;
    }

    if (contexte === "ligne") {
      if (c === "\n") {
        contexte = "code";
        out += c;
      }
      i += 1;
      continue;
    }

    if (contexte === "bloc") {
      if (c === "*" && suivant === "/") {
        contexte = "code";
        i += 2;
        continue;
      }
      // On garde les sauts de ligne : les messages d'échec citent des numéros
      // de ligne, et les écraser rendrait le rouge plus difficile à instruire.
      if (c === "\n") out += c;
      i += 1;
      continue;
    }

    // Dans une chaîne : `\` échappe le caractère suivant, y compris le délimiteur.
    if (c === "\\") {
      out += c + (suivant ?? "");
      i += 2;
      continue;
    }
    if (c === contexte) contexte = "code";
    out += c;
    i += 1;
  }

  return out;
}
