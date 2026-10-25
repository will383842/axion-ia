/**
 * Suppression MANUELLE depuis la console (demande de Will du 25/10/2026 : « il faut que la console
 * sache supprimer »). JAMAIS automatique : seul un clic du super-administrateur, après l'écran de
 * confirmation et la saisie du mot EFFACER, appelle `supprimerManuellement`.
 *
 * Trois cibles :
 *   · le QUESTIONNAIRE d'une rencontre, avec toutes ses réponses (dirigeant compris), ses
 *     brouillons, son suivi et les courriers du suivi ;
 *   · une RENCONTRE (son questionnaire, ses participants, son suivi de rendez-vous) ;
 *   · une FICHE CLIENT (ses rencontres comme ci-dessus, ses contacts).
 *
 * Garde-fous :
 *   · LISTE BLANCHE : avant toute suppression, on lit dans le catalogue PostgreSQL TOUTES les clés
 *     étrangères qui visent les lignes à supprimer. Une seule ligne liée hors liste blanche
 *     (facture, devis, contrat, audit, compte rendu, enregistrement, projet, e-mail en attente…)
 *     et RIEN n'est supprimé : Will lit lesquelles, et les traite à la main ou avec le support.
 *     Une cascade vers une table hors périmètre est donc impossible : elle n'aurait rien à suivre ;
 *   · un e-mail réellement parti vers une autre adresse que contact@axion-ia.com (un vrai
 *     prospect) bloque aussi : ces données passent par l'effacement RGPD, pas par ici ;
 *   · le bilan est RECALCULÉ dans la transaction de suppression (rien ne change entre l'écran et
 *     le clic sans être revu) ;
 *   · une trace d'audit (`activity_logs`, jamais purgée) dit qui, quand, quoi et combien, SANS
 *     contenu (ni nom, ni adresse, ni réponse) ;
 *   · les e-mails déjà partis restent dans `email_logs` (rien n'y est touché).
 */

import { prisma } from "@/lib/prisma";
import { dechiffrerParole } from "@/lib/chiffrer-parole";

import type { Tx } from "./base";

export const MOT_CONFIRMATION = "EFFACER";
/** La seule adresse « interne » : un envoi ailleurs est un envoi à un vrai prospect. */
export const ADRESSE_INTERNE = "contact@axion-ia.com";

export type TypeCible = "questionnaire" | "rencontre" | "client";

export interface Compteur {
  readonly libelle: string;
  readonly n: number;
}

export interface BilanSuppression {
  readonly type: TypeCible;
  readonly id: string;
  /** Raison sociale ou titre : pour l'écran de confirmation seulement, jamais tracé. */
  readonly nom: string;
  readonly email: string | null;
  readonly compteurs: ReadonlyArray<Compteur>;
  /** Vide : la suppression est permise. Sinon, ce qui l'empêche, en clair. */
  readonly bloquants: ReadonlyArray<string>;
}

export const MESSAGE_BLOQUE =
  "Suppression impossible depuis la console : d'autres données sont liées. Supprimez-les à la main, ou contactez le support.";

/** Noms lisibles des tables qui reviennent le plus souvent ; sinon le nom de la table. */
const NOMS_TABLES: Readonly<Record<string, string>> = {
  comptes_rendus: "compte(s) rendu(s)",
  faits: "fait(s) relevé(s)",
  enregistrements: "enregistrement(s) de visio",
  traitements_visio: "traitement(s) de visio",
  emails_suivi: "e-mail(s) de suivi",
  email_outbox: "e-mail(s) en attente (« E-mails à valider »)",
  devis: "devis",
  factures_formation: "facture(s) de formation",
  projets: "projet(s)",
  documents_generes: "document(s)",
  audit_missions: "mission(s) d'audit",
  coaching_contracts: "contrat(s) de coaching",
  dossiers_financement: "dossier(s) de financement",
  formations: "formation(s)",
  training_sessions: "session(s) de formation",
  rencontres: "rencontre(s)",
};

