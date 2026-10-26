/**
 * La fiche prospect se COMPLÈTE depuis la réponse du dirigeant au questionnaire (25/10/2026).
 *
 * Quand le dirigeant (réponse AUTHENTIFIÉE par son code) envoie ses réponses, les champs
 * OBJECTIFS que la fiche n'a pas encore sont copiés : adresse (rue, code postal, ville), secteur,
 * et la personne à contacter (ajoutée à la fiche, jamais à la place d'une autre).
 *
 *   · ⛔ JAMAIS un écrasement : un champ déjà rempli (par Will ou autrement) n'est pas touché ;
 *   · la raison sociale n'est jamais remplacée (une fiche en a toujours une) ;
 *   · ⛔ le SIREN et le SIRET tapés par le prospect ne sont JAMAIS posés (règle de la fiche
 *     automatique : « jamais de SIREN sans clic de Will ») : ils sont NOTÉS dans la trace
 *     (`sirenPropose`, `siretPropose`) et la fiche console propose « Poser ce SIREN », un clic
 *     de Will qui passe par la porte unique et son verrou (`confirmerSirenFormAction`) ;
 *   · ⛔ l'adresse e-mail tapée par le répondant ne range JAMAIS d'office un futur rendez-vous :
 *     elle n'est reprise sur la fiche que si c'est celle à qui Will a envoyé le questionnaire ou
 *     celle du titulaire de la réservation Calendly (déjà liées à cette fiche). Sinon la personne
 *     est ajoutée SANS adresse (la trace le dit) ; l'adresse reste dans le questionnaire ;
 *   · une adresse invalide est ignorée, le reste de la complétion continue ; une personne sans
 *     adresse n'est pas ajoutée deux fois (même nom déjà sur la fiche) ;
 *   · non copiés, gardés dans le questionnaire : l'effectif (une TRANCHE, « 20 à 49 », alors que
 *     la fiche attend un nombre qui gouverne des seuils), les outils et les sites (aucun champ de
 *     la fiche) ;
 *   · une trace d'audit (`client.complete_depuis_questionnaire`) dit quoi, quand, d'où (référence,
 *     questionnaire, rencontre : le lien vers le questionnaire) ; sans auteur (geste automatique).
 *     Elle n'est jamais purgée (aucune suppression du journal d'activité : garde
 *     `retention-preuve-envoi.spec.ts`) ;
 *   · Axion Partners : `emettreFaitClient` dans la même transaction, seulement si la fiche a
 *     changé (cliquet des écrivains) ;
 *   · best-effort : une panne ici ne perd JAMAIS la réponse, déjà enregistrée (`route.ts`).
 */

import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { checkSirenFormat, checkSiretFormat, sirenDuSiret } from "@/lib/siret";
import { ajouterPersonneAFiche } from "@/server/qualiopi/crm/porte-client";
import { chargeClientAvant, emettreFaitClient } from "@/server/partners-sync/producteurs/client";
import { codeDirigeantPreauditValide } from "@/server/visio/questionnaire-en-ligne/jeton";
import { dansLaTransaction } from "@/features/dossier-client/base";
import { ficheVivante } from "./de-la-fiche";
import { reessayerSiInterblocage } from "./interblocage";

export const ACTION_COMPLETE_DEPUIS_QUESTIONNAIRE = "client.complete_depuis_questionnaire";

export interface ChampsObjectifs {
  readonly siret?: string;
  readonly siren?: string;
  readonly adresseRue?: string;
  readonly adresseCodePostal?: string;
  readonly adresseVille?: string;
  readonly secteur?: string;
  readonly personne?: PersonneProposee;
}

interface PersonneProposee {
  readonly nom?: string;
  readonly email?: string;
  readonly telephone?: string;
  readonly fonction?: string;
}

/** Ce qui n'est jamais copié, gardé dans le questionnaire (le dire dans la trace). */
export const NON_COPIES: ReadonlyArray<string> = ["effectif (tranche)", "outils", "sites"];

