import { describe, expect, it } from "vitest";

import {
  ligneEquipe,
  phraseEnTete,
  suivreParPersonne,
  type EntreeBrouillon,
  type EntreeOuverture,
  type EntreeReponse,
  type SuiviParPersonne,
} from "../personnes";
import { squeletteDuHtml } from "../squelette";
import { HTML_SYNTHETIQUE } from "./squelette.fixture";

const CODE_DIR = "DIRIGEANTSECRET0000AAAA";
const estCodeDirigeant = (m: string): boolean => m === CODE_DIR;
const T = (j: number) => new Date(Date.UTC(2026, 9, j, 9, 0, 0));
const sq = squeletteDuHtml(HTML_SYNTHETIQUE);

const CODES = ["aaaaaaaaaaa1", "bbbbbbbbbbb2", "ccccccccccc3", "ddddddddddd4"];
const equipe = (journees: string[] = ["Oui", "Oui", "Oui", "Oui"]) =>
  ["Alice Martin", "Bruno Durand", "Chloé Petit", "David Éloi"].map((n, i) => ({
    id: CODES[i],
    prenom: n.split(" ")[0],
    nom: n.split(" ")[1],
    role: `Fonction ${i}`,
    journee: journees[i],
  }));

function dirigeant(extra: Record<string, unknown> = {}, donnees: Record<string, unknown> = {}) {
  return {
    id: "r-dir",
    mode: "main",
    membreColonne: null,
    recuLe: T(25),
    ecartee: false,
    charge: {
      mode: "main",
      membre: CODE_DIR,
      donnees: { equipe: equipe(), ent_effectif: "20 à 49", a_nom: "x", ...donnees },
      ...extra,
    },
  } satisfies EntreeReponse;
}

const brouillonCollab = (code: string, data: Record<string, unknown> = {}): EntreeBrouillon => ({
  id: `brouillon-${code.length}`,
  mode: "emp",
  membre: code,
  majLe: T(26),
  instantane: {
    data: { id_prenom: "Alice", id_nom: "Martin", b_1: "x", ...data },
    more: 0,
    pre: [],
  },
});

function suivre(
  p: Partial<{
    reponses: EntreeReponse[];
    brouillons: EntreeBrouillon[];
    ouvertures: EntreeOuverture[] | null;
    luLe: Date | null;
  }>,
): SuiviParPersonne {
  return suivreParPersonne({
    reponses: p.reponses ?? [],
    brouillons: p.brouillons ?? [],
    ouvertures: p.ouvertures === undefined ? [] : p.ouvertures,
    estCodeDirigeant,
    squelette: sq,
    luLe: p.luLe ?? null,
  });
}

describe("scénario Oury : dirigeant reçu, 4 déclarés, 1 brouillon rapproché", () => {
  const s = suivre({ reponses: [dirigeant()], brouillons: [brouillonCollab(CODES[0] as string)] });
  it("phrase d'en-tête", () => {
    expect(phraseEnTete(s)).toBe(
      "1 sur 6 reçus : il manque 4 collaborateurs (dont 1 en train de remplir) et le référent informatique (si la partie technique lui a été confiée).",
    );
  });
  it("ligne équipe", () => {
    expect(ligneEquipe(s)).toBe("Collaborateurs : déclarés 4 · reçus 0 · en cours 1 · manquants 3");
  });
  it("le brouillon est rattaché à un nom de l'équipe, par le code", () => {
    const alice = s.collaborateurs.find((l) => l.nom === "Alice Martin");
    expect(alice).toMatchObject({ etat: "en_cours", sourceNom: "equipe", rapprochement: "code" });
    expect(alice?.taux?.essentiellesRemplies).toBe(1);
  });
  it("jamais le code du dirigeant dans la sortie", () => {
    expect(JSON.stringify(s)).not.toContain(CODE_DIR);
    expect(JSON.stringify(s)).not.toContain("AAAA");
  });
  it("effectif incohérent : liste incomplète", () => {
    expect(s.effectif).toEqual({ tranche: "20 à 49", remarque: "liste_incomplete" });
  });
});

