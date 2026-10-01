/**
 * Les ÉTAPES À LA DEMANDE du circuit visio (chantier visio, PR 7) :
 * `questionnaire` (P6), `lire_reponses` et `email_suivi`.
 *
 * Elles passent par le MÊME circuit que le compte rendu : une ligne
 * `traitements_visio` programmée par la console (`planifierDans`), prise par
 * le worker (seul détenteur de la clé OpenAI), prise atomique, plafond de
 * dépense et registre des coûts (`executerPasse`), classes d'erreur, écriture
 * finale gardée. Une étape est attachée à une RENCONTRE : le questionnaire et
 * la lecture des réponses s'attachent à une rencontre du projet (« rencontre
 * d'ancrage »), l'e-mail de suivi à la rencontre qu'il suit.
 *
 * Ce que la console prépare AVANT de programmer l'étape (la demande de Will) :
 *   · questionnaire  — une ligne `questionnaires_cadrage` en `brouillon`, sans
 *                      question : l'étape la remplit ;
 *   · lire_reponses  — les réponses collées sous chaque question, questionnaire
 *                      `reponse_recue` : l'étape en tire des faits PROPOSÉS ;
 *   · email_suivi    — une ligne `emails_suivi` (destinataire choisi par Will),
 *                      sans e-mail : l'étape rédige et GARE l'e-mail en
 *                      « E-mails à valider » (`exigerValidation: true`).
 *
 * Rien n'est jamais envoyé à un client par ces étapes. Et rien n'est envoyé à
 * OpenAI tant que le drapeau ne l'ouvre pas pour cette rencontre
 * (`../ia-a-la-demande.ts`) : chaque gestionnaire le revérifie AVANT de lire.
 *
 * Les données de l'e-mail de suivi (destinataire, participants, faits validés,
 * premier message art. 14) se lisent à UN endroit, `lireDonneesEmailSuivi`,
 * appelé par l'étape comme par le geste « modèle fixe ».
 */

import type {
  FaitStatut,
  FaitSuivi,
  FaitType,
  PrismaClient,
} from "../../../../prisma/generated/client";
import { chiffrerParole, dechiffrerParole } from "@/lib/chiffrer-parole";
import { consoliderFaits, type FaitAConsolider } from "@/features/dossier-client/consolider-faits";
import { lireFaitsDUnClient } from "@/features/dossier-client/lire-faits";
import { empreinteDesConsignes, instructionsDe } from "../consignes";
import type { ModeEnregistrement } from "../drapeau";
import { ArretVisio, type ContexteEtape, type Gestionnaire } from "../etapes";
import { estRencontreDeTest, iaALaDemandePermise } from "../ia-a-la-demande";
import { ErreurVisio } from "../openai/erreurs";
import { executerPasse } from "../openai/passe";
import type { Tx } from "../prise-d-etape";
import { SCHEMAS_VISIO } from "../schemas";
import { QUESTIONS_REELLES, REPONSE_JE_NE_SAIS_PAS } from "../questionnaire-en-ligne/constantes";
import {
  adresseDEnvoi,
  construireEntreeEmail,
  destinataireValide,
  faitsPourEmail,
  verifierEmail,
  type FaitPourEmail,
} from "./email-suivi";
import {
  construireEntreeLecture,
  verifierLecture,
  type FaitDeReponse,
  type QuestionAvecReponse,
} from "./lire-reponses";
import {
  construireEntreeP6,
  verifierQuestionnaire,
  type FaitPourQuestionnaire,
  type QuestionRetenue,
} from "./p6-questionnaire";

// ── Ports ────────────────────────────────────────────────────────────────────

export interface DonneesQuestionnaire {
  readonly questionnaireId: string;
  readonly projet: { readonly id: string; readonly titre: string };
  readonly faits: ReadonlyArray<FaitPourQuestionnaire>;
  readonly trous: ReadonlyArray<number>;
}

export interface DonneesLecture {
  readonly questionnaireId: string;
  readonly clientId: string;
  readonly projetId: string;
  readonly reponseRecueLe: Date;
  readonly questions: ReadonlyArray<QuestionAvecReponse>;
}

