/**
 * 🔴 CHANTIER QNC, LOT L11 — UNE SEULE RÈGLE DE LECTURE : CE QUE MONTRE
 * L'ÉCRAN EST CE QUE CONTIENT LE ZIP.
 *
 * Le dossier de session se lit à deux endroits : l'onglet « Dossier » de la
 * fiche session, et le ZIP remis au certificateur. Deux rendus écrits chacun de
 * leur côté finiraient par diverger — c'est l'histoire de ce dépôt (cf.
 * `piece-admissible.ts`, `hors-dossier-audit.ts`). Ici, il n'y a qu'UN rendu :
 * `rendreDossier` produit les groupes, les entrées, leurs lignes et les fichiers
 * qu'elles désignent ; l'écran affiche ce rendu, le ZIP l'écrit. Rien d'autre.
 *
 * Classement : destinataire → canal → date (heure de Paris), dans l'ordre fixe
 * de `classement.ts`. Les blocs Moyens, Réclamations et Adaptation suivent.
 *
 * Deux règles qui ne se voient qu'ici :
 *   · une pièce REMPLACÉE reste au dossier, étiquetée « remplacée par … », et
 *     n'entre dans AUCUN chiffre (`horsVoyants`) ;
 *   · un élément du BANC D'ESSAI (session ou inscription `estTestInterne`)
 *     est montré, étiqueté, et exclu des chiffres réels.
 *
 * Module PUR.
 */

import { dateHeureParis } from "@/server/qualiopi/sessions/verrou-dossier-pur";
import { parisDateISO, parisMinutesDuJour } from "@/server/qualiopi/presence/time";

import {
  LIBELLE_CANAL,
  LIBELLE_DESTINATAIRE,
  ORDRE_CANAUX,
  ORDRE_DESTINATAIRES,
  type Canal,
  type Destinataire,
} from "./classement";

export type NatureElement = "piece" | "email" | "remise" | "retour" | "relance";

export const LIBELLE_NATURE: Record<NatureElement, string> = {
  piece: "Pièce",
  email: "E-mail",
  remise: "Remise",
  retour: "Retour",
  relance: "Relance",
};

export interface ElementDossier {
  /** Unique et stable : `<nature>:<identifiant>`. */
  readonly cle: string;
  readonly nature: NatureElement;
  readonly destinataire: Destinataire;
  readonly canal: Canal;
  /** Date posée par le serveur. */
  readonly date: Date;
  readonly titre: string;
  readonly details: readonly string[];
  readonly etiquettes: readonly string[];
  /** Rattaché au banc d'essai (session ou inscription) : hors chiffres réels. */
  readonly essai: boolean;
  /** Pièce remplacée : montrée, mais dans aucun chiffre. */
  readonly horsVoyants: boolean;
  /** Chemin du PDF dans le ZIP, pour une pièce. */
  readonly cheminPdf?: string | null;
  /** Copie de l'e-mail tel qu'il est parti, pour un e-mail. */
  readonly copie?: { readonly sujet: string; readonly html: string; readonly texte: string } | null;
}

export type IdBloc = "moyens" | "reclamations" | "adaptation";

export interface BlocDossier {
  readonly id: IdBloc;
  readonly titre: string;
  readonly lignes: readonly string[];
}

export interface ModeleDossierSession {
  readonly session: {
    readonly numero: string;
    readonly titre: string;
    readonly estTestInterne: boolean;
  };
  readonly elements: readonly ElementDossier[];
  readonly blocs: readonly BlocDossier[];
  /** Pièces et e-mails de facturation, de rémunération ou d'employeur : comptés, non repris. */
  readonly horsDossier: { readonly pieces: number; readonly emails: number };
  /** Une lecture qui a échoué — jamais tue, jamais rendue comme « aucun ». */
  readonly avertissements: readonly string[];
}

export interface FichierRendu {
  readonly chemin: string;
  readonly sorte: "pdf" | "html" | "texte";
}

export interface EntreeRendue {
  readonly cle: string;
  readonly nature: NatureElement;
  /** « 30/09/2026 à 14:05 (heure de Paris) ». */
  readonly quand: string;
  readonly titre: string;
  readonly lignes: readonly string[];
  readonly etiquettes: readonly string[];
  readonly fichiers: readonly FichierRendu[];
}

