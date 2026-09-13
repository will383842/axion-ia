// @vitest-environment node

/**
 * Tests — une alerte dit CE QU'ELLE VISE, jamais un UUID.
 *
 * 🔴 Le défaut : « Cible : TrainingSession — 0d4e0c8b-3aaa-4f1e-… ». Le LIEN
 * avait déjà été réparé par `lien-cible.ts` ; le libellé, non. Or personne ne
 * lit un UUID : pour savoir de qui ou de quoi parlait l'alerte, il fallait
 * cliquer, attendre l'écran, revenir. Sur vingt alertes, vingt allers-retours
 * pour trier ce qui est urgent — et dans l'E-MAIL d'alerte, où il n'y a aucun
 * écran sur lequel cliquer, l'UUID ne menait nulle part du tout.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSessionFindMany = vi.fn();
const mockTrainerFindMany = vi.fn();
const mockDevisFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingSession: { findMany: (...a: unknown[]) => mockSessionFindMany(...a) },
    trainer: { findMany: (...a: unknown[]) => mockTrainerFindMany(...a) },
    devis: { findMany: (...a: unknown[]) => mockDevisFindMany(...a) },
  },
}));

import { libellesDesCibles, texteCible, cleCible, NOM_TYPE_CIBLE } from "./libelle-cible";

const SESSION = "0d4e0c8b-3aaa-4f1e-9c77-1b2d3e4f5a6b";
const PERSONNE = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  mockSessionFindMany.mockResolvedValue([]);
  mockTrainerFindMany.mockResolvedValue([]);
  mockDevisFindMany.mockResolvedValue([]);
});

describe("texteCible — module pur, et il ne rend JAMAIS un UUID", () => {
  it("🔴 une cible résolue est nommée, pas identifiée", () => {
    const resolus = new Map([
      [cleCible("TrainingSession", SESSION), "Prompt engineering — 12/09/2026"],
    ]);
    const t = texteCible("TrainingSession", SESSION, resolus);
    expect(t).toBe("Session : Prompt engineering — 12/09/2026");
    expect(t).not.toContain(SESSION);
  });

  it("🔴 une cible NON résolue ne recolle pas l'UUID « au cas où »", () => {
    /*
      Le piège de ce lot : « je n'ai pas le nom, je remets l'identifiant ».
      Ce serait revenir au défaut avec une justification. Le lien, quand il
      existe, porte déjà l'identifiant — et quand il n'existe pas, l'UUID
      n'apprend rien à personne.
    */
    const t = texteCible("TrainingSession", SESSION, new Map());
    expect(t).toBe("Session (non retrouvée)");
    expect(t).not.toContain(SESSION);
    expect(t).not.toContain("0d4e0c8b");
  });

  it("⚠️ « Trainer » ne se traduit PAS par « Formateur »", () => {
    /*
      🔑 Depuis que l'organisme embauche hors formation, `Trainer` porte des gens
      qui n'animent rien. Écrire « Formateur : Camille Martin » sur l'alerte de
      remise de SON CDD lui affirmerait un métier qui n'est pas le sien —
      exactement le défaut corrigé dans l'e-mail de contrat.
    */
    expect(NOM_TYPE_CIBLE["Trainer"]).toBe("Personne");
    const resolus = new Map([[cleCible("Trainer", PERSONNE), "Camille Martin — Secrétaire"]]);
    expect(texteCible("Trainer", PERSONNE, resolus)).toBe("Personne : Camille Martin — Secrétaire");
  });

  it("un type inconnu du module reste affiché tel quel — honnête plutôt que muet", () => {
    expect(texteCible("ModeleInconnu", "abc123", new Map())).toBe("ModeleInconnu (non retrouvée)");
  });

  it("sans cible du tout : null, et l'écran n'affiche pas la ligne", () => {
    expect(texteCible(null, null, new Map())).toBeNull();
    expect(texteCible("", SESSION, new Map())).toBeNull();
    expect(texteCible("   ", SESSION, new Map())).toBeNull();
  });

  it("un type SANS identifiant nomme quand même la nature", () => {
    expect(texteCible("Devis", null, new Map())).toBe("Devis");
    expect(texteCible("Devis", "  ", new Map())).toBe("Devis");
  });
});

