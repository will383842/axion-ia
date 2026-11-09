import { describe, expect, it } from "vitest";

import {
  CONDITION_GARANTIE,
  GARANTIE_PHRASE,
  RAPPORT_COMPLET,
  gainExempleEur,
  remplacerJetons,
} from "@/content/journee-ia-commun";
import { JOURNEE_IA_TIER } from "@/content/pricing";
import { META_DESCRIPTION_MAX } from "@/lib/seo";
import {
  CONTENU,
  DEBUT_PROMESSE,
  DESCRIPTION_META,
  GARANTIE,
  JETON_PRIX,
  LIBELLE_CTA,
  OG_IMAGE_ALT,
  TEXTES_ANNEXES,
  TITRE,
} from "../contenu";

/** Clés qui ne portent pas de texte lu : icônes, noms de fichier, liens, titre mis en couleur. */
const SANS_TEXTE = new Set(["icone", "image", "url", "lienHref", "ancre", "titreAccent"]);

/** Tous les textes visibles d'une valeur, à plat. */
function textes(valeur: unknown, cle = ""): string[] {
  if (typeof valeur === "string") return SANS_TEXTE.has(cle) ? [] : [valeur];
  if (Array.isArray(valeur)) return valeur.flatMap((v) => textes(v, cle));
  if (valeur && typeof valeur === "object") {
    return Object.entries(valeur).flatMap(([k, v]) => (SANS_TEXTE.has(k) ? [] : textes(v, k)));
  }
  return [];
}

const mots = (t: string) => t.split(/\s+/).filter((m) => /[\p{L}\d]/u.test(m));
/** Les mots tels que le lecteur les voit : les jetons sont résolus avant le décompte. */
const compte = (liste: string[]) => liste.reduce((n, t) => n + mots(remplacerJetons(t)).length, 0);

const { faq, ...sansFaq } = CONTENU;
const horsFaq = textes(sansFaq);
const toutLeTexte = [...textes(CONTENU), ...textes(TEXTES_ANNEXES), TITRE, DESCRIPTION_META];
const tout = toutLeTexte.join("\n");

/** Mots visibles de CONTENU hors FAQ, re-mesurés le 09/11/2026 après la nouvelle carte des gains (était 872). */
const MOTS_MESURES = 948;
/** Mots du premier écran (l'accroche, sans le titre mis en couleur), mesurés de même. */
const MOTS_PREMIER_ECRAN = 204; // re-mesuré le 09/11/2026 (nouvelle carte des gains ; était 183)

