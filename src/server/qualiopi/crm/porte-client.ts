/**
 * LA PORTE UNIQUE DE CRÉATION D'UNE FICHE CLIENT (chantier visio, plan §3.17,
 * décision B18 prise sur recommandation : « un client = une fiche »).
 *
 * ## Le défaut que ce module ferme
 *
 * Avant lui, la console ne reconnaissait un client que s'il revenait avec
 * EXACTEMENT la même adresse (« Convertir ») — et « Nouveau client » comme
 * l'assistant de vente ne vérifiaient rien. La DAF de la société Martin
 * réservait avec son adresse, puis la dirigeante avec la sienne : une seconde
 * fiche « Martin » naissait sans rien dire.
 *
 * ## La règle
 *
 * `trouverFichesProches()` classe les fiches existantes qui ressemblent au
 * candidat (fonction PURE) :
 *
 *   | signal       | règle                                         | effet        |
 *   |--------------|-----------------------------------------------|--------------|
 *   | `siren`      | même SIREN (ou 9 premiers chiffres du SIRET)  | BLOQUANT     |
 *   | `email`      | même adresse (fiche ou personne, empreinte)   | fort : motif |
 *   | `domaine`    | même domaine PRO (jamais un webmail)          | proposition  |
 *   | `nom_ville`  | nom normalisé + même ville ou code postal     | proposition  |
 *
 * Un particulier n'a que les signaux `email` et `nom_ville`.
 *
 * `creerOuRetrouverClient()` crée la fiche DANS une transaction :
 *   1. verrou consultatif `pg_advisory_xact_lock(hashtext(…))` par SIREN et par
 *      adresse — deux clics simultanés attendent l'un l'autre ;
 *   2. NOUVELLE recherche, sous le verrou (celle de l'écran peut dater) ;
 *   3. même SIREN parmi les fiches non absorbées → REFUS, toujours : il n'y a
 *      pas de « créer quand même » pour deux fiches d'une même entreprise ;
 *   4. même adresse → création seulement avec un MOTIF (≥ 10 caractères),
 *      journalisé dans `ActivityLog` (`client.creation_forcee`) ;
 *   5. création, puis contact de facturation par `definirContactFacturation`.
 *
 * Pas de contrainte `UNIQUE` sur `clients.siren` : une fiche absorbée par une
 * fusion garde ses pièces ET son SIREN. La règle est « un seul SIREN parmi les
 * fiches non absorbées », tenue par ce verrou et prouvée en Gate D
 * (`scripts/ci/gate-d-visio.ts`, deux créations simultanées).
 *
 * Elle vaut aussi pour une fiche EXISTANTE à qui l'on donne un SIREN (« C'est
 * elle », SIRET saisi dans « Éditer ») : `exigerSirenLibre()` prend le MÊME
 * verrou et fait la MÊME recherche, dans la transaction de `updateClientAction`.
 *
 * ## C'est aussi la porte qu'attend Axion Partners (INT-T03)
 *
 * Partners exige que « tous les écrivains de `Client` passent par une fonction
 * d'émission unique ». Elle n'existe pas encore sur `main` (lu le 29/09) : la
 * porte EST cette fonction, et Partners s'y branchera. Jamais deux « fonctions
 * uniques ». Cliquet : `tests/unit/ci/aucun-ecrivain-de-client-hors-de-la-porte-unique.spec.ts`.
 *
 * ⚠️ Module NEUTRE (ni `server-only`, ni Next) : il reçoit son client Prisma.
 * Il est appelé par `createClientAction`, par le script de Gate D, et plus tard
 * par la création de fiche prospect depuis un rendez-vous (PR 4).
 */