export interface GroupeCanalRendu {
  readonly canal: Canal;
  readonly libelle: string;
  readonly entrees: readonly EntreeRendue[];
}

export interface GroupeDestinataireRendu {
  readonly destinataire: Destinataire;
  readonly libelle: string;
  readonly canaux: readonly GroupeCanalRendu[];
}

export interface DossierRendu {
  readonly entete: readonly string[];
  readonly groupes: readonly GroupeDestinataireRendu[];
  readonly blocs: readonly BlocDossier[];
  readonly chiffres: readonly string[];
  readonly avertissements: readonly string[];
}

/** Racine du dossier complet dans le ZIP. */
export const RACINE_DOSSIER_COMPLET = "dossier-complet";

function deuxChiffres(n: number): string {
  return String(n).padStart(2, "0");
}

/** `2026-09-30_14h05` en heure de Paris : trie les fichiers dans l'ordre des faits. */
export function horodatageFichier(d: Date): string {
  const minutes = parisMinutesDuJour(d);
  return `${parisDateISO(d)}_${deuxChiffres(Math.floor(minutes / 60))}h${deuxChiffres(minutes % 60)}`;
}

/** Un fragment de chemin sûr : ni séparateur, ni remontée, ni caractère exotique. */
export function fragmentSur(texte: string): string {
  const sur = texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return sur === "" ? "sans-titre" : sur;
}

function fichiersDe(e: ElementDossier): FichierRendu[] {
  const fichiers: FichierRendu[] = [];
  if (e.cheminPdf) fichiers.push({ chemin: e.cheminPdf, sorte: "pdf" });
  if (e.copie) {
    const base = `${RACINE_DOSSIER_COMPLET}/${e.destinataire}/${e.canal}/${horodatageFichier(e.date)}_${fragmentSur(e.cle)}`;
    fichiers.push({ chemin: `${base}.html`, sorte: "html" });
    fichiers.push({ chemin: `${base}.txt`, sorte: "texte" });
  }
  return fichiers;
}

function comparer(a: ElementDossier, b: ElementDossier): number {
  const d = a.date.getTime() - b.date.getTime();
  // À date égale, l'ordre de la clé : le rendu est déterministe, donc l'écran
  // et le ZIP tirés à une seconde d'écart listent dans le même ordre.
  return d !== 0 ? d : a.cle < b.cle ? -1 : a.cle > b.cle ? 1 : 0;
}

function pluriel(n: number, mot: string): string {
  return `${n} ${mot}${n > 1 ? "s" : ""}`;
}