/** Ce que l'e-mail de suivi lit en base — une seule lecture, `lireDonneesEmailSuivi`. */
export interface DonneesEmailSuivi {
  readonly clientId: string;
  readonly rencontre: { readonly titre: string; readonly date: Date | null };
  readonly contact: {
    readonly id: string;
    readonly nom: string;
    readonly origine: string;
    readonly adresses: ReadonlyArray<{ readonly email: string; readonly nature: "pro" | "perso" }>;
  };
  readonly participants: ReadonlyArray<{
    readonly contactId: string | null;
    readonly role: string;
    readonly contactActif: boolean;
  }>;
  readonly faits: ReadonlyArray<FaitPourEmail & { readonly statut: FaitStatut }>;
  /** Aucun e-mail n'est encore parti (ni en attente) vers cette personne. */
  readonly premierMessage: boolean;
}

export interface DonneesEmail extends DonneesEmailSuivi {
  readonly emailSuiviId: string;
}

export interface DepotDemandes {
  readonly pourQuestionnaire: (rencontreId: string) => Promise<DonneesQuestionnaire | null>;
  readonly ecrireQuestionnaire: (
    tx: Tx,
    a: {
      readonly questionnaireId: string;
      readonly questions: ReadonlyArray<QuestionRetenue>;
      readonly modele: string;
      readonly promptHash: string;
    },
  ) => Promise<void>;
  readonly pourLecture: (rencontreId: string) => Promise<DonneesLecture | null>;
  readonly ecrireFaitsDeReponse: (
    tx: Tx,
    a: {
      readonly clientId: string;
      readonly projetId: string;
      readonly constateLe: Date;
      readonly faits: ReadonlyArray<FaitDeReponse>;
    },
  ) => Promise<number>;
  readonly pourEmail: (rencontreId: string) => Promise<DonneesEmail | null>;
  readonly lierEmail: (tx: Tx, emailSuiviId: string, emailOutboxId: string) => Promise<void>;
  /**
   * Un e-mail de suivi déjà GARÉ (`a_valider`) pour cette rencontre et ce
   * destinataire, mais jamais relié à une ligne `emails_suivi` : le reste
   * d'une exécution interrompue après le garage (qui tourne hors transaction).
   * L'étape le reprend au lieu d'en garer un second. `null` s'il n'y en a pas.
   */
  readonly emailGareSansSuivi: (
    tx: Tx,
    a: { readonly rencontreId: string; readonly to: string },
  ) => Promise<string | null>;
  /** La rencontre est-elle une rencontre de test (client fictif) ? */
  readonly estRencontreDeTest: (rencontreId: string) => Promise<boolean>;
}

/** Garer un e-mail dans « E-mails à valider ». Rend l'identifiant de la ligne, ou `null`. */
export interface PortEnvoiEmailSuivi {
  readonly mettreEnValidation: (a: {
    readonly to: string;
    readonly payload: Record<string, unknown>;
    readonly clientId: string;
    readonly sujet: string;
    readonly rencontreId: string;
  }) => Promise<string | null>;
}

/** Le port réel : `enqueueEmail(…, { exigerValidation: true })`, importé paresseusement. */
export const envoiEmailSuiviReel: PortEnvoiEmailSuivi = {
  mettreEnValidation: async (a) => {
    const { enqueueEmail } = await import("@/server/queue/queues");
    const r = await enqueueEmail("visio-email-suivi", a.to, "fr", a.payload, {
      exigerValidation: true,
      clientId: a.clientId,
      sujet: a.sujet,
      entityType: "Rencontre",
      entityId: a.rencontreId,
    });
    return r.garePourValidation === true && typeof r.outboxId === "string" ? r.outboxId : null;
  },
};

export interface DepsDemandes {
  readonly depot: DepotDemandes;
  readonly envoi: PortEnvoiEmailSuivi;
  /** Le drapeau, lu à l'exécution (`modeEnregistrement`) ; injecté par les tests et la Gate D. */
  readonly mode: () => ModeEnregistrement;
}

function demandes(ctx: ContexteEtape): DepsDemandes {
  const d = ctx.deps.demandes;
  if (d === undefined) throw new ArretVisio("inconnu");
  return d;
}

/**
 * ⛔ Défense en profondeur : même programmée, une étape à la demande ne parle
 * pas à OpenAI si le drapeau ne l'ouvre pas pour cette rencontre (arrêt
 * définitif, rien d'écrit ; le geste de Will l'a déjà refusée).
 */
