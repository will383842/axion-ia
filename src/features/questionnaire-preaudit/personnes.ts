/**
 * Le suivi du questionnaire avant audit, PERSONNE PAR PERSONNE (2026-10-27) — module PUR.
 *
 * Besoin de Will : savoir qui a répondu, qui remplit, qui a seulement ouvert, qui manque — sur la
 * base de l'équipe que le dirigeant a lui-même déclarée dans sa réponse. L'ancien affichage
 * comptait des réponses sans dire de qui, et divisait par toutes les questions du fichier.
 *
 * Ce module ne lit ni ne montre le CONTENU des réponses : il s'en sert pour COMPTER (taux) et pour
 * lire l'identité déclarée (prénom, nom, fonction). Sa sortie ne contient que des états, des dates,
 * des comptes, une tranche d'effectif et des identités avec leur source. ⛔ Elle ne contient JAMAIS
 * le code du dirigeant ; les autres codes y figurent sous la forme « …abcd » (4 caractères).
 */

import {
  tauxDeReponses,
  type ParcoursSquelette,
  type Squelette,
  type TauxDeReponses,
} from "./squelette";

// ── Entrées ─────────────────────────────────────────────────────────────────

export interface EntreeReponse {
  readonly id: string;
  readonly mode: string;
  /** Colonne `membre` de la ligne (le code du dirigeant y est NULL sauf en parcours collaborateur). */
  readonly membreColonne: string | null;
  readonly recuLe: Date;
  readonly ecartee: boolean;
  /** La charge déchiffrée ; `null` si mise à l'écart (jamais déchiffrée) ou illisible. */
  readonly charge: Readonly<Record<string, unknown>> | null;
}

export interface EntreeBrouillon {
  readonly id: string;
  readonly mode: string;
  readonly membre: string;
  readonly majLe: Date;
  /** L'instantané `{ data, more, pre }` déchiffré ; `null` si illisible. */
  readonly instantane: Readonly<Record<string, unknown>> | null;
}

export interface EntreeOuverture {
  readonly mode: string;
  readonly membre: string;
  readonly premiereOuverture: Date;
  readonly derniereOuverture: Date;
  readonly nombre: number;
  readonly derniereEtapeAtteinte: number;
}

export interface EntreePersonnes {
  readonly reponses: ReadonlyArray<EntreeReponse>;
  readonly brouillons: ReadonlyArray<EntreeBrouillon>;
  /** `null` : suivi des ouvertures éteint ou indisponible. */
  readonly ouvertures: ReadonlyArray<EntreeOuverture> | null;
  readonly estCodeDirigeant: (membre: string) => boolean;
  readonly squelette: Squelette | null;
  readonly luLe: Date | null;
}

// ── Sorties ─────────────────────────────────────────────────────────────────

export type EtatLigne =
  | "recu"
  | "ecartee"
  | "en_cours"
  | "ouvert"
  | "pas_de_nouvelles"
  | "pas_de_lien_prevu"
  | "lien_sans_code";

export type RoleLigne =
  "dirigeant" | "collaborateur" | "non_retrouvee" | "referent" | "journee_dirigeant";

/** D'où vient le nom : l'équipe déclarée, la réponse de la personne, ou son brouillon (réservé). */
export type SourceNom = "equipe" | "reponse" | "brouillon";

export interface LignePersonne {
  readonly cle: string;
  readonly role: RoleLigne;
  readonly nom: string | null;
  readonly fonction: string | null;
  readonly sourceNom: SourceNom | null;
  /** « …abcd » : jamais le code du dirigeant. */
  readonly codeCourt: string | null;
  /** « nom » : rapprochée par le nom, à vérifier. `sansCode` : réponse reçue sans code personnel. */
  readonly rapprochement: "code" | "nom" | null;
  readonly sansCode: boolean;
  readonly etat: EtatLigne;
  /** Dernière réponse non écartée. */
  readonly recuLe: Date | null;
  readonly nbEnvois: number;
  /** Reçue après la dernière lecture de Will (ou jamais lue). */
  readonly pasEncoreLue: boolean;
  readonly brouillonId: string | null;
  readonly brouillonMajLe: Date | null;
  readonly ouverture: { readonly nombre: number; readonly derniere: Date } | null;
  readonly taux: TauxDeReponses | null;
  /** Réponse du dirigeant reçue sans son code : peut venir d'un salarié (« à vérifier »). */
  readonly aVerifier: boolean;
}