const nomTable = (t: string) => NOMS_TABLES[t.replace(/"/g, "")] ?? `table ${t}`;

const ident = (s: string) => `"${s.replace(/"/g, '""')}"`;

/**
 * Les clés étrangères qui visent `table` : la colonne qui pointe vers `id`, lue dans le catalogue
 * (clés composées comprises). Rien n'est supposé : une table ajoutée demain est vue demain.
 */
async function clesEtrangeres(
  tx: Tx,
  table: string,
): Promise<ReadonlyArray<{ table: string; colonne: string }>> {
  return tx.$queryRaw<{ table: string; colonne: string }[]>`
    SELECT c.conrelid::regclass::text AS "table", a.attname AS colonne
    FROM pg_constraint c
    JOIN pg_attribute cible ON cible.attrelid = c.confrelid AND cible.attname = 'id'
    JOIN pg_attribute a ON a.attrelid = c.conrelid
      AND a.attnum = c.conkey[COALESCE(array_position(c.confkey, cible.attnum), 1)]
    WHERE c.contype = 'f' AND c.confrelid = to_regclass(${table})`;
}

/**
 * `"table.colonne"` → les lignes liées qui sont À NOUS : `true` (toutes), ou celles dont
 * `colonne` vaut l'un des `ids` (ex. les participants de NOS rencontres).
 */
type Nos = ReadonlyMap<
  string,
  true | { readonly colonne: string; readonly ids: readonly string[] }
>;

/** Les lignes liées à `ids` HORS de la liste blanche, par table. */
async function liensHorsPerimetre(
  tx: Tx,
  table: string,
  ids: readonly string[],
  nos: Nos,
): Promise<string[]> {
  if (ids.length === 0) return [];
  const sortie: string[] = [];
  for (const fk of await clesEtrangeres(tx, table)) {
    const regle = nos.get(`${fk.table.replace(/"/g, "")}.${fk.colonne}`);
    if (regle === true) continue;
    const exclusion =
      regle === undefined ? "" : ` AND NOT (${ident(regle.colonne)}::text = ANY($2::text[]))`;
    const lignes = await tx.$queryRawUnsafe<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM ${fk.table} WHERE ${ident(fk.colonne)}::text = ANY($1::text[])${exclusion}`,
      [...ids],
      regle === undefined ? [] : [...regle.ids],
    );
    const n = Number(lignes[0]?.n ?? 0);
    if (n > 0) sortie.push(`${n} ${nomTable(fk.table)} lié(e)s`);
  }
  return sortie;
}

/** Un e-mail RÉEL (pas un essai) parti vers une autre adresse que contact@ : un vrai prospect. */
async function envoisReels(tx: Tx, ids: readonly string[]): Promise<number> {
  if (ids.length === 0) return 0;
  return tx.emailLog.count({
    where: {
      entityId: { in: [...ids] },
      status: "sent",
      NOT: [{ recipient: ADRESSE_INTERNE }, { entityType: "QuestionnaireAvantAuditEssai" }],
    },
  });
}

interface Parties {
  readonly compteurs: Map<string, number>;
  readonly bloquants: string[];
  readonly questionnaireIds: string[];
  readonly rencontreIds: string[];
  readonly contactIds: string[];
}

const vide = (): Parties => ({
  compteurs: new Map(),
  bloquants: [],
  questionnaireIds: [],
  rencontreIds: [],
  contactIds: [],
});

const ajouter = (p: Parties, libelle: string, n: number) =>
  p.compteurs.set(libelle, (p.compteurs.get(libelle) ?? 0) + n);

const TOUT = true as const;

async function partiesQuestionnaire(tx: Tx, qid: string, p: Parties): Promise<void> {
  const q = await tx.questionnaireAvantAudit.findUnique({
    where: { id: qid },
    select: { id: true, destinataire: true, envoyeLe: true },
  });
  if (q === null) return;
  p.questionnaireIds.push(q.id);
  let dest: string | null = null;
  try {
    dest = q.destinataire === null ? null : dechiffrerParole(q.destinataire);
  } catch {
    dest = null;
  }
  if (q.envoyeLe !== null && (dest === null || dest.trim().toLowerCase() !== ADRESSE_INTERNE)) {
    p.bloquants.push(
      `questionnaire envoyé à un prospect réel (pas à ${ADRESSE_INTERNE}) : passez par l'effacement RGPD`,
    );
  }
  const [envois, brouillons, suivis, courriers] = await Promise.all([
    tx.questionnaireAvantAuditEnvoi.findMany({
      where: { questionnaireId: qid },
      select: { id: true },
    }),
    tx.questionnaireAvantAuditBrouillon.count({ where: { questionnaireId: qid } }),
    tx.questionnaireAvantAuditSuivi.count({ where: { questionnaireId: qid } }),
    tx.questionnaireAvantAuditCourrier.count({ where: { questionnaireId: qid } }),
  ]);
  ajouter(p, "questionnaire", 1);
  ajouter(p, "réponse(s), dirigeant compris", envois.length);
  ajouter(p, "brouillon(s)", brouillons);
  ajouter(p, "suivi(s) du questionnaire", suivis);
  ajouter(p, "courrier(s) du suivi", courriers);
  const envoiIds = envois.map((e) => e.id);
  const nosQ: Nos = new Map([
    ["questionnaires_avant_audit_envois.questionnaire_id", TOUT],
    ["questionnaires_avant_audit_brouillons.questionnaire_id", TOUT],
    ["questionnaires_avant_audit_suivis.questionnaire_id", TOUT],
    ["questionnaires_avant_audit_courriers.questionnaire_id", TOUT],
  ]);
  p.bloquants.push(...(await liensHorsPerimetre(tx, "questionnaires_avant_audit", [qid], nosQ)));
  p.bloquants.push(
    ...(await liensHorsPerimetre(
      tx,
      "questionnaires_avant_audit_envois",
      envoiIds,
      new Map([
        [
          "questionnaires_avant_audit_courriers.envoi_id",
          { colonne: "questionnaire_id", ids: [qid] },
        ],
      ]),
    )),
  );
  const reels = await envoisReels(tx, [qid, ...envoiIds]);
  if (reels > 0) p.bloquants.push(`${reels} e-mail(s) parti(s) à un prospect réel`);
}

async function partiesRencontre(tx: Tx, rid: string, p: Parties): Promise<void> {
  const r = await tx.rencontre.findUnique({
    where: { id: rid },
    select: {
      id: true,
      questionnaireAvantAudit: { select: { id: true } },
      participants: { select: { id: true } },
      suivi: { select: { valideLe: true } },
    },
  });
  if (r === null) return;
  p.rencontreIds.push(r.id);
  ajouter(p, "rencontre(s)", 1);
  ajouter(p, "participant(s)", r.participants.length);
  ajouter(p, "suivi(s) de rendez-vous", r.suivi === null ? 0 : 1);
  if (r.suivi?.valideLe != null) p.bloquants.push("issue du rendez-vous déjà validée");
  if (r.questionnaireAvantAudit !== null) {
    await partiesQuestionnaire(tx, r.questionnaireAvantAudit.id, p);
  }
  const nosR: Nos = new Map([
    ["questionnaires_avant_audit.rencontre_id", TOUT],
    ["rencontre_participants.rencontre_id", TOUT],
    ["rencontre_suivis.rencontre_id", TOUT],
  ]);
  p.bloquants.push(...(await liensHorsPerimetre(tx, "rencontres", [rid], nosR)));
  p.bloquants.push(
    ...(await liensHorsPerimetre(
      tx,
      "rencontre_participants",
      r.participants.map((x) => x.id),
      new Map(),
    )),
  );
  const reels = await envoisReels(tx, [rid]);
  if (reels > 0) p.bloquants.push(`${reels} e-mail(s) parti(s) à un prospect réel`);
}

async function partiesClient(tx: Tx, cid: string, p: Parties): Promise<void> {
  const [rencontres, contacts] = await Promise.all([
    tx.rencontre.findMany({ where: { clientId: cid }, select: { id: true } }),
    tx.clientContact.findMany({ where: { clientId: cid }, select: { id: true } }),
  ]);
  for (const r of rencontres) await partiesRencontre(tx, r.id, p);
  p.contactIds.push(...contacts.map((c) => c.id));
  ajouter(p, "fiche client", 1);
  ajouter(p, "contact(s) de la fiche", contacts.length);
  const nosRencontres = { colonne: "rencontre_id", ids: p.rencontreIds };
  p.bloquants.push(
    ...(await liensHorsPerimetre(
      tx,
      "clients",
      [cid],
      new Map<string, true | { colonne: string; ids: readonly string[] }>([
        ["rencontres.client_id", TOUT],
        ["client_contacts.client_id", TOUT],
        ["rencontre_participants.client_id", nosRencontres],
      ]),
    )),
  );
  p.bloquants.push(
    ...(await liensHorsPerimetre(
      tx,
      "client_contacts",
      p.contactIds,
      new Map([["rencontre_participants.contact_id", nosRencontres]]),
    )),
  );
  const reels = await envoisReels(tx, [cid]);
  if (reels > 0) p.bloquants.push(`${reels} e-mail(s) parti(s) à un prospect réel`);
}

async function entete(
  tx: Tx,
  type: TypeCible,
  id: string,
): Promise<{ nom: string; email: string | null } | null> {
  if (type === "client") {
    const c = await tx.client.findUnique({
      where: { id },
      select: { raisonSociale: true, contactEmail: true },
    });
    return c === null ? null : { nom: c.raisonSociale, email: c.contactEmail };
  }
  const rencontreId =
    type === "rencontre"
      ? id
      : (
          await tx.questionnaireAvantAudit.findUnique({
            where: { id },
            select: { rencontreId: true },
          })
        )?.rencontreId;
  if (type === "questionnaire" && rencontreId === undefined) return null;
  const r =
    rencontreId === null || rencontreId === undefined
      ? null
      : await tx.rencontre.findUnique({
          where: { id: rencontreId },
          select: { titre: true, client: { select: { raisonSociale: true, contactEmail: true } } },
        });
  if (type === "rencontre" && r === null) return null;
  return {
    nom: r?.client?.raisonSociale ?? r?.titre ?? "Questionnaire sans rencontre",
    email: r?.client?.contactEmail ?? null,
  };
}

async function calculer(
  tx: Tx,
  type: TypeCible,
  id: string,
): Promise<{ bilan: BilanSuppression; parties: Parties } | null> {
  const e = await entete(tx, type, id);
  if (e === null) return null;
  const p = vide();
  if (type === "questionnaire") await partiesQuestionnaire(tx, id, p);
  else if (type === "rencontre") await partiesRencontre(tx, id, p);
  else await partiesClient(tx, id, p);
  return {
    bilan: {
      type,
      id,
      nom: e.nom,
      email: e.email,
      compteurs: [...p.compteurs].map(([libelle, n]) => ({ libelle, n })),
      bloquants: [...new Set(p.bloquants)],
    },
    parties: p,
  };
}

/** L'écran de confirmation : ce qui serait supprimé, et ce qui l'empêche. Lecture seule. */
export async function bilanSuppression(
  type: TypeCible,
  id: string,
  base: { $transaction: typeof prisma.$transaction } = prisma,
): Promise<BilanSuppression | null> {
  return base.$transaction(async (tx) => (await calculer(tx as Tx, type, id))?.bilan ?? null, {
    timeout: 30_000,
  });
}

export type ResultatSuppression =
  | { readonly ok: true; readonly compteurs: ReadonlyArray<Compteur> }
  | { readonly ok: false; readonly motif: string };

/**
 * Supprime, après avoir REVU le bilan dans la même transaction. L'appelant a déjà vérifié le rôle
 * (super-administrateur) et le mot de confirmation ; on revérifie le mot ici (défense en
 * profondeur). Rien n'est supprimé si un bloquant existe.
 */
export async function supprimerManuellement(
  args: {
    readonly type: TypeCible;
    readonly id: string;
    readonly acteurId: string;
    readonly confirmation: string;
  },
  base: { $transaction: typeof prisma.$transaction } = prisma,
): Promise<ResultatSuppression> {
  if (args.confirmation !== MOT_CONFIRMATION) {
    return { ok: false, motif: `Écrivez ${MOT_CONFIRMATION} pour confirmer.` };
  }
  return base.$transaction(
    async (t): Promise<ResultatSuppression> => {
      const tx = t as Tx;
      const calcul = await calculer(tx, args.type, args.id);
      if (calcul === null) return { ok: false, motif: "Introuvable : rien n'a été supprimé." };
      const { bilan, parties: p } = calcul;
      if (bilan.bloquants.length > 0) {
        return { ok: false, motif: `${MESSAGE_BLOQUE} (${bilan.bloquants.join(" ; ")})` };
      }
      const qids = p.questionnaireIds;
      if (qids.length > 0) {
        await tx.questionnaireAvantAuditCourrier.deleteMany({
          where: { questionnaireId: { in: qids } },
        });
        await tx.questionnaireAvantAuditSuivi.deleteMany({
          where: { questionnaireId: { in: qids } },
        });
        await tx.questionnaireAvantAuditBrouillon.deleteMany({
          where: { questionnaireId: { in: qids } },
        });
        await tx.questionnaireAvantAuditEnvoi.deleteMany({
          where: { questionnaireId: { in: qids } },
        });
        await tx.questionnaireAvantAudit.deleteMany({ where: { id: { in: qids } } });
      }
      const rids = p.rencontreIds;
      if (rids.length > 0) {
        // Participants et suivi de rendez-vous suivent par la cascade de la base (liste blanche).
        await tx.rencontre.deleteMany({ where: { id: { in: rids } } });
      }
      if (args.type === "client") {
        await tx.clientContact.deleteMany({ where: { clientId: args.id } });
        await tx.client.delete({ where: { id: args.id } });
      }
      // Trace SANS contenu : qui, quand (createdAt), quoi, combien. Jamais purgée.
      await tx.activityLog.create({
        data: {
          adminUserId: args.acteurId,
          action: `suppression-manuelle.${args.type}`,
          targetType: args.type,
          targetId: args.id,
          changes: Object.fromEntries(bilan.compteurs.map((c) => [c.libelle, c.n])),
        },
      });
      return { ok: true, compteurs: bilan.compteurs };
    },
    { timeout: 30_000 },
  );
}
