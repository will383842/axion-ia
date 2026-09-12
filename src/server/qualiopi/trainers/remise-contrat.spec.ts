// @vitest-environment node

/**
 * Tests — la remise du contrat de travail, et le délai qui requalifie un CDD.
 *
 * Ce qui se joue : chaque condition de `remiseCddEnSouffrance` retire un faux
 * positif. Une alerte qui se déclenche à tort n'est pas un désagrément — elle
 * apprend à ignorer la famille entière, et c'est la vraie qu'on rate ensuite.
 *
 * ⚠️ Aucun test ne vérifie un calcul de « jours ouvrables » : le module refuse
 * d'en faire un, et c'est sa propriété la plus importante. Un témoin qui
 * l'exigerait pousserait à l'écrire.
 */

import { describe, expect, it } from "vitest";

import {
  DELAI_REMISE_CDD_JOURS_OUVRABLES,
  joursDepuisEmbauche,
  messageRemiseCdd,
  remiseCddEnSouffrance,
  type SalarieRemise,
} from "./remise-contrat";

/** 15 septembre 2026. L'embauche par défaut est au 10 : le délai court. */
const MAINTENANT = new Date("2026-09-15T12:00:00.000Z");

function salarie(o: Partial<SalarieRemise> = {}): SalarieRemise {
  return {
    statut: "salarie",
    contratType: "cdd",
    dateEmbauche: new Date("2026-09-10T00:00:00.000Z"),
    contratRemisAt: null,
    contratEtabli: true,
    ...o,
  };
}

describe("remiseCddEnSouffrance — le cas qui doit alerter", () => {
  it("🔴 un CDD établi, embauche commencée, remise non consignée", () => {
    expect(remiseCddEnSouffrance(salarie(), MAINTENANT)).toBe(true);
  });

  it("🔑 le JOUR MÊME de l'embauche compte déjà", () => {
    // Le délai court dès le premier jour. Comparer en strictement supérieur
    // ferait taire l'alerte précisément le jour où elle est le plus utile —
    // celui où l'on peut encore remettre la pièce dans les temps.
    expect(
      remiseCddEnSouffrance(
        salarie({ dateEmbauche: new Date("2026-09-15T00:00:00.000Z") }),
        MAINTENANT,
      ),
    ).toBe(true);
  });
});

describe("🔑 les cinq conditions — chacune retire un faux positif", () => {
  it("un CDI ne déclenche rien : aucun délai de cette nature ne le vise", () => {
    // ⚠️ Le remettre reste une obligation de l'employeur, mais son retard ne
    // requalifie rien. Une alerte sans conséquence attachée apprend à ignorer
    // les alertes.
    expect(remiseCddEnSouffrance(salarie({ contratType: "cdi" }), MAINTENANT)).toBe(false);
  });

  it("une nature NON RENSEIGNÉE ne déclenche rien non plus", () => {
    expect(remiseCddEnSouffrance(salarie({ contratType: null }), MAINTENANT)).toBe(false);
  });

  it("un SOUS-TRAITANT n'a pas de contrat de travail", () => {
    expect(remiseCddEnSouffrance(salarie({ statut: "sous_traitant" }), MAINTENANT)).toBe(false);
  });

  it("un DIRIGEANT relève de son mandat social", () => {
    expect(remiseCddEnSouffrance(salarie({ statut: "dirigeant" }), MAINTENANT)).toBe(false);
  });

  it("🔴 sans contrat ÉTABLI, il n'y a rien à remettre", () => {
    // Réclamer la remise d'un document inexistant enverrait chercher une erreur
    // là où il n'y a qu'une étape non faite.
    expect(remiseCddEnSouffrance(salarie({ contratEtabli: false }), MAINTENANT)).toBe(false);
  });

  it("🔴 une embauche À VENIR n'est en retard de rien", () => {
    expect(
      remiseCddEnSouffrance(
        salarie({ dateEmbauche: new Date("2026-10-01T00:00:00.000Z") }),
        MAINTENANT,
      ),
    ).toBe(false);
  });

  it("une date d'embauche ABSENTE n'arme pas le délai", () => {
    expect(remiseCddEnSouffrance(salarie({ dateEmbauche: null }), MAINTENANT)).toBe(false);
  });

  it("🔑 une remise CONSIGNÉE éteint l'alerte — c'est le geste qui la ferme", () => {
    expect(
      remiseCddEnSouffrance(
        salarie({ contratRemisAt: new Date("2026-09-11T00:00:00.000Z") }),
        MAINTENANT,
      ),
    ).toBe(false);
  });
});

describe("joursDepuisEmbauche — situer, jamais décider", () => {
  it("compte les jours calendaires écoulés", () => {
    expect(joursDepuisEmbauche(new Date("2026-09-10T00:00:00.000Z"), MAINTENANT)).toBe(5);
  });

  it("rend 0 le jour même", () => {
    expect(joursDepuisEmbauche(new Date("2026-09-15T00:00:00.000Z"), MAINTENANT)).toBe(0);
  });

  it("🔑 rend null pour une embauche À VENIR, jamais un nombre négatif", () => {
    // Un négatif se lirait comme un retard à rebours dans le message.
    expect(joursDepuisEmbauche(new Date("2026-10-01T00:00:00.000Z"), MAINTENANT)).toBeNull();
  });

  it("rend null quand la date manque", () => {
    expect(joursDepuisEmbauche(null, MAINTENANT)).toBeNull();
  });
});

describe("messageRemiseCdd — il nomme la conséquence, pas seulement la tâche", () => {
  it("🔴 dit la REQUALIFICATION, et les deux articles", () => {
    // Une alerte qui dit seulement « à faire » se range derrière les autres.
    // Celle-ci ne se rattrape pas en payant : c'est la nature du contrat qui
    // bascule, et le message doit le porter.
    const m = messageRemiseCdd("Camille Martin", 5);
    expect(m).toMatch(/requalifiable/i);
    expect(m).toContain("L.1242-13");
    expect(m).toContain("L.1245-1");
  });

  it("nomme le salarié et prescrit un geste QUI EXISTE", () => {
    const m = messageRemiseCdd("Camille Martin", 5);
    expect(m).toContain("Camille Martin");
    expect(m).toMatch(/consignez la date/i);
  });

  it("dit le délai depuis la CONSTANTE, jamais en toutes lettres", () => {
    expect(messageRemiseCdd("X", 1)).toContain(
      `${DELAI_REMISE_CDD_JOURS_OUVRABLES} jours ouvrables`,
    );
  });

  it("🔑 accorde le pluriel, et parle au présent le jour même", () => {
    // Un message qui dit « il y a 1 jours » ou « il y a 0 jour » se lit comme
    // une machine. Sur une alerte qu'on veut voir traitée, le soin compte.
    expect(messageRemiseCdd("X", 1)).toContain("il y a 1 jour.");
    expect(messageRemiseCdd("X", 3)).toContain("il y a 3 jours.");
    expect(messageRemiseCdd("X", 0)).toContain("commence aujourd'hui");
  });

  it("⚠️ n'invente AUCUNE date limite quand l'ancienneté est inconnue", () => {
    const m = messageRemiseCdd("X", null);
    expect(m).not.toMatch(/il y a/);
    expect(m).toMatch(/L\.1242-13/);
  });
});
