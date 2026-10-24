/**
 * La fiche prospect se COMPLÈTE depuis la réponse du dirigeant au questionnaire (25/10/2026).
 *
 * Quand le dirigeant (réponse AUTHENTIFIÉE par son code) envoie ses réponses, les champs
 * OBJECTIFS que la fiche n'a pas encore sont copiés : SIRET et SIREN, adresse (rue, code postal,
 * ville), secteur, et la personne à contacter (ajoutée à la fiche, jamais à la place d'une autre).
 *
 *   · ⛔ JAMAIS un écrasement : un champ déjà rempli (par Will ou autrement) n'est pas touché ;
 *   · la raison sociale n'est jamais remplacée (une fiche en a toujours une) ;
 *   · le SIREN passe par le même verrou et la même recherche que la création
 *     (`exigerSirenLibre`) : s'il est déjà celui d'une autre fiche, il n'est PAS posé (rien
 *     n'est fusionné ; la trace le dit) ;
 *   · non copiés, gardés dans le questionnaire : l'effectif (une TRANCHE, « 20 à 49 », alors que
 *     la fiche attend un nombre qui gouverne des seuils), les outils et les sites (aucun champ de
 *     la fiche) ;
 *   · une trace d'audit (`client.complete_depuis_questionnaire`) dit quoi, quand, d'où (référence,
 *     questionnaire, rencontre : le lien vers le questionnaire) ; sans auteur (geste automatique) ;
 *   · Axion Partners : `emettreFaitClient` dans la même transaction (cliquet des écrivains) ;
 *   · best-effort : une panne ici ne perd JAMAIS la réponse, déjà enregistrée (`route.ts`).
 */

import { prisma } from "@/lib/prisma";
import { checkSirenFormat, checkSiretFormat, sirenDuSiret } from "@/lib/siret";
import {
  ajouterPersonneAFiche,
  ErreurSirenDejaPris,
  exigerSirenLibre,
} from "@/server/qualiopi/crm/porte-client";
import { chargeClientAvant, emettreFaitClient } from "@/server/partners-sync/producteurs/client";
import { codeDirigeantPreauditValide } from "@/server/visio/questionnaire-en-ligne/jeton";
import { dansLaTransaction } from "@/features/dossier-client/base";

export const ACTION_COMPLETE_DEPUIS_QUESTIONNAIRE = "client.complete_depuis_questionnaire";

export interface ChampsObjectifs {
  readonly siret?: string;
  readonly siren?: string;
  readonly adresseRue?: string;
  readonly adresseCodePostal?: string;
  readonly adresseVille?: string;
  readonly secteur?: string;
  readonly personne?: {
    readonly nom?: string;
    readonly email?: string;
    readonly telephone?: string;
    readonly fonction?: string;
  };
}

/** Ce qui n'est jamais copié, gardé dans le questionnaire (le dire dans la trace). */
export const NON_COPIES: ReadonlyArray<string> = ["effectif (tranche)", "outils", "sites"];

function texte(v: unknown, max: number): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t !== "" && t.length <= max ? t : undefined;
}

/** Les champs objectifs de la réponse (`donnees` du schéma 3 ou 4). PUR. */
export function champsObjectifsDe(json: string): ChampsObjectifs {
  let d: Record<string, unknown> = {};
  try {
    const o = JSON.parse(json) as { donnees?: unknown };
    if (typeof o.donnees === "object" && o.donnees !== null && !Array.isArray(o.donnees)) {
      d = o.donnees as Record<string, unknown>;
    }
  } catch {
    return {};
  }
  const sortie: {
    -readonly [K in keyof ChampsObjectifs]: ChampsObjectifs[K];
  } = {};
  const brut = texte(d["ent_siret"], 40);
  if (brut !== undefined) {
    const siret = checkSiretFormat(brut);
    if (siret.ok) {
      sortie.siret = siret.value;
      sortie.siren = sirenDuSiret(siret.value);
    } else {
      const siren = checkSirenFormat(brut);
      if (siren.ok) sortie.siren = siren.value;
    }
  }
  const rue = texte(d["ent_adresse"], 300);
  const cp = texte(d["ent_cp"], 12);
  const ville = texte(d["ent_ville"], 120);
  if (rue !== undefined) sortie.adresseRue = rue;
  if (cp !== undefined) sortie.adresseCodePostal = cp;
  if (ville !== undefined) sortie.adresseVille = ville;
  const secteur = texte(d["ent_activite"], 200);
  if (secteur !== undefined) sortie.secteur = secteur;
  const nom = [texte(d["contact_prenom"], 100), texte(d["contact_nom"], 100)]
    .filter((x): x is string => x !== undefined)
    .join(" ");
  const email = texte(d["contact_email"], 200);
  const telephone = texte(d["contact_tel"], 40);
  const fonction = texte(d["contact_role"], 120);
  if (nom !== "" || email !== undefined) {
    sortie.personne = {
      ...(nom !== "" ? { nom } : {}),
      ...(email !== undefined ? { email } : {}),
      ...(telephone !== undefined ? { telephone } : {}),
      ...(fonction !== undefined ? { fonction } : {}),
    };
  }
  return sortie;
}

