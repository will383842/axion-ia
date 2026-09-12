// @vitest-environment node

/**
 * Tests — `pilotage-formateurs.ts`, le module qui répond à « qu'est-ce qu'on
 * doit, à qui, échu ou à venir ».
 *
 * ## 🔴 Ce module n'avait AUCUN test, et il décide de ce qu'on verse
 *
 * Il alimente l'écran de pilotage de la console, la fiche de chaque formateur,
 * et — depuis cette PR — l'espace du formateur lui-même. Trois surfaces, une
 * seule source, et rien qui la tienne. `typecheck` en vérifiait les FORMES ;
 * aucune assertion n'en vérifiait les DÉCISIONS.
 *
 * Ce qui se joue ici n'est pas de l'affichage :
 *
 *  · l'ordre de la liste dit dans quel ordre on paie — et un retard coûte des
 *    pénalités là où une grosse somme non échue n'en coûte aucune ;
 *  · le `mode` dit quel GESTE faire : chercher une facture, ou porter une ligne
 *    sur une paie. Les confondre envoie l'opérateur réclamer une facture à
 *    quelqu'un qui n'en émettra jamais ;
 *  · l'absence d'échéance sur une ligne de paie est une DÉCISION : lui en
 *    inventer une ferait apparaître des « retards » qui n'existent pas.
 *
 * ## Ce que ces tests ne font pas
 *
 * ⚠️ Ils ne re-testent pas `deroulerAvanceRecuperable` ni `joursDeRetard` — ces
 * deux-là ont leurs propres tests, et les rejouer ici donnerait une seconde
 * définition du même calcul. On vérifie le BRANCHEMENT : que ce module les
 * appelle, avec les bonnes entrées, et rende leur résultat sans le retoucher.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockStatementFindMany = vi.fn();
const mockTrainerFindMany = vi.fn();
const mockTrainerFindUnique = vi.fn();
const mockFeeLineFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainerStatement: { findMany: (...a: unknown[]) => mockStatementFindMany(...a) },
    trainer: {
      findMany: (...a: unknown[]) => mockTrainerFindMany(...a),
      findUnique: (...a: unknown[]) => mockTrainerFindUnique(...a),
    },
    trainerFeeLine: { findMany: (...a: unknown[]) => mockFeeLineFindMany(...a) },
  },
}));

import {
  listDuFormateurs,
  lireRemunerationDuFormateur,
  lireSituationFixe,
} from "./pilotage-formateurs";

/** 15 septembre 2026, midi UTC. Toutes les dates des cas s'y réfèrent. */
const MAINTENANT = new Date("2026-09-15T12:00:00.000Z");

function releve(o: Record<string, unknown> = {}) {
  return {
    id: "rel-1",
    statut: "facture_recue",
    periodeYear: 2026,
    periodeMonth: 8,
    totalTtcCents: 120_000,
    dateFacture: new Date("2026-09-01T00:00:00.000Z"),
    // 30 jours après la facture : échéance au 01/10, donc PAS en retard le 15/09.
    echeanceAt: new Date("2026-10-01T00:00:00.000Z"),
    payeAt: null,
    autofactureAt: null,
    autofactureTransmiseAt: null,
    trainerId: "f-indep",
    trainer: { nom: "Durand", prenom: "Alex", statut: "sous_traitant" },
    ...o,
  };
}

function salarie(o: Record<string, unknown> = {}) {
  return {
    id: "f-sal",
    nom: "Martin",
    prenom: "Camille",
    statut: "salarie",
    fixeMensuelBrutCents: 200_000,
    avanceRepriseCents: 0,
    ...o,
  };
}

function ligneAnalytique(o: Record<string, unknown> = {}) {
  return {
    trainerId: "f-sal",
    periodeYear: 2026,
    periodeMonth: 9,
    montantHtCents: 250_000,
    ...o,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockStatementFindMany.mockResolvedValue([]);
  mockTrainerFindMany.mockResolvedValue([]);
  mockTrainerFindUnique.mockResolvedValue(null);
  mockFeeLineFindMany.mockResolvedValue([]);
});

// ─────────────────────────────────────────────────────────────────────────────
// Robustesse au stub de build
// ─────────────────────────────────────────────────────────────────────────────

