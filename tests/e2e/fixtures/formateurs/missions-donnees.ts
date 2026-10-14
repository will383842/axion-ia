// Banc @formateurs (missions) — les DONNÉES d'un scénario : un « monde » isolé.
//
// Chaque scénario crée son propre monde (offre, formation, client, sessions,
// formateurs, administrateur), marqué d'un suffixe unique, et l'EFFACE en fin de
// test. Données fictives seulement : domaine `example.test`, SIRET de banc à clé
// de Luhn juste, noms inventés.
//
// 🔑 Le formateur « prêt » est l'ÉTAT D'ENTRÉE du parcours mission : son dossier
// et son contrat-cadre sont le sujet de l'équipe A (E01-E12). Ici il est POSÉ tel
// que ce parcours le laisse : fiche active, registre contrôlé ce mois-ci, numéro
// de déclaration, contrat-cadre de la dernière version arrêtée SIGNÉ des deux
// parties, avec le SIRET de la fiche inscrit dedans.

import { createHash, randomUUID } from "node:crypto";

import type { Prisma } from "../../../../prisma/generated/client/index.js";

import { prisma } from "./base";
import { messagesCaptes, URL_PUITS, viderPuitsPour } from "./puits-smtp";

const JOUR_MS = 86_400_000;

function hex64(graine: string): string {
  return createHash("sha256").update(graine).digest("hex");
}

/** SIRET fictif à clé de Luhn juste (14 chiffres), distinct par graine. */
export function siretDeBanc(graine: number): string {
  const base = `9${String(graine % 1e12).padStart(12, "0")}`;
  for (let c = 0; c <= 9; c += 1) {
    const s = `${base}${c}`;
    let somme = 0;
    for (let i = 0; i < 14; i += 1) {
      let d = Number(s[13 - i]);
      if (i % 2 === 1) {
        d *= 2;
        if (d > 9) d -= 9;
      }
      somme += d;
    }
    if (somme % 10 === 0) return s;
  }
  throw new Error("siret de banc introuvable");
}