export interface ComptesCollaborateurs {
  readonly declares: number;
  readonly sansLienPrevu: number;
  readonly attendus: number;
  readonly recus: number;
  readonly enCours: number;
  readonly ouvertsSeulement: number;
  readonly manquants: number;
}

export interface ComptesTotal {
  readonly attendus: number;
  readonly recus: number;
}

export interface Effectif {
  readonly tranche: string;
  readonly remarque: "liste_incomplete" | "liste_depasse" | null;
}

export interface SuiviParPersonne {
  readonly equipe: {
    readonly connue: boolean;
    readonly source: "reponse" | "brouillon" | "reponse_sans_code" | null;
  };
  readonly dirigeant: LignePersonne;
  readonly collaborateurs: ReadonlyArray<LignePersonne>;
  readonly referents: ReadonlyArray<LignePersonne>;
  /** La « journée type » du dirigeant : HORS du total X sur Y. */
  readonly journeeDirigeant: LignePersonne | null;
  readonly collab: ComptesCollaborateurs;
  readonly total: ComptesTotal;
  readonly effectif: Effectif | null;
  /** Fiches de l'équipe sans prénom ni nom : aucune ligne possible. */
  readonly fichesSansNom: number;
  readonly ouverturesIndisponibles: boolean;
}

// ── Petits outils ───────────────────────────────────────────────────────────

type Dico = Readonly<Record<string, unknown>>;

const objet = (v: unknown): Dico | null =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Dico) : null;
const texte = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const CODE = /^[A-Za-z0-9_-]{12,60}$/;

const sansAccents = (s: string): string =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

const codeCourt = (code: string): string => `…${code.slice(-4)}`;

/** Les réponses d'un brouillon : `data`, sinon `donnees`, `reponses`, `answers`, sinon l'objet. */
export function valeursDuBrouillon(instantane: Dico | null): Dico {
  if (instantane === null) return {};
  for (const cle of ["data", "donnees", "reponses", "answers"]) {
    const v = objet(instantane[cle]);
    if (v !== null) return v;
  }
  return instantane;
}

const valeursDeLaCharge = (charge: Dico | null): Dico => objet(charge?.["donnees"]) ?? {};

interface Identite {
  readonly prenom: string;
  readonly nom: string;
  readonly fonction: string;
}

function identiteDeLaReponse(charge: Dico | null): Identite | null {
  if (charge === null) return null;
  const d = valeursDeLaCharge(charge);
  for (const bloc of [objet(charge["collaborateur"]), objet(charge["lien"])]) {
    if (bloc === null) continue;
    const prenom = texte(bloc["prenom"]);
    const nom = texte(bloc["nom"]);
    if (prenom !== "" || nom !== "") return { prenom, nom, fonction: texte(bloc["fonction"]) };
  }
  const prenom = texte(d["id_prenom"]);
  const nom = texte(d["id_nom"]);
  return prenom !== "" || nom !== "" ? { prenom, nom, fonction: texte(d["id_role"]) } : null;
}

function identiteDuBrouillon(b: EntreeBrouillon): Identite | null {
  const d = valeursDuBrouillon(b.instantane);
  const prenom = texte(d["id_prenom"]);
  const nom = texte(d["id_nom"]);
  return prenom !== "" || nom !== "" ? { prenom, nom, fonction: texte(d["id_role"]) } : null;
}

const nomComplet = (i: Identite): string => [i.prenom, i.nom].filter((x) => x !== "").join(" ");

/** Le code d'une réponse : la colonne, sinon celui que la charge porte. */
function codeDeLaReponse(r: EntreeReponse): string | null {
  if (r.membreColonne !== null && r.membreColonne !== "") return r.membreColonne;
  const c = r.charge;
  if (c === null) return null;
  const m = texte(c["membre"]);
  if (m !== "") return m;
  const m2 = texte(objet(c["collaborateur"])?.["membre"]);
  return m2 !== "" ? m2 : null;
}

// ── Regroupement ────────────────────────────────────────────────────────────

interface Seau {
  reponses: EntreeReponse[];
  brouillon: EntreeBrouillon | null;
  ouverture: EntreeOuverture | null;
  rapprochement: "code" | "nom" | null;
}

const seauVide = (): Seau => ({
  reponses: [],
  brouillon: null,
  ouverture: null,
  rapprochement: null,
});

function plusRecente(a: EntreeOuverture | null, b: EntreeOuverture): EntreeOuverture {
  return a === null || b.derniereOuverture > a.derniereOuverture ? b : a;
}

