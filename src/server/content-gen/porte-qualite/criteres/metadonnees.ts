/** B14 : auteur et dates honnêtes. */

import { nettoyer, texteDe } from "../html";
import type { ContenuPorte, ContextePorte, ResultatBrut } from "../types";

const jour = (d: string): string => d.slice(0, 10);
const valide = (d: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}/.test(d) || Number.isNaN(Date.parse(d))) return false;
  // Refuse un jour inexistant que V8 fait déborder (« 2026-02-30 » → 2 mars).
  return new Date(`${d.slice(0, 10)}T00:00:00Z`).toISOString().slice(0, 10) === d.slice(0, 10);
};

export function evaluerB14(c: ContenuPorte, x: ContextePorte): ResultatBrut {
  // Horloge injectée invalide : on ne compare rien (échec fermé, voir `lancer`).
  if (Number.isNaN(x.maintenant.getTime())) throw new Error("horloge injectée invalide");
  const raisons: string[] = [];
  if (!c.auteur || c.auteur.nom.trim().length === 0) {
    raisons.push("Auteur non identifiable.");
  } else if (c.auteur.type === "Person" && !c.auteur.reel) {
    raisons.push("Auteur présenté comme une personne qui n'est pas réelle (faux auteur).");
  }

  if (!c.datePublished || !valide(c.datePublished)) {
    raisons.push("Date de publication absente ou illisible.");
  } else if (Date.parse(c.datePublished) > x.maintenant.getTime()) {
    raisons.push("Date de publication dans le futur.");
  }

  let nonEvalue: string | null = null;
  if (c.dateModified) {
    if (!valide(c.dateModified)) {
      raisons.push("Date de modification illisible.");
    } else if (Date.parse(c.dateModified) > x.maintenant.getTime()) {
      raisons.push("Date de modification dans le futur.");
    } else if (c.datePublished && jour(c.dateModified) < jour(c.datePublished)) {
      raisons.push("Date de modification antérieure à la date de publication.");
    } else if (!c.datePublished || jour(c.dateModified) !== jour(c.datePublished)) {
      if (x.corpsDejaPublie.etat === "indisponible") {
        nonEvalue = `Corps déjà publié non lu : ${x.corpsDejaPublie.raison}`;
      } else if (x.corpsDejaPublie.valeur === null) {
        raisons.push("Date de modification sur un contenu jamais publié.");
      } else if (texteDe(nettoyer(x.corpsDejaPublie.valeur)) === texteDe(nettoyer(c.corpsHtml))) {
        raisons.push("Date de modification changée alors que le texte est identique.");
      }
    }
  }

  if (raisons.length > 0) return { statut: "echec", raison: raisons.join(" "), preuves: [] };
  if (nonEvalue) return { statut: "non_evalue", raison: nonEvalue, preuves: [] };
  return { statut: "ok", raison: null, preuves: [] };
}
