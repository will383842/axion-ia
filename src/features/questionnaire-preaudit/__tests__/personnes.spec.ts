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
      "1 sur 5 reçus : il manque 4 collaborateurs (dont 1 en train de remplir).",
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
    expect(l).toMatchObject({ etat: "recu", pasEncoreLue: false, nbEnvois: 1 });
    expect(l?.taux?.essentiellesRemplies).toBe(2);
    expect(s.collab).toMatchObject({ recus: 1, manquants: 3 });
  });
  it("jamais lue / lue", () => {
    const rs = [dirigeant(), reponseCollab(CODES[1] as string)];
    expect(suivre({ reponses: rs, luLe: T(28) }).collaborateurs[1]?.pasEncoreLue).toBe(false);
    // Sans date de lecture, aucune ligne n'est dite « pas lue » : le « à traiter » du questionnaire suffit.
    expect(suivre({ reponses: rs, luLe: null }).collaborateurs[1]?.pasEncoreLue).toBe(false);
    expect(suivre({ reponses: rs, luLe: T(1) }).collaborateurs[1]?.pasEncoreLue).toBe(true);
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
    expect(s.total.attendus).toBe(5);
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

describe("taux d'un collaborateur : le brouillon et l'envoi comptent pareil les cases pré-remplies", () => {
  const donnees = { b_1: "x", m_1: "y" };
  const tauxDuCollab = (s: SuiviParPersonne): number | undefined =>
    s.collaborateurs.find((l) => l.taux !== null)?.taux?.pourcentage ?? undefined;
  const envoye = (extra: Record<string, unknown>): EntreeReponse => ({
    id: "r-collab",
    mode: "emp",
    membreColonne: CODES[0] as string,
    recuLe: T(27),
    ecartee: false,
    charge: { mode: "emp", membre: CODES[0], donnees, ...extra },
  });

  it("une case jamais vérifiée (prefill.non_verifies) ne compte pas à l'envoi", () => {
    const brouillon = suivre({
      reponses: [dirigeant()],
      brouillons: [
        {
          ...brouillonCollab(CODES[0] as string),
          instantane: { data: donnees, more: 0, pre: ["b_1"] },
        },
      ],
    });
    const apresEnvoi = suivre({
      reponses: [dirigeant(), envoye({ prefill: { non_verifies: ["b_1"] } })],
    });
    const sansPrefill = suivre({ reponses: [dirigeant(), envoye({})] });

    expect(tauxDuCollab(apresEnvoi)).toBe(tauxDuCollab(brouillon));
    expect(tauxDuCollab(apresEnvoi) as number).toBeLessThan(tauxDuCollab(sansPrefill) as number);
  });
});

describe("référent informatique : attendu seulement s'il a commencé", () => {
  const CODE_REF = "refcode00001";
  const brouillonRef = (): EntreeBrouillon => ({
    id: "b-ref",
    mode: "it",
    membre: "it-refcode00001",
    majLe: T(26),
    instantane: { data: {}, more: 0, pre: [] },
  });
  const ouverture = (membre: string): EntreeOuverture => ({
    mode: "perso",
    membre,
    premiereOuverture: T(26),
    derniereOuverture: T(27),
    nombre: 1,
    derniereEtapeAtteinte: 1,
  });

  it("un brouillon du référent le rend attendu et cité dans l'en-tête", () => {
    const s = suivre({ reponses: [dirigeant()], brouillons: [brouillonRef()] });
    expect(s.total.attendus).toBe(6);
    expect(phraseEnTete(s)).toContain("le référent informatique");
  });

  it("une réponse mise de côté ne le garde pas attendu à vie", () => {
    const ecartee: EntreeReponse = {
      id: "r-ref",
      mode: "it",
      membreColonne: CODE_REF,
      recuLe: T(27),
      ecartee: true,
      charge: { mode: "it", membre: CODE_REF, donnees: {} },
    };
    const s = suivre({ reponses: [dirigeant(), ecartee] });
    expect(s.total.attendus).toBe(5);
    expect(phraseEnTete(s)).not.toContain("le référent informatique");
  });

  it("un lien perso ouvert avec le code d'un référent connu va sur sa ligne", () => {
    const recue: EntreeReponse = {
      id: "r-ref2",
      mode: "it",
      membreColonne: CODE_REF,
      recuLe: T(27),
      ecartee: false,
      charge: { mode: "it", membre: CODE_REF, donnees: {} },
    };
    const s = suivre({ reponses: [dirigeant(), recue], ouvertures: [ouverture(CODE_REF)] });
    expect(s.referents[0]?.ouverture).not.toBeNull();
    expect(s.collaborateurs.some((l) => l.role === "non_retrouvee")).toBe(false);
  });
});

describe("lien commun (sans code personnel) : information seule, hors du total", () => {
  const lien = (nombre: number, derniere: number): EntreeOuverture => ({
    mode: "lien",
    membre: "",
    premiereOuverture: T(26),
    derniereOuverture: T(derniere),
    nombre,
    derniereEtapeAtteinte: 0,
  });

  it("cumule les ouvertures et garde la plus récente, sans toucher aux comptes", () => {
    const sans = suivre({ reponses: [dirigeant()] });
    const avec = suivre({ reponses: [dirigeant()], ouvertures: [lien(2, 27), lien(3, 28)] });
    expect(avec.lienCommun).toEqual({ nombre: 5, derniere: T(28) });
    expect(avec.total).toEqual(sans.total);
    expect(avec.collab).toEqual(sans.collab);
    expect(avec.collaborateurs.some((l) => l.role === "non_retrouvee")).toBe(false);
  });

  it("aucune ouverture du lien commun : rien à montrer", () => {
    expect(suivre({ reponses: [dirigeant()] }).lienCommun).toBeNull();
  });
});

describe("adresse e-mail professionnelle (visible de Will seul, lien « Écrire »)", () => {
  const avecEmail = (email: unknown) => equipe().map((p, i) => (i === 1 ? { ...p, email } : p));
  const reponseEmp = (donnees: Record<string, unknown>): EntreeReponse => ({
    id: "r-mail",
    mode: "emp",
    membreColonne: CODES[1] as string,
    recuLe: T(27),
    ecartee: false,
    charge: {
      mode: "emp",
      membre: CODES[1],
      collaborateur: { prenom: "Bruno", nom: "Durand", fonction: "F", membre: CODES[1] },
      donnees: { b_1: "x", ...donnees },
    },
  });
  const bruno = (s: SuiviParPersonne) => s.collaborateurs.find((l) => l.nom === "Bruno Durand");

  it("l'adresse de la fiche équipe est lue, en minuscules", () => {
    const s = suivre({
      reponses: [dirigeant({}, { equipe: avecEmail(" Bruno@Exemple-Fictif.FR ") })],
    });
    expect(bruno(s)).toMatchObject({ email: "bruno@exemple-fictif.fr", sourceEmail: "equipe" });
    expect(s.collaborateurs[0]).toMatchObject({ email: null, sourceEmail: null });
  });
  it("une adresse invalide donne null", () => {
    for (const mauvaise of ["pas-une-adresse", "a@b", "a b@c.fr", 42, `${"x".repeat(200)}@e.fr`]) {
      const s = suivre({ reponses: [dirigeant({}, { equipe: avecEmail(mauvaise) })] });
      expect(bruno(s)).toMatchObject({ email: null, sourceEmail: null });
    }
  });
  it("l'adresse saisie par la personne prime sur celle du dirigeant", () => {
    const s = suivre({
      reponses: [
        dirigeant({}, { equipe: avecEmail("dirigeant@exemple-fictif.fr") }),
        reponseEmp({ id_email_emp: "bruno.pro@exemple-fictif.fr" }),
      ],
    });
    expect(bruno(s)).toMatchObject({
      email: "bruno.pro@exemple-fictif.fr",
      sourceEmail: "reponse",
    });
  });
  it("une réponse collaborateur qui porte id_email (champ en ligne) est lue", () => {
    const s = suivre({
      reponses: [dirigeant(), reponseEmp({ id_email: "Bruno.Pro@Exemple-Fictif.fr" })],
    });
    expect(bruno(s)).toMatchObject({
      email: "bruno.pro@exemple-fictif.fr",
      sourceEmail: "reponse",
    });
  });
  it("une adresse invalide dans la réponse laisse celle du dirigeant", () => {
    const s = suivre({
      reponses: [
        dirigeant({}, { equipe: avecEmail("dirigeant@exemple-fictif.fr") }),
        reponseEmp({ id_email_emp: "nimporte quoi" }),
      ],
    });
    expect(bruno(s)).toMatchObject({ email: "dirigeant@exemple-fictif.fr", sourceEmail: "equipe" });
  });
  it("le dirigeant n'a jamais d'adresse, même s'il en a saisi une", () => {
    const s = suivre({
      reponses: [
        dirigeant({}, { id_email_emp: "dir@exemple-fictif.fr", id_email: "dir@exemple-fictif.fr" }),
      ],
    });
    expect(s.dirigeant).toMatchObject({ email: null, sourceEmail: null });
  });
  it("le référent informatique : id_email", () => {
    const recue: EntreeReponse = {
      id: "r-ref-mail",
      mode: "it",
      membreColonne: "refcode00001",
      recuLe: T(27),
      ecartee: false,
      charge: {
        mode: "it",
        membre: "refcode00001",
        donnees: { id_prenom: "Marc", id_nom: "Dubois", id_email: "Marc@Exemple-Fictif.fr" },
      },
    };
    const s = suivre({ reponses: [dirigeant(), recue] });
    expect(s.referents[0]).toMatchObject({
      email: "marc@exemple-fictif.fr",
      sourceEmail: "reponse",
    });
  });
});