const aDeLActivite = (s: Seau): boolean =>
  s.reponses.length > 0 || s.brouillon !== null || s.ouverture !== null;

interface Declaree {
  readonly identite: Identite;
  readonly code: string | null;
  readonly lienPrevu: boolean;
  readonly seau: Seau;
}

function lireEquipe(
  valeurs: Dico,
  estCodeDirigeant: (m: string) => boolean,
): { personnes: Declaree[]; sansNom: number } {
  const liste = Array.isArray(valeurs["equipe"]) ? (valeurs["equipe"] as unknown[]) : [];
  const personnes: Declaree[] = [];
  let sansNom = 0;
  for (const brut of liste) {
    const e = objet(brut);
    if (e === null) continue;
    const prenom = texte(e["prenom"]);
    const nom = texte(e["nom"]);
    if (prenom === "" && nom === "") {
      sansNom++;
      continue;
    }
    const id = texte(e["id"]);
    personnes.push({
      identite: { prenom, nom, fonction: texte(e["role"]) },
      code: CODE.test(id) && !estCodeDirigeant(id) ? id : null,
      lienPrevu: !/^Non/.test(texte(e["journee"])),
      seau: seauVide(),
    });
  }
  return { personnes, sansNom };
}

// ── Effectif ────────────────────────────────────────────────────────────────

function lireTranche(brut: string): { bas: number; haut: number } | null {
  const plage = /(\d+)\s*(?:à|-|a)\s*(\d+)/i.exec(brut);
  if (plage !== null) return { bas: Number(plage[1]), haut: Number(plage[2]) };
  const plus = /(\d+)\s*(?:et plus|\+|ou plus)/i.exec(brut);
  if (plus !== null) return { bas: Number(plus[1]), haut: Number.POSITIVE_INFINITY };
  return null;
}

// ── Construction ────────────────────────────────────────────────────────────

