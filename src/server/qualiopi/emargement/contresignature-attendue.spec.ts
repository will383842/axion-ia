/**
 * Tests — `contresignature-attendue.ts`.
 *
 * Module PUR : aucun mock, aucun Prisma. Ce fichier est la garde de quatre
 * choses qui se dégradent vite si personne ne les tient :
 *
 * 1. **la règle** — attendue pour `opco` · `cpf` · `france_travail` · `mixte`,
 *    jamais pour `direct` ;
 * 2. **l'honnêteté du libellé** — c'est CONTRACTUEL et VARIABLE, pas
 *    réglementaire. Les mots « obligatoire », « exigé par la loi »,
 *    « réglementaire » sont interdits, et le test les cherche ;
 * 3. **le non-blocage** — le module ne rend qu'un CONSTAT. Aucune fonction ne
 *    rend un refus, aucun champ ne porte un verbe bloquant. Décision de Will du
 *    25/08/2026 : « LA CONTRESIGNATURE PAS BLOQUANTE » ;
 * 4. **la non-duplication de la mesure** — ce module ne recompte RIEN. Il
 *    consomme `bilanContresignature` (`contresignatures-manquantes.ts`), dont
 *    l'en-tête dit : « une seule mesure, trois surfaces ; recompter ailleurs
 *    fabriquerait trois vérités ». Il en fabrique une quatrième lecture, pas un
 *    quatrième calcul.
 *
 * 🔴 Et le point le plus coûteux de l'audit de ce dépôt : **jamais de ratio sur
 * un dénominateur nul**. `dossier-session.ts` a déjà payé « 0/0 conformes »
 * (incident `D3-3-01`, 2026-08-20) — un ratio complet se lit « tout va bien »,
 * même quand il ne mesure rien. Le cas « rien à contresigner » est donc un cas
 * NOMMÉ, pas un compte à zéro.
 */

import { describe, it, expect } from "vitest";
import {
  attenteContresignature,
  constaterContresignature,
  financeursEffectifs,
  FINANCEMENTS,
  type FinancementSession,
} from "./contresignature-attendue";
import type { DemiJourneeAContresigner } from "./contresignatures-manquantes";

const dj = (date: string, demiJournee: "matin" | "apres_midi"): DemiJourneeAContresigner => ({
  date,
  demiJournee,
  formateurId: "f1",
});

/** Financements pour lesquels un tiers paie — donc réclame des pièces. */
const TIERS: FinancementSession[] = ["opco", "cpf", "france_travail", "mixte"];

describe("attenteContresignature — la règle", () => {
  it("attend la contresignature pour chaque financement par un tiers", () => {
    for (const f of TIERS) {
      const a = attenteContresignature({ session: f });
      expect(a.attendue, `financement ${f}`).toBe(true);
      expect(a.financeur, `financement ${f}`).not.toBeNull();
      expect(a.pourquoi.length, `financement ${f}`).toBeGreaterThan(40);
    }
  });

  it("ne l'attend PAS en financement direct — personne d'autre ne paie", () => {
    const a = attenteContresignature({ session: "direct" });
    expect(a.attendue).toBe(false);
    expect(a.financeur).toBeNull();
  });

  it("ne l'attend pas quand le financement n'est pas renseigné", () => {
    // Le bandeau affirme « votre financeur réclamera ». Sans financement
    // renseigné, la prémisse n'est pas établie : on se tait plutôt que
    // d'affirmer au hasard sur toutes les sessions du registre.
    expect(attenteContresignature({ session: null }).attendue).toBe(false);
    expect(attenteContresignature({ session: undefined }).attendue).toBe(false);
    expect(attenteContresignature({ session: null }).financeur).toBeNull();
  });

  it("couvre TOUTE la liste `FinancementType` — pas une valeur de moins", () => {
    // Si quelqu'un ajoute une valeur à l'enum Prisma sans passer ici, ce test
    // rougit : `FINANCEMENTS` est la liste que le module prétend traiter.
    expect([...FINANCEMENTS].sort()).toEqual(
      ["cpf", "direct", "france_travail", "mixte", "opco"].sort(),
    );
    for (const f of FINANCEMENTS) {
      expect(() => attenteContresignature({ session: f })).not.toThrow();
    }
  });

  it("ne rend jamais un financeur nommé quand rien n'est attendu", () => {
    // Un `financeur` non nul sur `attendue: false` laisserait un appelant
    // afficher « votre OPCO » sur une session payée par le client.
    for (const f of [...FINANCEMENTS, null]) {
      const a = attenteContresignature({ session: f });
      expect(a.attendue === (a.financeur !== null), `financement ${f}`).toBe(true);
    }
  });
});