type FicheActuelle = Readonly<
  Record<
    "siret" | "siren" | "adresseRue" | "adresseCodePostal" | "adresseVille" | "secteur",
    string | null
  >
>;

const vide = (v: string | null) => v === null || v.trim() === "";

/** Seulement les champs que la fiche n'a PAS (jamais un écrasement). PUR. */
export function aCompleter(
  fiche: FicheActuelle,
  c: ChampsObjectifs,
): Partial<Record<keyof FicheActuelle, string>> {
  const data: Record<string, string> = {};
  for (const cle of [
    "siret",
    "siren",
    "adresseRue",
    "adresseCodePostal",
    "adresseVille",
    "secteur",
  ] as const) {
    const v = c[cle];
    if (v !== undefined && vide(fiche[cle])) data[cle] = v;
  }
  // Un SIRET seul sur une fiche qui a déjà un AUTRE SIREN : on ne pose pas d'identifiants
  // incompatibles.
  if (data["siret"] !== undefined && !vide(fiche.siren) && fiche.siren !== c.siren) {
    delete data["siret"];
  }
  return data;
}

export type IssueCompletion =
  | { readonly statut: "ignoree"; readonly raison: string }
  | {
      readonly statut: "complete";
      readonly clientId: string;
      readonly champs: ReadonlyArray<string>;
      readonly personneAjoutee: boolean;
      readonly sirenDejaPris: boolean;
    };

/**
 * Complète la fiche liée à la rencontre du questionnaire. Seulement pour la réponse du
 * DIRIGEANT authentifiée par son code. Voir l'en-tête.
 */
export async function completerFicheDepuisReponse(
  questionnaireId: string,
  reponse: { readonly mode: string; readonly membre: string | null; readonly json: string },
): Promise<IssueCompletion> {
  if (reponse.mode !== "main") return { statut: "ignoree", raison: "pas_le_dirigeant" };
  if (reponse.membre === null || !codeDirigeantPreauditValide(questionnaireId, reponse.membre)) {
    return { statut: "ignoree", raison: "dirigeant_non_authentifie" };
  }
  const q = await prisma.questionnaireAvantAudit.findUnique({
    where: { id: questionnaireId },
    select: { ref: true, rencontreId: true, rencontre: { select: { clientId: true } } },
  });
  const clientId = q?.rencontre?.clientId ?? null;
  if (q === null || clientId === null) return { statut: "ignoree", raison: "sans_fiche" };
  const champs = champsObjectifsDe(reponse.json);

  return prisma.$transaction(async (tx): Promise<IssueCompletion> => {
    const fiche = await tx.client.findUnique({
      where: { id: clientId },
      select: {
        siret: true,
        siren: true,
        adresseRue: true,
        adresseCodePostal: true,
        adresseVille: true,
        secteur: true,
      },
    });
    if (fiche === null) return { statut: "ignoree", raison: "sans_fiche" };
    const data: Record<string, string> = { ...aCompleter(fiche, champs) };
    let sirenDejaPris = false;
    if (data["siren"] !== undefined) {
      try {
        await exigerSirenLibre(tx, clientId, data["siren"]);
      } catch (e) {
        if (!(e instanceof ErreurSirenDejaPris)) throw e;
        // Le SIREN est celui d'une AUTRE fiche : ni posé, ni fusionné. Will décide.
        sirenDejaPris = true;
        delete data["siren"];
        delete data["siret"];
      }
    }
    const avant = await chargeClientAvant(tx, clientId);
    if (Object.keys(data).length > 0) {
      await tx.client.update({
        where: { id: clientId },
        data: {
          ...(data["siret"] !== undefined ? { siret: data["siret"] } : {}),
          ...(data["siren"] !== undefined ? { siren: data["siren"] } : {}),
          ...(data["adresseRue"] !== undefined ? { adresseRue: data["adresseRue"] } : {}),
          ...(data["adresseCodePostal"] !== undefined
            ? { adresseCodePostal: data["adresseCodePostal"] }
            : {}),
          ...(data["adresseVille"] !== undefined ? { adresseVille: data["adresseVille"] } : {}),
          ...(data["secteur"] !== undefined ? { secteur: data["secteur"] } : {}),
        },
      });
    }
    let personneAjoutee = false;
    if (champs.personne !== undefined) {
      const r = await ajouterPersonneAFiche(dansLaTransaction(tx), clientId, champs.personne, null);
      personneAjoutee = r.cree;
    }
    await emettreFaitClient(tx, clientId, { avant });
    const copies = Object.keys(data);
    if (copies.length > 0 || personneAjoutee || sirenDejaPris) {
      await tx.activityLog.create({
        data: {
          adminUserId: null,
          action: ACTION_COMPLETE_DEPUIS_QUESTIONNAIRE,
          targetType: "Client",
          targetId: clientId,
          changes: {
            origine: "questionnaire",
            questionnaireId,
            ref: q.ref,
            rencontreId: q.rencontreId,
            champs: copies,
            personneAjoutee,
            sirenDejaPris,
            nonCopies: [...NON_COPIES],
          },
        },
      });
    }
    return { statut: "complete", clientId, champs: copies, personneAjoutee, sirenDejaPris };
  });
}
