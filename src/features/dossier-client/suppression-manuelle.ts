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
 *   · le bilan est RECALCULÉ dans la transaction de suppression, APRÈS avoir verrouillé
 *     (`SELECT … FOR UPDATE`) les lignes visées : fiche, rencontres, questionnaires, réponses,
 *     participants, contacts. Une écriture concurrente du worker (enregistrement, traitement
 *     de visio, compte rendu, e-mail de suivi, contrôle IDCC…) pose sur la ligne parente un
 *     verrou `FOR KEY SHARE`, qui ATTEND notre fin : soit elle est déjà validée et le bilan la
 *     voit (elle bloque), soit elle arrive après et échoue sur sa clé étrangère. Jamais une
 *     ligne n'est emportée en silence par une cascade ;
 *   · une clé étrangère dont la 1re colonne visée n'est pas la colonne attendue (`id`…) n'est
 *     pas devinée : elle BLOQUE (« lien non vérifiable ») ; une clé composée dont la 1re colonne
 *     visée est la bonne (`*_meme_client`) est comptée par cette colonne ;
 *   · DOUBLE VALIDATION (26/10/2026) : 1re étape = bilan + mot EFFACER, qui délivre un jeton signé
 *     de 5 minutes ; 2e étape = recopie du numéro de la fiche (ou d'un code de contrôle). Le bilan
 *     est recalculé dans la transaction et comparé à son empreinte : s'il a changé, rien n'est
 *     supprimé ;
 *   · un double clic ne trace rien : « déjà supprimé », aucune ligne d'audit si rien n'est
 *     supprimé ;
 *   · une trace d'audit (`activity_logs`, jamais purgée) dit qui, quand, quoi et combien, SANS
 *     contenu (ni nom, ni adresse, ni réponse) ;
 *   · les e-mails déjà partis restent dans `email_logs` (rien n'y est touché).
 */

import { prisma } from "@/lib/prisma";
import { dechiffrerParole } from "@/lib/chiffrer-parole";

import type { Tx } from "./base";
import {
  creerJetonSuppression,
  empreinteBilan,
  lireJetonSuppression,
  normaliserCode,
} from "./suppression-jeton";

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
  /** À recopier en 2e validation (numéro de la fiche, ou 8 premiers caractères) ; jamais tracé. */
  readonly code: string;
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
  email_outbox: "e-mail(s) non refusé(s) de « E-mails à valider »",
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

interface CleEtrangere {
  readonly table: string;
  readonly colonne: string;
  /** La colonne VISÉE dans `table` (attendue : `id`, ou la clé primaire donnée). */
  readonly cible: string | null;
  /** Nombre de colonnes de la clé : seule une clé à UNE colonne est vérifiable ici. */
  readonly n: number;
}

/**
 * TOUTES les clés étrangères qui visent `table`, lues dans le catalogue : rien n'est supposé, une
 * table ajoutée demain est vue demain. La première colonne de chaque côté, et leur nombre : une clé
 * composée dont la 1re colonne visée n'est pas celle attendue sera REFUSÉE (`liensHorsPerimetre`).
 */
async function clesEtrangeres(tx: Tx, table: string): Promise<ReadonlyArray<CleEtrangere>> {
  const lignes = await tx.$queryRaw<
    Array<{ table: string; colonne: string; cible: string | null; n: number | null }>
  >`
    SELECT c.conrelid::regclass::text AS "table", a.attname AS colonne,
           cible.attname AS cible, cardinality(c.conkey)::int AS n
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    LEFT JOIN pg_attribute cible ON cible.attrelid = c.confrelid AND cible.attnum = c.confkey[1]
    WHERE c.contype = 'f' AND c.confrelid = to_regclass(${table})`;
  return lignes.map((l) => ({
    table: l.table,
    colonne: l.colonne,
    cible: l.cible ?? null,
    n: Number(l.n ?? 0),
  }));
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
  /** La colonne que les lignes à supprimer exposent aux clés étrangères (sa clé primaire). */
  colonneCible = "id",
): Promise<string[]> {
  if (ids.length === 0) return [];
  const sortie: string[] = [];
  for (const fk of await clesEtrangeres(tx, table)) {
    if (fk.n < 1 || fk.cible !== colonneCible) {
      // Vise une autre colonne en 1re position : on ne devine pas, on refuse.
      sortie.push(`lien non vérifiable depuis la console (${nomTable(fk.table)})`);
      continue;
    }
    // Clé composée (`*_meme_client` : (contact_id, client_id) → client_contacts(id, client_id)) : la
    // 1re colonne visée est notre clé primaire, donc toute ligne qui nous vise porte notre id dans
    // `fk.colonne`. Compter par elle suffit ; une ligne que Postgres ne contrôle pas (autre colonne
    // NULL) est comptée aussi : on bloque plutôt que d'oublier.
    const regle = nos.get(`${fk.table.replace(/"/g, "")}.${fk.colonne}`);
    if (regle === true) continue;
    const exclusion =
      regle === undefined ? "" : ` AND NOT (${ident(regle.colonne)}::text = ANY($2::text[]))`;
    // Un paramètre en trop (`$2` absent de la requête) fait refuser l'appel par Postgres.
    const requete = `SELECT count(*)::int AS n FROM ${fk.table} WHERE ${ident(fk.colonne)}::text = ANY($1::text[])${exclusion}`;
    const lignes =
      regle === undefined
        ? await tx.$queryRawUnsafe<{ n: number }[]>(requete, [...ids])
        : await tx.$queryRawUnsafe<{ n: number }[]>(requete, [...ids], [...regle.ids]);
    const n = Number(lignes[0]?.n ?? 0);
    if (n > 0) sortie.push(`${n} ${nomTable(fk.table)} lié(e)s`);
  }
  return sortie;
}

/**
 * Un e-mail RÉEL (pas un essai) parti, rebondi ou EN COURS d'envoi vers une autre adresse que
 * contact@ : un vrai prospect. Seul un échec définitif (`failed`) ne compte pas.
 */
export const STATUTS_ENVOI_REEL = ["sent", "bounced", "pending"] as const;

async function envoisReels(tx: Tx, ids: readonly string[]): Promise<number> {
  if (ids.length === 0) return 0;
  return tx.emailLog.count({
    where: {
      entityId: { in: [...ids] },
      status: { in: [...STATUTS_ENVOI_REEL] },
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
  /** Les lignes d'`email_outbox` REFUSÉES de la fiche : seules à lui appartenir. */
  readonly outboxRefuseIds: string[];
}

const vide = (): Parties => ({
  compteurs: new Map(),
  bloquants: [],
  questionnaireIds: [],
  rencontreIds: [],
  contactIds: [],
  outboxRefuseIds: [],
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
  // Le suivi de rendez-vous part par la cascade : ce qui le vise (clé `rencontre_id`) bloque.
  if (r.suivi !== null) {
    p.bloquants.push(
      ...(await liensHorsPerimetre(tx, "rencontre_suivis", [rid], new Map(), "rencontre_id")),
    );
  }
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
  // Les questionnaires envoyés à cette fiche SANS rendez-vous : la clé étrangère les détacherait
  // (SET NULL) et les laisserait orphelins ; ici c'est Will qui supprime la fiche, il voit donc
  // leur compte au bilan, et un envoi réel à un prospect reste un bloquant (effacement RGPD).
  const directs = await tx.questionnaireAvantAudit.findMany({
    where: { clientId: cid, rencontreId: null },
    select: { id: true },
  });
  for (const q of directs) await partiesQuestionnaire(tx, q.id, p);
  p.contactIds.push(...contacts.map((c) => c.id));
  const [adresses, refuses] = await Promise.all([
    p.contactIds.length === 0
      ? 0
      : tx.clientContactAdresse.count({ where: { contactId: { in: p.contactIds } } }),
    tx.emailOutbox.findMany({ where: { clientId: cid, statut: "refuse" }, select: { id: true } }),
  ]);
  p.outboxRefuseIds.push(...refuses.map((x) => x.id));
  ajouter(p, "fiche client", 1);
  ajouter(p, "contact(s) de la fiche", contacts.length);
  ajouter(p, "adresse(s) e-mail des contacts", adresses);
  ajouter(p, "e-mail(s) refusé(s) de « E-mails à valider »", refuses.length);
  const nosRencontres = { colonne: "rencontre_id", ids: p.rencontreIds };
  p.bloquants.push(
    ...(await liensHorsPerimetre(
      tx,
      "clients",
      [cid],
      new Map<string, true | { colonne: string; ids: readonly string[] }>([
        ["rencontres.client_id", TOUT],
        ["questionnaires_avant_audit.client_id", { colonne: "id", ids: p.questionnaireIds }],
        ["client_contacts.client_id", TOUT],
        ["rencontre_participants.client_id", nosRencontres],
        // Refusé = état final, jamais parti : seule cette ligne est à la fiche. Les autres bloquent.
        ["email_outbox.client_id", { colonne: "statut", ids: ["refuse"] }],
      ]),
    )),
  );
  p.bloquants.push(
    ...(await liensHorsPerimetre(
      tx,
      "client_contacts",
      p.contactIds,
      new Map<string, true | { colonne: string; ids: readonly string[] }>([
        ["rencontre_participants.contact_id", nosRencontres],
        // Les adresses d'un contact partent avec lui (cascade) : comptées au bilan, supprimées ici.
        ["client_contact_adresses.contact_id", TOUT],
      ]),
    )),
  );
  // Un e-mail de suivi qui vise un e-mail refusé : on ne le détache pas en silence.
  p.bloquants.push(...(await liensHorsPerimetre(tx, "email_outbox", p.outboxRefuseIds, new Map())));
  // Les e-mails rattachés à la fiche ET à chacun de ses contacts.
  const reels = await envoisReels(tx, [cid, ...p.contactIds]);
  if (reels > 0) p.bloquants.push(`${reels} e-mail(s) parti(s) à un prospect réel`);
}

async function entete(
  tx: Tx,
  type: TypeCible,
  id: string,
): Promise<{ nom: string; email: string | null; code: string } | null> {
  if (type === "client") {
    const c = await tx.client.findUnique({
      where: { id },
      select: { raisonSociale: true, contactEmail: true, numero: true },
    });
    return c === null ? null : { nom: c.raisonSociale, email: c.contactEmail, code: c.numero };
  }
  const q =
    type === "rencontre"
      ? undefined
      : await tx.questionnaireAvantAudit.findUnique({
          where: { id },
          select: {
            rencontreId: true,
            client: { select: { raisonSociale: true, contactEmail: true } },
          },
        });
  if (type === "questionnaire" && q === null) return null;
  const rencontreId = type === "rencontre" ? id : q?.rencontreId;
  const r =
    rencontreId === null || rencontreId === undefined
      ? null
      : await tx.rencontre.findUnique({
          where: { id: rencontreId },
          select: { titre: true, client: { select: { raisonSociale: true, contactEmail: true } } },
        });
  if (type === "rencontre" && r === null) return null;
  // Sans rendez-vous, la fiche visée directement donne son nom au questionnaire.
  const fiche = r?.client ?? q?.client ?? null;
  return {
    nom: fiche?.raisonSociale ?? r?.titre ?? "Questionnaire sans rendez-vous",
    email: fiche?.contactEmail ?? null,
    code: id.slice(0, 8).toUpperCase(),
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
      code: e.code,
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
  | {
      readonly ok: true;
      readonly compteurs: ReadonlyArray<Compteur>;
      /** Vrai si rien n'existait plus (double clic) : rien supprimé, rien tracé. */
      readonly dejaSupprime?: boolean;
    }
  | { readonly ok: false; readonly motif: string };

const DEJA_SUPPRIME: ResultatSuppression = { ok: true, compteurs: [], dejaSupprime: true };

/** `SELECT … FOR UPDATE` des lignes de `table` dont `colonne` vaut l'un des `ids` ; leurs ids. */
async function verrouiller(
  tx: Tx,
  table: string,
  colonne: string,
  ids: readonly string[],
  rendue = "id",
): Promise<string[]> {
  if (ids.length === 0) return [];
  const lignes = await tx.$queryRawUnsafe<Array<{ id?: unknown }>>(
    `SELECT ${ident(rendue)}::text AS id FROM ${table} WHERE ${ident(colonne)}::text = ANY($1::text[]) FOR UPDATE`,
    [...ids],
  );
  return lignes.map((l) => l.id).filter((x): x is string => typeof x === "string");
}

/**
 * Verrouille, du parent vers les enfants, tout ce que la suppression touche : aucune ligne fille
 * ne peut plus s'y rattacher avant la fin de la transaction (voir l'en-tête).
 */
async function verrouillerLePerimetre(tx: Tx, type: TypeCible, id: string): Promise<void> {
  let rids: string[] = [];
  let qids: string[] = [];
  if (type === "client") {
    await verrouiller(tx, "clients", "id", [id]);
    // Sans ce verrou, un e-mail refusé entre le bilan et la suppression serait détaché en silence.
    await verrouiller(tx, "email_outbox", "client_id", [id]);
    rids = await verrouiller(tx, "rencontres", "client_id", [id]);
    qids = await verrouiller(tx, "questionnaires_avant_audit", "client_id", [id]);
    await verrouiller(tx, "client_contacts", "client_id", [id]);
  } else if (type === "rencontre") {
    rids = await verrouiller(tx, "rencontres", "id", [id]);
  } else {
    qids = await verrouiller(tx, "questionnaires_avant_audit", "id", [id]);
  }
  if (rids.length > 0) {
    qids = [
      ...qids,
      ...(await verrouiller(tx, "questionnaires_avant_audit", "rencontre_id", rids)),
    ];
    await verrouiller(tx, "rencontre_participants", "rencontre_id", rids);
    await verrouiller(tx, "rencontre_suivis", "rencontre_id", rids, "rencontre_id");
  }
  await verrouiller(tx, "questionnaires_avant_audit_envois", "questionnaire_id", qids);
}

/**
 * 1re validation : le mot EFFACER est écrit, le bilan est relu et ne montre aucun bloquant. On
 * délivre alors le jeton signé (5 minutes) qui ouvre la 2e étape. Rien n'est supprimé ici.
 */
export async function preparerSuppression(
  args: {
    readonly type: TypeCible;
    readonly id: string;
    readonly acteurId: string;
    readonly confirmation: string;
  },
  base: { $transaction: typeof prisma.$transaction } = prisma,
  maintenant: number = Date.now(),
): Promise<
  { readonly ok: true; readonly jeton: string } | { readonly ok: false; readonly motif: string }
> {
  if (args.confirmation !== MOT_CONFIRMATION) {
    return { ok: false, motif: `Écrivez ${MOT_CONFIRMATION} pour confirmer.` };
  }
  const bilan = await bilanSuppression(args.type, args.id, base);
  if (bilan === null) return { ok: false, motif: "Introuvable : rien à supprimer." };
  if (bilan.bloquants.length > 0) {
    return { ok: false, motif: `${MESSAGE_BLOQUE} (${bilan.bloquants.join(" ; ")})` };
  }
  const jeton = creerJetonSuppression(
    { type: args.type, id: args.id, acteurId: args.acteurId, empreinte: empreinteBilan(bilan) },
    maintenant,
  );
  if (jeton === null) {
    return {
      ok: false,
      motif: "Suppression indisponible : la clé de signature manque sur le serveur.",
    };
  }
  return { ok: true, jeton };
}

/**
 * 2e validation : supprime, après avoir REVU le bilan dans la même transaction. L'appelant a déjà
 * vérifié le rôle (super-administrateur) ; on revérifie ici (défense en profondeur) le jeton de la
 * 1re étape (signé, non expiré, même cible, même acteur), le numéro recopié et l'empreinte du
 * bilan. Rien n'est supprimé si un bloquant existe ou si quelque chose a changé entre les deux.
 */
export async function supprimerManuellement(
  args: {
    readonly type: TypeCible;
    readonly id: string;
    readonly acteurId: string;
    readonly jeton: string;
    readonly code: string;
  },
  base: { $transaction: typeof prisma.$transaction } = prisma,
  maintenant: number = Date.now(),
): Promise<ResultatSuppression> {
  const lu = lireJetonSuppression(args.jeton, maintenant);
  if (!lu.ok) return { ok: false, motif: lu.motif };
  const { contenu } = lu;
  if (contenu.t !== args.type || contenu.i !== args.id || contenu.a !== args.acteurId) {
    return {
      ok: false,
      motif: "Cette validation ne vaut pas pour cette suppression : recommencez.",
    };
  }
  return base.$transaction(
    async (t): Promise<ResultatSuppression> => {
      const tx = t as Tx;
      await verrouillerLePerimetre(tx, args.type, args.id);
      const calcul = await calculer(tx, args.type, args.id);
      // Double clic, ou supprimé entre-temps : rien à faire, et rien à tracer.
      if (calcul === null) return DEJA_SUPPRIME;
      const { bilan, parties: p } = calcul;
      if (bilan.bloquants.length > 0) {
        return { ok: false, motif: `${MESSAGE_BLOQUE} (${bilan.bloquants.join(" ; ")})` };
      }
      if (normaliserCode(args.code) !== normaliserCode(bilan.code)) {
        return { ok: false, motif: "Le numéro recopié ne correspond pas. Rien n'a été supprimé." };
      }
      if (empreinteBilan(bilan) !== contenu.b) {
        return {
          ok: false,
          motif:
            "Ce qui serait supprimé a changé depuis la première validation : relisez le bilan et recommencez.",
        };
      }
      let supprimees = 0;
      const compter = (r: { count: number } | undefined) => {
        supprimees += Number(r?.count ?? 0);
      };
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
        compter(await tx.questionnaireAvantAudit.deleteMany({ where: { id: { in: qids } } }));
      }
      const rids = p.rencontreIds;
      if (rids.length > 0) {
        // Participants et suivi de rendez-vous suivent par la cascade de la base (liste blanche).
        compter(await tx.rencontre.deleteMany({ where: { id: { in: rids } } }));
      }
      if (args.type === "client") {
        // Les e-mails refusés d'abord (sinon `SET NULL` les laisserait orphelins), puis les adresses.
        if (p.outboxRefuseIds.length > 0) {
          await tx.emailOutbox.deleteMany({
            where: { id: { in: p.outboxRefuseIds }, clientId: args.id, statut: "refuse" },
          });
        }
        if (p.contactIds.length > 0) {
          await tx.clientContactAdresse.deleteMany({ where: { contactId: { in: p.contactIds } } });
        }
        await tx.clientContact.deleteMany({ where: { clientId: args.id } });
        compter(await tx.client.deleteMany({ where: { id: args.id } }));
      }
      if (supprimees === 0) return DEJA_SUPPRIME;
      // Trace SANS contenu : qui, quand (createdAt), quoi, combien. Jamais purgée.
      await tx.activityLog.create({
        data: {
          adminUserId: args.acteurId,
          action: `suppression-manuelle.${args.type}`,
          targetType: args.type,
          targetId: args.id,
          changes: {
            ...Object.fromEntries(bilan.compteurs.map((c) => [c.libelle, c.n])),
            doubleValidation: true,
          },
        },
      });
      return { ok: true, compteurs: bilan.compteurs };
    },
    { timeout: 30_000 },
  );
}