/**
 * 🔴 R-INTER — LE PAYEUR DE LA SESSION N'EST PAS TOUJOURS LE PAYEUR EFFECTIF.
 *
 * Ce bloc est la raison d'être du correctif, et il tient à une valeur par
 * défaut : une session inter-entreprises se crée en `direct` (`sessions.ts`).
 * Ne lire QUE `session.financementType` faisait donc écrire, sur une session
 * dont un inscrit relève d'un OPCO, « aucun financeur tiers ne réclame de
 * pièce » — dans `index.txt`, c'est-à-dire dans la pièce même que l'organisme
 * dépose chez ce financeur. Une affirmation d'absence, fausse, au pire endroit.
 *
 * ⚠️ Ce qui rend ces témoins capables de VOIR la faute n'est pas la force de
 * leurs assertions, c'est leur POPULATION : une fixture sans `parInscription`
 * ne peut rien observer ici, quelle que soit l'assertion qu'on lui accroche.
 * Chaque cas ci-dessous porte donc des inscriptions, sauf celui qui garde
 * explicitement le cas nominal sans inscription.
 */
describe("attenteContresignature — R-INTER : le financement PAR INSCRIPTION", () => {
  /** La phrase que le dossier d'audit ne doit pas écrire quand un tiers paie. */
  const AFFIRMATION_D_ABSENCE = "aucun financeur tiers ne réclame de pièce";

  it("🔴 session `direct`, UN inscrit en OPCO : la contresignature est attendue", () => {
    // Le cas exact qui a motivé le refus de la PR. `direct` n'est pas un choix
    // ici : c'est la valeur POSÉE PAR DÉFAUT à la création de la session.
    const a = attenteContresignature({ session: "direct", parInscription: ["opco"] });
    expect(a.attendue).toBe(true);
    expect(a.financeur).toBe("votre OPCO");
    // 🔑 Le contre-témoin qui compte vraiment : il ne suffit pas que la bonne
    // phrase apparaisse, il faut que la FAUSSE ait disparu.
    expect(a.pourquoi).not.toContain(AFFIRMATION_D_ABSENCE);
  });

  it("dit qu'une PARTIE seulement des inscrits est financée, quand c'est le cas", () => {
    // Le second inscrit n'a pas d'override : il retombe sur la session, donc
    // sur `direct`. La feuille d'émargement est UNE, le dossier du financeur ne
    // l'est pas — taire l'assiette ferait lire « toute la session est
    // financée », faux dans l'autre sens.
    const a = attenteContresignature({ session: "direct", parInscription: ["opco", null] });
    expect(a.attendue).toBe(true);
    expect(a.pourquoi).toContain("Une PARTIE des inscrits");
  });

  it("ne parle PAS de « partie » quand tous les inscrits surchargent en OPCO", () => {
    // Personne ne paie en direct : le financement de la session ne vaut que
    // comme repli, et il n'a ici personne à replier.
    const a = attenteContresignature({ session: "direct", parInscription: ["opco", "opco"] });
    expect(a.attendue).toBe(true);
    expect(a.financeur).toBe("votre OPCO");
    expect(a.pourquoi).not.toContain("Une PARTIE");
  });

  it("ne nomme AUCUN financeur unique quand deux circuits distincts coexistent", () => {
    // Un OPCO et le CPF sur la même feuille : écrire « votre OPCO » désignerait
    // le mauvais interlocuteur à la moitié du dossier.
    const a = attenteContresignature({ session: "direct", parInscription: ["opco", "cpf"] });
    expect(a.attendue).toBe(true);
    expect(a.financeur).toBe("vos financeurs");
    expect(a.pourquoi).not.toContain("votre OPCO");
    expect(a.pourquoi).not.toContain("Caisse des Dépôts");
  });

  it("⚠️ le cas NOMINAL est intact : session OPCO sans aucune inscription chargée", () => {
    // Le vrai risque de SUR-correction. Un appelant qui ne charge pas les
    // inscriptions — ou une session sans inscrit — doit se comporter
    // exactement comme avant : le financement de la session fait foi.
    for (const f of [
      { session: "opco" } as const,
      { session: "opco", parInscription: [] } as const,
    ]) {
      const a = attenteContresignature(f);
      expect(a.attendue, JSON.stringify(f)).toBe(true);
      expect(a.financeur, JSON.stringify(f)).toBe("votre OPCO");
    }
  });

  it("🔴 la session RÉELLE du 05/09 : `direct` + un inscrit SANS override → silence", () => {
    // La configuration en production. Le bandeau ne doit PAS s'y afficher :
    // affirmer « votre financeur réclamera » sur un dossier payé par le client
    // transformerait l'information en bruit, c'est-à-dire en rien.
    const a = attenteContresignature({ session: "direct", parInscription: [null] });
    expect(a.attendue).toBe(false);
    expect(a.financeur).toBeNull();
  });
});