export function suivreParPersonne(e: EntreePersonnes): SuiviParPersonne {
  const { estCodeDirigeant, squelette } = e;
  const parRecence = <T extends { recuLe: Date }>(l: T[]): T[] =>
    [...l].sort((a, b) => b.recuLe.getTime() - a.recuLe.getTime());

  // 1. L'équipe lue.
  const principales = parRecence(e.reponses.filter((r) => r.mode === "main" && !r.ecartee));
  const authentifiee = principales.find((r) => {
    const m = texte(r.charge?.["membre"]);
    return r.charge !== null && m !== "" && estCodeDirigeant(m);
  });
  const brouillonDirigeant =
    e.brouillons.find((b) => b.mode === "main" && b.instantane !== null) ?? null;
  const sansCode = principales.find((r) => r.charge !== null);
  let valeursEquipe: Dico | null = null;
  let source: SuiviParPersonne["equipe"]["source"] = null;
  if (authentifiee !== undefined) {
    valeursEquipe = valeursDeLaCharge(authentifiee.charge);
    source = "reponse";
  } else if (brouillonDirigeant !== null) {
    valeursEquipe = valeursDuBrouillon(brouillonDirigeant.instantane);
    source = "brouillon";
  } else if (sansCode !== undefined) {
    valeursEquipe = valeursDeLaCharge(sansCode.charge);
    source = "reponse_sans_code";
  }
  const equipeConnue = valeursEquipe !== null;
  const lue = lireEquipe(valeursEquipe ?? {}, estCodeDirigeant);
  const declarees = lue.personnes;
  const parCode = new Map<string, Declaree>();
  for (const p of declarees) if (p.code !== null && !parCode.has(p.code)) parCode.set(p.code, p);

  // 2. Dirigeant.
  const seauDirigeant = seauVide();
  seauDirigeant.reponses = e.reponses.filter((r) => r.mode === "main");
  seauDirigeant.brouillon = e.brouillons.find((b) => b.mode === "main") ?? null;
  for (const o of e.ouvertures ?? []) {
    if (o.mode === "main") seauDirigeant.ouverture = plusRecente(seauDirigeant.ouverture, o);
  }

  // 3. Classement par code.
  const seauJournee = seauVide();
  const inconnus = new Map<string, { seau: Seau; mode: "emp" | "it" }>();
  const referents = new Map<string, Seau>();
  const sansCodeEmp: EntreeReponse[] = [];

  const rangerCollab = (code: string, ajout: (s: Seau) => void): void => {
    if (estCodeDirigeant(code)) return ajout(seauJournee);
    const connue = parCode.get(code);
    if (connue !== undefined) {
      connue.seau.rapprochement = "code";
      return ajout(connue.seau);
    }
    const existant = inconnus.get(code) ?? { seau: seauVide(), mode: "emp" as const };
    inconnus.set(code, existant);
    ajout(existant.seau);
  };
  const rangerReferent = (code: string, ajout: (s: Seau) => void): void => {
    const s = referents.get(code) ?? seauVide();
    referents.set(code, s);
    ajout(s);
  };

  for (const r of e.reponses) {
    if (r.mode === "emp") {
      const code = codeDeLaReponse(r);
      if (code === null) sansCodeEmp.push(r);
      else rangerCollab(code, (s) => s.reponses.push(r));
    } else if (r.mode === "it") {
      rangerReferent(codeDeLaReponse(r) ?? "", (s) => s.reponses.push(r));
    }
  }
  for (const b of e.brouillons) {
    if (b.mode === "emp") {
      rangerCollab(b.membre, (s) => {
        if (s.brouillon === null || b.majLe > s.brouillon.majLe) s.brouillon = b;
      });
    } else if (b.mode === "it") {
      rangerReferent(b.membre, (s) => {
        if (s.brouillon === null || b.majLe > s.brouillon.majLe) s.brouillon = b;
      });
    }
  }
  for (const o of e.ouvertures ?? []) {
    if (o.mode === "lien" || o.mode === "main" || o.membre === "") continue;
    const pourReferent = o.mode === "it" || (o.mode === "perso" && o.membre.startsWith("it-"));
    if (pourReferent) rangerReferent(o.membre, (s) => (s.ouverture = plusRecente(s.ouverture, o)));
    else rangerCollab(o.membre, (s) => (s.ouverture = plusRecente(s.ouverture, o)));
  }

  // 4. Réponses sans code : rapprochement par le nom, seulement s'il n'y a pas d'ambiguïté.
  const cleNom = (i: Identite): string => sansAccents(`${i.prenom} ${i.nom}`);
  const nonRapprochees: EntreeReponse[] = [];
  for (const r of parRecence(sansCodeEmp).reverse()) {
    const id = identiteDeLaReponse(r.charge);
    const candidates =
      id === null
        ? []
        : declarees.filter((p) => !aDeLActivite(p.seau) && cleNom(p.identite) === cleNom(id));
    if (candidates.length === 1) {
      const p = candidates[0] as Declaree;
      p.seau.reponses.push(r);
      p.seau.rapprochement = "nom";
    } else {
      nonRapprochees.push(r);
    }
  }

  // 5. Lignes.
  const ligneDe = (
    cle: string,
    role: RoleLigne,
    mode: ParcoursSquelette,
    seau: Seau,
    ident: { nom: string | null; fonction: string | null; source: SourceNom | null },
    vide: EtatLigne,
    code: string | null,
    sansCodePerso: boolean,
    aVerifier = false,
  ): LignePersonne => {
    const valides = parRecence(seau.reponses.filter((r) => !r.ecartee));
    const derniere = valides[0] ?? null;
    let etat: EtatLigne;
    if (derniere !== null) etat = "recu";
    else if (seau.reponses.length > 0) etat = "ecartee";
    else if (seau.brouillon !== null) etat = "en_cours";
    else if (seau.ouverture !== null) etat = "ouvert";
    else etat = vide;

    let taux: TauxDeReponses | null = null;
    if (derniere !== null) {
      if (derniere.charge !== null) {
        taux = tauxDeReponses(valeursDeLaCharge(derniere.charge), squelette, mode);
      }
    } else if (seau.reponses.length === 0 && seau.brouillon?.instantane != null) {
      const pre = Array.isArray(seau.brouillon.instantane["pre"])
        ? new Set(
            (seau.brouillon.instantane["pre"] as unknown[]).filter((x) => typeof x === "string"),
          )
        : new Set<string>();
      taux = tauxDeReponses(
        valeursDuBrouillon(seau.brouillon.instantane),
        squelette,
        mode,
        pre as ReadonlySet<string>,
      );
    }
    return {
      cle,
      role,
      nom: ident.nom,
      fonction: ident.fonction,
      sourceNom: ident.source,
      codeCourt: code === null ? null : codeCourt(code),
      rapprochement: seau.rapprochement,
      sansCode: sansCodePerso,
      etat,
      recuLe: derniere?.recuLe ?? null,
      nbEnvois: valides.length,
      pasEncoreLue:
        derniere !== null && (e.luLe === null || derniere.recuLe.getTime() > e.luLe.getTime()),
      brouillonId: seau.brouillon?.id ?? null,
      brouillonMajLe: seau.brouillon?.majLe ?? null,
      ouverture:
        seau.ouverture === null
          ? null
          : { nombre: seau.ouverture.nombre, derniere: seau.ouverture.derniereOuverture },
      taux,
      aVerifier,
    };
  };

  // Un nom tiré d'une réponse ou d'un brouillon, pour une personne hors de la liste.
  const identiteDuSeau = (
    s: Seau,
  ): { nom: string | null; fonction: string | null; source: SourceNom | null } => {
    for (const r of parRecence(s.reponses)) {
      const i = identiteDeLaReponse(r.charge);
      if (i !== null && nomComplet(i) !== "") {
        return { nom: nomComplet(i), fonction: i.fonction || null, source: "reponse" };
      }
    }
    if (s.brouillon !== null) {
      const i = identiteDuBrouillon(s.brouillon);
      if (i !== null && nomComplet(i) !== "") {
        return { nom: nomComplet(i), fonction: i.fonction || null, source: "brouillon" };
      }
    }
    return { nom: null, fonction: null, source: null };
  };

  const ligneDirigeant = ligneDe(
    "dirigeant",
    "dirigeant",
    "main",
    seauDirigeant,
    { nom: null, fonction: null, source: null },
    "pas_de_nouvelles",
    null,
    false,
    authentifiee === undefined && principales.length > 0,
  );

  const lignesCollab: LignePersonne[] = [];
  declarees.forEach((p, i) => {
    const vide: EtatLigne = !p.lienPrevu
      ? "pas_de_lien_prevu"
      : p.code === null
        ? "lien_sans_code"
        : "pas_de_nouvelles";
    lignesCollab.push(
      ligneDe(
        `c${i}`,
        "collaborateur",
        "emp",
        p.seau,
        { nom: nomComplet(p.identite), fonction: p.identite.fonction || null, source: "equipe" },
        vide,
        p.code,
        false,
      ),
    );
  });
  const horsListe: LignePersonne[] = [];
  let k = 0;
  for (const [code, { seau }] of inconnus) {
    horsListe.push(
      ligneDe(
        `h${k++}`,
        equipeConnue ? "non_retrouvee" : "collaborateur",
        "emp",
        seau,
        identiteDuSeau(seau),
        "pas_de_nouvelles",
        code,
        false,
      ),
    );
  }
  for (const r of nonRapprochees) {
    const s = seauVide();
    s.reponses.push(r);
    horsListe.push(
      ligneDe(
        `h${k++}`,
        equipeConnue ? "non_retrouvee" : "collaborateur",
        "emp",
        s,
        identiteDuSeau(s),
        "pas_de_nouvelles",
        null,
        true,
      ),
    );
  }

  const lignesReferent: LignePersonne[] = [];
  if (referents.size === 0) {
    lignesReferent.push(
      ligneDe(
        "r0",
        "referent",
        "it",
        seauVide(),
        { nom: null, fonction: null, source: null },
        "pas_de_nouvelles",
        null,
        false,
      ),
    );
  } else {
    let n = 0;
    for (const [code, seau] of referents) {
      lignesReferent.push(
        ligneDe(
          `r${n++}`,
          "referent",
          "it",
          seau,
          identiteDuSeau(seau),
          "pas_de_nouvelles",
          code === "" ? null : code,
          code === "",
        ),
      );
    }
  }

  const refuseJournee = texte(valeursEquipe?.["dir_journee"]).startsWith("Non");
  const journeeDirigeant =
    aDeLActivite(seauJournee) || (equipeConnue && !refuseJournee)
      ? ligneDe(
          "journee",
          "journee_dirigeant",
          "emp",
          seauJournee,
          { nom: null, fonction: null, source: null },
          "pas_de_nouvelles",
          null,
          false,
        )
      : null;

  // 6. Comptes.
  const toutesCollab = [...lignesCollab, ...horsListe];
  const compte = (l: LignePersonne): boolean => {
    if (l.role === "collaborateur" && l.sourceNom === "equipe") {
      return l.etat !== "pas_de_lien_prevu" && l.etat !== "lien_sans_code";
    }
    // Personne hors liste : attendue seulement si elle a répondu ou commencé.
    return l.etat === "recu" || l.etat === "ecartee" || l.etat === "en_cours";
  };
  const attendusLignes = toutesCollab.filter(compte);
  const recus = attendusLignes.filter((l) => l.etat === "recu").length;
  const enCours = attendusLignes.filter((l) => l.etat === "en_cours").length;
  const ouverts = attendusLignes.filter((l) => l.etat === "ouvert").length;
  const sansLien = lignesCollab.filter(
    (l) => l.etat === "pas_de_lien_prevu" || l.etat === "lien_sans_code",
  ).length;
  const collab: ComptesCollaborateurs = {
    declares: declarees.length,
    sansLienPrevu: sansLien,
    attendus: attendusLignes.length,
    recus,
    enCours,
    ouvertsSeulement: ouverts,
    manquants: attendusLignes.length - recus - enCours,
  };
  const referentRecu = lignesReferent.some((l) => l.etat === "recu");
  const total: ComptesTotal = {
    attendus: 1 + collab.attendus + 1,
    recus: (ligneDirigeant.etat === "recu" ? 1 : 0) + recus + (referentRecu ? 1 : 0),
  };

  // 7. Effectif.
  let effectif: Effectif | null = null;
  const brutEffectif = texte(valeursEquipe?.["ent_effectif"]);
  if (brutEffectif !== "") {
    const t = lireTranche(brutEffectif);
    let remarque: Effectif["remarque"] = null;
    if (t !== null && equipeConnue) {
      const n = declarees.length + 1;
      if (n < t.bas) remarque = "liste_incomplete";
      else if (n > t.haut) remarque = "liste_depasse";
    }
    effectif = { tranche: brutEffectif, remarque };
  }

  return {
    equipe: { connue: equipeConnue, source },
    dirigeant: ligneDirigeant,
    collaborateurs: toutesCollab,
    referents: lignesReferent,
    journeeDirigeant,
    collab,
    total,
    effectif,
    fichesSansNom: lue.sansNom,
    ouverturesIndisponibles: e.ouvertures === null,
  };
}

