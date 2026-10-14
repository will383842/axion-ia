// Banc @formateurs, équipe sécurité — les DONNÉES d'un scénario, côté `tsx`.
//
// Tout est fictif et reconnaissable : domaine `example.test` (RFC 2606),
// noms « Banc-Sécu », suffixe aléatoire par scénario. Chaque création est
// notée, et `menage()` l'efface en fin de scénario, dans l'ordre inverse.
//
// 🔑 Les interrupteurs et les textes validés sont posés PAR LES ACTIONS DE LA
// CONSOLE (session super-administrateur réelle de la base du banc), pas par une
// écriture directe : leurs préalables sont donc relus comme en production.
// L'état d'avant est relu en base et remis à la fin, ligne par ligne.
//
// ⚠️ Les interrupteurs sont des lignes GLOBALES de `settings`, partagées par
// tous les specs du job. Les scénarios de cette équipe qui les touchent se
// sérialisent par un verrou Redis (`avecVerrouInterrupteurs`).

import { randomUUID } from "node:crypto";

import { Redis } from "ioredis";

import { prisma } from "@/lib/prisma";
import * as interrupteursConsole from "@/server/actions/qualiopi/formateurs-interrupteurs";
import { validerTexteEmailAction } from "@/server/email/textes-valides-actions";
import { empreinteAttendue } from "@/server/email/textes-formateurs-a-valider";
import { cleTexteValide } from "@/server/email/textes-valides";

import { poserSession } from "./faux-auth";

export type Role =
  "super_admin" | "admin" | "editor" | "reader" | "responsable_qualite" | "secretaire";

export interface Admin {
  readonly id: string;
  readonly role: Role;
  readonly email: string;
  readonly name: string;
}

/** Suffixe propre au scénario : isole ses lignes de celles des autres specs. */
export const CLE = randomUUID().slice(0, 8);

const aEffacer: Array<() => Promise<unknown>> = [];

/** Note un effacement à faire au ménage (joué en ordre inverse). */
export function aNettoyer(f: () => Promise<unknown>): void {
  aEffacer.push(f);
}

/** Efface tout ce que le scénario a créé ; une faute de ménage ne masque pas le résultat. */
export async function menage(): Promise<void> {
  for (const f of aEffacer.reverse()) {
    try {
      await f();
    } catch (e) {
      console.error("banc @formateurs — ménage incomplet :", e instanceof Error ? e.message : e);
    }
  }
  aEffacer.length = 0;
}

export function adresse(role: string): string {
  return `${role}.secu.${CLE}.${Math.floor(Math.random() * 1e6)}@example.test`;
}

export async function creerAdmin(role: Role): Promise<Admin> {
  const email = adresse(`admin-${role}`);
  const name = `Banc-Sécu ${role} ${CLE}`;
  const a = await prisma.adminUser.create({
    data: { name, email, passwordHash: "banc-formateurs-aucun-mot-de-passe", role },
    select: { id: true },
  });
  aNettoyer(async () => {
    await prisma.activityLog.deleteMany({ where: { adminUserId: a.id } });
    await prisma.adminUser.delete({ where: { id: a.id } });
  });
  return { id: a.id, role, email, name };
}

/** La session que les Server Actions liront par `auth()`. */
export function seConnecter(admin: Admin | null): void {
  poserSession(
    admin === null ? null : { user: { id: admin.id, role: admin.role, email: admin.email } },
  );
}

export interface Independant {
  readonly id: string;
  readonly email: string;
  readonly nom: string;
  readonly prenom: string;
  readonly telephone: string;
  readonly adresse: string;
}

