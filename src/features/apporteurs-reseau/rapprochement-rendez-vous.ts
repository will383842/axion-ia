// Réseau d'apporteurs — lot 5 de la « validation par rendez-vous » : le RAPPROCHEMENT.
//
// Quand un rendez-vous apparaît (réservation Calendly enrichie, ou rencontre créée dans la
// console), l'outil cherche les présentations « réservées » auxquelles il pourrait se rattacher et
// PROPOSE le rapprochement dans `propositions_rendez_vous_presentation`. Le dirigeant (Williams)
// retient ou écarte. Ce module N'ÉCRIT JAMAIS une validation ni une commission, n'envoie aucun
// e-mail et ne dit rien à personne.
//
// Ne propose que si : interrupteur allumé (`APPORTEURS_VALIDATION_RDV`), présentation « réservée »
// avec une ligne de réservation ouverte, rendez-vous PRIS pendant la réservation (règle du lot 2 ;
// « pas encore tenu » n'est PAS un refus : on propose, le dirigeant attendra), et, côté Calendly,
// événement enrichi avec une adresse CONFIRMÉE par l'API (jamais la colonne, que la route publique
// peut avoir remplie).
//
// Clés : empreinte de l'e-mail (`email_exact`) ; même domaine non générique ou même fiche client
// (`meme_entreprise`) ; fiche client du même SIREN et même périmètre d'établissement
// (`meme_siren`). La réponse « Un apporteur d'affaires » à la question d'origine ne pose que
// `apporteurCite` : elle ne rapproche rien à elle seule, et son absence n'empêche rien.
//
// DATE DE PRISE (`prisAt`) : côté Calendly, `invitee.created_at` de la charge CONFIRMÉE par l'API —
// jamais `capturedAt` (création de NOTRE ligne, parfois jours après la réservation). Absente ou
// illisible : rien n'est proposé. Côté rencontre saisie à la main (clé « rencontre:… »), la seule
// date connue est celle de la SAISIE dans la console : le préfixe de la clé le dit au dirigeant.
//
// Rendez-vous ANNULÉ : proposé quand même. Le dépôt ne sait pas QUI a annulé (Calendly rend `host`
// même quand le visiteur annule depuis nos pages) et la règle veut qu'une annulation par Axion IA
// soit réputée tenue : le dirigeant tranche, le lot de validation relit statut et issue au moment de
// retenir. Exclus : absent (`no_show`), reporté (`reporte`, ou ancienne réservation d'un report).
//
// Écriture : `createMany({ skipDuplicates })` sur (presentationId, rendezVousCle) — un rejeu ne
// double rien, et une proposition écartée n'est jamais recréée (sa ligne reste). AUCUN ordre n'est
// garanti entre les lignes : l'affichage doit trier sur `presentation.recueAt` (plus ancienne
// saisie d'abord, puis départage).
//
// Candidates : on part des réservations OUVERTES (pas échues, pas validées, terme non dépassé à la
// date de prise), par pages à curseur : aucune présentation n'est écartée en silence.
//
// ⚠️ L'INTERRUPTEUR EST PAR CONTENEUR : l'enrichissement tourne côté site ET côté worker/cron
// (`refresh`, `discover`). `APPORTEURS_VALIDATION_RDV=true` doit être posée sur LES DEUX.
//
// ⚠️ RGPD : aucune adresse, aucun téléphone, aucun nom dans quoi que ce soit d'écrit ou de
// journalisé ici. Seules les empreintes servent à comparer ; ce module ne journalise rien.
// ⚠️ Atteint par le WORKER : aucun `server-only`.

import { natureDuDomaine, domaineDe } from "@/lib/email/nature-adresse";
import { decryptPii } from "@/lib/pii-crypto";
import { prisma } from "@/lib/prisma";
import { hashEmailForLookup } from "@/lib/security/email-hash";

import {
  type Etablissement,
  lireEtablissements,
  memePerimetre,
  siretNet,
} from "./etablissement-presentation";
import { validationParRendezVousActive } from "./interrupteur-rendez-vous";
import { rendezVousRecevable } from "./regle-attribution";
import { cleRendezVous, lireReservations, tableAbsente } from "./reservation-presentation";

