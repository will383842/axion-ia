/**
 * coordonnees.ts — `GET /api/partners/candidatures/{candidatureId}/coordonnees` (INT-T27-A,
 * REQ-INT-032, REQ-INT-029, partners/ADR-0023).
 *
 * La charge `candidature.recue` ne porte AUCUNE coordonnée du candidat : Partners les TIRE ici,
 * au moment du traitement, et seulement pour une candidature effectivement émise vers lui. La
 * route n'est pas un annuaire : c'est la seule porte par laquelle une adresse de candidat quitte
 * axionia vers Partners, et chaque verrou ci-dessous répond à une façon de la détourner.
 *
 *   1. INERTIE. Canal fermé, build ou secret absent : la réponse d'un identifiant inexistant,
 *      avant toute lecture.
 *   2. AUTHENTIFICATION, avant toute lecture : la même que la relecture (`verifierRequetePartners`,
 *      secret dédié, `<horodatage>.<chemin exact>`, 300 s, temps constant), PLUS une liste
 *      d'autorisation d'adresses réseau (`PARTNERS_IP_AUTORISEES`, adresses ou plages CIDR
 *      séparées par des virgules). Liste absente ou vide : tout est refusé — échec fermé.
 *   3. DÉBIT : au plus `PLAFOND_LECTURES_COORDONNEES` lectures RÉUSSIES par candidature sur 24 h
 *      glissantes, compteur à conduite `refuser` sur panne. Au-delà, la réponse d'un identifiant
 *      inexistant ; l'écart est journalisé et alerté.
 *   4. PORTÉE : une ligne `candidature.recue` doit exister dans `partners_sync_outbox` pour ce
 *      sujet. Sinon — inexistante, non émise, plafond atteint, compteur en panne, déchiffrement
 *      impossible — la MÊME réponse, statut, corps et en-têtes : aucun oracle.
 *   5. RÉPONSE FERMÉE : `{nom, prenom, email, telephone}`, déchiffrés à l'instant, nuls si absents,
 *      signée comme un envoi (secret d'émission), jamais mise en cache.
 *   6. JOURNAL SANS CLAIR : l'identifiant, l'empreinte de l'adresse et le résultat.
 *
 * Le NOM : le formulaire de candidature enregistre « prénom nom » dans un seul champ chiffré
 * (`Submission.contactName`). La séparation n'est pas récupérable sans deviner — un prénom
 * composé la fausse. Le nom complet est donc rendu tel que saisi dans `nom`, et `prenom` est nul,
 * ce que le contrat admet pour un champ absent. Séparer à la source est une dette nommée.
 */
import { hashIp } from "@/lib/security/ip-hash";

import { dansLaPlage, ipVisiteurOuNull } from "@/lib/client-ip-core";
import type { RateLimitConfig } from "@/lib/rate-limit";
import { horodatageSignature, signerCorps } from "@/server/partners/enveloppe";

import { canalPartnersOuvert, secretPartners, secretRelecture } from "./config";
import { verifierRequetePartners } from "./relecture";

/** 5 lectures réussies par candidature sur 24 h glissantes, refus si le compteur est en panne. */
export const PLAFOND_LECTURES_COORDONNEES: RateLimitConfig = {
  limit: 5,
  windowSec: 24 * 3600,
  surPanne: "refuser",
};

const cleDuPlafond = (candidatureId: string) => `partners:coordonnees:${candidatureId}`;

/**
 * Un identifiant de candidature est l'UUID d'une `Submission` (`@db.Uuid`). Toute autre forme
 * n'est même pas cherchée : passée à Prisma, elle lèverait (500) au lieu de rendre l'introuvable.
 */
const IDENTIFIANT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ResultatCoordonnees =
  | "rendue"
  | "non_emise"
  | "plafond_atteint"
  | "limiteur_en_panne"
  | "dechiffrement_impossible"
  | "identifiant_illisible"
  | "refusee";