describe("cas de l'équipe", () => {
  it("« Non, pas pour cette personne » : pas de lien prévu, hors total", () => {
    const s = suivre({
      reponses: [
        dirigeant({}, { equipe: equipe(["Oui", "Oui", "Oui", "Non, pas pour cette personne"]) }),
      ],
    });
    expect(s.collab).toMatchObject({ declares: 4, sansLienPrevu: 1, attendus: 3, manquants: 3 });
    expect(ligneEquipe(s)).toContain("· 1 sans lien (choix du dirigeant)");
    expect(s.collaborateurs[3]?.etat).toBe("pas_de_lien_prevu");
  });
  it("fiche sans prénom ni nom : comptée à part, pas de ligne", () => {
    const eq = [
      ...equipe(),
      { id: "eeeeeeeeeee5", prenom: "", nom: "", role: "X", journee: "Oui" },
    ];
    const s = suivre({ reponses: [dirigeant({}, { equipe: eq })] });
    expect(s.fichesSansNom).toBe(1);
    expect(s.collab.declares).toBe(4);
  });
  it("personne sans id : lien sans code, suivi impossible", () => {
    const eq = equipe().map((p, i) => (i === 0 ? { ...p, id: undefined } : p));
    const s = suivre({ reponses: [dirigeant({}, { equipe: eq })] });
    expect(s.collaborateurs[0]?.etat).toBe("lien_sans_code");
    expect(s.collab.attendus).toBe(3);
  });
  it("code inconnu : personne non retrouvée dans l'équipe, avec fin du code seulement", () => {
    const s = suivre({
      reponses: [dirigeant()],
      brouillons: [brouillonCollab("zzzzzzzzzzzz9876", { id_prenom: "Zoé", id_nom: "Inconnue" })],
    });
    const l = s.collaborateurs.find((x) => x.role === "non_retrouvee");
    expect(l).toMatchObject({ codeCourt: "…9876", etat: "en_cours", sourceNom: "brouillon" });
    expect(JSON.stringify(s)).not.toContain("zzzzzzzzzzzz9876");
    expect(s.collab.attendus).toBe(5);
  });
  it("code ouvert seulement et inconnu : non compté parmi les attendus", () => {
    const s = suivre({
      reponses: [dirigeant()],
      ouvertures: [
        {
          mode: "emp",
          membre: "zzzzzzzzzzzz9876",
          premiereOuverture: T(26),
          derniereOuverture: T(26),
          nombre: 1,
          derniereEtapeAtteinte: 1,
        },
      ],
    });
    expect(s.collab.attendus).toBe(4);
  });
  it("équipe lue du brouillon du dirigeant", () => {
    const s = suivre({
      brouillons: [
        {
          id: "b-dir",
          mode: "main",
          membre: "",
          majLe: T(26),
          instantane: { data: { equipe: equipe(), ent_effectif: "Je ne sais pas" }, pre: [] },
        },
      ],
    });
    expect(s.equipe).toEqual({ connue: true, source: "brouillon" });
    expect(s.dirigeant.etat).toBe("en_cours");
    expect(s.effectif?.remarque).toBeNull();
  });
  it("équipe inconnue : phrase dédiée", () => {
    const s = suivre({});
    expect(phraseEnTete(s)).toBe(
      "Dirigeant : pas de nouvelles. L'équipe n'est pas encore déclarée : on ne sait pas encore combien de collaborateurs attendre.",
    );
  });
  it("réponse du dirigeant sans son code : à vérifier", () => {
    const r = dirigeant();
    const s = suivre({
      reponses: [{ ...r, charge: { ...r.charge, membre: null } }],
    });
    expect(s.equipe.source).toBe("reponse_sans_code");
    expect(s.dirigeant.aVerifier).toBe(true);
  });
  it("liste qui dépasse l'effectif", () => {
    const s = suivre({ reponses: [dirigeant({}, { ent_effectif: "1 à 3" })] });
    expect(s.effectif?.remarque).toBe("liste_depasse");
  });
});