/** Un formateur indépendant en nom propre, fictif. */
export async function creerIndependant(
  donnees: Partial<Parameters<typeof prisma.trainer.create>[0]["data"]> = {},
): Promise<Independant> {
  const email = adresse("formateur");
  const nom = `Banc-Sécu-${CLE}`;
  const prenom = `Zéphyrin${CLE.slice(0, 4)}`;
  const telephone = `06${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
  const adressePro = `17 rue du Banc-Sécu-${CLE} 69000 Lyon`;
  const t = await prisma.trainer.create({
    data: {
      nom,
      prenom,
      email,
      telephone,
      statut: "sous_traitant",
      actif: false,
      adresseProfessionnelle: adressePro,
      ...donnees,
    } as Parameters<typeof prisma.trainer.create>[0]["data"],
    select: { id: true, email: true },
  });
  aNettoyer(() => effacerFormateur(t.id));
  return { id: t.id, email: t.email, nom, prenom, telephone, adresse: adressePro };
}

/** Efface un formateur fictif et ce qui pend à lui (au mieux). */
export async function effacerFormateur(trainerId: string): Promise<void> {
  const docs = await prisma.documentGenere.findMany({ where: { trainerId }, select: { id: true } });
  const ids = docs.map((d) => d.id);
  if (ids.length > 0) {
    await prisma.documentSignatureToken.deleteMany({ where: { documentGenereId: { in: ids } } });
    await prisma.documentGenere.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.missionFormateur.deleteMany({ where: { trainerId } });
  await prisma.trainerDocument.deleteMany({ where: { trainerId } });
  await prisma.trainerStatement.deleteMany({ where: { trainerId } });
  await prisma.formateurMagicLink.deleteMany({ where: { trainerId } });
  await prisma.activityLog.deleteMany({ where: { targetId: trainerId } });
  await prisma.trainer.delete({ where: { id: trainerId } });
}

/** Une session de formation fictive (offre, formation, session). */
export async function creerSessionFormation(debut: Date): Promise<{
  id: string;
  formationId: string;
  dateDebut: Date;
  dateFin: Date;
  statut: string;
}> {
  const offre = await prisma.offreSite.create({
    data: {
      code: `BANC-SECU-${CLE}`,
      titreFr: `Offre banc ${CLE}`,
      slug: `banc-secu-${CLE}`,
      formatPedagogique: "collectif_1jour",
      publicViseFr: "Banc",
      dureeHeuresMin: 7,
      dureeHeuresMax: 7,
      tarifType: "sur_devis",
      promessePrincipaleFr: "Banc",
      anglePedagogiqueFr: "Banc",
    } as never,
    select: { id: true },
  });
  const formation = await prisma.formation.create({
    data: {
      numero: `BANC-F-${CLE}`,
      titre: `Formation banc ${CLE}`,
      slug: `formation-banc-secu-${CLE}`,
      offreSiteId: offre.id,
      dureeHeures: 7,
    },
    select: { id: true },
  });
  const fin = new Date(debut.getTime() + 8 * 3_600_000);
  const session = await prisma.trainingSession.create({
    data: {
      numero: `BANC-S-${CLE}`,
      titreSession: `Session banc ${CLE}`,
      formationId: formation.id,
      dateDebut: debut,
      dateFin: fin,
      modalite: "presentiel",
      montantHtCents: 100_000,
      nbParticipantsPrevus: 4,
    },
    select: { id: true, statut: true },
  });
  aNettoyer(async () => {
    await prisma.missionFormateur.deleteMany({ where: { sessionId: session.id } });
    await prisma.trainingSession.delete({ where: { id: session.id } });
    await prisma.formation.delete({ where: { id: formation.id } });
    await prisma.offreSite.delete({ where: { id: offre.id } });
  });
  return {
    id: session.id,
    formationId: formation.id,
    dateDebut: debut,
    dateFin: fin,
    statut: String(session.statut),
  };
}

let numero = 0;
/** Une pièce générée fictive (contrat-cadre, lettre de mission…), avec un jeton de signature. */
export async function creerPieceASigner(
  trainerId: string,
  type: "contrat_sous_traitance" | "lettre_mission",
  statutSignature: "en_attente" | "partielle" | "signee",
  sessionId?: string,
): Promise<{ id: string; jetonId: string }> {
  numero += 1;
  const doc = await prisma.documentGenere.create({
    data: {
      type,
      numero: `BANC-SECU-${CLE}-${numero}`,
      hashSha256: "0".repeat(64),
      suppressionPrevueAt: new Date(Date.now() + 10 * 365 * 86_400_000),
      trainerId,
      statutSignature,
      ...(sessionId ? { sessionId } : {}),
    } as never,
    select: { id: true },
  });
  const jeton = await prisma.documentSignatureToken.create({
    data: {
      documentGenereId: doc.id,
      partie: "formateur",
      tokenHash: randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, ""),
      signataireNom: "Signataire banc",
      expiresAt: new Date(Date.now() + 7 * 86_400_000),
    },
    select: { id: true },
  });
  return { id: doc.id, jetonId: jeton.id };
}

// ── Interrupteurs et textes, posés par la console ─────────────────────────

const ACTIONS: Readonly<Record<string, string>> = {
  textes_valides: "basculerFormateursTextesValidesAction",
  echange_ouvert: "basculerFormateursEchangeOuvertAction",
  invitation_auto: "basculerFormateursInvitationAutoAction",
  dossier_en_ligne: "basculerFormateursDossierEnLigneAction",
  relances_auto: "basculerFormateursRelancesAutoAction",
  pieces_cron: "basculerFormateursPiecesCronAction",
  activation_auto: "basculerFormateursActivationAutoAction",
  suivi_echange: "basculerFormateursSuiviEchangeAction",
  fin_collaboration: "basculerFormateursFinCollaborationAction",
  garde_mission_portes: "basculerFormateursGardeMissionPortesAction",
  controle_registre_periodique: "basculerFormateursControleRegistrePeriodiqueAction",
  changement_coordonnees: "basculerFormateursChangementCoordonneesAction",
};

type EtatAction = { ok: true; message: string } | { ok: false; error: string };
type Bascule = (prev: EtatAction, fd: FormData) => Promise<EtatAction>;

const avant = new Map<string, { value: unknown; description: string | null } | null>();

async function noterAvant(key: string): Promise<void> {
  if (avant.has(key)) return;
  const l = await prisma.setting.findUnique({
    where: { key },
    select: { value: true, description: true },
  });
  avant.set(key, l);
}

/** Bascule un interrupteur PAR SON ACTION de console, sous la session courante. */
export async function basculerParLaConsole(cle: string, actif: boolean): Promise<EtatAction> {
  const nom = ACTIONS[cle];
  if (nom === undefined) throw new Error(`banc : pas d'action connue pour « ${cle} »`);
  await noterAvant(`formateurs.${cle}`);
  const fd = new FormData();
  fd.set("actif", actif ? "1" : "0");
  const action = (interrupteursConsole as unknown as Record<string, Bascule>)[nom];
  if (action === undefined) throw new Error(`banc : action « ${nom} » introuvable`);
  return action({ ok: true, message: "" }, fd);
}