/**
 * 🔴 B1 (revues 5247614532 et 5247629929, sur `faa31dd0c`) — UN INSCRIT DONT ON
 * NE SAIT PAS QUI PAIE N'EST PAS UN INSCRIT PAYÉ EN DIRECT.
 *
 * La correction de F1 résolvait chaque inscription, puis RETIRAIT les
 * inconnues avant de conclure. Session sans financement, inscrits
 * `["direct", null]` : l'inconnue disparaissait, il ne restait que `direct`, et
 * `index.txt` écrivait « aucun financeur tiers ne réclame de pièce » — la même
 * affirmation d'absence que F1, par le cas du financement non renseigné.
 *
 * Le chemin existe : une session récurrente se crée sans financement
 * (`sessions-recurrentes.ts`), et un inscrit peut recevoir un override sans que
 * la session en ait un (`inter-entreprises.ts`).
 *
 * ⚠️ Toutes les populations ci-dessous MÉLANGENT connu et inconnu : c'est ce que
 * le témoin « distingue les DEUX silences » ne faisait pas — il n'essayait que
 * des populations homogènes, et passait donc sur la faute.
 */
describe("attenteContresignature — B1 : un financement INCONNU n'est pas un paiement direct", () => {
  const AFFIRMATION_D_ABSENCE = "aucun financeur tiers ne réclame de pièce";

  it("🔴 session non renseignée, inscrits `[direct, null]` : AUCUNE phrase d'absence", () => {
    const a = attenteContresignature({ session: null, parInscription: ["direct", null] });
    expect(a.attendue).toBe(false);
    expect(a.financeur).toBeNull();
    expect(a.pourquoi).not.toContain(AFFIRMATION_D_ABSENCE);
    expect(a.pourquoi).toContain("non renseigné");
  });

  it("🔴 le bandeau se tait pour « non renseigné », pas pour « payé en direct »", () => {
    const c = constaterContresignature({
      financement: { session: null, parInscription: ["direct", null] },
      signees: 3,
      aContresigner: [dj("2026-09-01", "matin")],
    });
    expect(c.afficher === false && c.raison).toBe("financement_non_renseigne");
  });

  it("🔴 `[opco, null]` : attendue, mais l'assiette n'est PAS affirmée entière", () => {
    // Un tiers est connu : l'avertissement reste dû. Mais écrire « cette session
    // est financée par un tiers » affirmerait l'assiette entière, alors qu'on ne
    // sait pas qui paie pour l'autre inscrit.
    const a = attenteContresignature({ session: null, parInscription: ["opco", null] });
    expect(a.attendue).toBe(true);
    expect(a.financeur).toBe("votre OPCO");
    expect(a.pourquoi).not.toContain("Cette session est financée par un tiers");
    expect(a.pourquoi).toContain("non renseigné");
  });

  it("`[opco, direct, null]` : dit les TROIS parts, sans en taire aucune", () => {
    const a = attenteContresignature({ session: null, parInscription: ["opco", "direct", null] });
    expect(a.attendue).toBe(true);
    expect(a.pourquoi).toContain("Une PARTIE des inscrits");
    expect(a.pourquoi).toContain("en direct");
    expect(a.pourquoi).toContain("non renseigné");
  });

  it("contre-témoin : tous les inscrits CONNUS en direct → l'absence reste dite", () => {
    // Sans ce témoin, un module qui ne dirait plus JAMAIS « aucun financeur
    // tiers » passerait les quatre cas ci-dessus. La session est inconnue, mais
    // chaque inscrit porte son override : personne n'est inconnu.
    const a = attenteContresignature({ session: null, parInscription: ["direct", "direct"] });
    expect(a.attendue).toBe(false);
    expect(a.pourquoi).toContain(AFFIRMATION_D_ABSENCE);
    const c = constaterContresignature({
      financement: { session: null, parInscription: ["direct", "direct"] },
      signees: 3,
      aContresigner: [dj("2026-09-01", "matin")],
    });
    expect(c.afficher === false && c.raison).toBe("non_attendue_par_le_financeur");
  });
});

