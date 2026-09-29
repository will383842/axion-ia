// @vitest-environment node
/**
 * Chaque champ de la note manuelle produit UN fait, du bon type, rangé à la
 * bonne portée (plan §3.13, vérification C5) : activité et effectif pour
 * l'entreprise ; besoin, budget, décideur, échéance pour le projet ;
 * prochaine étape et objection au projet s'il y en a un.
 *
 * Contre-témoin : sans projet, un besoin est REFUSÉ avec un message qui dit
 * quoi faire (la base refuserait un fait de projet sans projet).
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { dechiffrerParole } from "@/lib/chiffrer-parole";
import { LIBELLE_TYPE_FAIT } from "../libelles";
import {
  CHAMPS_DE_LA_NOTE,
  cleDuFait,
  enregistrerNoteManuelle,
  faitsDeLaNote,
  noteVide,
} from "../note-manuelle";
import { CLE_TEST, dossierEnMemoire, id } from "./_dossier-en-memoire";

const CLE_INITIALE = process.env["PII_ENCRYPTION_KEY"];
beforeEach(() => {
  process.env["PII_ENCRYPTION_KEY"] = CLE_TEST;
});
afterEach(() => {
  if (CLE_INITIALE === undefined) delete process.env["PII_ENCRYPTION_KEY"];
  else process.env["PII_ENCRYPTION_KEY"] = CLE_INITIALE;
});

describe("chaque champ de la note produit son type de fait", () => {
  it("les sept champs et la case, avec un projet", () => {
    const faits = faitsDeLaNote(
      {
        activite: "Menuiserie sur mesure",
        effectif: "42 salariés",
        besoin: "Former l'équipe commerciale",
        budget: "autour de 5 000 €",
        decideur: "La gérante",
        echeance: "avant décembre",
        prochaineEtape: "Envoyer le devis",
        objection: true,
        objectionTexte: "Le prix",
      },
      true,
    );
    expect(faits.map((f) => [f.type, f.portee])).toEqual([
      ["activite", "entreprise"],
      ["effectif", "entreprise"],
      ["besoin", "projet"],
      ["budget", "projet"],
      ["decideur", "projet"],
      ["echeance", "projet"],
      ["prochaine_etape", "projet"],
      ["objection", "projet"],
    ]);
    expect(faits.find((f) => f.type === "effectif")?.quantite).toBe(42);
    // Types suivis : ouverts ; les autres, sans suivi (CHECK du suivi).
    expect(faits.find((f) => f.type === "prochaine_etape")?.suivi).toBe("ouvert");
    expect(faits.find((f) => f.type === "objection")?.suivi).toBe("ouvert");
    expect(faits.find((f) => f.type === "besoin")?.suivi).toBeNull();
    expect(CHAMPS_DE_LA_NOTE).toHaveLength(7);
  });

  it("sans projet : activité, effectif et prochaine étape vont à l'entreprise", () => {
    const faits = faitsDeLaNote(
      { activite: "Cabinet d'expertise", effectif: "12", prochaineEtape: "Rappeler en janvier" },
      false,
    );
    expect(faits.map((f) => f.portee)).toEqual(["entreprise", "entreprise", "entreprise"]);
  });

  it("contre-témoin : un besoin sans projet est refusé, en français", () => {
    expect(() => faitsDeLaNote({ besoin: "Un audit" }, false)).toThrow(/projet/);
  });

  it("une note vide est vide ; les clés suivent la cardinalité", () => {
    expect(noteVide({})).toBe(true);
    expect(noteVide({ objection: true })).toBe(false);
    expect(cleDuFait("effectif")).toBe("global");
    // Type multiple : une clé opaque, propre à chaque fait saisi.
    expect(cleDuFait("besoin")).toMatch(/^saisie_[0-9a-f]{32}$/);
    expect(cleDuFait("besoin")).not.toBe(cleDuFait("besoin"));
  });

  it("« En bref » nomme chaque fait par `LIBELLE_TYPE_FAIT`, comme la page du rendez-vous", async () => {
    const base = dossierEnMemoire({});
    const rencontreId = id(5);
    await base.client.$transaction((tx) =>
      enregistrerNoteManuelle(tx as never, {
        rencontreId,
        clientId: id(1),
        projetId: null,
        saisie: { activite: "Menuiserie", objection: true, objectionTexte: "Le prix" },
        parAdminId: id(2),
        constateLe: new Date("2026-10-05T08:00:00Z"),
      }),
    );
    const contenu = JSON.parse(
      dechiffrerParole(String(base.tables["compteRendu"]?.[0]?.["contenu"])),
    ) as { enBref: string };
    expect(contenu.enBref).toBe(
      `${LIBELLE_TYPE_FAIT.activite} : Menuiserie · ${LIBELLE_TYPE_FAIT.objection} : Le prix`,
    );
  });
});