export type LigneJournalCoordonnees = {
  readonly evenement: "partners.coordonnees";
  readonly candidatureId: string;
  /** SHA-256 tronqué de l'adresse réseau, jamais l'adresse. */
  readonly adresseEmpreinte: string;
  readonly resultat: ResultatCoordonnees;
};

type Chiffree = string | null;

export interface LecteurCoordonnees {
  partnersSyncOutbox: {
    findFirst(args: {
      where: { eventType: "candidature.recue"; subjectRef: string };
      select: { id: true };
    }): PromiseLike<{ id: string } | null>;
  };
  submission: {
    findUnique(args: {
      where: { id: string };
      select: { contactName: true; contactEmail: true; contactPhone: true };
    }): PromiseLike<{
      contactName: Chiffree;
      contactEmail: Chiffree;
      contactPhone: Chiffree;
    } | null>;
  };
}

export type DependancesCoordonnees = {
  prisma?: LecteurCoordonnees;
  maintenantMs?: number;
  dechiffrer?: (valeur: Chiffree) => Chiffree;
  limiteur?: {
    consulter(cle: string): Promise<{ allowed: boolean; panne: boolean }>;
    enregistrer(cle: string): Promise<void>;
  };
  journaliser?: (ligne: LigneJournalCoordonnees) => void;
  alerter?: (candidatureId: string) => Promise<void>;
};

