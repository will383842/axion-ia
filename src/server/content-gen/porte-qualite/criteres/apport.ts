/**
 * B07 : apport original (§ 8). Au moins `apportsMin` apports DISTINCTS, marqués dans le texte
 * source et vérifiés. Un marqueur dont le contenu ne passe pas sa vérification ne compte pas.
 * Le type D ne compte que si une donnée réelle existe (`donneeProprePresente`), jamais simulée.
 * Qualiopi, CPF et RNCP ne sont jamais un « angle » : B01 les refuse déjà.
 */

import { extraireApports, type ApportMarque, type TypeApport } from "../apports";
import { texteDe } from "../html";
import type { ReglagesPorte } from "../reglages";
import type { ContenuPorte, ContextePorte, ResultatBrut } from "../types";

const RE_EFFECTIF = /\b\d{1,4}\s*(?:salari[ée]s?|personnes|collaborateurs?|employ[ée]s?)\b/i;
const RE_ETIQUETTE_TYPE = /\bexemple\s+type\b|\bcas\s+type\b|\bsituation\s+type\b/i;
const RE_RESULTAT = /\d+(?:[.,]\d+)?\s*(?:%|heures?|h\b|jours?|€|euros?|minutes?)/i;
const RE_ANNEE = /\b20[12]\d\b/;
const RE_ANGLE =
  /\b(?:ai\s*act|r[èe]glement\s+europ[ée]en|employeur|droit\s+du\s+travail|cse\b|fiscal\w*|code\s+du\s+travail|calendrier\s+fran[çc]ais|cnil|rgpd)/i;

function verifier(a: ApportMarque, donneePropre: boolean): string | null {
  const t = texteDe(a.html);
  switch (a.type) {
    case "A":
      if (!RE_EFFECTIF.test(t)) return "exemple sans effectif de l'entreprise";
      if (!(RE_ETIQUETTE_TYPE.test(t) || RE_RESULTAT.test(t))) {
        return "exemple sans résultat chiffré ni étiquette « exemple type »";
      }
      return null;
    case "B": {
      if (!/\d/.test(t)) return "chiffre sourcé sans nombre";
      if (!/<a\b[^>]*href\s*=\s*["']https?:\/\//i.test(a.html))
        return "chiffre sans lien vers la source";
      if (!RE_ANNEE.test(t)) return "chiffre sans date de la source";
      return null;
    }
    case "C":
      return RE_ANGLE.test(t) ? null : "angle sans point propre au contexte français";
    case "D":
      return donneePropre
        ? null
        : "donnée propre indisponible : aucune donnée réelle (jamais simulée)";
  }
}

export function evaluerB07(c: ContenuPorte, x: ContextePorte, r: ReglagesPorte): ResultatBrut {
  const apports = extraireApports(c.corpsHtml);
  if (apports.length === 0) {
    return {
      statut: "echec",
      raison: `Aucun apport original marqué : ${r.apportsMin} apports distincts exigés.`,
      preuves: [],
    };
  }
  const valides = new Set<TypeApport>();
  const preuves: string[] = [];
  for (const a of apports) {
    const refus = verifier(a, x.donneeProprePresente === true);
    if (refus === null) {
      valides.add(a.type);
      preuves.push(`${a.type} : vérifié`);
    } else {
      preuves.push(`${a.type} : ${refus}`);
    }
  }
  if (valides.size < r.apportsMin) {
    return {
      statut: "echec",
      raison: `${valides.size} apport(s) distinct(s) vérifié(s), ${r.apportsMin} exigés.`,
      preuves,
    };
  }
  return { statut: "ok", raison: null, preuves };
}