function texte(v: unknown, max: number): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t !== "" && t.length <= max ? t : undefined;
}

const adresseValide = (v: string) => z.string().email().safeParse(v).success;

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
  // Validée AVANT toute normalisation : une adresse invalide est ignorée, le reste continue.
  const brutEmail = texte(d["contact_email"], 200);
  const email = brutEmail !== undefined && adresseValide(brutEmail) ? brutEmail : undefined;
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

/**
 * Seulement les champs que la fiche n'a PAS (jamais un écrasement). ⛔ Ni `siret` ni `siren` :
 * jamais posés sans le clic de Will (voir `sirenAProposer`). PUR.
 */
export function aCompleter(
  fiche: FicheActuelle,
  c: ChampsObjectifs,
): Partial<Record<"adresseRue" | "adresseCodePostal" | "adresseVille" | "secteur", string>> {
  const data: Record<string, string> = {};
  for (const cle of ["adresseRue", "adresseCodePostal", "adresseVille", "secteur"] as const) {
    const v = c[cle];
    if (v !== undefined && vide(fiche[cle])) data[cle] = v;
  }
  return data;
}

/**
 * Le SIREN (et le SIRET) à PROPOSER à Will : seulement si la fiche n'a encore ni SIREN ni SIRET.
 * Rien n'est écrit : la trace le note, la fiche console offre « Poser ce SIREN ». PUR.
 */
export function sirenAProposer(
  fiche: Pick<FicheActuelle, "siret" | "siren">,
  c: ChampsObjectifs,
): { readonly siren: string; readonly siret: string | null } | null {
  if (c.siren === undefined || !vide(fiche.siren) || !vide(fiche.siret)) return null;
  return { siren: c.siren, siret: c.siret ?? null };
}

/** Le même nom, sans casse, accents ni espaces superflus. PUR. */
export function memeNom(a: string, b: string): boolean {
  const n = (x: string) =>
    x.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  return n(a) !== "" && n(a) === n(b);
}

/**
 * La personne à ajouter : son adresse n'est gardée que si elle est DÉJÀ liée à la fiche (celle
 * à qui Will a envoyé le questionnaire, ou le titulaire Calendly). PUR.
 */
export function personneAAjouter(
  personne: PersonneProposee | undefined,
  adressesSures: ReadonlySet<string>,
): { readonly personne: PersonneProposee | undefined; readonly adresseNonReprise: boolean } {
  if (personne === undefined) return { personne: undefined, adresseNonReprise: false };
  let adresseNonReprise = false;
  let p: PersonneProposee = personne;
  if (p.email !== undefined) {
    const h = hashEmailForLookup(p.email);
    if (h === null || !adressesSures.has(h)) {
      adresseNonReprise = true;
      const { email: _nonReprise, ...sansAdresse } = p;
      p = sansAdresse;
    }
  }
  if (p.nom === undefined && p.email === undefined)
    return { personne: undefined, adresseNonReprise };
  return { personne: p, adresseNonReprise };
}