describe("financeursEffectifs — qui paie RÉELLEMENT", () => {
  it("dédoublonne : trois inscrits d'un même OPCO ne font qu'un financeur", () => {
    expect(
      financeursEffectifs({ session: "direct", parInscription: ["opco", "opco", "opco"] }),
    ).toEqual(["opco"]);
  });

  it("garde un ORDRE stable — la phrase ne doit pas changer d'un rendu à l'autre", () => {
    const entree = { session: "direct", parInscription: ["cpf", "opco", "cpf"] } as const;
    expect(financeursEffectifs(entree)).toEqual(["cpf", "opco"]);
    // Deux appels, même liste : rien ne dépend d'un parcours de `Set` reconstruit.
    expect(financeursEffectifs(entree)).toEqual(financeursEffectifs(entree));
  });

  it("résout chaque inscription sur la session quand elle n'a pas d'override", () => {
    // `null` n'est pas un trou : c'est « comme la session ». L'oublier ferait
    // disparaître des financeurs au lieu de les hériter.
    expect(financeursEffectifs({ session: "opco", parInscription: [null, null] })).toEqual([
      "opco",
    ]);
    expect(financeursEffectifs({ session: "direct", parInscription: [null, "cpf"] })).toEqual([
      "direct",
      "cpf",
    ]);
  });

  it("🔑 rend `[]` — et non `[null]` — quand aucun financeur n'est connu", () => {
    // Un `null` qui survivrait dans la liste ferait compter UN financeur là où
    // il n'y en a aucun, et `constaterContresignature` en tirerait un libellé.
    expect(financeursEffectifs({ session: null, parInscription: [null] })).toEqual([]);
    expect(financeursEffectifs({ session: null })).toEqual([]);
    expect(financeursEffectifs({ session: undefined, parInscription: [undefined] })).toEqual([]);
  });

  it("retombe sur la session quand aucune inscription n'est fournie", () => {
    expect(financeursEffectifs({ session: "opco" })).toEqual(["opco"]);
    expect(financeursEffectifs({ session: "opco", parInscription: [] })).toEqual(["opco"]);
  });
});

describe("attenteContresignature — le libellé est HONNÊTE", () => {
  // 🔴 La contresignature n'est réclamée par AUCUN texte réglementaire : c'est
  // une pièce de la liste CONTRACTUELLE de chaque financeur, et cette liste
  // varie d'un financeur à l'autre. Écrire « obligatoire » ferait croire à une
  // règle de droit, et enverrait l'organisme discuter avec le mauvais
  // interlocuteur le jour d'un refus de règlement.
  const INTERDITS = [
    "obligatoire",
    "obligation légale",
    "exigé par la loi",
    "exigée par la loi",
    "réglementaire",
    "la réglementation impose",
    "impose la loi",
  ];

  it("n'écrit jamais « obligatoire » ni « exigé par la loi »", () => {
    for (const f of [...FINANCEMENTS, null]) {
      const texte = attenteContresignature({ session: f }).pourquoi.toLowerCase();
      for (const mot of INTERDITS) {
        expect(texte, `financement ${f} / mot « ${mot} »`).not.toContain(mot);
      }
    }
  });

  it("dit que la liste des pièces est CONTRACTUELLE et qu'elle VARIE", () => {
    for (const f of TIERS) {
      const texte = attenteContresignature({ session: f }).pourquoi.toLowerCase();
      expect(texte, `financement ${f}`).toContain("contractuel");
      expect(texte, `financement ${f}`).toMatch(/varie|d'un financeur à l'autre/);
    }
  });

  it("nomme les DEUX signataires — stagiaire ET formateur", () => {
    for (const f of TIERS) {
      const texte = attenteContresignature({ session: f }).pourquoi.toLowerCase();
      expect(texte, `financement ${f}`).toContain("stagiaire");
      expect(texte, `financement ${f}`).toContain("formateur");
    }
  });

  it("renvoie vers le financeur pour confirmer — jamais vers un texte de loi", () => {
    for (const f of TIERS) {
      expect(
        attenteContresignature({ session: f }).pourquoi.toLowerCase(),
        `financement ${f}`,
      ).toContain("confirmer auprès");
    }
  });
});

