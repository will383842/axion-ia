import { describe, expect, it } from "vitest";

// Contrat 2.7 (09/10/2026) : lot 1 de l'analyse juridique du 09/10 (quinze corrections) et
// décisions de Will (conservation des données par critères, préavis progressif, prorata de 3.6). Un test par
// correction, vérifié sur le texte : présence de la formule nouvelle, absence de l'ancienne.

import { deuxCases } from "../contrat-pdf";
import { CONTRAT_V2_MARKDOWN, CONTRAT_VERSION } from "../contrat-v2";
import { signeAvant26 } from "../etablissement-presentation";

// Sans gras, italique ni retours à la ligne : on lit les phrases, pas la mise en forme.
const net = CONTRAT_V2_MARKDOWN.replace(/\*+/g, "").replace(/\s+/g, " ");

/** Le texte d'un article, du titre « ### Article n — » au suivant. */
function article(n: string): string {
  const debut = net.indexOf(`### Article ${n} —`);
  if (debut < 0) throw new Error(`article ${n} absent`);
  const fin = net.indexOf("### ", debut + 4);
  return fin < 0 ? net.slice(debut) : net.slice(debut, fin);
}

describe("contrat 2.7 — version", () => {
  it("version 2.7, inscrite dans le texte signé (titre) ; deux cases et pas de règle d'avant 2.6", () => {
    expect(CONTRAT_VERSION).toBe("2.7");
    expect(net.startsWith(`## Contrat d'apporteur d'affaires — version ${CONTRAT_VERSION}`)).toBe(
      true,
    );
    expect(deuxCases(CONTRAT_VERSION)).toBe(true);
    expect(signeAvant26({ version: CONTRAT_VERSION })).toBe(false);
    expect(signeAvant26({ version: "2.6" })).toBe(false);
  });
});