type Motif = "email_exact" | "meme_entreprise" | "meme_siren";

interface FicheClient {
  siren: string | null;
  siret: string | null;
}

interface RendezVous {
  cle: string;
  prisAt: Date;
  rendezVousAt: Date | null;
  /** Empreintes des adresses du rendez-vous (jamais l'adresse elle-même hors de ce module). */
  empreintes: string[];
  /** Domaines PROFESSIONNELS (non génériques) des adresses du rendez-vous. */
  domaines: string[];
  client: FicheClient | null;
  apporteurCite: boolean;
}

/** Erreur sans cause ni arguments Prisma (qui recopient les empreintes) : pour Sentry. */
export function erreurRapprochement(err: unknown): Error {
  const code = err && typeof err === "object" ? (err as { code?: unknown }).code : undefined;
  return new Error(`rapprochement : ${typeof code === "string" ? code : "erreur"}`);
}

const TAILLE_PAGE = 500;
const REPONSE_APPORTEUR = /apporteurs?\s+d['’]affaires/i;

function objet(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/**
 * L'invité tel que l'API Calendly l'a confirmé : celui que l'enrichissement vient de lire, sinon
 * celui de la charge stockée SI elle porte `_refreshedAt` (posé seulement par l'enrichissement,
 * jamais par la route publique).
 */
function inviteeConfirme(
  fourni: Record<string, unknown> | undefined,
  rawPayload: unknown,
): Record<string, unknown> | null {
  if (fourni && Object.keys(fourni).length > 0) return fourni;
  const raw = objet(rawPayload);
  if (!raw || typeof raw["_refreshedAt"] !== "string") return null;
  return objet(raw["invitee"]);
}

function adresseConfirmee(invitee: Record<string, unknown>): string | null {
  const email = invitee["email"];
  return typeof email === "string" && email.includes("@") ? email.trim() : null;
}

/** `invitee.created_at` : la date de PRISE du rendez-vous. Absente ou illisible : `null`. */
function datePrise(invitee: Record<string, unknown>): Date | null {
  const v = invitee["created_at"];
  if (typeof v !== "string") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function reponseApporteur(invitee: Record<string, unknown>): boolean {
  const qr = invitee["questions_and_answers"];
  if (!Array.isArray(qr)) return false;
  return qr.some((q) => {
    const reponse = objet(q)?.["answer"];
    return typeof reponse === "string" && REPONSE_APPORTEUR.test(reponse);
  });
}

function domainesPro(emails: readonly string[]): string[] {
  const d = new Set<string>();
  for (const e of emails) {
    const dom = domaineDe(e);
    if (dom && natureDuDomaine(dom) === "pro") d.add(dom);
  }
  return [...d];
}

const SELECT_EVENEMENT = {
  id: true,
  enrichedAt: true,
  status: true,
  startTime: true,
  rawPayload: true,
  rencontre: {
    select: { statut: true, client: { select: { siren: true, siret: true } } },
  },
  eventUri: true,
} as const;

/** Une rencontre absente ou reportée n'a pas eu lieu : rien à proposer (annulée : voir en-tête). */
function rencontreCaduque(statut: string | null | undefined): boolean {
  return statut === "absent" || statut === "reporte";
}

const PROFONDEUR_REPORTS = 10;

/**
 * Date de la PREMIÈRE réservation : un report crée un nouvel invité (`old_invitee`) dont
 * `created_at` est la date du report, pas celle de la prise. On remonte la chaîne ; une
 * ancienne réservation introuvable, non confirmée par l'API ou sans date → `null` (rien).
 */
async function datePriseOrigine(
  invitee: Record<string, unknown>,
  eventUri: string | null,
): Promise<Date | null> {
  let courant = invitee;
  let uriCourante = eventUri;
  const vus = new Set<string>();
  for (let i = 0; i < PROFONDEUR_REPORTS; i++) {
    const ancien = courant["old_invitee"];
    let ev: { rawPayload: unknown; eventUri?: string | null } | null;
    if (typeof ancien === "string" && ancien !== "") {
      // Report fait depuis le lien Calendly : le nouvel invité porte l'ancien.
      if (vus.has(ancien)) return null;
      vus.add(ancien);
      ev = await prisma.calendlyEvent.findUnique({
        where: { inviteeUri: ancien },
        select: { rawPayload: true, eventUri: true },
      });
    } else if (ancien === undefined || ancien === null || ancien === "") {
      // Report fait depuis NOTRE site : nouvelle réservation sans `old_invitee`, le lien ancien →
      // nouveau n'est écrit que dans `calendly_reports`.
      const rapport = uriCourante
        ? await prisma.calendlyReport.findUnique({
            where: { nouvelEventUri: uriCourante },
            select: { ancienEventUri: true },
          })
        : null;
      if (!rapport) return datePrise(courant);
      if (vus.has(rapport.ancienEventUri)) return null;
      vus.add(rapport.ancienEventUri);
      ev = await prisma.calendlyEvent.findFirst({
        where: { eventUri: rapport.ancienEventUri },
        select: { rawPayload: true, eventUri: true },
      });
    } else {
      return null;
    }
    if (!ev) return null;
    uriCourante = ev.eventUri ?? null;
    const precedent = inviteeConfirme(undefined, ev.rawPayload);
    if (!precedent) return null;
    courant = precedent;
  }
  return null; // chaîne trop longue : on ne devine pas
}

/** Le rendez-vous, ou `null` s'il ne peut rien proposer (non enrichi, adresse non confirmée…). */
async function lireRendezVous(e: {
  calendlyEventId?: string;
  rencontreId?: string;
  invitee?: Record<string, unknown>;
}): Promise<RendezVous | null> {
  let calendlyEventId = e.calendlyEventId;
  let rencontre: {
    statut: string | null;
    createdAt: Date;
    debutPrevu: Date | null;
    client: FicheClient | null;
    participants: Array<{ emailHash: string | null }>;
  } | null = null;
  if (e.rencontreId) {
    const r = await prisma.rencontre.findUnique({
      where: { id: e.rencontreId },
      select: {
        statut: true,
        createdAt: true,
        debutPrevu: true,
        calendlyEventId: true,
        client: { select: { siren: true, siret: true } },
        participants: { where: { role: "client" }, select: { emailHash: true } },
      },
    });
    if (!r || rencontreCaduque(r.statut)) return null;
    calendlyEventId ??= r.calendlyEventId ?? undefined;
    rencontre = r;
  }
  const cle = cleRendezVous({
    calendlyEventId: calendlyEventId ?? null,
    rencontreId: e.rencontreId ?? null,
  });
  if (!cle) return null;

  if (calendlyEventId) {
    const ev = await prisma.calendlyEvent.findUnique({
      where: { id: calendlyEventId },
      select: SELECT_EVENEMENT,
    });
    if (!ev || !ev.enrichedAt) return null;
    // Absent : n'a pas eu lieu. Annulé : proposé (en-tête). « completed » : marqué tenu, recevable.
    if (ev.status === "no_show") return null;
    // Ancienne réservation d'un report : le rendez-vous vit dans la nouvelle réservation.
    if (ev.eventUri) {
      const reporte = await prisma.calendlyReport.findUnique({
        where: { ancienEventUri: ev.eventUri },
        select: { nouvelEventUri: true },
      });
      if (reporte) return null;
    }
    const invitee = inviteeConfirme(e.invitee, ev.rawPayload);
    if (!invitee) return null; // charge non confirmée par l'API : AUCUN rapprochement
    // Ancien invité d'un report fait par le lien Calendly (`rescheduled`) : le rendez-vous vit dans
    // la nouvelle réservation (même règle que le bilan des rendez-vous).
    if (invitee["rescheduled"] === true) return null;
    if (rencontreCaduque(ev.rencontre?.statut)) return null;
    const adresse = adresseConfirmee(invitee);
    if (!adresse) return null; // adresse non confirmée : AUCUN rapprochement
    const prisAt = await datePriseOrigine(invitee, ev.eventUri ?? null);
    if (!prisAt) return null; // pas de date de prise fiable : rien (jamais `capturedAt`)
    const empreinte = hashEmailForLookup(adresse);
    return {
      cle,
      prisAt,
      rendezVousAt: ev.startTime ?? null,
      empreintes: empreinte ? [empreinte] : [],
      domaines: domainesPro([adresse]),
      client: rencontre?.client ?? ev.rencontre?.client ?? null,
      apporteurCite: reponseApporteur(invitee),
    };
  }
  if (!rencontre) return null;
  return {
    cle,
    prisAt: rencontre.createdAt,
    rendezVousAt: rencontre.debutPrevu,
    empreintes: rencontre.participants.flatMap((p) => (p.emailHash ? [p.emailHash] : [])),
    domaines: [],
    client: rencontre.client,
    apporteurCite: false,
  };
}

/** Les empreintes → ensembles de fiches client qui les portent (fiche personne, pas la société). */
async function fichesDesEmpreintes(
  empreintes: readonly string[],
): Promise<Map<string, Set<string>>> {
  const m = new Map<string, Set<string>>();
  if (empreintes.length === 0) return m;
  try {
    const ls = await prisma.clientContactAdresse.findMany({
      where: { emailHash: { in: [...empreintes] } },
      select: { emailHash: true, contact: { select: { clientId: true } } },
    });
    for (const l of ls) {
      const s = m.get(l.emailHash) ?? new Set<string>();
      s.add(l.contact.clientId);
      m.set(l.emailHash, s);
    }
  } catch (err) {
    if (!tableAbsente(err)) throw err;
  }
  return m;
}

/**
 * Propose les rapprochements d'un rendez-vous. Rend le nombre de propositions CRÉÉES (0 si rien,
 * si l'interrupteur est éteint, ou si tout existait déjà). Ne rattrape pas ses erreurs : les
 * appelants l'entourent d'un try/catch (un échec du rapprochement ne casse jamais leur travail).
 */
export async function proposerPourRendezVous(e: {
  calendlyEventId?: string;
  rencontreId?: string;
  /** L'invité que l'API vient de confirmer (enrichissement) ; sinon la charge stockée confirmée. */
  invitee?: Record<string, unknown>;
}): Promise<number> {
  if (!validationParRendezVousActive()) return 0;
  const rdv = await lireRendezVous(e);
  if (!rdv) return 0;

  const aEcrire: Array<{
    presentationId: string;
    rendezVousCle: string;
    motif: Motif;
    apporteurCite: boolean;
    prisAt: Date;
    rendezVousAt: Date | null;
    recueAt: Date;
  }> = [];

  // Réservations OUVERTES à la date de prise, par pages à curseur (aucune perte silencieuse).
  let curseur: string | null = null;
  for (;;) {
    let page: Array<{ presentationId: string }>;
    try {
      page = await prisma.presentationReservation.findMany({
        where: {
          regle: "rendez_vous",
          echueAt: null,
          valideeAt: null,
          reserveeJusquAt: { gte: rdv.prisAt },
          ...(curseur ? { presentationId: { gt: curseur } } : {}),
        },
        select: { presentationId: true },
        orderBy: { presentationId: "asc" },
        take: TAILLE_PAGE,
      });
    } catch (err) {
      if (tableAbsente(err)) return 0; // migration pas encore passée (fenêtre app/worker)
      throw err;
    }
    if (page.length === 0) break;
    curseur = page[page.length - 1]!.presentationId;
    await examinerPage(
      page.map((p) => p.presentationId),
      rdv,
      aEcrire,
    );
    if (page.length < TAILLE_PAGE) break;
  }
  if (aEcrire.length === 0) return 0;

  try {
    const r = await prisma.propositionRendezVousPresentation.createMany({
      data: aEcrire.map(({ recueAt: _recueAt, ...d }) => d),
      skipDuplicates: true,
    });
    return r.count;
  } catch (err) {
    if (tableAbsente(err)) return 0;
    throw err;
  }
}

async function examinerPage(
  ids: string[],
  rdv: RendezVous,
  aEcrire: Array<{
    presentationId: string;
    rendezVousCle: string;
    motif: Motif;
    apporteurCite: boolean;
    prisAt: Date;
    rendezVousAt: Date | null;
    recueAt: Date;
  }>,
): Promise<void> {
  const candidates = await prisma.presentationEntreprise.findMany({
    where: { id: { in: ids }, statut: "reservee", recueAt: { lte: rdv.prisAt } },
    select: {
      id: true,
      apporteurId: true,
      siren: true,
      personneEmail: true,
      personneEmailHash: true,
      recueAt: true,
    },
  });
  if (candidates.length === 0) return;
  const cids = candidates.map((c) => c.id);
  const [reservations, etabs] = await Promise.all([
    lireReservations(cids),
    lireEtablissements(cids),
  ]);
  const maintenant = new Date();

  // Les fiches client portant l'adresse du rendez-vous / celle de la personne présentée.
  const empreintesPresentees = candidates.flatMap((c) =>
    c.personneEmailHash ? [c.personneEmailHash] : [],
  );
  const fiches = await fichesDesEmpreintes([...rdv.empreintes, ...empreintesPresentees]);
  const fichesDuRdv = new Set(rdv.empreintes.flatMap((h) => [...(fiches.get(h) ?? [])]));

  for (const c of candidates) {
    const r = reservations.get(c.id);
    // Sans ligne de réservation ouverte (règle « rendez_vous »), la présentation est d'avant.
    if (!r || r.regle !== "rendez_vous" || r.echueAt || r.valideeAt) continue;
    // Règle du lot 2 : pris pendant la réservation, et pas tenu avant sa prise. SEUL « pas encore
    // tenu » n'est pas un refus ici (le dirigeant attendra) ; tout autre motif refuse.
    const recevable = rendezVousRecevable({
      recueAt: c.recueAt,
      reserveeJusquAt: r.reserveeJusquAt,
      prisAt: rdv.prisAt,
      tenuAt: rdv.rendezVousAt,
      maintenant,
    });
    if (!recevable.ok && recevable.motif !== "pas_encore_tenu") continue;

    // Une fiche client du MÊME SIREN d'un AUTRE établissement est un veto ferme.
    const etab: Etablissement = etabs.get(c.id) ?? { siret: null, entreprise: false, exclus: [] };
    const memeSiren = !!rdv.client?.siren && rdv.client.siren === c.siren;
    if (
      memeSiren &&
      !memePerimetre({ siret: siretNet(rdv.client?.siret), entreprise: false, exclus: [] }, etab)
    )
      continue;
    // Une fiche client d'un AUTRE SIREN : jamais de rapprochement par domaine (groupe, cabinet…).
    const autreSiren = !!rdv.client?.siren && rdv.client.siren !== c.siren;

    let motif: Motif | null = null;
    if (c.personneEmailHash && rdv.empreintes.includes(c.personneEmailHash)) {
      motif = "email_exact";
    } else {
      const sesFiches = c.personneEmailHash
        ? (fiches.get(c.personneEmailHash) ?? new Set())
        : new Set<string>();
      let domaine = false;
      if (rdv.domaines.length > 0 && !autreSiren) {
        try {
          const clair = decryptPii(c.personneEmail);
          domaine = !!clair && domainesPro([clair]).some((d) => rdv.domaines.includes(d));
        } catch {
          domaine = false; // illisible : pas de rapprochement par domaine, jamais d'échec
        }
      }
      if (domaine || [...sesFiches].some((id) => fichesDuRdv.has(id))) motif = "meme_entreprise";
      else if (memeSiren) motif = "meme_siren";
    }
    if (!motif) continue;
    aEcrire.push({
      presentationId: c.id,
      rendezVousCle: rdv.cle,
      motif,
      apporteurCite: rdv.apporteurCite,
      prisAt: rdv.prisAt,
      rendezVousAt: rdv.rendezVousAt,
      recueAt: c.recueAt,
    });
  }
}