async function exigerIaPermise(ctx: ContexteEtape, d: DepsDemandes): Promise<void> {
  const mode = d.mode();
  const test = mode === "pilote" ? await d.depot.estRencontreDeTest(ctx.t.rencontreId) : false;
  if (!iaALaDemandePermise(mode, test)) throw new ArretVisio("inconnu");
}

function depsPasse(ctx: ContexteEtape) {
  return { client: ctx.deps.openai(), cout: ctx.deps.cout };
}

// ── Gestionnaires ───────────────────────────────────────────────────────────

export const questionnaire: Gestionnaire = async (ctx) => {
  const d = demandes(ctx);
  await exigerIaPermise(ctx, d);
  const donnees = await d.depot.pourQuestionnaire(ctx.t.rencontreId);
  if (donnees === null) throw new ArretVisio("inconnu");
  const { entree, refs } = construireEntreeP6({
    projet: donnees.projet,
    faits: donnees.faits,
    trous: donnees.trous,
  });
  const catalogue = await ctx.deps.catalogue();
  const { sortie, modele } = await executerPasse(depsPasse(ctx), {
    passe: "questionnaire",
    schema: SCHEMAS_VISIO.questionnaire.schema,
    nomSchema: SCHEMAS_VISIO.questionnaire.nom,
    instructions: instructionsDe("questionnaire", catalogue.texte),
    entree,
    jobId: ctx.jobId,
  });
  const bilan = verifierQuestionnaire(sortie, refs);
  if (bilan.questions.length === 0) {
    throw new ErreurVisio("contenu", "sortie_invalide", "questionnaire vide après vérification");
  }
  return {
    ecrire: async (tx) => {
      await d.depot.ecrireQuestionnaire(tx, {
        questionnaireId: donnees.questionnaireId,
        questions: bilan.questions,
        modele,
        promptHash: empreinteDesConsignes(),
      });
      return [];
    },
  };
};

export const lireReponses: Gestionnaire = async (ctx) => {
  const d = demandes(ctx);
  await exigerIaPermise(ctx, d);
  const donnees = await d.depot.pourLecture(ctx.t.rencontreId);
  if (donnees === null) throw new ArretVisio("inconnu");
  const avecReponse = donnees.questions.filter((q) => q.reponse !== null);
  if (avecReponse.length === 0) throw new ArretVisio("inconnu");
  const catalogue = await ctx.deps.catalogue();
  const { sortie } = await executerPasse(depsPasse(ctx), {
    passe: "lire_reponses",
    schema: SCHEMAS_VISIO.lectureReponses.schema,
    nomSchema: SCHEMAS_VISIO.lectureReponses.nom,
    instructions: instructionsDe("lire_reponses", catalogue.texte),
    entree: construireEntreeLecture(donnees.questions),
    jobId: ctx.jobId,
  });
  const bilan = verifierLecture(sortie, donnees.questions, donnees.reponseRecueLe);
  return {
    ecrire: async (tx) => {
      await d.depot.ecrireFaitsDeReponse(tx, {
        clientId: donnees.clientId,
        projetId: donnees.projetId,
        constateLe: donnees.reponseRecueLe,
        faits: bilan.faits,
      });
      return [];
    },
  };
};