/** Le rendu UNIQUE du dossier, lu par l'écran et par le ZIP. */
export function rendreDossier(m: ModeleDossierSession): DossierRendu {
  const entete = [
    `Dossier complet — session ${m.session.numero}`,
    m.session.titre,
    "Classement : destinataire, puis canal, puis date (heure de Paris).",
  ];
  if (m.session.estTestInterne) {
    entete.push(
      "SESSION DU BANC D'ESSAI — rien de ce dossier ne compte dans les chiffres réels de l'organisme.",
    );
  }

  const groupes: GroupeDestinataireRendu[] = [];
  for (const destinataire of ORDRE_DESTINATAIRES) {
    const canaux: GroupeCanalRendu[] = [];
    for (const canal of ORDRE_CANAUX) {
      const elements = m.elements
        .filter((e) => e.destinataire === destinataire && e.canal === canal)
        .sort(comparer);
      if (elements.length === 0) continue;
      canaux.push({
        canal,
        libelle: LIBELLE_CANAL[canal],
        entrees: elements.map((e) => ({
          cle: e.cle,
          nature: e.nature,
          quand: dateHeureParis(e.date),
          titre: e.titre,
          lignes: e.details,
          etiquettes: [...e.etiquettes, ...(e.essai ? ["Banc d'essai — hors chiffres réels"] : [])],
          fichiers: fichiersDe(e),
        })),
      });
    }
    if (canaux.length > 0) {
      groupes.push({ destinataire, libelle: LIBELLE_DESTINATAIRE[destinataire], canaux });
    }
  }

  // Les CHIFFRES RÉELS : ni banc d'essai, ni pièce remplacée.
  const reels = m.elements.filter((e) => !e.essai && !e.horsVoyants);
  const compte = (n: NatureElement): number => reels.filter((e) => e.nature === n).length;
  const essais = m.elements.filter((e) => e.essai).length;
  const remplacees = m.elements.filter((e) => e.horsVoyants).length;
  const chiffres = [
    `Chiffres réels : ${pluriel(compte("piece"), "pièce")}, ${pluriel(compte("email"), "e-mail")}, ${pluriel(compte("remise"), "remise")}, ${pluriel(compte("retour"), "retour")}, ${pluriel(compte("relance"), "relance")}.`,
  ];
  if (remplacees > 0) {
    chiffres.push(
      `${pluriel(remplacees, "pièce")} remplacée${remplacees > 1 ? "s" : ""}, gardée${remplacees > 1 ? "s" : ""} au dossier et exclue${remplacees > 1 ? "s" : ""} des chiffres.`,
    );
  }
  if (essais > 0) {
    chiffres.push(
      `${pluriel(essais, "élément")} du banc d'essai, montré${essais > 1 ? "s" : ""} et exclu${essais > 1 ? "s" : ""} des chiffres réels.`,
    );
  }
  if (m.horsDossier.pieces + m.horsDossier.emails > 0) {
    chiffres.push(
      `Non repris (facturation, rémunération, employeur — aucun indicateur ne les réclame) : ${pluriel(m.horsDossier.pieces, "pièce")}, ${pluriel(m.horsDossier.emails, "e-mail")}.`,
    );
  }

  return { entete, groupes, blocs: m.blocs, chiffres, avertissements: m.avertissements };
}

/** Les lignes d'une entrée, telles que l'index du ZIP les écrit. */
export function lignesEntree(e: EntreeRendue): string[] {
  return [
    `      ${e.quand} — ${LIBELLE_NATURE[e.nature]} — ${e.titre}${
      e.etiquettes.length > 0 ? ` [${e.etiquettes.join(" ; ")}]` : ""
    }`,
    ...e.lignes.map((l) => `        ${l}`),
    ...e.fichiers.map((f) => `        → ${f.chemin}`),
  ];
}

/** L'index texte du dossier complet : TOUT ce que l'écran montre, dans le même ordre. */
export function lignesIndexDossier(r: DossierRendu): string[] {
  const lignes: string[] = [...r.entete, "", ...r.chiffres];
  for (const g of r.groupes) {
    lignes.push("", `== ${g.libelle} ==`);
    for (const c of g.canaux) {
      lignes.push(`   ${c.libelle} :`);
      for (const e of c.entrees) lignes.push(...lignesEntree(e));
    }
  }
  if (r.groupes.length === 0)
    lignes.push("", "Aucune pièce, aucun e-mail, aucune remise rattachés.");
  for (const b of r.blocs) lignes.push("", `== ${b.titre} ==`, ...b.lignes.map((l) => `   ${l}`));
  if (r.avertissements.length > 0) {
    lignes.push("", "AVERTISSEMENTS :", ...r.avertissements.map((a) => `   ${a}`));
  }
  return lignes;
}

/** Tous les fichiers que désignent les entrées (PDF compris). */
export function fichiersDossier(r: DossierRendu): FichierRendu[] {
  return r.groupes.flatMap((g) => g.canaux.flatMap((c) => c.entrees.flatMap((e) => e.fichiers)));
}

/** Toutes les clés, dans l'ordre d'affichage — le témoin « écran = ZIP ». */
export function clesDossier(r: DossierRendu): string[] {
  return r.groupes.flatMap((g) => g.canaux.flatMap((c) => c.entrees.map((e) => e.cle)));
}

/** Le fichier texte d'une copie d'e-mail : en-tête lisible, puis la version texte. */
export function texteCopieEmail(e: EntreeRendue, copie: { sujet: string; texte: string }): string {
  return [
    `Objet : ${copie.sujet}`,
    `Envoyé : ${e.quand}`,
    ...e.lignes,
    ...(e.etiquettes.length > 0 ? [`Étiquettes : ${e.etiquettes.join(" ; ")}`] : []),
    "",
    copie.texte,
  ].join("\n");
}