export type IssueCompletion =
  | { readonly statut: "ignoree"; readonly raison: string }
  | {
      readonly statut: "complete";
      readonly clientId: string;
      readonly champs: ReadonlyArray<string>;
      readonly personneAjoutee: boolean;
      /** Le SIREN tapé par le prospect, proposé à Will (jamais posé), ou `null`. */
      readonly sirenPropose: string | null;
      /** L'adresse tapée n'est ni celle du destinataire ni celle du titulaire : non reprise. */
      readonly adresseNonReprise: boolean;
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
    select: {
      ref: true,
      rencontreId: true,
      clientId: true,
      destinataireHash: true,
      rencontre: { select: { clientId: true, calendlyEvent: { select: { inviteeEmail: true } } } },
    },
  });
  // Sans rendez-vous, la fiche visée a pu être absorbée depuis : on écrit sur celle que Will regarde.
  const clientId =
    q?.rencontre?.clientId ?? (q?.clientId != null ? await ficheVivante(q.clientId) : null);
  if (q === null || clientId === null) return { statut: "ignoree", raison: "sans_fiche" };
  const champs = champsObjectifsDe(reponse.json);
  const adressesSures = new Set(
    [
      q.destinataireHash,
      hashEmailForLookup(q.rencontre?.calendlyEvent?.inviteeEmail ?? null),
    ].filter((h): h is string => typeof h === "string" && h !== ""),
  );
  const { personne, adresseNonReprise } = personneAAjouter(champs.personne, adressesSures);

  return reessayerSiInterblocage(() =>
    prisma.$transaction(async (tx): Promise<IssueCompletion> => {
      // Verrou de la fiche AVANT toute lecture ou écriture : deux réponses du dirigeant (renvoi modifié)
      // ou un enregistrement de la console sur la même fiche passent l'une après l'autre, dans le même
      // ordre (fiche, puis personnes) — c'est le croisement inverse qui produisait l'interblocage 40P01.
      await tx.$queryRaw`SELECT id FROM clients WHERE id = ${clientId}::uuid FOR UPDATE`;
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
      const data = aCompleter(fiche, champs);
      const propose = sirenAProposer(fiche, champs);
      const avant = await chargeClientAvant(tx, clientId);
      const copies = Object.keys(data);
      if (copies.length > 0) {
        await tx.client.update({ where: { id: clientId }, data });
      }
      let personneAjoutee = false;
      if (personne !== undefined) {
        // Sans adresse, la porte créerait une 2e personne au même nom : on la cherche d'abord.
        const nom = personne.nom;
        const dejaLa =
          personne.email === undefined && nom !== undefined
            ? (
                await tx.clientContact.findMany({ where: { clientId }, select: { nom: true } })
              ).some((c) => memeNom(c.nom, nom))
            : false;
        if (!dejaLa) {
          const r = await ajouterPersonneAFiche(dansLaTransaction(tx), clientId, personne, null);
          personneAjoutee = r.cree;
        }
      }
      // Axion Partners : un fait seulement si la fiche a changé.
      if (copies.length > 0 || personneAjoutee) await emettreFaitClient(tx, clientId, { avant });
      if (copies.length > 0 || personneAjoutee || propose !== null || adresseNonReprise) {
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
              sirenPropose: propose?.siren ?? null,
              siretPropose: propose?.siret ?? null,
              adresseNonReprise,
              nonCopies: [...NON_COPIES],
            },
          },
        });
      }
      return {
        statut: "complete",
        clientId,
        champs: copies,
        personneAjoutee,
        sirenPropose: propose?.siren ?? null,
        adresseNonReprise,
      };
    }),
  );
}

/**
 * Le dernier SIREN proposé par un questionnaire pour cette fiche (affiché à côté de « SIREN à
 * compléter », avec « Poser ce SIREN »). Lecture seule, `null` si aucun.
 */
export async function sirenProposeParQuestionnaire(
  clientId: string,
): Promise<{ readonly siren: string; readonly siret: string | null; readonly le: Date } | null> {
  const traces = await prisma.activityLog.findMany({
    where: {
      action: ACTION_COMPLETE_DEPUIS_QUESTIONNAIRE,
      targetType: "Client",
      targetId: clientId,
    },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { changes: true, createdAt: true },
  });
  for (const t of traces) {
    const c = t.changes as { sirenPropose?: unknown; siretPropose?: unknown } | null;
    const siren = typeof c?.sirenPropose === "string" ? c.sirenPropose : null;
    if (siren === null || !checkSirenFormat(siren).ok) continue;
    const siret = typeof c?.siretPropose === "string" ? c.siretPropose : null;
    return { siren, siret, le: t.createdAt };
  }
  return null;
}