describe("contrat 2.7 — les quinze corrections", () => {
  it("1. art. 14 : plus de « case distincte », renvoi à la case « J'ai lu le contrat et je l'accepte »", () => {
    const a14 = article("14");
    expect(a14).not.toContain("case distincte");
    expect(a14).not.toContain("acceptation distincte");
    expect(a14).toContain("« J'ai lu le contrat et je l'accepte »");
    expect(a14).toContain(
      "spécifiée de façon très apparente (article 48 du code de procédure civile)",
    );
    expect(a14).toContain("{{APPORTEUR_QUALITE}}");
  });

  it("2. 3.1 : l'entreprise déclarée s'entend de l'établissement ; 3.6 restreint ; 12.1 en établissements", () => {
    expect(net).toContain(
      "Aux articles 3.2 à 3.5 et 3.7, l'entreprise déclarée s'entend de l'établissement déclaré.",
    );
    expect(net).toContain(
      "L'établissement qui commande est celui au profit duquel la prestation est commandée ; à défaut de pouvoir le déterminer, celui dont le numéro SIRET figure sur le devis ou la commande, puis celui qui figure sur la fiche du client.",
    );
    expect(net).toContain("au profit du personnel de l'établissement attribué");
    expect(net).toContain("Aucune autre société du groupe n'est rattachée d'office");
    expect(net).not.toContain("L.233-3");
    expect(net).toContain("les établissements correspondants redeviennent librement déclarables");
  });

  it("3. 3.2 / 3.7 : la personne qui a rencontré le client est nommée, et ce nom peut être communiqué", () => {
    expect(net).toContain("nom de la personne qui a rencontré ou joint ce représentant");
    expect(net).toContain("à défaut d'une telle indication, cette personne est l'Apporteur");
    expect(net).toContain("ce message peut aussi indiquer le nom de cette personne");
    expect(net).toContain(
      "lui-même ou par la personne agissant pour son compte que la déclaration nomme",
    );
  });

  it("4. 4.6 et 5.4 : suspension du parrainage bornée à 15 jours, liste fermée des reports", () => {
    expect(net).toContain(
      "la suspension ne peut excéder quinze jours à compter de sa notification, et à l'expiration de ce délai elle est levée de plein droit",
    );
    expect(net).not.toContain("vérification, dans les conditions de l'article 3.7 ;");
    expect(net).toContain(
      "Un versement ne peut être différé que dans les cas suivants, limitativement énumérés",
    );
    expect(net).toContain(
      "(e) la vérification d'un lien de parrainage, dans la limite de quinze jours",
    );
    expect(net).toContain("Aucun autre motif ne peut différer un versement.");
  });

  it("5. 12.3 : les commandes signées avant une annulation postérieure à la confirmation restent commissionnées", () => {
    expect(net).toContain(
      "Lorsque cette annulation ou cette extinction intervient après la confirmation de l'attribution, les commandes signées avant elle restent commissionnées",
    );
  });

  it("6. un seul régime d'échéance : jour d'acquisition (4.0), autofacture (5.1), échéance de l'émission (5.3)", () => {
    expect(net).toContain(
      "le jour d'acquisition de la commission est le plus tardif du jour de l'encaissement intégral et du jour de la réalisation de la prestation",
    );
    expect(net).toContain(
      "5.1 — Autofacture. Le jour d'acquisition d'une commission (article 4.0)",
    );
    expect(net).toContain(
      "autofacture est le trentième jour suivant son émission, laquelle a lieu dans les conditions de l'article 5.1",
    );
    expect(net).not.toContain("laquelle a lieu le jour de l'encaissement intégral");
    expect(net).not.toContain("court à compter de ce rattachement");
    expect(net).toContain(
      "2.1 bis Chaque autofacture est établie dans les conditions de l'article 5.1",
    );
    expect(net).not.toContain("la date de l'encaissement intégral comme date de la prestation");
  });

  it("7. 8.6 anti-corruption, et 4.5 bis y renvoie", () => {
    expect(net).toContain("8.6 — Probité.");
    expect(net).toContain("aucun avantage indu");
    expect(net).toContain("ou à l'article 8.6 (corruption)");
  });

  it("8. survie (21), manquements (11.2), renvoi 2.6 (3.5), délai de 15 jours (2.8)", () => {
    expect(article("21")).toContain(
      "Les articles 2.6, 3.1, 3.3, 3.5, 3.6, 3.7, 4, 5, 6.2, 6.3, 6.5, 6.6, 7, 8.1 alinéa 2, 8.5, 8.6, 9, 12, 13.2, 14, 15, 16, 17,",
    );
    expect(net).toContain("au titre des articles 2.6, 3.7, 3.8, 6.1, 6.3,");
    expect(net).toContain("des préposés de l'Apporteur mentionnés à l'article 2.6.");
    expect(net).toContain(
      "(articles 3.1, y compris le délai de quinze jours de rattachement, 3.2,",
    );
  });

  it("9. grille citée à une date fixe ; charte de marque datée", () => {
    expect(net).toContain(
      "Annexe 1 — Grille de commissions du présent contrat, version 2 du {{GRILLE_DATE}}",
    );
    expect(net).toContain(
      "ceux que la Société publiait au {{GRILLE_DATE}}, date de la présente grille",
    );
    expect(net).not.toContain("ceux de la date de la version");
    expect(net).toContain("Chaque version de la charte est datée");
  });

  it("10. annexe 1 : plus de dégressivité, une seule ligne d'audits à 30 %, forfait clarifié — taux inchangés", () => {
    expect(net).not.toContain("dégressivité");
    expect(net).toContain("| Tous les audits | à partir de 1 190 € | 30 % |");
    expect(net).not.toContain("Audit ciblé — solo");
    expect(net).toContain("soit 250 € HT pour une demi-journée");
    expect(net).toContain("15 % du montant hors taxes facturé");
  });

  it("11. 22 bis.3 : Qualiopi dans les termes exacts (L.6352-13), image d'un tiers", () => {
    expect(net).toContain("Il ne se prévaut de la certification Qualiopi de la Société");
    expect(net).toContain("que dans les termes exacts qu'elle lui fournit");
    expect(net).toContain("(article L.6352-13 du code du travail)");
    expect(net).toContain(
      "Il n'utilise l'image, le nom ou la voix d'un tiers qu'avec l'autorisation",
    );
    expect(net).toContain("les visuels que la Société lui remet");
  });

  it("12. facture électronique (5.1 bis, 6.3, annexe 2.2) ; plus d'« entrée en vigueur du CIBS »", () => {
    expect(net).toContain("5.1 bis — Facture électronique.");
    expect(net).toContain("plateforme agréée");
    expect(net).toContain("Un défaut d'acheminement par la plateforme ne diffère aucun versement.");
    expect(net).toContain("courent de l'envoi de ce courrier électronique");
    expect(net).toContain("l'annuaire de la facturation électronique");
    expect(net).toContain("la catégorie de l'opération : « prestation de services »");
    expect(net).not.toContain("(CIBS)");
    expect(net).not.toMatch(/entrée en vigueur du code des impositions/);
    expect(net).toContain(
      "dispositions du code des impositions sur les biens et services relatives à la taxe sur la valeur ajoutée",
    );
  });

  it("13. pas de reprise en cas de faute lourde ou dolosive de la Société ; 4.2 bis borné à 12 mois", () => {
    expect(net).toContain(
      "sauf lorsque l'inexécution procède d'une faute lourde ou dolosive de la Société",
    );
    expect(net).toContain(
      "Aucune reprise n'a lieu non plus lorsque l'annulation, le remboursement ou l'avoir procède d'une faute lourde ou dolosive de la Société.",
    );
    expect(net).toContain(
      "La suspension ne peut excéder douze mois à compter de la réception de la contestation",
    );
  });

  it("14. 6.3 : retenue de l'article 182 B du CGI à la charge de l'Apporteur ; changement de résidence sous 15 jours", () => {
    expect(net).toContain(
      "la retenue à la source prévue à l'article 182 B du code général des impôts",
    );
    expect(net).toContain("est supportée par l'Apporteur");
    expect(net).toContain(
      "L'Apporteur déclare qu'il préviendra la Société dans les quinze jours s'il change de pays de résidence fiscale.",
    );
  });

  it("15. 2.8 sans doublon de l'encaissement ; 13.4 recodification", () => {
    const a2 = article("2");
    expect(a2).toContain("L'encaissement s'entend au sens de l'article 4.0.");
    expect(a2).not.toContain("quel que soit le moyen de paiement du client");
    expect(net.match(/quel que soit le moyen de paiement du client/g)).toHaveLength(1);
    expect(net).toContain(
      "Tout renvoi du présent contrat à un texte légal ou réglementaire vise aussi le texte qui, à la suite d'une recodification ou d'une renumérotation, le remplace.",
    );
  });
});