import type { ClientType, CompanySize, Prisma } from "../../../../prisma/generated/client";
import { natureAdresse } from "@/lib/email/nature-adresse";
import { checkSirenFormat } from "@/lib/siret";
import { hashEmailForLookup, normalizeEmail } from "@/lib/security/email-hash";
import { nextNumero } from "@/server/qualiopi/numbering/allocate";
import { withNumberRetry } from "@/server/qualiopi/numbering/retry";
import {
  creerOuRetrouverPersonne,
  definirContactFacturation,
} from "@/server/qualiopi/crm/contact-facturation";
import { nomsProches, normaliserVille } from "@/server/qualiopi/crm/normaliser-nom";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type SignalProche = "siren" | "email" | "domaine" | "nom_ville";
export type ForceSignal = "bloquant" | "fort" | "proposition";

/** Force de chaque signal — la table du plan §3.17, point 3. */
export const FORCE_DU_SIGNAL: Readonly<Record<SignalProche, ForceSignal>> = {
  siren: "bloquant",
  email: "fort",
  domaine: "proposition",
  nom_ville: "proposition",
};

/** Ordre d'affichage : le plus fort d'abord. */
const ORDRE_DES_SIGNAUX: ReadonlyArray<SignalProche> = ["siren", "email", "domaine", "nom_ville"];

/** Libellé pour Will, en français clair. */
export const LIBELLE_DU_SIGNAL: Readonly<Record<SignalProche, string>> = {
  siren: "même numéro SIREN",
  email: "même adresse e-mail",
  domaine: "même fin d'adresse professionnelle",
  nom_ville: "même nom dans la même ville",
};

export interface FicheProche {
  readonly ficheId: string;
  readonly numero: string;
  readonly raisonSociale: string;
  readonly signal: SignalProche;
  readonly force: ForceSignal;
}

/** Une fiche proche, avec le libellé de son signal pour l'écran (`LIBELLE_DU_SIGNAL`). */
export interface FicheProcheLibellee extends FicheProche {
  readonly libelle: string;
}

/** Ajoute à chaque fiche le libellé de son signal — la SEULE table est `LIBELLE_DU_SIGNAL`. */
export function libellerFichesProches(fiches: ReadonlyArray<FicheProche>): FicheProcheLibellee[] {
  return fiches.map((f) => ({ ...f, libelle: LIBELLE_DU_SIGNAL[f.signal] }));
}

/** Le candidat, préparé pour la comparaison (empreintes, domaines pro, ville). */
export interface CandidatPrepare {
  readonly type: ClientType;
  readonly raisonSociale: string;
  /** 9 chiffres, ou `null`. */
  readonly siren: string | null;
  readonly emailHashes: ReadonlyArray<string>;
  /** Adresses normalisées (minuscules). */
  readonly emails: ReadonlyArray<string>;
  /** Domaines PROFESSIONNELS seulement : un webmail ne rapproche jamais. */
  readonly domainesPro: ReadonlyArray<string>;
  readonly ville: string | null;
  readonly codePostal: string | null;
}

