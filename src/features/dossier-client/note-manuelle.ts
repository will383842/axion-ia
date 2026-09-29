/**
 * La NOTE MANUELLE — « Pas d'enregistrement : note manuelle »
 * (chantier visio, PR 4 ; plan §3.13, vérifications C5 et C10).
 *
 * Sept champs et une case, tapés par Will après un appel non enregistré
 * (téléphone, visio sans accord, appel improvisé) :
 *
 *   activité de la société · effectif · besoin · budget · décideur ·
 *   échéance · prochaine étape · [case] une objection a été exprimée
 *
 * Chaque champ rempli devient UN FAIT `saisie_manuelle`, du type
 * correspondant (`CHAMPS_DE_LA_NOTE`), rapporté par Williams, validé d'office
 * (c'est Will qui l'écrit), chiffré comme toute parole. Et la note produit un
 * `CompteRendu(origine = manuel, statut = valide)` : c'est lui qui ÉTEINT
 * l'alerte « rendez-vous tenu sans compte rendu » (F1).
 *
 * Portées : l'activité et l'effectif valent pour toute l'entreprise ; le
 * besoin, le budget, le décideur et l'échéance pour UN projet (table
 * `types-de-faits.ts`) — la note exige donc un projet dès qu'un de ces
 * champs est rempli (« Valider et préparer le devis » le crée au besoin, dans
 * la même transaction). La prochaine étape et l'objection vont au projet s'il
 * y en a un, sinon à l'entreprise.
 *
 * Ce module ne pose jamais `notes`, `contexteIa` ni `besoinsIdentifies` de la
 * fiche client : tout passe par des faits, effaçables un par un.
 */

import type { FaitType } from "../../../prisma/generated/client";
import { chiffrerParole } from "@/lib/chiffrer-parole";
import { TYPES_DE_FAITS } from "@/server/visio/types-de-faits";
import type { Tx } from "./base";

/** Les champs de la note, dans l'ordre de l'écran, et le type de fait de chacun. */
export const CHAMPS_DE_LA_NOTE = [
  { champ: "activite", type: "activite", libelle: "Ce que fait la société" },
  { champ: "effectif", type: "effectif", libelle: "Effectif" },
  { champ: "besoin", type: "besoin", libelle: "Besoin" },
  { champ: "budget", type: "budget", libelle: "Budget annoncé" },
  { champ: "decideur", type: "decideur", libelle: "Qui décide" },
  { champ: "echeance", type: "echeance", libelle: "Échéance" },
  { champ: "prochaineEtape", type: "prochaine_etape", libelle: "Prochaine étape" },
] as const satisfies ReadonlyArray<{ champ: string; type: FaitType; libelle: string }>;

export type ChampDeLaNote = (typeof CHAMPS_DE_LA_NOTE)[number]["champ"];

export type SaisieNote = Partial<Record<ChampDeLaNote, string | null>> & {
  /** La case « une objection a été exprimée ». */
  readonly objection?: boolean;
  /** Ce que le client a objecté (facultatif). */
  readonly objectionTexte?: string | null;
};

/** Un fait à écrire, avant chiffrement. PUR. */
export interface FaitDeLaNote {
  readonly type: FaitType;
  readonly cle: string;
  readonly portee: "entreprise" | "projet";
  readonly enonce: string;
  readonly quantite: number | null;
  readonly unite: "salaries" | null;
  readonly suivi: "ouvert" | null;
}

export class ErreurNote extends Error {}

const TAILLE_MAX_CHAMP = 1000;

function texte(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t === "" ? null : t.slice(0, TAILLE_MAX_CHAMP);
}

/** La clé d'un fait : « global » pour un type à valeur unique, sinon le texte réduit. */
export function cleDuFait(type: FaitType, enonce: string): string {
  if (TYPES_DE_FAITS[type].cardinalite === "unique") return "global";
  const reduit = enonce
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  return reduit === "" ? "global" : reduit;
}

/** La saisie est-elle vide ? */
export function noteVide(s: SaisieNote): boolean {
  return CHAMPS_DE_LA_NOTE.every((c) => texte(s[c.champ]) === null) && s.objection !== true;
}

/**
 * Les faits d'une note — un par champ rempli. PUR. `avecProjet` : un projet
 * est choisi pour la rencontre.
 */
