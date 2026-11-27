/** B13 : maillage sortant. Les liens entrants à J+7 relèvent de Q16, pas de la porte. */

import { cheminInterne, liens, nettoyer } from "../html";
import type { ContenuPorte, ContextePorte, ResultatBrut } from "../types";
import type { ReglagesPorte } from "../reglages";

const echec = (raison: string, preuves: string[] = []): ResultatBrut => ({
  statut: "echec",
  raison,
  preuves,
});

export function evaluerB13(c: ContenuPorte, x: ContextePorte, r: ReglagesPorte): ResultatBrut {
  const chemins = [
    ...new Set(
      liens(nettoyer(c.corpsHtml))
        .map((l) => cheminInterne(l.href, x.hotesInternes))
        .filter((p): p is string => p !== null),
    ),
  ];
  // Déterministe d'abord : pas besoin de la source pour constater qu'il en manque.
  if (chemins.length < r.liensInternesMin) {
    return echec(
      `Maillage insuffisant : ${chemins.length} lien(s) interne(s) distinct(s), ${r.liensInternesMin} au moins.`,
      chemins,
    );
  }
  // Chemin relatif (« fr/diagnostic ») accepté : on le ramène à « /fr/diagnostic ».
  const brut = x.pageProprietaire?.trim();
  const proprietaire = brut
    ? cheminInterne(/^(\/|https?:)/i.test(brut) ? brut : `/${brut}`, x.hotesInternes)
    : null;
  if (proprietaire && !chemins.includes(proprietaire)) {
    return echec(`Aucun lien vers la page propriétaire du thème (${proprietaire}).`, chemins);
  }
  if (x.etatLiens.etat === "indisponible") {
    return {
      statut: "non_evalue",
      raison: `Santé des liens non vérifiée : ${x.etatLiens.raison}`,
      preuves: chemins,
    };
  }
  const etats = x.etatLiens.valeur;
  const sains = chemins.filter((p) => etats[p] === "sain");
  if (sains.length < r.liensInternesMin) {
    const pasSains = chemins
      .filter((p) => etats[p] !== "sain")
      .map((p) => `${p} : ${etats[p] ?? "non vérifié"}`);
    return echec(
      `Seulement ${sains.length} lien(s) interne(s) sain(s), ${r.liensInternesMin} au moins.`,
      pasSains,
    );
  }
  return { statut: "ok", raison: null, preuves: sains };
}