// ── Phrases ─────────────────────────────────────────────────────────────────

const MOTS_ETAT: Readonly<Record<EtatLigne, string>> = {
  recu: "reçu",
  ecartee: "réponse mise de côté",
  en_cours: "en train de remplir",
  ouvert: "ouvert, rien d'enregistré",
  pas_de_nouvelles: "pas de nouvelles",
  pas_de_lien_prevu: "pas de lien prévu",
  lien_sans_code: "lien sans code",
};

export const motsDEtat = (e: EtatLigne): string => MOTS_ETAT[e];

function joindre(morceaux: ReadonlyArray<string>): string {
  if (morceaux.length <= 1) return morceaux.join("");
  return `${morceaux.slice(0, -1).join(", ")} et ${morceaux[morceaux.length - 1]}`;
}

/** La phrase d'en-tête : qui a répondu, et ce qu'il manque. */
export function phraseEnTete(s: SuiviParPersonne): string {
  if (!s.equipe.connue) {
    return (
      `Dirigeant : ${motsDEtat(s.dirigeant.etat)}. L'équipe n'est pas encore déclarée : ` +
      "on ne sait pas encore combien de collaborateurs attendre."
    );
  }
  const manque: string[] = [];
  if (s.dirigeant.etat !== "recu") manque.push("le dirigeant");
  const k = s.collab.attendus - s.collab.recus;
  if (k > 0) {
    manque.push(
      `${k} collaborateur${k > 1 ? "s" : ""}` +
        (s.collab.enCours > 0 ? ` (dont ${s.collab.enCours} en train de remplir)` : ""),
    );
  }
  if (!s.referents.some((l) => l.etat === "recu")) {
    manque.push("le référent informatique (si la partie technique lui a été confiée)");
  }
  if (manque.length === 0) return `Tout est reçu : ${s.total.recus} sur ${s.total.attendus}.`;
  return `${s.total.recus} sur ${s.total.attendus} reçus : il manque ${joindre(manque)}.`;
}

export function ligneEquipe(s: SuiviParPersonne): string {
  const c = s.collab;
  return (
    `Collaborateurs : déclarés ${c.declares} · reçus ${c.recus} · en cours ${c.enCours} · ` +
    `manquants ${c.manquants}` +
    (c.sansLienPrevu > 0 ? ` · ${c.sansLienPrevu} sans lien (choix du dirigeant)` : "")
  );
}
