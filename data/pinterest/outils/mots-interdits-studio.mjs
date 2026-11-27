// Copie PURE de la logique de `motsInterditsEnvoiZernio` du Studio (src/domaine/mots-interdits-envoi.ts,
// branche feat/pinterest-pr6). Sert uniquement à contrôler les épingles avant import dans le Studio.
const J = (...p) => p.join("");
const FAMILLE = J("cert", "ifi");
const NOM_QUALITE = J("quali", "opi");
const RACINES = [
  { libelle: J("cert", "ifié"), motif: new RegExp(`${FAMILLE}(?!cat(?!ion))`) },
  { libelle: J("Quali", "opi"), motif: new RegExp(NOM_QUALITE) },
  { libelle: J("Gre", "noble"), motif: new RegExp(J("gre", "noble")) },
  { libelle: J("Aucun gain ", "garanti"), motif: new RegExp(J("aucun\\s+gain\\s+", "garanti")) },
];
const INVISIBLES = /[­᠎​-‏‪-‮⁠-⁯﻿]|\p{Cf}/gu;
const ESPACES_INSECABLES = /[     ]/g;
const ACCENTS = /[̀-ͯ]/g;
function aplatir(t, insecableSupprimee, separerCamel) {
  const s = t.replace(ESPACES_INSECABLES, insecableSupprimee ? "" : " ").normalize("NFKD").replace(INVISIBLES, "").replace(ACCENTS, "");
  return (separerCamel ? s.replace(/([a-z])([A-Z])/g, "$1 $2") : s).toLowerCase();
}
export function motsInterditsEnvoiZernio(texte) {
  const l = [aplatir(texte, false, true), aplatir(texte, true, true), aplatir(texte, true, false)];
  return RACINES.filter((r) => l.some((n) => r.motif.test(n))).map((r) => r.libelle);
}