describe("robustesse au stub de build", () => {
  it("listDuFormateurs rend [] quand la base est absente", async () => {
    // ⚠️ Les DEUX branches doivent tomber : une seule en échec rendrait une
    // liste à moitié vraie, ce qui est pire qu'une liste vide — l'écran
    // annoncerait « rien à payer aux salariés » sur une panne.
    mockStatementFindMany.mockRejectedValue(new Error("no db"));
    mockTrainerFindMany.mockRejectedValue(new Error("no db"));
    await expect(listDuFormateurs(MAINTENANT)).resolves.toEqual([]);
  });

  it("lireSituationFixe rend null quand la base est absente", async () => {
    mockTrainerFindUnique.mockRejectedValue(new Error("no db"));
    await expect(lireSituationFixe("f-sal")).resolves.toBeNull();
  });

  it("lireRemunerationDuFormateur rend null quand la base est absente", async () => {
    mockTrainerFindUnique.mockRejectedValue(new Error("no db"));
    await expect(lireRemunerationDuFormateur("f-sal")).resolves.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Les indépendants
// ─────────────────────────────────────────────────────────────────────────────

describe("les indépendants — une dette exigible, avec une échéance", () => {
  it("un relevé non soldé devient une ligne due, réglée par FACTURE", async () => {
    mockStatementFindMany.mockResolvedValue([releve()]);
    const [l] = await listDuFormateurs(MAINTENANT);
    expect(l?.mode).toBe("facture");
    expect(l?.montantCents).toBe(120_000);
    expect(l?.statementId).toBe("rel-1");
    expect(l?.trainerNom).toBe("Alex Durand");
  });

  it("🔴 une échéance DÉPASSÉE rend un retard en jours", async () => {
    mockStatementFindMany.mockResolvedValue([
      releve({ echeanceAt: new Date("2026-09-05T00:00:00.000Z") }),
    ]);
    const [l] = await listDuFormateurs(MAINTENANT);
    expect(l?.retardJours).toBe(10);
  });

  it("une échéance À VENIR ne rend AUCUN retard", async () => {
    // 🔑 Témoin négatif indispensable : un calcul qui rendrait toujours un
    // nombre ferait apparaître tout le monde en retard, et l'écran de pilotage
    // deviendrait du bruit qu'on apprend à ignorer.
    mockStatementFindMany.mockResolvedValue([releve()]);
    const [l] = await listDuFormateurs(MAINTENANT);
    expect(l?.retardJours).toBeNull();
  });

  it("🔴 une autofacture ÉMISE mais jamais TRANSMISE est signalée", async () => {
    // L'état dangereux du circuit : la pièce existe, le formateur ne l'a pas
    // reçue, et personne n'a donc ouvert son délai de contestation. Payer là
    // dessus perdrait la quatrième condition de régularité.
    mockStatementFindMany.mockResolvedValue([
      releve({ autofactureAt: new Date("2026-09-01T00:00:00.000Z") }),
    ]);
    const [l] = await listDuFormateurs(MAINTENANT);
    expect(l?.autofactureNonTransmise).toBe(true);
  });

  it("une autofacture TRANSMISE ne l'est pas", async () => {
    mockStatementFindMany.mockResolvedValue([
      releve({
        autofactureAt: new Date("2026-09-01T00:00:00.000Z"),
        autofactureTransmiseAt: new Date("2026-09-02T00:00:00.000Z"),
      }),
    ]);
    const [l] = await listDuFormateurs(MAINTENANT);
    expect(l?.autofactureNonTransmise).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Les salariés et dirigeants
// ─────────────────────────────────────────────────────────────────────────────

describe("les salariés — un complément de PAIE, sans échéance", () => {
  it("🔴 le mode est `paie` et l'échéance est NULLE", async () => {
    // ⚠️ L'absence d'échéance est une DÉCISION, pas un oubli : la paie a son
    // propre calendrier, et lui en inventer une ferait apparaître des retards
    // qui n'existent pas — sur des gens qu'on paie à l'heure.
    mockTrainerFindMany.mockResolvedValue([salarie()]);
    mockFeeLineFindMany.mockResolvedValue([ligneAnalytique()]);
    const [l] = await listDuFormateurs(MAINTENANT);
    expect(l?.mode).toBe("paie");
    expect(l?.echeance).toBeNull();
    expect(l?.retardJours).toBeNull();
    expect(l?.statementId).toBeNull();
  });

  it("le montant dû est le COMPLÉMENT, pas les commissions brutes", async () => {
    // 2 500 € de commissions imputées sur 2 000 € de fixe → 500 € de complément.
    // Rendre 2 500 € ferait verser DEUX FOIS le fixe.
    mockTrainerFindMany.mockResolvedValue([salarie()]);
    mockFeeLineFindMany.mockResolvedValue([ligneAnalytique()]);
    const [l] = await listDuFormateurs(MAINTENANT);
    expect(l?.montantCents).toBe(50_000);
  });

  it("🔴 c'est le complément DU DERNIER MOIS, jamais le CUMUL des mois passés", async () => {
    /*
      🔑 CE TÉMOIN EST NÉ D'UNE MUTATION QUI N'A PAS ROUGI.

      Le cas précédent n'a qu'UN mois — et sur un seul mois, « complément du
      mois » et « cumul des compléments » valent la même chose. Remplacer l'un
      par l'autre ne changeait donc rien, et le test passait vert sur un module
      qui aurait versé la somme de tous les mois d'un coup.

      Deux mois suffisent à les séparer : 500 € en août, 700 € en septembre.
      La paie de septembre doit porter 700 €, pas 1 200 €.
    */
    mockTrainerFindMany.mockResolvedValue([salarie()]);
    mockFeeLineFindMany.mockResolvedValue([
      ligneAnalytique({ periodeMonth: 8, montantHtCents: 250_000 }),
      ligneAnalytique({ periodeMonth: 9, montantHtCents: 270_000 }),
    ]);
    const [l] = await listDuFormateurs(MAINTENANT);
    expect(l?.montantCents).toBe(70_000);
    expect(l?.periodeMonth, "la ligne se rattache au DERNIER mois déroulé").toBe(9);
  });

  it("🔴 un mois SOUS le fixe ne crée aucun complément, mais une dette à rattraper", async () => {
    mockTrainerFindMany.mockResolvedValue([salarie()]);
    mockFeeLineFindMany.mockResolvedValue([ligneAnalytique({ montantHtCents: 150_000 })]);
    const [l] = await listDuFormateurs(MAINTENANT);
    expect(l?.montantCents).toBe(0);
    expect(l?.avanceResteCents).toBe(50_000);
  });

  it("🔑 un salarié à l'équilibre exact ne figure PAS dans la liste", async () => {
    // Rien à verser, rien à rattraper : l'afficher chaque mois à zéro
    // apprendrait à survoler la liste — et c'est là qu'on rate un vrai retard.
    mockTrainerFindMany.mockResolvedValue([salarie()]);
    mockFeeLineFindMany.mockResolvedValue([ligneAnalytique({ montantHtCents: 200_000 })]);
    await expect(listDuFormateurs(MAINTENANT)).resolves.toEqual([]);
  });

  it("un salarié sans AUCUNE ligne commissionnée ne figure pas non plus", async () => {
    mockTrainerFindMany.mockResolvedValue([salarie()]);
    mockFeeLineFindMany.mockResolvedValue([]);
    await expect(listDuFormateurs(MAINTENANT)).resolves.toEqual([]);
  });

  it("⚠️ un DIRIGEANT est traité comme un salarié, pas oublié", async () => {
    // L'asymétrie a déjà failli être introduite côté console : tester
    // l'appartenance positive à « salarié » l'aurait exclu, alors qu'il peut
    // animer des formations contre un fixe exactement comme lui.
    mockTrainerFindMany.mockResolvedValue([salarie({ id: "f-dir", statut: "dirigeant" })]);
    mockFeeLineFindMany.mockResolvedValue([ligneAnalytique({ trainerId: "f-dir" })]);
    const [l] = await listDuFormateurs(MAINTENANT);
    expect(l?.statut).toBe("dirigeant");
    expect(l?.mode).toBe("paie");
  });

  it("🔴 et il est bien CHERCHÉ EN BASE : le filtre de la requête le nomme", async () => {
    /*
      🔑 SECOND TÉMOIN NÉ D'UNE MUTATION MUETTE.

      Le cas ci-dessus ne prouve rien du filtre : le mock rend ce qu'on lui dit
      de rendre, quel que soit le `where`. Retirer « dirigeant » de la requête
      laissait donc le test VERT sur un module qui ne l'aurait plus jamais
      trouvé en production.

      Avec un mock, la seule façon d'éprouver un filtre est de LIRE l'argument
      passé. C'est ce que fait ce témoin — et il vaut aussi pour les deux autres
      conditions, qu'un « simplifions la requête » emporterait sans bruit :
      `actif` (un ancien salarié n'attend plus rien) et `fixeMensuelBrutCents`
      non nul (sans fixe, il n'y a pas d'imputation à faire).
    */
    mockTrainerFindMany.mockResolvedValue([]);
    await listDuFormateurs(MAINTENANT);

    const where = (mockTrainerFindMany.mock.calls[0]?.[0] as { where: Record<string, unknown> })
      .where;
    expect(where["statut"]).toStrictEqual({ in: ["salarie", "dirigeant"] });
    expect(where["actif"]).toBe(true);
    expect(where["fixeMensuelBrutCents"]).toStrictEqual({ not: null });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// L'ordre de la liste
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ⚠️ CE QUE CES TROIS TÉMOINS NE COUVRENT PAS, ET IL FAUT LE DIRE.
 *
 * Le comparateur a trois clauses. J'ai muté la PREMIÈRE — « les retards
 * d'abord » — en la neutralisant, et les tests sont restés VERTS. Ce n'est pas
 * une faiblesse des témoins : c'est que cette clause est DÉMONTRABLEMENT
 * redondante avec la deuxième.
 *
 * `retardJours` dérive de l'échéance : il décroît quand l'échéance s'éloigne.
 * Deux lignes en retard sont donc toujours dans le même ordre selon l'une ou
 * l'autre. Et une ligne en retard face à une ligne SANS échéance (la paie) est
 * placée devant par la troisième clause, qui dit déjà « ce qui n'a pas
 * d'échéance ferme la marche ».
 *
 * 🔑 On la GARDE quand même, et on ne fabrique pas un témoin artificiel pour
 * faire croire qu'elle est tenue. Elle énonce l'INTENTION — « un retard coûte
 * des pénalités, il passe devant » — et cette intention devra survivre au jour
 * où l'échéance ne sera plus la seule source de retard (un accord de report, un
 * échéancier négocié). Ce jour-là, la clause cessera d'être redondante, et il
 * faudra un témoin. Écrire ici qu'elle ne l'est pas encore vaut mieux qu'un test
 * vert qui ne prouve rien — c'est exactement le défaut que ce dépôt a payé
 * plusieurs fois.
 */
describe("l'ordre dit dans quel ordre on paie", () => {
  it("🔴 les RETARDS passent devant, du plus ancien au plus récent", async () => {
    mockStatementFindMany.mockResolvedValue([
      releve({ id: "a-venir", echeanceAt: new Date("2026-10-01T00:00:00.000Z") }),
      releve({ id: "retard-court", echeanceAt: new Date("2026-09-10T00:00:00.000Z") }),
      releve({ id: "retard-long", echeanceAt: new Date("2026-08-01T00:00:00.000Z") }),
    ]);
    const ids = (await listDuFormateurs(MAINTENANT)).map((l) => l.statementId);
    expect(ids).toStrictEqual(["retard-long", "retard-court", "a-venir"]);
  });

  it("🔑 à égalité de retard, l'échéance la plus PROCHE passe devant", async () => {
    mockStatementFindMany.mockResolvedValue([
      releve({ id: "lointain", echeanceAt: new Date("2026-12-01T00:00:00.000Z") }),
      releve({ id: "proche", echeanceAt: new Date("2026-09-20T00:00:00.000Z") }),
    ]);
    const ids = (await listDuFormateurs(MAINTENANT)).map((l) => l.statementId);
    expect(ids).toStrictEqual(["proche", "lointain"]);
  });

  it("🔴 une ligne de PAIE, sans échéance, ferme la marche derrière un retard", async () => {
    // ⚠️ Ce n'est pas un jugement sur les personnes : un retard de paiement
    // fournisseur fait courir des pénalités de plein droit, un complément de
    // paie attend le bulletin. L'ordre traduit le COÛT du retard, pas la
    // priorité des gens.
    mockStatementFindMany.mockResolvedValue([
      releve({ id: "retard", echeanceAt: new Date("2026-08-01T00:00:00.000Z") }),
    ]);
    mockTrainerFindMany.mockResolvedValue([salarie()]);
    mockFeeLineFindMany.mockResolvedValue([ligneAnalytique()]);
    const lignes = await listDuFormateurs(MAINTENANT);
    expect(lignes.map((l) => l.mode)).toStrictEqual(["facture", "paie"]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// La lecture de l'espace formateur
// ─────────────────────────────────────────────────────────────────────────────

describe("lireRemunerationDuFormateur — ce que le formateur lit chez lui", () => {
  it("rend le statut, le fixe et le déroulé du mois", async () => {
    mockTrainerFindUnique.mockResolvedValue({
      statut: "salarie",
      fixeMensuelBrutCents: 200_000,
      avanceRepriseCents: 0,
    });
    mockFeeLineFindMany.mockResolvedValue([ligneAnalytique()]);
    const r = await lireRemunerationDuFormateur("f-sal");
    expect(r?.statut).toBe("salarie");
    expect(r?.fixeMensuelBrutCents).toBe(200_000);
    expect(r?.situation?.complementDuMoisCents).toBe(50_000);
  });

  it("🔑 rend le MÊME complément que le pilotage de la console", async () => {
    // 🔴 La propriété qui compte, et la seule qui justifie que les deux
    // surfaces partagent une fonction : l'employeur et le salarié doivent lire
    // la MÊME somme. Deux chemins de calcul finiraient par en annoncer deux —
    // sur la même paie, et c'est le salarié qui découvrirait l'écart.
    mockTrainerFindUnique.mockResolvedValue({
      statut: "salarie",
      fixeMensuelBrutCents: 200_000,
      avanceRepriseCents: 0,
    });
    mockTrainerFindMany.mockResolvedValue([salarie()]);
    mockFeeLineFindMany.mockResolvedValue([ligneAnalytique()]);

    const [cote_console] = await listDuFormateurs(MAINTENANT);
    const cote_formateur = await lireRemunerationDuFormateur("f-sal");
    expect(cote_formateur?.situation?.complementDuMoisCents).toBe(cote_console?.montantCents);
  });

  it("un formateur SANS commission rend une situation nulle, pas des zéros", async () => {
    // Afficher « 0 € » laisserait croire à un calcul fait ; `null` dit qu'il n'y
    // a rien à calculer, et l'écran peut alors le formuler autrement.
    mockTrainerFindUnique.mockResolvedValue({
      statut: "salarie",
      fixeMensuelBrutCents: 200_000,
      avanceRepriseCents: 0,
    });
    mockFeeLineFindMany.mockResolvedValue([]);
    const r = await lireRemunerationDuFormateur("f-sal");
    expect(r?.situation).toBeNull();
    expect(r?.statut).toBe("salarie");
  });

  it("un formateur introuvable rend null", async () => {
    mockTrainerFindUnique.mockResolvedValue(null);
    await expect(lireRemunerationDuFormateur("inconnu")).resolves.toBeNull();
  });

  it("⚠️ un SOUS-TRAITANT rend bien son statut — c'est l'écran qui décide, pas la lecture", async () => {
    // La lecture ne filtre pas : elle DIT le statut. Filtrer ici obligerait
    // chaque appelant à deviner pourquoi il ne reçoit rien.
    mockTrainerFindUnique.mockResolvedValue({
      statut: "sous_traitant",
      fixeMensuelBrutCents: null,
      avanceRepriseCents: null,
    });
    const r = await lireRemunerationDuFormateur("f-indep");
    expect(r?.statut).toBe("sous_traitant");
    expect(r?.fixeMensuelBrutCents).toBeNull();
  });
});
