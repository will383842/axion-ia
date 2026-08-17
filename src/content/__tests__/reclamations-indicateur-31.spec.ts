/**
 * Garde-fou — procédure publiée « difficultés, réclamations et aléas » (off.31).
 *
 * Audit blanc Qualiopi du 2026-08-15 : le champ d'application publié sur
 * /reclamations ne couvrait qu'UN des trois objets nommés par l'indicateur 31
 * du RNQ V9 (« les difficultés, réclamations et ALÉAS survenus en cours de
 * prestation »). Le mot « aléa » n'apparaissait dans aucun texte publié, alors
 * même que le registre des incidents est opérationnel en base.
 *
 * Un texte de contenu qui perd une phrase ne casse RIEN : le site compile, la
 * page rend, les tests passent, et l'écart ne se découvre que devant
 * l'auditeur. Ce fichier est là pour qu'il rougisse. Chaque assertion
 * correspond à une exigence nommée, pas à une tournure : si la rédaction
 * évolue, adapter la regex — pas supprimer le cas.
 *
 * ── Quatre familles de vérifications ───────────────────────────────────────
 *   1. LES TROIS OBJETS de l'indicateur 31 sont nommés au champ d'application.
 *   2. LE TRAITEMENT DES ALÉAS est décrit : déclarant, délai, enregistrement
 *      au registre des incidents, mesures de remédiation, information des
 *      parties. Le vocabulaire du registre doit rester aligné sur les énums
 *      Prisma (IncidentType / IncidentGravite / IncidentStatut).
 *   3. AUCUN DÉLAI DE DÉPÔT n'est opposé au réclamant — la clause « 10 jours
 *      ouvrés » du livret d'accueil a été retirée le même jour, la procédure
 *      publiée ne doit pas la réintroduire par une autre porte.
 *   4. ÉTANCHÉITÉ MÉDIATION : aucun médiateur de la consommation n'est nommé
 *      tant qu'aucune adhésion n'est prise, et les TROIS pages publiques qui
 *      constatent cette absence (réclamations, CGV, mentions légales) disent
 *      la même chose. Nommer un médiateur inexistant sur un support opposable
 *      est plus grave que le silence.
 */
import { describe, it, expect } from "vitest";
import { getLegal } from "@/content/legal";

const REC_FR = getLegal("reclamations").fr;
const CGV_FR = getLegal("conditions-generales").fr;
const MENTIONS_FR = getLegal("mentions-legales").fr;

/** Corps concaténé de toutes les sections FR, pour les recherches globales. */
const CORPS = REC_FR.sections.map((s) => `${s.title}\n${s.body}`).join("\n\n");