describe("réponses des collaborateurs", () => {
  const reponseCollab = (
    code: string | null,
    over: Partial<EntreeReponse> = {},
  ): EntreeReponse => ({
    id: `r-${code ?? "x"}`,
    mode: "emp",
    membreColonne: code,
    recuLe: T(27),
    ecartee: false,
    charge: {
      mode: "emp",
      membre: code,
      collaborateur: { prenom: "Bruno", nom: "Durand", fonction: "F", membre: code },
      donnees: { b_1: "x", m_1: "y" },
    },
    ...over,
  });
  it("reçue par code : taux sur les essentielles du parcours", () => {
    const s = suivre({ reponses: [dirigeant(), reponseCollab(CODES[1] as string)] });
    const l = s.collaborateurs.find((x) => x.nom === "Bruno Durand");
    expect(l).toMatchObject({ etat: "recu", pasEncoreLue: true, nbEnvois: 1 });
    expect(l?.taux?.essentiellesRemplies).toBe(2);
    expect(s.collab).toMatchObject({ recus: 1, manquants: 3 });
  });
  it("jamais lue / lue", () => {
    const rs = [dirigeant(), reponseCollab(CODES[1] as string)];
    expect(suivre({ reponses: rs, luLe: T(28) }).collaborateurs[1]?.pasEncoreLue).toBe(false);
    expect(suivre({ reponses: rs, luLe: null }).collaborateurs[1]?.pasEncoreLue).toBe(true);
  });
  it("réponse écartée : état écarté, ni taux ni compte en reçu", () => {
    const s = suivre({
      reponses: [dirigeant(), reponseCollab(CODES[1] as string, { ecartee: true, charge: null })],
    });
    const l = s.collaborateurs[1];
    expect(l).toMatchObject({ etat: "ecartee", taux: null });
    expect(s.collab.recus).toBe(0);
  });
  it("sans code : rapprochée par le nom, à vérifier", () => {
    const s = suivre({ reponses: [dirigeant(), reponseCollab(null)] });
    expect(s.collaborateurs[1]).toMatchObject({ etat: "recu", rapprochement: "nom" });
  });
  it("sans code et homonymes : non rapprochée", () => {
    const eq = equipe().map((p, i) => (i === 2 ? { ...p, prenom: "Bruno", nom: "durand" } : p));
    const s = suivre({ reponses: [dirigeant({}, { equipe: eq }), reponseCollab(null)] });
    expect(s.collaborateurs.filter((l) => l.rapprochement === "nom")).toHaveLength(0);
    const orph = s.collaborateurs.find((l) => l.role === "non_retrouvee");
    expect(orph).toMatchObject({ sansCode: true, etat: "recu" });
  });
});

describe("journée du dirigeant, référent, ouvertures", () => {
  it("code du dirigeant en parcours collaborateur : sous-ligne hors total, code absent", () => {
    const rep: EntreeReponse = {
      id: "r-j",
      mode: "emp",
      membreColonne: CODE_DIR,
      recuLe: T(26),
      ecartee: false,
      charge: { mode: "emp", membre: CODE_DIR, donnees: { b_1: "x" } },
    };
    const s = suivre({
      reponses: [dirigeant(), rep],
      brouillons: [{ ...brouillonCollab(CODE_DIR), id: "b-j" }],
    });
    expect(s.journeeDirigeant?.etat).toBe("recu");
    expect(s.collab.attendus).toBe(4);
    expect(s.total.attendus).toBe(6);
    expect(s.collaborateurs.some((l) => l.role === "non_retrouvee")).toBe(false);
    const sortie = JSON.stringify(s);
    expect(sortie).not.toContain(CODE_DIR);
    expect(sortie).not.toContain("AAAA");
  });
  it("référent : une ligne vide attendue, puis groupement par code", () => {
    expect(suivre({ reponses: [dirigeant()] }).referents).toHaveLength(1);
    const rep: EntreeReponse = {
      id: "r-it",
      mode: "it",
      membreColonne: "it-abcdef123456",
      recuLe: T(27),
      ecartee: false,
      charge: { mode: "it", membre: "it-abcdef123456", donnees: { t_1: "x" } },
    };
    const s = suivre({ reponses: [dirigeant(), rep] });
    expect(s.referents[0]).toMatchObject({ etat: "recu", codeCourt: "…3456" });
    expect(phraseEnTete(s)).toContain("2 sur 6");
  });
  it("tout reçu", () => {
    const reps: EntreeReponse[] = [dirigeant()];
    for (const c of CODES) {
      reps.push({
        id: `r${c}`,
        mode: "emp",
        membreColonne: c,
        recuLe: T(27),
        ecartee: false,
        charge: { mode: "emp", membre: c, donnees: { b_1: "x" } },
      });
    }
    reps.push({
      id: "r-it",
      mode: "it",
      membreColonne: "it-abcdef123456",
      recuLe: T(27),
      ecartee: false,
      charge: { mode: "it", donnees: {} },
    });
    expect(phraseEnTete(suivre({ reponses: reps }))).toBe("Tout est reçu : 6 sur 6.");
  });
  it("ouvertures null : signalé, aucun état « ouvert »", () => {
    const s = suivre({ reponses: [dirigeant()], ouvertures: null });
    expect(s.ouverturesIndisponibles).toBe(true);
  });
  it("ouvert seulement", () => {
    const s = suivre({
      reponses: [dirigeant()],
      ouvertures: [
        {
          mode: "perso",
          membre: CODES[2] as string,
          premiereOuverture: T(26),
          derniereOuverture: T(27),
          nombre: 2,
          derniereEtapeAtteinte: 1,
        },
      ],
    });
    expect(s.collaborateurs[2]).toMatchObject({ etat: "ouvert", ouverture: { nombre: 2 } });
    expect(s.collab.ouvertsSeulement).toBe(1);
  });
});