describe("constaterContresignature — quand le bandeau se tait", () => {
  it("se tait en financement direct, même sans AUCUNE contresignature", () => {
    const c = constaterContresignature({
      financement: { session: "direct" },
      signees: 3,
      aContresigner: [dj("2026-09-01", "matin")],
    });
    expect(c.afficher).toBe(false);
    expect(c.afficher === false && c.raison).toBe("non_attendue_par_le_financeur");
  });

  it("se tait quand le financement n'est pas renseigné", () => {
    const c = constaterContresignature({
      financement: { session: null },
      signees: 3,
      aContresigner: [dj("2026-09-01", "matin")],
    });
    expect(c.afficher).toBe(false);
    expect(c.afficher === false && c.raison).toBe("financement_non_renseigne");
  });

  it("🔑 distingue les DEUX silences, inscriptions comprises", () => {
    // « On ne sait pas » et « on sait que personne ne réclamera » ne sont pas
    // la même réponse. Les confondre ferait passer une IGNORANCE pour une
    // réponse — et c'est la raison, pas le silence, que lisent les appelants.
    //
    // ⚠️ La population porte des inscriptions dans les deux cas : c'est elle
    // qui rend ce témoin capable de voir une résolution par inscription qui
    // perdrait le repli sur la session.
    const inconnu = constaterContresignature({
      financement: { session: null, parInscription: [null, null] },
      signees: 3,
      aContresigner: [dj("2026-09-01", "matin")],
    });
    const toutEnDirect = constaterContresignature({
      financement: { session: "direct", parInscription: [null, null] },
      signees: 3,
      aContresigner: [dj("2026-09-01", "matin")],
    });
    expect(inconnu.afficher === false && inconnu.raison).toBe("financement_non_renseigne");
    expect(toutEnDirect.afficher === false && toutEnDirect.raison).toBe(
      "non_attendue_par_le_financeur",
    );
    // Témoin de non-vacuité : les deux cas se taisent, mais PAS pour la même
    // raison. Un module qui rendrait la même partout passerait les deux
    // assertions ci-dessus si elles étaient écrites séparément et mollement.
    expect(inconnu.afficher === false && inconnu.raison).not.toBe(
      toutEnDirect.afficher === false && toutEnDirect.raison,
    );
  });

  it("se tait quand TOUT est contresigné — le bandeau disparaît", () => {
    const c = constaterContresignature({
      financement: { session: "opco" },
      signees: 3,
      aContresigner: [],
    });
    expect(c.afficher).toBe(false);
    expect(c.afficher === false && c.raison).toBe("tout_contresigne");
  });
});