/** Allume, dans l'ordre, sous une session super-administrateur ; échoue si la console refuse. */
export async function allumerParLaConsole(
  direction: Admin,
  cles: readonly string[],
): Promise<void> {
  seConnecter(direction);
  for (const cle of cles) {
    const r = await basculerParLaConsole(cle, true);
    if (!r.ok) throw new Error(`banc : la console refuse d'allumer « ${cle} » : ${r.error}`);
  }
}

/** Valide des textes formateurs PAR L'ACTION de la console (empreinte du texte du code). */
export async function validerTextesParLaConsole(
  direction: Admin,
  textes: ReadonlyArray<{ gabarit: string; variante?: string }>,
): Promise<void> {
  seConnecter(direction);
  for (const t of textes) {
    const cle = cleTexteValide(t.gabarit, t.variante);
    await noterAvant(cle);
    const empreinte = empreinteAttendue(cle) ?? undefined;
    const r = await validerTexteEmailAction({
      gabarit: t.gabarit,
      ...(t.variante ? { variante: t.variante } : {}),
      valide: true,
      ...(empreinte ? { empreinte } : {}),
    });
    if (!r.ok) throw new Error(`banc : la console refuse de valider « ${cle} » : ${r.error}`);
  }
}

/** Note une clé de réglage à remettre en l'état, sans la toucher soi-même. */
export async function noterReglage(key: string): Promise<void> {
  await noterAvant(key);
}