export const emailSuivi: Gestionnaire = async (ctx) => {
  const d = demandes(ctx);
  await exigerIaPermise(ctx, d);
  const donnees = await d.depot.pourEmail(ctx.t.rencontreId);
  if (donnees === null) throw new ArretVisio("inconnu");
  const to = destinataireDuSuivi(donnees);
  if (to === null) throw new ArretVisio("inconnu");
  const faits = faitsPourEmail(donnees.faits);
  if (faits.length === 0) throw new ArretVisio("inconnu");
  const catalogue = await ctx.deps.catalogue();
  const { sortie } = await executerPasse(depsPasse(ctx), {
    passe: "email_suivi",
    schema: SCHEMAS_VISIO.emailSuivi.schema,
    nomSchema: SCHEMAS_VISIO.emailSuivi.nom,
    instructions: instructionsDe("email_suivi", catalogue.texte),
    entree: construireEntreeEmail({ rencontre: donnees.rencontre, faits }),
    jobId: ctx.jobId,
  });
  const verdict = verifierEmail(sortie, faits);
  if (!verdict.ok) {
    throw new ErreurVisio(
      "contenu",
      "sortie_invalide",
      `e-mail de suivi refusé : ${verdict.motif}`,
    );
  }
  const payload = payloadEmailSuivi(donnees, verdict.email);
  return {
    ecrire: async (tx) => {
      // ⛔ Idempotent (V1-01) : le garage tourne HORS de cette transaction. Une
      // exécution annulée après lui (arrêt du worker, écriture en échec) laisse
      // un e-mail « à valider » sans lien ; la reprise le relie au lieu d'en
      // garer un second — Will n'a jamais deux e-mails à valider pour un seul.
      const outboxId =
        (await d.depot.emailGareSansSuivi(tx, { rencontreId: ctx.t.rencontreId, to })) ??
        (await d.envoi.mettreEnValidation({
          to,
          payload,
          clientId: donnees.clientId,
          sujet: verdict.email.objet,
          rencontreId: ctx.t.rencontreId,
        }));
      if (outboxId === null) {
        throw new ErreurVisio(
          "passagere",
          "fournisseur_indisponible",
          "file « E-mails à valider » indisponible",
        );
      }
      await d.depot.lierEmail(tx, donnees.emailSuiviId, outboxId);
      return [];
    },
  };
};

/**
 * ⛔ L'adresse d'envoi, ou `null` : le destinataire est un participant CLIENT
 * validé de la rencontre, et l'adresse vient de sa fiche — jamais de l'IA.
 * Partagée par l'étape et le geste « modèle fixe ».
 */
export function destinataireDuSuivi(
  d: Pick<DonneesEmailSuivi, "contact" | "participants">,
): string | null {
  if (!destinataireValide(d.contact.id, d.participants)) return null;
  return adresseDEnvoi(d.contact.adresses);
}

/**
 * La charge utile du gabarit `visio-email-suivi` (partagée avec le gabarit
 * fixe). ⛔ Art. 14 : une personne citée par un tiers (`origine = mention`)
 * reçoit, au PREMIER message seulement, la ligne qui dit d'où vient son
 * adresse. La règle n'est écrite qu'ici.
 */
export function payloadEmailSuivi(
  d: Pick<DonneesEmailSuivi, "contact" | "premierMessage">,
  email: { readonly objet: string; readonly paragraphes: ReadonlyArray<string> },
): Record<string, unknown> {
  const informationArt14 = d.contact.origine === "mention" && d.premierMessage;
  return {
    contactName: d.contact.nom,
    objet: email.objet,
    paragraphes: [...email.paragraphes],
    ...(informationArt14 ? { informationArt14: true } : {}),
  };
}

export const GESTIONNAIRES_A_LA_DEMANDE = {
  questionnaire,
  lire_reponses: lireReponses,
  email_suivi: emailSuivi,
} as const;

// ── Dépôt Prisma ─────────────────────────────────────────────────────────────

type Db = PrismaClient;

function lire(v: string | null): string {
  if (v === null) return "";
  try {
    return dechiffrerParole(v);
  } catch {
    return "";
  }
}

/** « Je ne sais pas. » vaut absence de réponse pour la lecture IA. */
export function sansJeNeSaisPas(reponse: string | null): string | null {
  return reponse !== null && reponse.trim() === REPONSE_JE_NE_SAIS_PAS ? null : reponse;
}

/** Le projet principal de la rencontre d'ancrage (le questionnaire est celui de ce projet). */
async function projetDeLaRencontre(db: Db, rencontreId: string) {
  const r = await db.rencontre.findUnique({
    where: { id: rencontreId },
    select: { clientId: true, projetId: true },
  });
  if (!r || r.clientId === null || r.projetId === null) return null;
  return { clientId: r.clientId, projetId: r.projetId };
}