describe("contrat 2.7 — décisions de Will du 09/10", () => {
  it("A. 7.2 : conservation par critères, sans purge automatique, sans « échéance fixée à l'avance »", () => {
    expect(net).not.toContain("sans échéance fixée à l'avance");
    expect(net).not.toContain("aussi longtemps qu'elle poursuit cette activité");
    expect(net).toContain(
      "tant que ces données restent exactes et que la personne exerce la fonction pour laquelle elles ont été recueillies, et jusqu'à son opposition ou sa demande d'effacement ; elles ne sont pas supprimées automatiquement.",
    );
  });

  it("B. 11.1 : préavis progressif de la Société (30, 60, 90 jours), 30 jours pour l'Apporteur, durée indéterminée", () => {
    const a11 = article("11");
    expect(a11).toContain("Le préavis est de trente jours lorsque l'Apporteur résilie.");
    expect(a11).toContain(
      "il est de trente jours pendant la première année du contrat, de soixante jours pendant la deuxième année et de quatre-vingt-dix jours à compter de la troisième année",
    );
    expect(article("10")).toContain("durée indéterminée");
  });

  it("C. aucun plafond de responsabilité de la Société n'est ajouté", () => {
    expect(net).not.toMatch(/responsabilité de la Société est (plafonnée|limitée)/);
  });

  it("D. 3.6 : une commande partagée avec d'autres établissements est commissionnée au prorata des participants", () => {
    const a3 = article("3");
    const debut = a3.indexOf("3.6 — Groupes de sociétés.");
    const a36 = a3.slice(debut, a3.indexOf("3.7 — Sincérité", debut));
    expect(a36).toContain(
      "la commission est calculée sur la seule part du prix qui correspond aux participants de l'établissement attribué, au prorata de leur nombre sur le nombre total de participants à la commande, et arrondie au centime supérieur.",
    );
    expect(a36).toContain(
      "Ces nombres sont arrêtés par la Société d'après la liste d'inscription à la prestation.",
    );
  });
});