describe("Journée IA — contenu.ts", () => {
  it("tient dans une fourchette de mots (plancher −10 %, plafond +5 % : pas de « blockhaus »)", () => {
    const n = compte(horsFaq);
    expect(n).toBeGreaterThanOrEqual(Math.floor(MOTS_MESURES * 0.9));
    expect(n).toBeLessThanOrEqual(Math.ceil(MOTS_MESURES * 1.05));
  });

  it("porte 194 à 214 mots au premier écran (accroche sans le titre accentué)", () => {
    const n = compte(textes(CONTENU.accroche));
    expect(n).toBeGreaterThanOrEqual(MOTS_PREMIER_ECRAN - 10);
    expect(n).toBeLessThanOrEqual(MOTS_PREMIER_ECRAN + 10);
  });

  it("n'a qu'un seul libellé de bouton : « Réserver un appel »", () => {
    expect(LIBELLE_CTA).toBe("Réserver un appel");
    expect(CONTENU.accroche.cta).toBe(LIBELLE_CTA);
    expect(CONTENU.rendezVous.cta).toBe(LIBELLE_CTA);
    const cles = JSON.stringify(CONTENU).match(/"cta":"[^"]*"/g) ?? [];
    expect(cles.length).toBeGreaterThanOrEqual(2);
    expect(new Set(cles).size).toBe(1);
    // Le lien secondaire a son propre nom.
    expect(CONTENU.accroche.lienDecide).toBe("Déjà décidé\u202f? Fixons la date ensemble");
  });

  it("a onze sections, dans l'ordre de la page", () => {
    expect(Object.keys(CONTENU)).toEqual([
      "accroche",
      "enBref",
      "pourQui",
      "deroule",
      "recevez",
      "calcul",
      "prix",
      "aiAct",
      "qui",
      "faq",
      "rendezVous",
    ]);
  });

  it("ne contient aucun mot interdit", () => {
    expect(tout).not.toMatch(/\bWill\b/);
    expect(tout).not.toMatch(/\bETI\b/);
    expect(tout).not.toMatch(/\bSaaS\b/i);
    expect(tout).not.toMatch(/\bCPF\b/);
    expect(tout).not.toMatch(/\bOPCO\b/i);
    for (const interdit of [
      "Qualiopi",
      "certifi",
      "certificat",
      "conforme",
      "conformité",
      "obligatoire",
      "Nos limites",
      "Ni label",
      "financement",
      "amende",
      "offert",
      "valeur de",
      "satisfait ou remboursé",
      "intégrateur",
      "no-code",
      "TPE/PME",
      "Grenoble",
      "Aucun gain garanti",
      "Vous êtes remboursé",
      "même prix pour tous",
      "3 à 4 h",
      "3 à 4\u00a0h",
    ]) {
      expect(tout.toLowerCase(), interdit).not.toContain(interdit.toLowerCase());
    }
  });

  it("héros : quatre tuiles, dont « L’après-midi » (formation + attestation par personne) en deuxième", () => {
    const { tuiles } = CONTENU.accroche;
    expect(tuiles).toHaveLength(4);
    expect(tuiles[1]).toEqual({
      valeur: "L’après-midi",
      legende: "formation + attestation par personne",
      attestation: true,
    });
  });

  it("« Ce que vous recevez » : l'attestation passe en premier, mise en valeur, avec sa phrase", () => {
    const { elements } = CONTENU.recevez;
    expect(elements).toHaveLength(6);
    expect(elements[0]).toMatchObject({
      titre: "Une attestation de formation par personne",
      texte: "Chaque participant repart avec une attestation de formation nominative et datée.",
      vedette: true,
    });
    // Une seule carte mise en valeur, et l'attestation n'apparaît plus en 5e position.
    expect(elements.filter((e) => "vedette" in e)).toHaveLength(1);
    expect(elements.filter((e) => e.titre.includes("attestation"))).toHaveLength(1);
  });

  it("AI Act : « Nos limites » est remplacé par « Une attestation par personne formée »", () => {
    const { cartes } = CONTENU.aiAct;
    expect(cartes).toHaveLength(3);
    expect(cartes.map((x) => x.titre)).not.toContain("Nos limites");
    expect(cartes[2]).toMatchObject({
      icone: "dossier",
      titre: "Une attestation par personne formée",
      texte:
        "Nominative et datée, remise à chaque participant : la trace écrite d’une mesure prise au titre de l’article 4 de l’AI Act.",
      attestation: true,
    });
    expect(tout).not.toContain("Ni label, ni statut");
  });

  it("écrit « 2 à 4 h » d'audit, jamais « 3 à 4 h »", () => {
    expect(tout).toMatch(/2 à 4[\u00a0 ]h/);
  });

  it("n'écrit aucun montant : ni symbole €, ni chiffre de prix", () => {
    expect(tout).not.toContain("€");
    // « en heures et en euros » est un libellé ; c'est un nombre suivi de « euros » qui est un montant.
    expect(tout).not.toMatch(/\d[\s\u00a0\u202f]*(euros?|eur)\b/i);
    expect(tout).not.toMatch(/\b1[\s\u00a0\u202f.]?490\b/);
    expect(tout).not.toMatch(/\b9[\s\u00a0\u202f.]?450\b/);
  });

  it("utilise le jeton de prix, et seulement des jetons connus", () => {
    const json = JSON.stringify(CONTENU);
    expect(json).toContain(JETON_PRIX);
    const connus = new Set([
      "{{PRIX}}",
      "{{GAIN_EXEMPLE}}",
      "{{TAUX_HORAIRE}}",
      "{{HEURES_EXEMPLE}}",
    ]);
    const trouves = json.match(/\{\{[^}]*\}\}/g) ?? [];
    expect(trouves.length).toBeGreaterThan(0);
    for (const j of trouves) expect(connus.has(j), j).toBe(true);
    // Tous les jetons se résolvent : aucun `{{` n'atteint la page.
    expect(remplacerJetons(json)).not.toContain("{{");
    expect(remplacerJetons(DESCRIPTION_META)).not.toContain("{{");
    expect(remplacerJetons(OG_IMAGE_ALT)).not.toContain("{{");
  });

  it("« moins de deux mois de ces heures » reste vrai : le prix est sous deux mois de l'exemple", () => {
    expect(CONTENU.prix.ancre).toContain("moins de deux mois");
    expect(JOURNEE_IA_TIER.priceFlat!).toBeLessThan((gainExempleEur() * 2) / 12);
  });

  it("le ruban et son libellé sont dans la carte des gains", () => {
    const carte = CONTENU.accroche.carteDesGains;
    expect(carte.ruban.heures).toHaveLength(4);
    expect(carte.ariaLabelRuban).toMatch(/^Déroulé/);
    expect(JSON.stringify(CONTENU.deroule)).not.toContain("ariaLabelRuban");
  });

  it("le calcul de l'exemple passe par les trois jetons", () => {
    const phrase = JSON.stringify(CONTENU.calcul);
    expect(phrase).toContain("{{HEURES_EXEMPLE}}");
    expect(phrase).toContain("{{TAUX_HORAIRE}}");
    expect(phrase).toContain("{{GAIN_EXEMPLE}}");
  });

  it("reprend la garantie mot pour mot, d'une seule constante", () => {
    // Le texte historique, déplacé dans le module commun, reste exporté tel quel.
    expect(GARANTIE).toBe(
      "À la fin de la journée, vous recevez votre rapport complet : vos gains chiffrés, les tâches à automatiser classées par rentabilité, et votre plan d’action sur 90 jours. Si les gains identifiés ne dépassent pas 3 fois le prix de la journée, nous vous remboursons, sans discussion, sous 30 jours.",
    );
    // La page affiche la phrase de remboursement, la condition, puis le rapport (sans doublon).
    expect(GARANTIE_PHRASE).toBe(
      "Si les gains identifiés ne dépassent pas 3 fois le prix de la journée, nous vous remboursons, sans discussion, sous 30 jours.",
    );
    expect(GARANTIE.endsWith(GARANTIE_PHRASE)).toBe(true);
    expect(CONTENU.prix.garantie).toBe(GARANTIE_PHRASE);
    expect(CONTENU.prix.condition).toBe(CONDITION_GARANTIE);
    expect(CONTENU.prix.rapport).toBe(RAPPORT_COMPLET);
    expect(GARANTIE_PHRASE).toContain(DEBUT_PROMESSE);
    expect(CONTENU.prix.titreGarantie).toBe(
      "Pas 3 fois le prix en gains identifiés\u202f? Nous vous remboursons.",
    );
    // La FAQ répète la phrase et la condition, mot pour mot.
    const faqGarantie = faq.find((f) => f.id === "faq-garantie");
    expect(faqGarantie?.reponse).toBe(`${GARANTIE_PHRASE} ${CONDITION_GARANTIE}`);
    // La précision « gains identifiés : calculés sur un an… » n'est pas encore validée.
    expect(JSON.stringify(CONTENU)).not.toMatch(/calculés sur un an/);
  });

  it("a treize questions, aux identifiants uniques", () => {
    expect(faq).toHaveLength(13);
    const ids = faq.map((f) => f.id);
    expect(new Set(ids).size).toBe(13);
    for (const id of ids) expect(id).toMatch(/^faq-[a-z-]+$/);
    expect(new Set(faq.map((f) => f.question)).size).toBe(13);
    for (const f of faq) expect(f.question.endsWith("?"), f.id).toBe(true);
  });

  it("annonce « jusqu’à 15 personnes » dans la FAQ", () => {
    const personnes = faq.find((f) => f.id === "faq-personnes");
    expect(personnes?.reponse).toContain("jusqu’à 15 personnes");
  });

  it("cite le règlement (UE) 2026/1744, jamais 2024/1689/oj ni CELEX", () => {
    const json = JSON.stringify(CONTENU);
    expect(json).toContain("2026/1744");
    expect(CONTENU.aiAct.source.url).toBe("https://eur-lex.europa.eu/eli/reg/2026/1744/oj");
    expect(json).not.toContain("2024/1689/oj");
    expect(json).not.toContain("CELEX");
    expect(json).not.toContain("rdv=journee");
  });

  it("garde la meta description sous le plafond, titre compris", () => {
    // Le cliquet `meta-description-longueur.spec.ts` ne mesure pas une valeur calculée.
    expect(remplacerJetons(DESCRIPTION_META).length).toBeLessThanOrEqual(META_DESCRIPTION_MAX);
    expect(TITRE).toBe("La Journée IA : audit et formation IA en PME · Axion-IA");
    expect(TITRE.length).toBeLessThanOrEqual(60);
  });

  it("le « En bref » est celui du module commun", () => {
    expect(CONTENU.enBref.startsWith("La Journée IA est une journée d’audit et de formation")).toBe(
      true,
    );
    expect(CONTENU.enBref).toContain("{{PRIX}}");
  });
});