export function depotDemandesPrisma(db: Db): DepotDemandes {
  return {
    pourQuestionnaire: async (rencontreId) => {
      const r = await projetDeLaRencontre(db, rencontreId);
      if (r === null) return null;
      const q = await db.questionnaireCadrage.findFirst({
        where: { projetId: r.projetId, statut: "brouillon", modele: null },
        orderBy: { version: "desc" },
        select: { id: true },
      });
      if (!q) return null;
      const projets = await db.projet.findMany({
        where: { clientId: r.clientId },
        select: { id: true, titre: true, derniereReouvertureLe: true },
      });
      const projet = projets.find((p) => p.id === r.projetId);
      if (!projet) return null;
      // LA lecture des faits partagée avec la console : même règle « effacé → vide ».
      const lus = await lireFaitsDUnClient(db, r.clientId, {
        statuts: ["valide", "efface"],
        illisible: "",
      });
      const locuteurs = new Map(lus.map((l) => [l.id, l.contactLocuteurId]));
      const faits: FaitAConsolider[] = lus;
      const conso = consoliderFaits(faits, projets, new Date());
      return {
        questionnaireId: q.id,
        projet: { id: projet.id, titre: projet.titre },
        faits: faits.map((f) => ({
          id: f.id,
          type: f.type,
          portee: f.portee,
          projetId: f.projetId,
          statut: f.statut,
          suivi: f.suivi as FaitSuivi | null,
          enonce: f.enonce,
          contactLocuteurId: locuteurs.get(f.id) ?? null,
        })),
        trous: conso.projets[projet.id]?.trous ?? [],
      };
    },
    ecrireQuestionnaire: async (tx, a) => {
      await tx.questionnaireQuestion.createMany({
        data: a.questions.map((q) => ({
          questionnaireId: a.questionnaireId,
          ordre: q.ordre,
          texte: chiffrerParole(q.texte),
          typeVise: q.typeVise,
          faitSourceId: q.faitSourceId,
        })),
      });
      await tx.questionnaireCadrage.update({
        where: { id: a.questionnaireId },
        data: { modele: a.modele.slice(0, 60), promptHash: a.promptHash, genereLe: new Date() },
      });
    },
    pourLecture: async (rencontreId) => {
      const r = await projetDeLaRencontre(db, rencontreId);
      if (r === null) return null;
      const q = await db.questionnaireCadrage.findFirst({
        where: { projetId: r.projetId, statut: "reponse_recue" },
        orderBy: { version: "desc" },
        select: {
          id: true,
          clientId: true,
          projetId: true,
          reponseRecueLe: true,
          questions: {
            // « Qui répond ? » (questionnaire en ligne, ordre 0) n'est pas une
            // réponse à lire : un nom et une fonction n'ont rien à faire chez l'IA.
            where: QUESTIONS_REELLES,
            orderBy: { ordre: "asc" },
            select: {
              id: true,
              ordre: true,
              texte: true,
              reponse: true,
              typeVise: true,
              cleVisee: true,
              faitsProduits: { select: { id: true } },
            },
          },
        },
      });
      if (!q || q.reponseRecueLe === null) return null;
      return {
        questionnaireId: q.id,
        clientId: q.clientId,
        projetId: q.projetId,
        reponseRecueLe: q.reponseRecueLe,
        // Une question qui a déjà produit un fait n'est pas relue (rejouer la
        // lecture ne double aucun fait).
        questions: q.questions
          .filter((x) => x.faitsProduits.length === 0)
          .map((x) => ({
            id: x.id,
            ordre: x.ordre,
            texte: lire(x.texte),
            // « Je ne sais pas. » (bouton du questionnaire en ligne) n'est pas
            // une réponse à ranger : l'IA n'en tire aucun fait à écarter.
            reponse: sansJeNeSaisPas(x.reponse === null ? null : lire(x.reponse) || null),
            typeVise: x.typeVise as FaitType,
            cleVisee: x.cleVisee,
          })),
      };
    },
    ecrireFaitsDeReponse: async (tx, a) => {
      for (const f of a.faits) {
        const cree = await tx.fait.create({
          data: {
            clientId: a.clientId,
            portee: "projet",
            projetId: a.projetId,
            type: f.type,
            cle: f.cle,
            enonce: chiffrerParole(f.enonce),
            quantite: f.quantite,
            dateCible: f.dateCible ? new Date(`${f.dateCible}T00:00:00Z`) : null,
            texteCourt: f.texteCourt ? chiffrerParole(f.texteCourt) : null,
            certitude: "dit_explicitement",
            confiance: f.confiance,
            source: "questionnaire_cadrage",
            questionnaireQuestionId: f.questionId,
            locuteur: "client",
            citation: chiffrerParole(f.citation),
            citationVerifiee: true,
            constateLe: a.constateLe,
            statut: "propose",
          },
          select: { id: true },
        });
        await tx.faitEvenement.create({ data: { faitId: cree.id, action: "propose" } });
      }
      return a.faits.length;
    },
    pourEmail: async (rencontreId) => {
      const e = await db.emailSuivi.findFirst({
        where: { rencontreId, emailOutboxId: null },
        orderBy: { creeLe: "desc" },
        select: { id: true, contactId: true },
      });
      if (!e) return null;
      const lu = await lireDonneesEmailSuivi(db, rencontreId, e.contactId);
      return lu.ok ? { ...lu.donnees, emailSuiviId: e.id } : null;
    },
    lierEmail: async (tx, emailSuiviId, emailOutboxId) => {
      await tx.emailSuivi.update({ where: { id: emailSuiviId }, data: { emailOutboxId } });
    },
    emailGareSansSuivi: async (tx, a) => {
      const orphelin = await tx.emailOutbox.findFirst({
        where: {
          template: "visio-email-suivi",
          entityType: "Rencontre",
          entityId: a.rencontreId,
          recipient: a.to,
          statut: "a_valider",
          emailSuivi: { is: null },
        },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      return orphelin?.id ?? null;
    },
    estRencontreDeTest: (rencontreId) => estRencontreDeTest(db, rencontreId),
  };
}

export type LectureEmailSuivi =
  | { readonly ok: true; readonly donnees: DonneesEmailSuivi }
  | { readonly ok: false; readonly motif: "rencontre_non_rangee" | "contact_hors_fiche" };

/**
 * Les données de l'e-mail de suivi d'une rencontre vers une personne — la
 * SEULE lecture, pour l'étape (`pourEmail`) comme pour les gestes de Will
 * (`gestes-suivi.ts`) : la rencontre rangée chez un client, la personne de
 * CETTE fiche, ses adresses, les participants, les faits validés déchiffrés,
 * et si un e-mail est déjà réellement PARTI vers elle (art. 14).
 */
export async function lireDonneesEmailSuivi(
  db: Pick<Db, "rencontre" | "clientContact" | "fait" | "emailSuivi">,
  rencontreId: string,
  contactId: string,
): Promise<LectureEmailSuivi> {
  const r = await db.rencontre.findUnique({
    where: { id: rencontreId },
    select: {
      clientId: true,
      titre: true,
      debutReel: true,
      debutPrevu: true,
      participants: { select: { contactId: true, role: true } },
    },
  });
  if (!r || r.clientId === null) return { ok: false, motif: "rencontre_non_rangee" };
  const contact = await db.clientContact.findUnique({
    where: { id: contactId },
    select: {
      id: true,
      nom: true,
      origine: true,
      statut: true,
      clientId: true,
      adresses: { select: { email: true, nature: true } },
    },
  });
  if (!contact || contact.clientId !== r.clientId) {
    return { ok: false, motif: "contact_hors_fiche" };
  }
  const faits = await db.fait.findMany({
    where: { rencontreId, statut: "valide" },
    select: { id: true, type: true, enonce: true, statut: true },
    orderBy: { createdAt: "asc" },
  });
  // Art. 14 : seul un e-mail réellement PARTI compte. Un e-mail garé
  // (`a_valider`, `approuve`) peut encore être écarté au profit d'un autre, et
  // sa charge utile est figée à la mise en file : tant qu'aucun n'est parti,
  // chaque e-mail préparé porte la ligne.
  const deja = await db.emailSuivi.count({
    where: {
      contactId: contact.id,
      emailOutboxId: { not: null },
      emailOutbox: { statut: "envoye" },
    },
  });
  return {
    ok: true,
    donnees: {
      clientId: r.clientId,
      rencontre: { titre: r.titre, date: r.debutReel ?? r.debutPrevu },
      contact: {
        id: contact.id,
        nom: contact.nom,
        origine: contact.origine,
        adresses: contact.adresses.map((a) => ({ email: a.email, nature: a.nature })),
      },
      participants: r.participants.map((p) => ({
        contactId: p.contactId,
        role: p.role,
        contactActif: p.contactId === contact.id ? contact.statut === "actif" : true,
      })),
      faits: faits.map((f) => ({
        id: f.id,
        type: f.type,
        enonce: lire(f.enonce),
        statut: f.statut,
      })),
      premierMessage: deja === 0,
    },
  };
}