/** Une fiche existante, telle que la recherche la ramène. */
export interface FicheConnue {
  readonly id: string;
  readonly numero: string;
  readonly raisonSociale: string;
  readonly siren: string | null;
  readonly adresseVille: string | null;
  readonly adresseCodePostal: string | null;
  readonly emailHashes: ReadonlyArray<string>;
  readonly domainesPro: ReadonlyArray<string>;
  /** Absorbée par une fusion vivante : elle ne compte plus comme fiche. */
  readonly absorbee: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Préparation du candidat
// ─────────────────────────────────────────────────────────────────────────────

export interface CandidatSaisi {
  readonly type?: ClientType;
  readonly raisonSociale: string;
  readonly siren?: string | null;
  readonly emails?: ReadonlyArray<string | null | undefined>;
  readonly ville?: string | null;
  readonly codePostal?: string | null;
}

function domaineDe(email: string): string {
  const i = email.lastIndexOf("@");
  return i === -1 ? "" : email.slice(i + 1);
}

/** Calcule empreintes et domaines pro. Seule étape non pure (clé d'empreinte). */
export function preparerCandidat(saisi: CandidatSaisi): CandidatPrepare {
  const emails = [
    ...new Set(
      (saisi.emails ?? [])
        .filter((e): e is string => typeof e === "string" && e.trim() !== "")
        .map((e) => normalizeEmail(e)),
    ),
  ];
  // Même contrôle que la saisie (format ET clé) : `src/lib/siret.ts`, source unique.
  const controle = saisi.siren ? checkSirenFormat(saisi.siren) : null;
  const siren = controle?.ok === true ? controle.value : null;
  return {
    type: saisi.type ?? "entreprise",
    raisonSociale: saisi.raisonSociale,
    siren,
    emails,
    emailHashes: emails.map((e) => hashEmailForLookup(e)).filter((h): h is string => h !== null),
    domainesPro: [
      ...new Set(emails.filter((e) => natureAdresse(e) === "pro").map((e) => domaineDe(e))),
    ].filter((d) => d !== ""),
    ville: saisi.ville?.trim() ? saisi.ville.trim() : null,
    codePostal: saisi.codePostal?.trim() ? saisi.codePostal.trim() : null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// La comparaison (PURE)
// ─────────────────────────────────────────────────────────────────────────────

function signalEntre(c: CandidatPrepare, f: FicheConnue): SignalProche | null {
  const particulier = c.type === "particulier";
  // 1. SIREN — jamais pour un particulier (il n'en a pas).
  if (!particulier && c.siren !== null && f.siren === c.siren) return "siren";
  // 2. Même adresse (empreinte : casse et espaces sans effet).
  if (c.emailHashes.some((h) => f.emailHashes.includes(h))) return "email";
  // 3. Même domaine PRO. `domainesPro` ne contient jamais un webmail : une
  //    adresse gmail ne rapproche JAMAIS deux fiches par son domaine.
  if (!particulier && c.domainesPro.some((d) => f.domainesPro.includes(d))) return "domaine";
  // 4. Nom normalisé + même ville ou même code postal.
  const memeVille =
    c.ville !== null &&
    f.adresseVille !== null &&
    normaliserVille(c.ville) !== "" &&
    normaliserVille(c.ville) === normaliserVille(f.adresseVille);
  const memeCp = c.codePostal !== null && f.adresseCodePostal === c.codePostal;
  if ((memeVille || memeCp) && nomsProches(c.raisonSociale, f.raisonSociale)) return "nom_ville";
  return null;
}

/**
 * Les fiches qui ressemblent au candidat, classées du signal le plus fort au
 * plus faible. Une fiche n'apparaît qu'une fois, avec son signal le plus fort.
 * Les fiches absorbées par une fusion vivante sont ignorées.
 */
export function trouverFichesProches(
  candidat: CandidatPrepare,
  fiches: ReadonlyArray<FicheConnue>,
): FicheProche[] {
  const proches: FicheProche[] = [];
  for (const f of fiches) {
    if (f.absorbee) continue;
    const signal = signalEntre(candidat, f);
    if (signal === null) continue;
    proches.push({
      ficheId: f.id,
      numero: f.numero,
      raisonSociale: f.raisonSociale,
      signal,
      force: FORCE_DU_SIGNAL[signal],
    });
  }
  return proches.sort(
    (a, b) =>
      ORDRE_DES_SIGNAUX.indexOf(a.signal) - ORDRE_DES_SIGNAUX.indexOf(b.signal) ||
      a.numero.localeCompare(b.numero),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// La recherche en base (filtrée : aucun balayage de toute la table)
// ─────────────────────────────────────────────────────────────────────────────

type LecteurFiches = Pick<Prisma.TransactionClient, "client">;

/** Plafond de lignes examinées : la recherche est filtrée, ce n'est qu'un filet. */
const PLAFOND_FICHES_EXAMINEES = 200;

export async function chargerFichesCandidates(
  db: LecteurFiches,
  c: CandidatPrepare,
): Promise<FicheConnue[]> {
  const ou: Prisma.ClientWhereInput[] = [];
  if (c.siren !== null) ou.push({ siren: c.siren });
  if (c.emails.length > 0) ou.push({ contactEmail: { in: [...c.emails] } });
  if (c.emailHashes.length > 0) {
    ou.push({
      contacts: { some: { adresses: { some: { emailHash: { in: [...c.emailHashes] } } } } },
    });
  }
  for (const d of c.domainesPro) {
    ou.push({ contactEmail: { endsWith: `@${d}`, mode: "insensitive" } });
    ou.push({
      contacts: {
        some: { adresses: { some: { email: { endsWith: `@${d}`, mode: "insensitive" } } } },
      },
    });
  }
  if (c.ville !== null) ou.push({ adresseVille: { equals: c.ville, mode: "insensitive" } });
  if (c.codePostal !== null) ou.push({ adresseCodePostal: c.codePostal });
  if (ou.length === 0) return [];

  const lignes = await db.client.findMany({
    where: { OR: ou },
    select: {
      id: true,
      numero: true,
      raisonSociale: true,
      siren: true,
      adresseVille: true,
      adresseCodePostal: true,
      contactEmail: true,
      contacts: { select: { adresses: { select: { email: true, emailHash: true } } } },
      fusionsAbsorbee: { where: { defaiteLe: null }, select: { id: true } },
    },
    orderBy: { numero: "asc" },
    take: PLAFOND_FICHES_EXAMINEES,
  });

  return lignes.map((l) => {
    const adresses = [
      ...(l.contactEmail ? [normalizeEmail(l.contactEmail)] : []),
      ...l.contacts.flatMap((p) => p.adresses.map((a) => normalizeEmail(a.email))),
    ];
    const hashes = new Set<string>(l.contacts.flatMap((p) => p.adresses.map((a) => a.emailHash)));
    for (const a of adresses) {
      const h = hashEmailForLookup(a);
      if (h !== null) hashes.add(h);
    }
    return {
      id: l.id,
      numero: l.numero,
      raisonSociale: l.raisonSociale,
      siren: l.siren,
      adresseVille: l.adresseVille,
      adresseCodePostal: l.adresseCodePostal,
      emailHashes: [...hashes],
      domainesPro: [
        ...new Set(adresses.filter((a) => natureAdresse(a) === "pro").map((a) => domaineDe(a))),
      ],
      absorbee: l.fusionsAbsorbee.length > 0,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// La création
// ─────────────────────────────────────────────────────────────────────────────

/** Le refus « même SIREN », nommé pour Will — le même à la création et à la modification. */
function messageSirenDejaPris(f: FicheProche): string {
  return (
    `Cette entreprise a déjà la fiche ${f.numero} (${f.raisonSociale}), ` +
    `avec le même numéro SIREN. Ouvrez-la, ou ajoutez-y cette personne : une ` +
    `entreprise n'a qu'une fiche.`
  );
}

/** Longueur minimale du motif de « créer quand même ». */
export const LONGUEUR_MIN_MOTIF_CREATION_FORCEE = 10;

/** Action journalisée dans `ActivityLog` quand Will crée malgré une adresse connue. */
export const ACTION_CREATION_FORCEE = "client.creation_forcee";

/** Les colonnes de la fiche que la porte écrit (jamais `contact*` : voir contact-facturation). */
export interface DonneesFiche {
  readonly type?: ClientType;
  readonly raisonSociale: string;
  readonly siret?: string;
  readonly siren?: string;
  readonly nafCode?: string;
  readonly conventionCollective?: string;
  readonly idcc?: string;
  readonly secteur?: string;
  readonly taille?: CompanySize;
  readonly adresse?: string;
  readonly adresseVille?: string;
  readonly adresseCodePostal?: string;
  readonly opcoIdentifie?: string;
  readonly opcoNumeroAdherent?: string;
  readonly opcoEnveloppeAnnuelleCents?: number;
  readonly source?: string;
  readonly contexteIa?: string;
  readonly notes?: string;
}

export interface PersonneSaisie {
  readonly nom?: string;
  readonly email?: string;
  readonly telephone?: string;
  readonly fonction?: string;
}

export interface OptionsCreation {
  readonly parAdminId: string | null;
  /** Motif de « créer quand même » (signal `email`). */
  readonly motifCreationForcee?: string | null;
}

export type ResultatCreation =
  | {
      readonly statut: "cree";
      readonly id: string;
      readonly numero: string;
      /** Les propositions (domaine, nom + ville) qui n'ont pas bloqué. */
      readonly proches: ReadonlyArray<FicheProche>;
      readonly creationForcee: boolean;
    }
  | {
      readonly statut: "refuse_siren";
      readonly fiche: FicheProche;
      readonly message: string;
    }
  | {
      readonly statut: "motif_requis";
      readonly proches: ReadonlyArray<FicheProche>;
      readonly message: string;
    };

type BasePorte = Pick<Prisma.TransactionClient, "client"> & {
  $transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T>;
};

/** Clé du verrou consultatif d'un SIREN — la même pour la création et la modification. */
function cleDeVerrouSiren(siren: string): string {
  return `client-siren:${siren}`;
}

/** Clés des verrous consultatifs, TRIÉES : deux transactions les prennent dans le même ordre. */
export function clesDeVerrou(c: CandidatPrepare): string[] {
  return [
    ...(c.siren !== null ? [cleDeVerrouSiren(c.siren)] : []),
    ...c.emailHashes.map((h) => `client-email:${h}`),
  ].sort();
}

/**
 * Crée une fiche client, ou refuse de créer un doublon. Voir l'en-tête.
 *
 * Le numéro `AXI-CLI-NNN` est alloué DANS la transaction ; une collision
 * d'unicité rejoue toute la transaction (`withNumberRetry`).
 */
export async function creerOuRetrouverClient(
  db: BasePorte,
  donnees: DonneesFiche,
  personne: PersonneSaisie | null,
  options: OptionsCreation,
): Promise<ResultatCreation> {
  const candidat = preparerCandidat({
    ...(donnees.type !== undefined ? { type: donnees.type } : {}),
    raisonSociale: donnees.raisonSociale,
    siren: donnees.siren ?? null,
    emails: personne?.email ? [personne.email] : [],
    ville: donnees.adresseVille ?? null,
    codePostal: donnees.adresseCodePostal ?? null,
  });

  return withNumberRetry(() =>
    db.$transaction(async (tx): Promise<ResultatCreation> => {
      // 1. Verrous : un second clic attend la fin du premier.
      for (const cle of clesDeVerrou(candidat)) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${cle}))`;
      }

      // 2. Nouvelle recherche, SOUS le verrou.
      const proches = trouverFichesProches(candidat, await chargerFichesCandidates(tx, candidat));

      // 3. Même SIREN : refus, sans exception.
      const bloquante = proches.find((p) => p.force === "bloquant");
      if (bloquante !== undefined) {
        return {
          statut: "refuse_siren",
          fiche: bloquante,
          message: messageSirenDejaPris(bloquante),
        };
      }

      // 4. Même adresse : motif obligatoire.
      const fortes = proches.filter((p) => p.force === "fort");
      const motif = (options.motifCreationForcee ?? "").trim();
      const creationForcee = fortes.length > 0;
      if (creationForcee && motif.length < LONGUEUR_MIN_MOTIF_CREATION_FORCEE) {
        return {
          statut: "motif_requis",
          proches,
          message:
            `Cette adresse e-mail est déjà connue sur la fiche ${fortes
              .map((p) => `${p.numero} (${p.raisonSociale})`)
              .join(", ")}. Ajoutez plutôt la personne à cette fiche. Pour créer ` +
            `quand même une nouvelle fiche, écrivez pourquoi (${LONGUEUR_MIN_MOTIF_CREATION_FORCEE} caractères au moins).`,
        };
      }

      // 5. Création.
      const numero = await nextNumero("client", null, (prefixe) =>
        tx.client.findMany({
          where: { numero: { startsWith: prefixe } },
          select: { numero: true },
        }),
      );
      const cree = await tx.client.create({
        data: { ...donnees, numero, statut: "prospect" },
        select: { id: true, numero: true },
      });

      if (personne !== null && (personne.nom || personne.email)) {
        await definirContactFacturation(tx, {
          clientId: cree.id,
          ...(personne.nom ? { nom: personne.nom } : {}),
          ...(personne.email ? { email: personne.email } : {}),
          ...(personne.telephone ? { telephone: personne.telephone } : {}),
          ...(personne.fonction ? { fonction: personne.fonction } : {}),
          origine: "saisie",
          parAdminId: options.parAdminId,
        });
      }

      if (creationForcee) {
        // Même transaction : pas de fiche forcée sans sa trace.
        await tx.activityLog.create({
          data: {
            adminUserId: options.parAdminId,
            action: ACTION_CREATION_FORCEE,
            targetType: "Client",
            targetId: cree.id,
            changes: {
              motif,
              fichesProches: fortes.map((p) => ({ numero: p.numero, signal: p.signal })),
            },
          },
        });
      }

      return {
        statut: "cree",
        id: cree.id,
        numero: cree.numero,
        proches: proches.filter((p) => p.force === "proposition"),
        creationForcee,
      };
    }),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Donner un SIREN à une fiche EXISTANTE
// ─────────────────────────────────────────────────────────────────────────────

/** Refus « ce SIREN est déjà celui d'une autre fiche » : son message nomme la fiche. */
export class ErreurSirenDejaPris extends Error {
  constructor(readonly fiche: FicheProche) {
    super(messageSirenDejaPris(fiche));
    this.name = "ErreurSirenDejaPris";
  }
}

type TransactionPorte = Pick<Prisma.TransactionClient, "client" | "$executeRaw">;

/**
 * À appeler DANS la transaction qui écrit `siren` sur une fiche existante,
 * AVANT l'écriture. Prend le verrou du SIREN (le même que la création), puis
 * cherche une AUTRE fiche non absorbée qui le porte : si elle existe, lève
 * `ErreurSirenDejaPris` (la transaction est annulée).
 *
 * Une fiche qui porte DÉJÀ ce SIREN n'est pas réexaminée : ré-enregistrer une
 * fiche sans toucher à son SIREN ne doit jamais échouer.
 */
export async function exigerSirenLibre(
  tx: TransactionPorte,
  clientId: string,
  siren: string,
): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${cleDeVerrouSiren(siren)}))`;
  const actuelle = await tx.client.findUnique({ where: { id: clientId }, select: { siren: true } });
  if (actuelle?.siren === siren) return;
  const candidat = preparerCandidat({ raisonSociale: "", siren });
  if (candidat.siren === null) return;
  const autre = trouverFichesProches(candidat, await chargerFichesCandidates(tx, candidat)).find(
    (p) => p.signal === "siren" && p.ficheId !== clientId,
  );
  if (autre !== undefined) throw new ErreurSirenDejaPris(autre);
}

// ─────────────────────────────────────────────────────────────────────────────
// « Ajouter cette personne à la fiche X »
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ajoute une personne à une fiche EXISTANTE — l'alternative à une seconde
 * fiche. Si la personne y est déjà (même adresse), rien n'est créé.
 */
export async function ajouterPersonneAFiche(
  db: BasePorte,
  clientId: string,
  personne: PersonneSaisie,
  parAdminId: string | null,
): Promise<{ contactId: string; cree: boolean }> {
  const nom = personne.nom?.trim() ?? "";
  const email = personne.email?.trim() ? normalizeEmail(personne.email) : null;
  if (nom === "" && email === null) {
    throw new Error("ajouter une personne : un nom ou une adresse est nécessaire");
  }
  return db.$transaction(async (tx) => {
    // Le chemin unique de création d'une personne (le même que le contact de
    // facturation) : retrouvée par son adresse, sinon créée avec elle.
    const r = await creerOuRetrouverPersonne(tx, {
      clientId,
      nom: nom !== "" ? nom : null,
      email,
      telephone: personne.telephone?.trim() || null,
      fonction: personne.fonction?.trim() || null,
      origine: "saisie",
      estContactFacturation: false,
      creeParId: parAdminId,
    });
    return { contactId: r.personne.id, cree: r.cree };
  });
}