describe("libellesDesCibles — une requête par TYPE, jamais une par alerte", () => {
  it("🔴 vingt alertes sur deux types font DEUX requêtes", async () => {
    /*
      Cet écran a déjà planté à l'hydratation une fois : c'est le dernier endroit
      du dépôt où ajouter une requête par ligne affichée.
    */
    const cibles = [
      ...Array.from({ length: 12 }, (_, i) => ({
        cibleType: "TrainingSession",
        cibleId: `s-${i}`,
      })),
      ...Array.from({ length: 8 }, (_, i) => ({ cibleType: "Trainer", cibleId: `t-${i}` })),
    ];
    await libellesDesCibles(cibles);
    expect(mockSessionFindMany).toHaveBeenCalledTimes(1);
    expect(mockTrainerFindMany).toHaveBeenCalledTimes(1);
    expect(mockDevisFindMany).not.toHaveBeenCalled();
  });

  it("🔑 les identifiants sont DÉDOUBLONNÉS avant la requête", async () => {
    await libellesDesCibles([
      { cibleType: "Devis", cibleId: "d-1" },
      { cibleType: "Devis", cibleId: "d-1" },
      { cibleType: "Devis", cibleId: "d-2" },
    ]);
    const where = mockDevisFindMany.mock.calls[0]?.[0] as { where: { id: { in: string[] } } };
    expect(where.where.id.in).toStrictEqual(["d-1", "d-2"]);
  });

  it("compose le libellé d'une session avec son titre, sa date et son numéro", async () => {
    mockSessionFindMany.mockResolvedValue([
      {
        id: SESSION,
        numero: "AXI-SES-2026-014",
        titreSession: "Prompt engineering",
        dateDebut: new Date("2026-09-12T08:00:00.000Z"),
      },
    ]);
    const r = await libellesDesCibles([{ cibleType: "TrainingSession", cibleId: SESSION }]);
    const l = r.get(cleCible("TrainingSession", SESSION));
    expect(l).toContain("Prompt engineering");
    expect(l).toContain("12/09/2026");
    expect(l).toContain("AXI-SES-2026-014");
  });

  it("🔑 un POSTE absent ne laisse pas de tiret orphelin", async () => {
    // `joindre` filtre les morceaux vides : sans lui le libellé se lirait
    // « Camille Martin — », une phrase cassée dans un e-mail d'alerte.
    mockTrainerFindMany.mockResolvedValue([
      { id: PERSONNE, nom: "Martin", prenom: "Camille", contratPoste: null },
    ]);
    const r = await libellesDesCibles([{ cibleType: "Trainer", cibleId: PERSONNE }]);
    expect(r.get(cleCible("Trainer", PERSONNE))).toBe("Camille Martin");
  });

  it("🔴 une panne de base rend une table VIDE, jamais une erreur", async () => {
    // L'écran des alertes doit s'afficher même si une entité annexe est
    // injoignable : c'est là qu'on va lire ce qui ne va pas.
    mockSessionFindMany.mockRejectedValue(new Error("no db"));
    const r = await libellesDesCibles([{ cibleType: "TrainingSession", cibleId: SESSION }]);
    expect(r.size).toBe(0);
    // …et l'affichage retombe sur la nature, pas sur l'UUID.
    expect(texteCible("TrainingSession", SESSION, r)).toBe("Session (non retrouvée)");
  });

  it("ignore les cibles sans type ou sans identifiant, sans requête inutile", async () => {
    await libellesDesCibles([
      { cibleType: null, cibleId: SESSION },
      { cibleType: "TrainingSession", cibleId: null },
      { cibleType: "", cibleId: "" },
    ]);
    expect(mockSessionFindMany).not.toHaveBeenCalled();
  });
});

describe("⚠️ le catalogue des types couvre ce que l'évaluateur émet", () => {
  it("🔴 CHAQUE type émis par l'évaluateur a un mot en français", () => {
    /*
      🔑 GARDE DE FAMILLE, ET ELLE LIT LA SOURCE — elle ne recopie pas une liste.

      Une liste recopiée ici serait exactement le motif qui dérive en silence :
      l'évaluateur gagne un seizième type, le témoin reste vert parce qu'il ne
      connaît que quinze, et l'écran se remet à afficher un nom de CLASSE. On
      extrait donc les `cibleType` du fichier qui les pose.

      ⚠️ Sans le premier `expect`, un changement de forme d'écriture rendrait
      zéro type trouvé — et un ensemble vide satisfait « tous ont un mot ».
    */
    const src = readFileSync(
      join(process.cwd(), "src/server/qualiopi/alertes/evaluateur.ts"),
      "utf8",
    );
    const emis = [
      ...new Set([...src.matchAll(/cibleType:\s*"([A-Za-z]+)"/g)].map((m) => m[1] as string)),
    ].sort();
    expect(emis.length, "aucun cibleType trouvé : la forme d'écriture a changé").toBeGreaterThan(
      10,
    );
    const manquants = emis.filter((t) => NOM_TYPE_CIBLE[t] === undefined);
    expect(
      manquants,
      "l'évaluateur émet ces types, et l'écran afficherait leur nom de CLASSE",
    ).toStrictEqual([]);
  });

  it("aucun libellé ne ressemble à un nom de classe", () => {
    /*
      Témoin discriminant : remplir la table avec les noms techniques passerait
      le test ci-dessus et n'apprendrait rien de plus à personne.

      ⚠️ DEUX EXCEPTIONS ASSUMÉES, et elles ne sont pas un relâchement : `Devis`
      et `Formation` sont déjà des mots FRANÇAIS. Le modèle porte le nom de la
      chose. Les renommer pour satisfaire ce témoin rendrait l'écran moins clair
      — le but est qu'un opérateur lise le mot qu'il emploie, pas qu'il diffère
      du schéma.
    */
    const DEJA_FRANCAIS = new Set(["Devis", "Formation"]);
    const suspects = Object.entries(NOM_TYPE_CIBLE)
      .filter(([cle, mot]) => mot === cle)
      .filter(([cle]) => !DEJA_FRANCAIS.has(cle));
    expect(suspects, "libellé identique au nom de modèle").toStrictEqual([]);
  });
});