/** Retrouve une section par son titre exact ; échoue explicitement si absente. */
function section(page: typeof REC_FR, titre: string): string {
  const found = page.sections.find((s) => s.title === titre);
  if (!found) {
    throw new Error(
      `Section « ${titre} » introuvable. Titres présents :\n` +
        page.sections.map((s) => `  - ${s.title}`).join("\n"),
    );
  }
  return found.body;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Les trois objets de l'indicateur 31
// ─────────────────────────────────────────────────────────────────────────────

describe("off.31 — les trois objets du libellé officiel sont nommés", () => {
  it("« difficultés », « réclamations » et « aléas » figurent au champ d'application", () => {
    // L'auditeur COFRAC cherche littéralement les trois mots du libellé.
    const b = section(REC_FR, "Objet et champ d'application");
    expect(b).toMatch(/difficultés/);
    expect(b).toMatch(/réclamations/);
    expect(b).toMatch(/aléas survenus en cours de prestation/);
  });

  it("chacun des trois objets est DÉFINI, pas seulement cité", () => {
    // Citer les trois mots sans les définir ne vaut pas mieux : le champ
    // d'application doit dire ce qui entre dans chaque catégorie.
    const b = section(REC_FR, "Objet et champ d'application");
    expect(b).toMatch(/Une difficulté est/);
    expect(b).toMatch(/Une réclamation s'entend de/);
    expect(b).toMatch(/Un aléa est un événement imprévu/);
  });

  it("l'intro et le titre SEO portent les trois objets", () => {
    // La page se découvre par son intro et par la SERP ; les trois mots doivent
    // y être, sinon la recherche « aléas » sur le site ne ramène rien.
    for (const texte of [REC_FR.intro, REC_FR.metaSeo.title, REC_FR.metaSeo.description]) {
      expect(texte).toMatch(/difficultés/i);
      expect(texte).toMatch(/réclamations/i);
      expect(texte).toMatch(/aléas/i);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Traitement des aléas
// ─────────────────────────────────────────────────────────────────────────────

describe("off.31 — traitement des aléas décrit", () => {
  it("déclarant identifié + délai de 24 heures ouvrées au responsable qualité", () => {
    const b = section(REC_FR, "Aléas survenus en cours de prestation");
    expect(b).toMatch(/déclaré au responsable qualité/);
    expect(b).toMatch(/24 heures ouvrées/);
    expect(b).toMatch(/incombe au formateur ou à l'intervenant/);
  });

  it("enregistrement systématique au registre des incidents", () => {
    const b = section(REC_FR, "Aléas survenus en cours de prestation");
    expect(b).toMatch(/systématiquement enregistré au registre des incidents/);
  });

  it("le vocabulaire du registre reste aligné sur les énums Prisma", () => {
    // 🔴 IncidentType / IncidentGravite / IncidentStatut (schema.prisma). Décrire
    // le registre autrement qu'il n'est tenu vaut moins que ne pas le décrire :
    // l'auditeur ouvre l'export PDF et compare aux libellés publiés.
    const b = section(REC_FR, "Aléas survenus en cours de prestation");
    expect(b).toMatch(/pédagogique, administratif, technique ou autre/);
    expect(b).toMatch(/mineure, majeure ou critique/);
    expect(b).toMatch(/ouvert, en cours, résolu/);
    expect(b).toMatch(/action corrective/);
  });

  it("les trois mesures de remédiation sont publiées", () => {
    // Limitatives et réellement praticables : un engagement publié se constate.
    const b = section(REC_FR, "Aléas survenus en cours de prestation");
    expect(b).toMatch(/report de la séquence ou de la session sans frais/);
    expect(b).toMatch(/remplacement du formateur/);
    expect(b).toMatch(/séquence de rattrapage/);
  });

  it("information du stagiaire, du client ET du financeur", () => {
    const b = section(REC_FR, "Aléas survenus en cours de prestation");
    expect(b).toMatch(/stagiaire/);
    expect(b).toMatch(/entreprise cliente/);
    expect(b).toMatch(/financeur/);
    expect(b).toMatch(/sont informés de l'aléa, de la mesure retenue/);
  });

  it("les deux registres sont nommés à la section de suivi", () => {
    const b = section(REC_FR, "Suivi, registres et amélioration continue");
    expect(b).toMatch(/registre des réclamations/);
    expect(b).toMatch(/registre des incidents/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Aucun délai de dépôt opposé au réclamant
// ─────────────────────────────────────────────────────────────────────────────

describe("off.31 — aucun délai de dépôt opposé au réclamant", () => {
  it("l'absence de délai de dépôt est énoncée explicitement", () => {
    const b = section(REC_FR, "Comment signaler une difficulté ou déposer une réclamation");
    expect(b).toMatch(/Aucun délai de dépôt n'est opposé au réclamant/);
    expect(b).toMatch(/pendant le déroulement de la prestation comme après son terme/);
  });

  it("aucune formule de forclusion sur le DÉPÔT ne réapparaît", () => {
    // 🔴 Le livret d'accueil imposait « dans un délai de 10 jours ouvrés suivant
    // la situation litigieuse » (retiré le 2026-08-15). Un délai de dépôt rend
    // irrecevable la réclamation qui arrive après le solde de la formation,
    // c'est-à-dire précisément celle que l'auditeur cherche.
    expect(CORPS).not.toMatch(/suivant la situation litigieuse/i);
    expect(CORPS).not.toMatch(/dans un délai de \d+ jours? ouvrés? suivant/i);
    expect(CORPS).not.toMatch(/passé ce délai[^.]*(?:irrecevable|forclos)/i);
  });

  it("la frontière avec le délai contractuel des CGV est dite", () => {
    // Les CGV portent un délai de forclusion de 90 jours réservé au Client
    // professionnel. Sans cette phrase, les deux textes publiés se démentent.
    const b = section(REC_FR, "Comment signaler une difficulté ou déposer une réclamation");
    expect(b).toMatch(/responsabilité contractuelle/);
    expect(b).toMatch(/sans effet sur la recevabilité/);
    // Le délai contractuel existe toujours côté CGV — s'il disparaît, cette
    // phrase de délimitation devient orpheline et doit être relue.
    expect(section(CGV_FR, "Délai de réclamation sur une prestation")).toMatch(
      /quatre-vingt-dix \(90\) jours/,
    );
  });

  it("les délais de RÉPONSE, eux, restent publiés", () => {
    // Ne pas opposer de délai au réclamant ne dispense pas d'en tenir un soi-même.
    const b = section(REC_FR, "Délais de traitement");
    expect(b).toMatch(/5 jours ouvrés/);
    expect(b).toMatch(/15 jours ouvrés/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Voies de recours externes + étanchéité médiation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Médiateurs de la consommation référencés au CECMC, cités ici uniquement pour
 * être INTERDITS tant qu'aucune adhésion n'est prise. Liste non exhaustive :
 * elle attrape le copier-coller le plus probable, pas toutes les inventions
 * possibles — d'où la vérification de cohérence des trois pages ci-dessous,
 * qui, elle, ne dépend d'aucune liste.
 */
const MEDIATEURS_INTERDITS =
  /\b(CM2C|Medicys|CNPM|MEDIATION[- ]CONSOMMATION|AME CONSO|Devigny|CMAP|Sas Médiation Solution)\b/i;

/** Constat d'absence d'adhésion à un dispositif de médiation. */
const CONSTAT_SANS_ADHESION = /n['’]a\b[^.]*adhér[ée]/;

describe("off.31 — voies de recours externes publiées", () => {
  it("la section existe et ne renvoie pas seulement aux conditions générales", () => {
    // Avant correction, la procédure se refermait sur « les dispositions prévues
    // par les conditions générales » : un auditeur y lit une absence de recours.
    const b = section(REC_FR, "Voies de recours externes");
    expect(b).toMatch(/voies de recours de droit commun/);
    expect(b).toMatch(/tribunal compétent/);
  });

  it("le contrôle DREETS et le financeur sont cités comme recours externes", () => {
    const b = section(REC_FR, "Voies de recours externes");
    expect(b).toMatch(/DREETS/);
    expect(b).toMatch(/L\.6361-1/);
    expect(b).toMatch(/le financeur peut être saisi/);
  });

  it("le recours au certificateur est conditionné à la détention de la certification", () => {
    // 🔴 Axion-IA est NOUVEL ENTRANT : affirmer au présent qu'elle est certifiée
    // serait faux sur un support public. La phrase doit rester conditionnelle.
    const b = section(REC_FR, "Voies de recours externes");
    expect(b).toMatch(/lorsque Axion-IA est titulaire de la certification Qualiopi/i);
    expect(b).not.toMatch(/Axion-IA est certifiée Qualiopi/i);
  });

  it("AUCUN médiateur de la consommation n'est nommé", () => {
    // ⚠️ Tant qu'aucune adhésion n'est prise (art. L.612-1), nommer un médiateur
    // sur une page publique est une affirmation fausse sur un support opposable.
    expect(CORPS).not.toMatch(MEDIATEURS_INTERDITS);
    expect(section(REC_FR, "Voies de recours externes")).toMatch(
      /adhéré à aucun dispositif de médiation/,
    );
  });

  it("les trois pages publiques disent la MÊME chose sur l'adhésion", () => {
    // 🔴 Le jour de l'adhésion, ces trois textes doivent bouger ENSEMBLE. Ce cas
    // rougit dès qu'un seul est mis à jour — c'est le seul contrôle ici qui ne
    // dépende pas d'une liste de noms.
    const constats = {
      "/reclamations → Voies de recours externes": CONSTAT_SANS_ADHESION.test(
        section(REC_FR, "Voies de recours externes"),
      ),
      "/conditions-generales → Particulier — médiation de la consommation":
        CONSTAT_SANS_ADHESION.test(section(CGV_FR, "Particulier — médiation de la consommation")),
      "/mentions-legales → Médiation de la consommation": CONSTAT_SANS_ADHESION.test(
        section(MENTIONS_FR, "Médiation de la consommation"),
      ),
    };
    const valeurs = new Set(Object.values(constats));
    expect(
      valeurs.size,
      "Divergence entre pages publiques sur l'adhésion à un médiateur :\n" +
        Object.entries(constats)
          .map(([k, v]) => `  ${v ? "absence d'adhésion constatée" : "adhésion supposée"} — ${k}`)
          .join("\n"),
    ).toBe(1);
  });
});