/** Remet chaque réglage touché dans son état d'avant (valeur, ou absence). */
export async function restaurerReglages(): Promise<void> {
  for (const [key, ligne] of avant) {
    if (ligne === null) await prisma.setting.deleteMany({ where: { key } });
    else
      await prisma.setting.upsert({
        where: { key },
        create: { key, value: ligne.value as never, description: ligne.description },
        update: { value: ligne.value as never, description: ligne.description },
      });
  }
  avant.clear();
}

// ── Le verrou des interrupteurs ───────────────────────────────────────────

const VERROU = "banc-formateurs:securite:interrupteurs";

/**
 * Sérialise les scénarios qui touchent les interrupteurs globaux : un seul à
 * la fois, et ses réglages remis en l'état AVANT de rendre le verrou.
 */
export async function avecVerrouInterrupteurs<T>(f: () => Promise<T>): Promise<T> {
  const redis = new Redis(process.env["REDIS_URL"] ?? "redis://localhost:6379", {
    maxRetriesPerRequest: 2,
  });
  const jeton = randomUUID();
  const limite = Date.now() + 240_000;
  try {
    for (;;) {
      const pris = await redis.set(VERROU, jeton, "PX", 180_000, "NX");
      if (pris === "OK") break;
      if (Date.now() > limite) throw new Error("banc : verrou des interrupteurs jamais obtenu");
      await new Promise((r) => setTimeout(r, 250));
    }
    try {
      return await f();
    } finally {
      await restaurerReglages();
    }
  } finally {
    if ((await redis.get(VERROU)) === jeton) await redis.del(VERROU);
    redis.disconnect();
  }
}

/** Les lignes du journal d'activité qui portent sur un objet. */
export function journalDe(targetId: string) {
  return prisma.activityLog.findMany({
    where: { targetId },
    select: { action: true, changes: true },
    orderBy: { createdAt: "asc" },
  });
}

/** Attend, en relisant, qu'une condition tienne (le worker tourne à part). */
export async function attendre<T>(
  lire: () => Promise<T>,
  ok: (v: T) => boolean,
  delaiMs = 60_000,
): Promise<T> {
  const limite = Date.now() + delaiMs;
  for (;;) {
    const v = await lire();
    if (ok(v) || Date.now() > limite) return v;
    await new Promise((r) => setTimeout(r, 500));
  }
}

export { prisma };

/** Une valeur fictive pour chaque [crochet] du texte d'un gabarit formateur. */
export async function valeursDuBanc(gabarit: string): Promise<Record<string, string>> {
  const { TEXTES_FORMATEUR } = await import("@/lib/email/templates/formateur-independant-textes");
  const t = (
    TEXTES_FORMATEUR as Record<
      string,
      { variantes: ReadonlyArray<{ objet: string; paragraphes: readonly string[] }> }
    >
  )[gabarit];
  const valeurs: Record<string, string> = {};
  for (const v of t?.variantes ?? []) {
    for (const s of [v.objet, ...v.paragraphes]) {
      for (const m of s.matchAll(/\[([^[\]]+)\]/g)) valeurs[m[1] ?? ""] = "banc";
    }
  }
  return valeurs;
}

/** Le jour civil de Paris (AAAA-MM-JJ). */
export function jourDeParis(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(d);
}
