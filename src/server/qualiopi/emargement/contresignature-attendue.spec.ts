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
      const a = attenteContresignature(f);
      expect(a.attendue, `financement ${f}`).toBe(true);
      expect(a.financeur, `financement ${f}`).not.toBeNull();
      expect(a.pourquoi.length, `financement ${f}`).toBeGreaterThan(40);
    }
  });

  it("ne l'attend PAS en financement direct — personne d'autre ne paie", () => {
    const a = attenteContresignature("direct");
    expect(a.attendue).toBe(false);
    expect(a.financeur).toBeNull();
  });

  it("ne l'attend pas quand le financement n'est pas renseigné", () => {
    // Le bandeau affirme « votre financeur réclamera ». Sans financement
    // renseigné, la prémisse n'est pas établie : on se tait plutôt que
    // d'affirmer au hasard sur toutes les sessions du registre.
    expect(attenteContresignature(null).attendue).toBe(false);
    expect(attenteContresignature(undefined).attendue).toBe(false);
    expect(attenteContresignature(null).financeur).toBeNull();
  });

  it("couvre TOUTE la liste `FinancementType` — pas une valeur de moins", () => {
    // Si quelqu'un ajoute une valeur à l'enum Prisma sans passer ici, ce test
    // rougit : `FINANCEMENTS` est la liste que le module prétend traiter.
    expect([...FINANCEMENTS].sort()).toEqual(
      ["cpf", "direct", "france_travail", "mixte", "opco"].sort(),
    );
    for (const f of FINANCEMENTS) {
      expect(() => attenteContresignature(f)).not.toThrow();
    }
  });

  it("ne rend jamais un financeur nommé quand rien n'est attendu", () => {
    // Un `financeur` non nul sur `attendue: false` laisserait un appelant
    // afficher « votre OPCO » sur une session payée par le client.
    for (const f of [...FINANCEMENTS, null]) {
      const a = attenteContresignature(f);
      expect(a.attendue === (a.financeur !== null), `financement ${f}`).toBe(true);
    }
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
      const texte = attenteContresignature(f).pourquoi.toLowerCase();
      for (const mot of INTERDITS) {
        expect(texte, `financement ${f} / mot « ${mot} »`).not.toContain(mot);
      }
    }
  });

  it("dit que la liste des pièces est CONTRACTUELLE et qu'elle VARIE", () => {
    for (const f of TIERS) {
      const texte = attenteContresignature(f).pourquoi.toLowerCase();
      expect(texte, `financement ${f}`).toContain("contractuel");
      expect(texte, `financement ${f}`).toMatch(/varie|d'un financeur à l'autre/);
    }
  });

  it("nomme les DEUX signataires — stagiaire ET formateur", () => {
    for (const f of TIERS) {
      const texte = attenteContresignature(f).pourquoi.toLowerCase();
      expect(texte, `financement ${f}`).toContain("stagiaire");
      expect(texte, `financement ${f}`).toContain("formateur");
    }
  });

  it("renvoie vers le financeur pour confirmer — jamais vers un texte de loi", () => {
    for (const f of TIERS) {
      expect(attenteContresignature(f).pourquoi.toLowerCase(), `financement ${f}`).toContain(
        "confirmer auprès",
      );
    }
  });
});

describe("constaterContresignature — quand le bandeau se tait", () => {
  it("se tait en financement direct, même sans AUCUNE contresignature", () => {
    const c = constaterContresignature({
      financement: "direct",
      signees: 3,
      aContresigner: [dj("2026-09-01", "matin")],
    });
    expect(c.afficher).toBe(false);
    expect(c.afficher === false && c.raison).toBe("non_attendue_par_le_financeur");
  });

  it("se tait quand le financement n'est pas renseigné", () => {
    const c = constaterContresignature({
      financement: null,
      signees: 3,
      aContresigner: [dj("2026-09-01", "matin")],
    });
    expect(c.afficher).toBe(false);
    expect(c.afficher === false && c.raison).toBe("financement_non_renseigne");
  });

  it("se tait quand TOUT est contresigné — le bandeau disparaît", () => {
    const c = constaterContresignature({
      financement: "opco",
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
      financement: "opco",
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
      financement: "opco",
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
      financement: "mixte",
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
      financement: "cpf",
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
      financement: "opco",
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
      financement: "opco",
      signees: 2,
      aContresigner: [dj("2026-09-01", "matin")],
    });
    expect(c.afficher).toBe(true);
    if (!c.afficher) return;
    expect(`${c.message} ${c.pourquoi}`.toLowerCase()).toContain("ne bloque");
  });
});

describe("constaterContresignature — 🔴 le défaut « 0/0 » ne se refait pas", () => {
  const vide = { financement: "opco" as const, signees: 0, aContresigner: [] };

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
    const c = constaterContresignature({ ...vide, financement: "mixte" });
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