/** Le jour civil (minuit UTC) `n` jours après `depuis`. */
export function jourCivil(depuis: Date, n: number): Date {
  const d = new Date(depuis.getTime() + n * JOUR_MS);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Un instant à `heure` h, heure de Paris (été comme hiver), le jour `jour`. */
export function aParis(jour: Date, heure: number, minutes = 0): Date {
  // Paris = UTC+1 ou UTC+2 : on essaie les deux et on garde celui qui tombe juste.
  for (const decalage of [2, 1]) {
    const d = new Date(jour);
    d.setUTCHours(heure - decalage, minutes, 0, 0);
    const h = Number(
      new Intl.DateTimeFormat("fr-FR", { hour: "numeric", hour12: false, timeZone: "Europe/Paris" })
        .formatToParts(d)
        .find((p) => p.type === "hour")?.value,
    );
    if (h === heure) return d;
  }
  throw new Error("heure de Paris introuvable");
}

/**
 * Le premier instant à 10 h (Paris) au moins une heure après l'heure RÉELLE.
 * Les actions de la console lisent l'heure réelle ; les passages planifiés reçoivent
 * l'horloge pilotée, qui part d'ici et n'est donc jamais derrière l'heure réelle.
 */
export function prochainDixHeures(): Date {
  const reel = Date.now() + 60 * 60_000;
  for (let n = 0; n < 3; n += 1) {
    const d = aParis(jourCivil(new Date(), n), 10);
    if (d.getTime() >= reel) return d;
  }
  throw new Error("aucun 10 h trouvé");
}

export interface FormateurBanc {
  readonly id: string;
  readonly email: string;
  readonly prenom: string;
  readonly siret: string;
}

export interface SessionBanc {
  readonly id: string;
  readonly numero: string;
  readonly dateDebut: Date;
  readonly dateFin: Date;
}

export interface Monde {
  readonly cle: string;
  readonly admin: { readonly id: string; readonly role: string; readonly email: string };
  readonly formationId: string;
  readonly clientId: string;
  /** Tout ce qui a été créé, pour le ménage. */
  readonly traces: {
    readonly trainers: string[];
    readonly sessions: string[];
    readonly clients: string[];
    readonly documents: string[];
    readonly adresses: string[];
  };
}

let compteur = 0;

/** Un monde neuf : offre, formation, client, administrateur actif du banc. */
export async function creerMonde(nom: string): Promise<Monde> {
  const cle = `${nom}-${randomUUID().slice(0, 8)}`;
  const offre = await prisma.offreSite.create({
    data: {
      code: `BANC-${cle}`.slice(0, 60),
      titreFr: `Offre du banc ${cle}`,
      slug: `banc-${cle}`,
      formatPedagogique: "collectif_1jour",
      publicViseFr: "Public fictif du banc",
      dureeHeuresMin: 7,
      dureeHeuresMax: 7,
      tarifType: "fixe",
      promessePrincipaleFr: "Promesse fictive",
      anglePedagogiqueFr: "Angle fictif",
    } as Prisma.OffreSiteUncheckedCreateInput,
    select: { id: true },
  });
  const formation = await prisma.formation.create({
    data: {
      numero: `BANC-F-${cle}`.slice(0, 40),
      titre: `Formation du banc ${cle}`,
      slug: `banc-formation-${cle}`,
      offreSiteId: offre.id,
      dureeHeures: 7,
    } as Prisma.FormationUncheckedCreateInput,
    select: { id: true },
  });
  const adminEmail = `admin.${cle}@example.test`;
  const admin = await prisma.adminUser.create({
    data: {
      name: `Direction Banc ${cle}`,
      email: adminEmail,
      passwordHash: "banc-sans-mot-de-passe",
      role: "super_admin",
    } as Prisma.AdminUserUncheckedCreateInput,
    select: { id: true, role: true, email: true },
  });
  const client = await prisma.client.create({
    data: {
      numero: `BANC-C-${cle}`.slice(0, 40),
      raisonSociale: `Entreprise Banc ${cle}`,
      adresseCodePostal: "69003",
      adresseVille: "Lyon",
      adressePaysCode: "FR",
      contactNom: "Contact Banc",
      contactEmail: `client.${cle}@example.test`,
    } as Prisma.ClientUncheckedCreateInput,
    select: { id: true },
  });
  return {
    cle,
    admin: { id: admin.id, role: admin.role, email: admin.email },
    formationId: formation.id,
    clientId: client.id,
    traces: {
      trainers: [],
      sessions: [],
      clients: [client.id],
      documents: [],
      adresses: [adminEmail, `client.${cle}@example.test`],
    },
  };
}

/** Un client de plus (formation à plusieurs entreprises). */
export async function creerClient(monde: Monde, suffixe: string): Promise<string> {
  const email = `client.${suffixe}.${monde.cle}@example.test`;
  const c = await prisma.client.create({
    data: {
      numero: `BANC-C${suffixe}-${monde.cle}`.slice(0, 40),
      raisonSociale: `Entreprise ${suffixe} ${monde.cle}`,
      contactNom: `Contact ${suffixe}`,
      contactEmail: email,
    } as Prisma.ClientUncheckedCreateInput,
    select: { id: true },
  });
  monde.traces.clients.push(c.id);
  monde.traces.adresses.push(email);
  return c.id;
}

export interface OptionsFormateur {
  readonly prenom: string;
  /** Habilité sur la formation du monde (défaut : oui). */
  readonly habilite?: boolean;
  /** Contrat-cadre signé, dernière version (défaut : oui). */
  readonly contratSigne?: boolean;
  /** SIRET inscrit dans le contrat, s'il diffère de la fiche. */
  readonly siretDuContrat?: string;
  readonly tarifJourneeHtCents?: number;
  readonly codePostalPro?: string;
  readonly geo?: { readonly lat: number; readonly lng: number };
}

/** Version du contrat-cadre posée (la dernière arrêtée, lue dans le code). */
export const VERSION_CONTRAT_BANC = 4;

/** Un formateur indépendant PRÊT à recevoir une mission (cf. en-tête). */
export async function creerFormateurPret(
  monde: Monde,
  o: OptionsFormateur,
): Promise<FormateurBanc> {
  compteur += 1;
  const email = `${o.prenom.toLowerCase()}.${monde.cle}@example.test`;
  const siret = siretDeBanc((Date.now() % 1e9) + compteur * 7919);
  const maintenant = new Date();
  const t = await prisma.trainer.create({
    data: {
      nom: `Banc-${monde.cle}`,
      prenom: o.prenom,
      email,
      statut: "sous_traitant",
      actif: true,
      siret,
      sousTraitantNda: "84691234569",
      sousTraitantVerifieAt: new Date(maintenant.getTime() - JOUR_MS),
      sousTraitantContratSigneAt:
        o.contratSigne === false ? null : new Date(maintenant.getTime() - 10 * JOUR_MS),
      tarifJourneeHtCents: o.tarifJourneeHtCents ?? 40_000,
      regimeTvaHonoraires: "franchise_293b",
      adresseProfessionnelle: "1 rue du Banc d'Essai, 69003 Lyon",
      codePostalPro: o.codePostalPro ?? "69003",
      ...(o.geo ? { geoLat: o.geo.lat, geoLng: o.geo.lng } : {}),
      activationValideeSource: "anterieure_au_controle",
      activationValideeAt: new Date(maintenant.getTime() - 10 * JOUR_MS),
    } as Prisma.TrainerUncheckedCreateInput,
    select: { id: true },
  });
  monde.traces.trainers.push(t.id);
  monde.traces.adresses.push(email);
  if (o.habilite !== false) {
    await prisma.trainerHabilitation.create({
      data: { trainerId: t.id, formationId: monde.formationId },
    });
  }
  if (o.contratSigne !== false) {
    await poserContratCadreSigne(monde, t.id, o.siretDuContrat ?? siret, VERSION_CONTRAT_BANC);
  }
  return { id: t.id, email, prenom: o.prenom, siret };
}

/** Pose un contrat-cadre signé du formateur et d'Axion (version donnée). */
export async function poserContratCadreSigne(
  monde: Monde,
  trainerId: string,
  siretInscrit: string,
  version: number,
): Promise<string> {
  const signeAt = new Date(Date.now() - 10 * JOUR_MS);
  const numero = `BANC-CC-${randomUUID().slice(0, 12)}`;
  const hash = hex64(numero);
  const doc = await prisma.documentGenere.create({
    data: {
      type: "contrat_sous_traitance",
      numero,
      trainerId,
      hashSha256: hash,
      suppressionPrevueAt: new Date(Date.now() + 5 * 365 * JOUR_MS),
      statutSignature: "signee",
      metadata: {
        renderData: { gabaritVersion: version, data: { cocontractant: { siret: siretInscrit } } },
      },
    } as Prisma.DocumentGenereUncheckedCreateInput,
    select: { id: true },
  });
  monde.traces.documents.push(doc.id);
  // Chaîne de hachage : la 2e signature pointe la 1re (`prev_hash` unique par pièce).
  let precedent: string | null = null;
  for (const partie of ["sous_traitant", "axionia"] as const) {
    const selfHash = hex64(`${numero}-${partie}`);
    await prisma.documentSignature.create({
      data: {
        documentGenereId: doc.id,
        provider: "interne",
        partie,
        signataireNom: partie === "axionia" ? "Direction Banc" : "Formateur Banc",
        methode: "confirmation_accessible",
        documentHashSha256: hash,
        selfHash,
        prevHash: precedent,
        hashVersion: 1,
        mentionVersion: "banc",
        consentementVersion: "banc",
        signeAt,
        suppressionPrevueAt: new Date(Date.now() + 5 * 365 * JOUR_MS),
      } as Prisma.DocumentSignatureUncheckedCreateInput,
    });
    precedent = selfHash;
  }
  return doc.id;
}

/** Une attestation de vigilance URSSAF VÉRIFIÉE, émise il y a `ilYaJours` jours. */
export async function poserAttestationVigilance(trainerId: string, ilYaJours = 10): Promise<void> {
  const emission = new Date(Date.now() - ilYaJours * JOUR_MS);
  await prisma.trainerDocument.create({
    data: {
      trainerId,
      type: "attestation_vigilance_urssaf",
      statutValidation: "valide",
      fichierUrl: "banc://attestation-vigilance.pdf",
      dateEmission: emission,
    } as Prisma.TrainerDocumentUncheckedCreateInput,
  });
}

export interface OptionsSession {
  /** Premier jour, en jours après `depuis` (défaut 20). */
  readonly dansJours?: number;
  readonly nbJours?: number;
  readonly depuis?: Date;
  readonly clientId?: string | null;
  readonly codePostal?: string;
  readonly ville?: string;
  readonly distanciel?: boolean;
}

/** Une session planifiée, ses journées 9 h - 17 h, sans formateur. */
export async function creerSession(monde: Monde, o: OptionsSession = {}): Promise<SessionBanc> {
  compteur += 1;
  const depuis = o.depuis ?? new Date();
  const premier = jourCivil(depuis, o.dansJours ?? 20);
  const nb = o.nbJours ?? 1;
  const dateDebut = aParis(premier, 9);
  const dateFin = aParis(jourCivil(premier, nb - 1), 17);
  const numero = `BANC-S-${monde.cle}-${compteur}`.slice(0, 40);
  const s = await prisma.trainingSession.create({
    data: {
      numero,
      titreSession: `Session du banc ${monde.cle} n° ${compteur}`,
      formationId: monde.formationId,
      clientId: o.clientId === undefined ? monde.clientId : o.clientId,
      dateDebut,
      dateFin,
      modalite: o.distanciel ? "distanciel" : "presentiel",
      lieuType: o.distanciel ? "distanciel" : "sur_site",
      ...(o.distanciel
        ? { lieuVisioUrl: "https://visio.example.test/banc" }
        : {
            lieuAdresse: "2 place du Banc",
            lieuCodePostal: o.codePostal ?? "69003",
            lieuVille: o.ville ?? "Lyon",
          }),
      montantHtCents: 150_000,
      nbParticipantsPrevus: 8,
      statut: "planifiee",
    } as Prisma.TrainingSessionUncheckedCreateInput,
    select: { id: true },
  });
  monde.traces.sessions.push(s.id);
  for (let i = 0; i < nb; i += 1) {
    await prisma.sessionJour.create({
      data: {
        sessionId: s.id,
        date: jourCivil(premier, i),
        heureDebut: "09:00",
        heureFin: "17:00",
      } as Prisma.SessionJourUncheckedCreateInput,
    });
  }
  return { id: s.id, numero, dateDebut, dateFin };
}

export interface OptionsPiece {
  readonly type:
    "convention" | "lettre_mission" | "autorisation_captation" | "contrat_sous_traitance";
  readonly sessionId?: string;
  readonly clientId?: string;
  readonly trainerId?: string;
  readonly statutSignature?: "en_attente" | "signee";
  readonly metadata?: Prisma.InputJsonValue;
}

/** Une pièce au registre (convention à signer, par exemple), sans PDF. */
export async function creerPiece(monde: Monde, o: OptionsPiece): Promise<string> {
  const numero = `BANC-${o.type.slice(0, 4).toUpperCase()}-${randomUUID().slice(0, 12)}`;
  const d = await prisma.documentGenere.create({
    data: {
      type: o.type,
      numero,
      hashSha256: hex64(numero),
      suppressionPrevueAt: new Date(Date.now() + 5 * 365 * JOUR_MS),
      statutSignature: o.statutSignature ?? "en_attente",
      ...(o.sessionId ? { sessionId: o.sessionId } : {}),
      ...(o.clientId ? { clientId: o.clientId } : {}),
      ...(o.trainerId ? { trainerId: o.trainerId } : {}),
      metadata: o.metadata ?? {},
    } as Prisma.DocumentGenereUncheckedCreateInput,
    select: { id: true },
  });
  monde.traces.documents.push(d.id);
  return d.id;
}

/** Les envois du journal (`email_logs`) vers une adresse, dans l'ordre. */
export function envoisVers(adresse: string, gabarit?: string) {
  return prisma.emailLog.findMany({
    where: { recipient: adresse, ...(gabarit ? { template: gabarit } : {}) },
    orderBy: { createdAt: "asc" },
    select: { template: true, status: true, jobId: true, createdAt: true },
  });
}

/** Les gabarits partis vers une adresse (lignes non annulées), dans l'ordre. */
export async function gabaritsVers(adresse: string): Promise<string[]> {
  return (await envoisVers(adresse))
    .filter((l) => l.status !== "cancelled" && l.status !== "failed")
    .map((l) => l.template);
}

async function sans(f: () => Promise<unknown>): Promise<void> {
  try {
    await f();
  } catch (e) {
    console.warn(`[banc missions] ménage incomplet : ${e instanceof Error ? e.message : e}`);
  }
}

/** Efface tout le monde, dans l'ordre des dépendances. Ne lève jamais. */
export async function effacerMonde(monde: Monde): Promise<void> {
  const { trainers, sessions, clients, adresses } = monde.traces;
  const docs = await prisma.documentGenere.findMany({
    where: {
      OR: [
        { id: { in: monde.traces.documents } },
        { trainerId: { in: trainers } },
        { sessionId: { in: sessions } },
        { clientId: { in: clients } },
      ],
    },
    select: { id: true },
  });
  const docIds = docs.map((d) => d.id);
  const missions = await prisma.missionFormateur.findMany({
    where: { OR: [{ trainerId: { in: trainers } }, { sessionId: { in: sessions } }] },
    select: { id: true },
  });
  const cibles = [...trainers, ...sessions, ...clients, ...docIds, ...missions.map((m) => m.id)];
  await sans(() =>
    prisma.missionFormateur.updateMany({
      where: { id: { in: missions.map((m) => m.id) } },
      data: { lettreMissionId: null },
    }),
  );
  await sans(() =>
    prisma.$executeRawUnsafe(
      `DELETE FROM document_signature_tokens WHERE document_genere_id = ANY($1::uuid[])`,
      docIds,
    ),
  );
  await sans(() =>
    prisma.documentSignature.deleteMany({ where: { documentGenereId: { in: docIds } } }),
  );
  await sans(() =>
    prisma.missionFormateur.deleteMany({ where: { id: { in: missions.map((m) => m.id) } } }),
  );
  await sans(() => prisma.documentGenere.deleteMany({ where: { id: { in: docIds } } }));
  await sans(() =>
    prisma.choixFormateurSession.deleteMany({ where: { sessionId: { in: sessions } } }),
  );
  await sans(() =>
    prisma.$executeRawUnsafe(
      `DELETE FROM session_formateurs_retires WHERE session_id = ANY($1::uuid[])`,
      sessions,
    ),
  );
  await sans(() => prisma.sessionFormateur.deleteMany({ where: { sessionId: { in: sessions } } }));
  await sans(() => prisma.sessionJour.deleteMany({ where: { sessionId: { in: sessions } } }));
  await sans(() =>
    prisma.trainingSession.updateMany({
      where: { id: { in: sessions } },
      data: { formateurPrincipalId: null },
    }),
  );
  await sans(() => prisma.trainingSession.deleteMany({ where: { id: { in: sessions } } }));
  await sans(() => prisma.trainerDocument.deleteMany({ where: { trainerId: { in: trainers } } }));
  await sans(() =>
    prisma.trainerHabilitation.deleteMany({ where: { trainerId: { in: trainers } } }),
  );
  await sans(() => prisma.trainerStatement.deleteMany({ where: { trainerId: { in: trainers } } }));
  await sans(() => prisma.trainer.deleteMany({ where: { id: { in: trainers } } }));
  await sans(() => prisma.client.deleteMany({ where: { id: { in: clients } } }));
  await sans(() => prisma.formation.deleteMany({ where: { id: monde.formationId } }));
  await sans(() => prisma.offreSite.deleteMany({ where: { slug: `banc-${monde.cle}` } }));
  await sans(() => prisma.activityLog.deleteMany({ where: { targetId: { in: cibles } } }));
  await sans(() => prisma.activityLog.deleteMany({ where: { adminUserId: monde.admin.id } }));
  await sans(() => prisma.adminUser.deleteMany({ where: { id: monde.admin.id } }));
  await sans(() => prisma.emailLog.deleteMany({ where: { recipient: { in: adresses } } }));
  for (const a of adresses) await sans(() => viderPuitsPour(a));
}

/** Le texte (version texte brut) des messages captés par le puits pour une adresse. */
export async function textesCaptes(
  adresse: string,
): Promise<Array<{ sujet: string; texte: string }>> {
  const messages = await messagesCaptes(adresse);
  return Promise.all(
    messages.map(async (m) => {
      const r = await fetch(`${URL_PUITS}/api/v1/message/${m.id}`);
      const corps = (await r.json()) as { Text?: string; HTML?: string };
      return { sujet: m.sujet, texte: `${corps.Text ?? ""}\n${corps.HTML ?? ""}` };
    }),
  );
}