describe("constaterContresignature — ce qui manque", () => {
  it("nomme les demi-journées manquantes et compte ce qui est fait", () => {
    const c = constaterContresignature({
      financement: { session: "opco" },
      signees: 3,
      aContresigner: [dj("2026-09-01", "apres_midi"), dj("2026-09-02", "matin")],
    });
    expect(c.afficher).toBe(true);
    if (!c.afficher) return;
    expect(c.cas).toBe("contresignatures_manquantes");
    expect(c.manquantes).toHaveLength(2);
    expect(c.nbConcernees).toBe(3);
    expect(c.nbContresignees).toBe(1);
    // Le détail doit citer les dates en clair — « 2 manquantes » sans dire
    // lesquelles oblige à rouvrir la feuille pour savoir où cliquer.
    expect(c.message).toContain("01/09/2026");
    expect(c.message).toContain("après-midi");
  });

  it("porte le nom du financeur dans le titre — le geste se justifie par LUI", () => {
    const c = constaterContresignature({
      financement: { session: "opco" },
      signees: 1,
      aContresigner: [dj("2026-09-01", "matin")],
    });
    expect(c.afficher).toBe(true);
    if (!c.afficher) return;
    expect(c.financeur).toContain("OPCO");
    expect(c.titre).toContain("OPCO");
  });

  it("n'écrase pas le détail quand il y a beaucoup de manquantes", () => {
    const beaucoup = Array.from({ length: 9 }, (_, i) =>
      dj(`2026-09-${String(i + 1).padStart(2, "0")}`, "matin"),
    );
    const c = constaterContresignature({
      financement: { session: "mixte" },
      signees: 9,
      aContresigner: beaucoup,
    });
    expect(c.afficher).toBe(true);
    if (!c.afficher) return;
    expect(c.manquantes).toHaveLength(9);
    // Le message cite les premières ET annonce le reste : ni un pavé, ni un
    // silence sur ce qu'il ne montre pas.
    expect(c.message).toMatch(/5 autres/);
  });

  it("reste au singulier quand une seule demi-journée manque", () => {
    const c = constaterContresignature({
      financement: { session: "cpf" },
      signees: 4,
      aContresigner: [dj("2026-09-03", "matin")],
    });
    expect(c.afficher).toBe(true);
    if (!c.afficher) return;
    expect(c.titre).not.toContain("demi-journées");
    expect(c.message).not.toMatch(/\bautres\b/);
  });

  it("ne rend JAMAIS de refus : le constat n'a aucun champ bloquant", () => {
    // ⛔ Décision de Will du 25/08/2026 : « LA CONTRESIGNATURE PAS BLOQUANTE ».
    // Un champ `bloquant`/`refus`/`interdit` dans ce type serait la porte par
    // laquelle un appelant futur en ferait une garde.
    const c = constaterContresignature({
      financement: { session: "opco" },
      signees: 1,
      aContresigner: [dj("2026-09-01", "matin")],
    });
    const clefs = Object.keys(c);
    for (const interdite of ["bloquant", "bloquante", "refus", "interdit", "empeche"]) {
      expect(clefs, `clef « ${interdite} »`).not.toContain(interdite);
    }
  });

  it("dit que le manque n'empêche rien — le bandeau informe, il ne ferme pas", () => {
    const c = constaterContresignature({
      financement: { session: "opco" },
      signees: 2,
      aContresigner: [dj("2026-09-01", "matin")],
    });
    expect(c.afficher).toBe(true);
    if (!c.afficher) return;
    expect(`${c.message} ${c.pourquoi}`.toLowerCase()).toContain("ne bloque");
  });
});

describe("constaterContresignature — 🔴 le défaut « 0/0 » ne se refait pas", () => {
  const vide = { financement: { session: "opco" as const }, signees: 0, aContresigner: [] };

  it("NOMME le cas « rien à contresigner » au lieu de compter jusqu'à zéro", () => {
    const c = constaterContresignature(vide);
    // Il s'affiche : une session financée dont aucune demi-journée signée
    // n'est terminée est un état qui mérite d'être dit — pas un silence qui
    // ressemble à « rien à faire ».
    expect(c.afficher).toBe(true);
    if (!c.afficher) return;
    expect(c.cas).toBe("rien_a_contresigner");
    expect(c.nbConcernees).toBe(0);
    expect(c.nbContresignees).toBe(0);
    expect(c.manquantes).toHaveLength(0);
  });

  it("n'écrit AUCUN ratio quand il n'y a rien à contresigner", () => {
    const c = constaterContresignature({ ...vide, financement: { session: "mixte" } });
    expect(c.afficher).toBe(true);
    if (!c.afficher) return;
    const texte = `${c.titre} ${c.message}`;
    // `0/0`, `0 / 0`, `0 sur 0` — les trois formes du même mensonge.
    expect(texte).not.toMatch(/\b0\s*\/\s*0\b/);
    expect(texte).not.toMatch(/\b0\s+sur\s+0\b/);
    expect(texte).not.toMatch(/\bconforme/i);
  });

  it("dit POURQUOI il n'y a rien, et que ce n'est pas un dossier en règle", () => {
    const c = constaterContresignature(vide);
    expect(c.afficher).toBe(true);
    if (!c.afficher) return;
    expect(c.message.toLowerCase()).toMatch(/signée|signature/);
    expect(c.message.toLowerCase()).toContain("pas");
  });

  it("le cas vide ne se confond pas avec « tout contresigné »", () => {
    const rien = constaterContresignature(vide);
    const tout = constaterContresignature({ ...vide, signees: 2 });
    expect(rien.afficher).toBe(true);
    expect(tout.afficher).toBe(false);
  });
});