export function faitsDeLaNote(s: SaisieNote, avecProjet: boolean): FaitDeLaNote[] {
  const faits: FaitDeLaNote[] = [];
  for (const { champ, type } of CHAMPS_DE_LA_NOTE) {
    const enonce = texte(s[champ]);
    if (enonce === null) continue;
    const meta = TYPES_DE_FAITS[type];
    const portee: "entreprise" | "projet" =
      (meta.porteesAdmises as readonly string[]).includes("projet") && avecProjet
        ? "projet"
        : (meta.porteesAdmises as readonly string[]).includes("entreprise")
          ? "entreprise"
          : "projet";
    if (portee === "projet" && !avecProjet) {
      throw new ErreurNote(
        "Le besoin, le budget, le décideur et l'échéance se rangent dans un projet : " +
          "choisissez-en un, ou créez-le.",
      );
    }
    const nombre = type === "effectif" ? /(\d[\d\s]*)/.exec(enonce)?.[1] : undefined;
    faits.push({
      type,
      cle: cleDuFait(type, enonce),
      portee,
      enonce,
      quantite: nombre ? Number(nombre.replace(/\s/g, "")) : null,
      unite: nombre ? "salaries" : null,
      suivi: meta.suivable ? "ouvert" : null,
    });
  }
  if (s.objection === true) {
    const enonce = texte(s.objectionTexte) ?? "Une objection a été exprimée.";
    faits.push({
      type: "objection",
      cle: cleDuFait("objection", enonce),
      portee: avecProjet ? "projet" : "entreprise",
      enonce,
      quantite: null,
      unite: null,
      suivi: "ouvert",
    });
  }
  return faits;
}

export interface EntreeNote {
  readonly rencontreId: string;
  readonly clientId: string;
  readonly projetId: string | null;
  readonly saisie: SaisieNote;
  readonly parAdminId: string;
  readonly constateLe: Date;
  readonly maintenant?: Date;
}

/** Version du contenu JSON du compte rendu d'une note manuelle. */
export const SCHEMA_NOTE_MANUELLE = 1;

/**
 * Écrit la note : ses faits (validés, chiffrés) et son compte rendu `manuel`
 * validé. À appeler DANS une transaction. Un compte rendu validé plus ancien
 * de la même rencontre passe `remplace` (un seul validé par rencontre, index).
 */
export async function enregistrerNoteManuelle(
  tx: Tx,
  e: EntreeNote,
): Promise<{ compteRenduId: string; faits: number }> {
  const faits = faitsDeLaNote(e.saisie, e.projetId !== null);
  if (faits.length === 0) {
    throw new ErreurNote("La note est vide : remplissez au moins un champ.");
  }
  const maintenant = e.maintenant ?? new Date();

  await tx.compteRendu.updateMany({
    where: { rencontreId: e.rencontreId, statut: "valide" },
    data: { statut: "remplace" },
  });
  const derniere = await tx.compteRendu.findFirst({
    where: { rencontreId: e.rencontreId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const libelle = (type: FaitType): string =>
    CHAMPS_DE_LA_NOTE.find((c) => c.type === type)?.libelle ?? "Objection";
  const contenu = {
    origine: "manuel",
    // Lu par l'onglet Échanges et la page du projet (« En bref »).
    enBref: faits.map((f) => `${libelle(f.type)} : ${f.enonce}`).join(" · "),
    champs: faits.map((f) => ({ type: f.type, enonce: f.enonce })),
  };
  const cr = await tx.compteRendu.create({
    data: {
      rencontreId: e.rencontreId,
      version: (derniere?.version ?? 0) + 1,
      origine: "manuel",
      statut: "valide",
      schemaVersion: SCHEMA_NOTE_MANUELLE,
      contenu: chiffrerParole(JSON.stringify(contenu)),
      valideParId: e.parAdminId,
      valideLe: maintenant,
    },
    select: { id: true },
  });

  for (const f of faits) {
    const fait = await tx.fait.create({
      data: {
        clientId: e.clientId,
        portee: f.portee,
        projetId: f.portee === "projet" ? e.projetId : null,
        type: f.type,
        cle: f.cle,
        enonce: chiffrerParole(f.enonce),
        quantite: f.quantite,
        unite: f.unite,
        certitude: "rapporte_par_williams",
        confiance: "haute",
        source: "saisie_manuelle",
        rencontreId: e.rencontreId,
        compteRenduId: cr.id,
        locuteur: "axion",
        constateLe: e.constateLe,
        statut: "valide",
        suivi: f.suivi,
      },
      select: { id: true },
    });
    await tx.faitEvenement.create({
      data: {
        faitId: fait.id,
        action: "valide",
        nouveauClientId: e.clientId,
        nouveauPortee: f.portee,
        nouveauProjetId: f.portee === "projet" ? e.projetId : null,
        parAdminId: e.parAdminId,
      },
    });
  }
  return { compteRenduId: cr.id, faits: faits.length };
}