/** La réponse de tout ce qui n'est pas une candidature émise : UNE seule, pour aucun oracle. */
function introuvable(): Response {
  return new Response("not_found", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function refusee(): Response {
  return new Response("signature_refusee", {
    status: 401,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/** Les adresses et plages autorisées, lues à chaque appel ; vide = rien n'est autorisé. */
function adressesAutorisees(): string[] {
  return (process.env.PARTNERS_IP_AUTORISEES ?? "")
    .split(",")
    .map((a) => a.trim())
    .filter((a) => a.length > 0);
}

function adresseAutorisee(ip: string | null): boolean {
  if (ip === null) return false;
  return adressesAutorisees().some((a) => (a.includes("/") ? dansLaPlage(ip, a) : a === ip));
}

/** L'empreinte SALÉE de `hashIp` (IP_HASH_SALT) : une IPv4 non salée se retrouve par force brute. */
const empreinteAdresse = (ip: string | null) => hashIp(ip) ?? "inconnue";

/** Une coordonnée déchiffrée, ou nulle ; `undefined` si le déchiffrement a échoué. */
function enClair(
  valeur: Chiffree,
  dechiffrer: (v: Chiffree) => Chiffree,
): string | null | undefined {
  if (valeur === null || valeur === "") return null;
  const clair = dechiffrer(valeur);
  if (clair === null || clair.trim() === "") return null;
  // Le placeholder de `decryptPii` (clé absente) ou un cryptogramme resté tel quel ne sont pas
  // des coordonnées : on ne les rend jamais.
  if (clair.startsWith("[encrypted") || clair.startsWith("enc:v")) return undefined;
  return clair;
}

async function resoudre(d: DependancesCoordonnees) {
  return {
    prisma: d.prisma ?? ((await import("@/lib/prisma")).prisma as unknown as LecteurCoordonnees),
    maintenantMs: d.maintenantMs ?? Date.now(),
    dechiffrer: d.dechiffrer ?? (await import("@/lib/pii-crypto")).decryptPii,
    limiteur: d.limiteur ?? (await limiteurParDefaut()),
    journaliser:
      d.journaliser ??
      ((l: LigneJournalCoordonnees) => console.warn(`[partners-sync] ${JSON.stringify(l)}`)),
    alerter: d.alerter ?? alerterParDefaut,
  };
}

async function limiteurParDefaut(): Promise<NonNullable<DependancesCoordonnees["limiteur"]>> {
  const { consulterRateLimit, enregistrerTentative } = await import("@/lib/rate-limit");
  return {
    consulter: (cle) => consulterRateLimit(cle, PLAFOND_LECTURES_COORDONNEES),
    enregistrer: (cle) => enregistrerTentative(cle, PLAFOND_LECTURES_COORDONNEES),
  };
}

async function alerterParDefaut(candidatureId: string): Promise<void> {
  try {
    const { notify } = await import("@/server/notifications");
    await notify({
      category: "MONITORING_ALERT",
      severity: "critical",
      payload: {
        kind: "partners_coordonnees_plafond",
        details: {
          legacyBody:
            "Les coordonnées d'une candidature ont été demandées au-delà du plafond de lectures " +
            `(${PLAFOND_LECTURES_COORDONNEES.limit} sur 24 h).\n\nCandidature : ${candidatureId}\n\n` +
            "Aucune coordonnée n'a été rendue. Vérifier le client de Partners avant tout.",
        },
      },
      dedupKey: `partners-coordonnees-plafond:${candidatureId}`,
      dedupTtlSec: 24 * 3600,
    });
  } catch (e) {
    console.warn(
      `[partners-sync] alerte de plafond impossible : ${e instanceof Error ? e.name : typeof e}`,
    );
  }
}

export async function repondreCoordonnees(
  requete: Request,
  candidatureId: string,
  dependances: DependancesCoordonnees = {},
): Promise<Response> {
  // 1. Inertie — la route n'existe pas.
  if (!canalPartnersOuvert()) return introuvable();
  const secretLecture = secretRelecture();
  const secretEmission = secretPartners();
  if (secretLecture === null || secretEmission === null) return introuvable();

  const d = await resoudre(dependances);
  const ip = ipVisiteurOuNull(requete.headers);
  const journal = (resultat: ResultatCoordonnees) =>
    d.journaliser({
      evenement: "partners.coordonnees",
      candidatureId: IDENTIFIANT.test(candidatureId) ? candidatureId : "(illisible)",
      adresseEmpreinte: empreinteAdresse(ip),
      resultat,
    });

  // 2. Authentification — rien n'est lu avant.
  const url = new URL(requete.url);
  const cible = `${url.pathname}${url.search}`;
  if (
    !adresseAutorisee(ip) ||
    !verifierRequetePartners(requete, cible, secretLecture, d.maintenantMs)
  ) {
    journal("refusee");
    return refusee();
  }
  if (!IDENTIFIANT.test(candidatureId)) {
    journal("identifiant_illisible");
    return introuvable();
  }

  // 3. Débit — avant la lecture des coordonnées.
  const cle = cleDuPlafond(candidatureId);
  const plafond = await d.limiteur.consulter(cle);
  if (plafond.panne) {
    journal("limiteur_en_panne");
    return introuvable();
  }
  if (!plafond.allowed) {
    journal("plafond_atteint");
    await d.alerter(candidatureId);
    return introuvable();
  }

  // 4. Portée — une candidature émise vers Partners, et seulement elle.
  const emise = await d.prisma.partnersSyncOutbox.findFirst({
    where: { eventType: "candidature.recue", subjectRef: `submission:${candidatureId}` },
    select: { id: true },
  });
  if (emise === null) {
    journal("non_emise");
    return introuvable();
  }
  const submission = await d.prisma.submission.findUnique({
    where: { id: candidatureId },
    select: { contactName: true, contactEmail: true, contactPhone: true },
  });
  if (submission === null) {
    journal("non_emise");
    return introuvable();
  }

  // 5. Réponse fermée, déchiffrée à l'instant.
  const nom = enClair(submission.contactName, d.dechiffrer);
  const email = enClair(submission.contactEmail, d.dechiffrer);
  const telephone = enClair(submission.contactPhone, d.dechiffrer);
  if (nom === undefined || email === undefined || telephone === undefined) {
    journal("dechiffrement_impossible");
    return introuvable();
  }
  await d.limiteur.enregistrer(cle);
  journal("rendue");

  const corps = JSON.stringify({ nom, prenom: null, email, telephone });
  const horodatage = horodatageSignature(new Date(d.maintenantMs));
  return new Response(corps, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Axionia-Timestamp": horodatage,
      "X-Axionia-Signature": signerCorps(secretEmission, horodatage, corps),
    },
  });
}
