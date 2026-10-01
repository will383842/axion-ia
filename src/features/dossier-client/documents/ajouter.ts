/**
 * Ajouter un document à un projet du dossier client (ADR 0063) — un LIEN ou
 * un FICHIER, jamais les deux.
 *
 * Ordre, pour un fichier (plan §5) : taille annoncée (avant de lire, par
 * l'action) → taille lue → format depuis l'extension → signature des premiers
 * octets → le projet est-il de CE client → antivirus → une transaction :
 * document + contenu + `ProjetEvenement(document_ajoute)`.
 *
 * Antivirus : un fichier n'est enregistré QUE sur un verdict « sain ».
 * « Infecté » et « indisponible » refusent, rien n'est écrit (consigne du chef
 * de projet du 01/10 et recommandation UX §6.2 ; `clamav.ts` : « indisponible
 * n'est pas un verdict »). La base admet `non_analyse` : la route de
 * téléchargement sait encore le traiter (réanalyse), mais ce module n'en écrit
 * plus.
 *
 * Le journal ne porte que des identifiants : jamais le titre ni le nom du
 * fichier (ils peuvent nommer une personne).
 *
 * ⚠️ Module NEUTRE : il reçoit son client Prisma (comme `creer-projet.ts`).
 */

import { createHash } from "node:crypto";

import type {
  CoteDocumentProjet,
  NatureDocumentProjet,
  Prisma,
} from "../../../../prisma/generated/client";
import type { VerdictAntivirus } from "@/server/careers/clamav";
import {
  FORMATS,
  TAILLE_MAX_FICHIER_OCTETS,
  extensionDe,
  formatDepuisNom,
  signatureConforme,
} from "./formats";
import { titreDepuisLien, validerLienHttps } from "./lien";

/** Une erreur dont le message est écrit pour Will (il peut aller dans `?erreur=`). */
export class ErreurDocument extends Error {
  constructor(
    message: string,
    /** Signature trouvée par l'antivirus (journal technique seulement). */
    readonly signature?: string,
  ) {
    super(message);
    this.name = "ErreurDocument";
  }
}

const FORMATS_ACCEPTES =
  "Formats acceptés : PDF, Word, Excel, PowerPoint, image (PNG, JPG), e-mail (.eml), page web " +
  "(.html), texte (.txt, .md, .csv). Choisissez à nouveau un fichier.";

/** Les textes exacts de 2-ux.md §6.2. */
export const MESSAGES_DOCUMENT = {
  niLienNiFichier: "Collez un lien ou choisissez un fichier.",
  lienEtFichier:
    "Choisissez un lien ou un fichier, pas les deux. Pour garder les deux, ajoutez-les l'un après l'autre.",
  pasHttps:
    "Ce lien ne commence pas par https://. Ouvrez la page dans votre navigateur, copiez " +
    "l'adresse dans la barre du haut, puis collez-la ici.",
  lienIllisible:
    "Cette adresse n'est pas reconnue. Copiez-la depuis la barre d'adresse de votre " +
    "navigateur, puis collez-la ici.",
  fichierVide: "Ce fichier est vide. Vérifiez que c'est le bon, puis choisissez-le à nouveau.",
  titreTropLong: "Le titre est trop long : 200 caractères au plus.",
  infecte:
    "L'antivirus a trouvé un risque dans ce fichier : il n'a pas été enregistré. " +
    "Ne l'ouvrez pas et ne l'envoyez à personne.",
  antivirusIndisponible:
    "La vérification antivirus ne répond pas pour l'instant : le fichier n'a pas été " +
    "enregistré. Réessayez dans quelques minutes.",
  echecImprevu:
    "Le document n'a pas pu être ajouté. Rien n'a été enregistré : réessayez. Si cela " +
    "recommence, notez l'heure, elle permettra d'en trouver la cause.",
  projetEtranger: "Ce projet n'appartient pas à ce client.",
  dateIllisible: "La date d'envoi n'est pas reconnue. Choisissez-la dans le calendrier.",
} as const;

function messageFormatRefuse(nom: string): string {
  const ext = extensionDe(nom);
  return ext === null
    ? `Ce fichier n'a pas de type reconnu. ${FORMATS_ACCEPTES}`
    : `Les fichiers « ${ext} » ne sont pas acceptés. ${FORMATS_ACCEPTES}`;
}

/** Taille annoncée par le navigateur, vérifiée AVANT de lire le fichier. */
export function verifierTailleAnnoncee(taille: number): void {
  if (taille <= 0) throw new ErreurDocument(MESSAGES_DOCUMENT.fichierVide);
  if (taille > TAILLE_MAX_FICHIER_OCTETS) {
    const mo = Math.ceil(taille / (1024 * 1024));
    throw new ErreurDocument(
      `Ce fichier pèse ${mo} Mo : la limite est de 15 Mo. Enregistrez-le en PDF plus léger, ` +
        "ou déposez-le en ligne et collez son lien.",
    );
  }
}

export interface EntreeDocument {
  readonly clientId: string;
  readonly projetId: string;
  readonly cote: CoteDocumentProjet;
  /** `null` : « Je laisse deviner ». */
  readonly nature: NatureDocumentProjet | null;
  /** Vide : repris du nom du fichier ou du site. */
  readonly titre: string;
  /** `AAAA-MM-JJ` ; vide ou `null` : aujourd'hui (heure de Paris). Ignorée pour « interne ». */
  readonly envoyeLe: string | null;
  readonly parAdminId: string | null;
  /** Pour tester : l'instant de l'ajout. */
  readonly maintenant?: Date;
}

type Db = {
  projet: {
    findFirst(args: {
      where: { id: string; clientId: string };
      select: { id: true };
    }): Promise<{ id: string } | null>;
  };
  $transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T>;
};

/** La date du jour à Paris, `AAAA-MM-JJ`. */
export function aujourdhuiAParis(maintenant: Date = new Date()): string {
  return new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(maintenant);
}

function dateDEnvoi(e: EntreeDocument): Date | null {
  if (e.cote !== "envoye_au_client") return null;
  const texte = (e.envoyeLe ?? "").trim() || aujourdhuiAParis(e.maintenant);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texte)) throw new ErreurDocument(MESSAGES_DOCUMENT.dateIllisible);
  const d = new Date(`${texte}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== texte)
    throw new ErreurDocument(MESSAGES_DOCUMENT.dateIllisible);
  return d;
}

function titreDemande(e: EntreeDocument): string | null {
  const titre = e.titre.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  if (titre.length > 200) throw new ErreurDocument(MESSAGES_DOCUMENT.titreTropLong);
  return titre === "" ? null : titre;
}

async function projetDuClient(db: Db, e: EntreeDocument): Promise<void> {
  const projet = await db.projet.findFirst({
    where: { id: e.projetId, clientId: e.clientId },
    select: { id: true },
  });
  if (projet === null) throw new ErreurDocument(MESSAGES_DOCUMENT.projetEtranger);
}

/** Une erreur de la base, dite en français ; jamais le texte brut de Postgres. */
function traduireErreurBase(err: unknown): never {
  const code = (err as { code?: unknown } | null)?.code;
  const texte = err instanceof Error ? err.message : String(err);
  if (code === "P2003" || /23503|documents_projet_projet_meme_client/.test(texte)) {
    throw new ErreurDocument(MESSAGES_DOCUMENT.projetEtranger);
  }
  if (/documents_projet_lien_https/.test(texte))
    throw new ErreurDocument(MESSAGES_DOCUMENT.lienIllisible);
  if (/documents_projet_titre_non_vide/.test(texte))
    throw new ErreurDocument("Donnez un titre au document.");
  if (/documents_projet_date_envoi/.test(texte))
    throw new ErreurDocument(MESSAGES_DOCUMENT.dateIllisible);
  if (/AXD0\d/.test(texte)) {
    throw new ErreurDocument(
      "Opération refusée par la base : le document n'a pas été enregistré. Réessayez.",
    );
  }
  throw err;
}

async function ecrire(
  db: Db,
  e: EntreeDocument,
  donnees: Omit<Prisma.DocumentProjetUncheckedCreateInput, "clientId" | "projetId" | "ajouteParId">,
): Promise<{ id: string }> {
  try {
    return await db.$transaction(async (tx) => {
      const doc = await tx.documentProjet.create({
        data: {
          ...donnees,
          clientId: e.clientId,
          projetId: e.projetId,
          ajouteParId: e.parAdminId,
        },
        select: { id: true },
      });
      await tx.projetEvenement.create({
        data: {
          projetId: e.projetId,
          action: "document_ajoute",
          documentId: doc.id,
          parAdminId: e.parAdminId,
        },
      });
      return { id: doc.id };
    });
  } catch (err) {
    return traduireErreurBase(err);
  }
}

/** Ajoute un LIEN https. */
export async function ajouterLien(db: Db, e: EntreeDocument & { readonly lien: string }) {
  const v = validerLienHttps(e.lien);
  if (!v.ok) {
    throw new ErreurDocument(
      v.raison === "vide"
        ? MESSAGES_DOCUMENT.niLienNiFichier
        : v.raison === "pas_https"
          ? MESSAGES_DOCUMENT.pasHttps
          : MESSAGES_DOCUMENT.lienIllisible,
    );
  }
  const titre = titreDemande(e) ?? titreDepuisLien(v.url);
  const envoyeLe = dateDEnvoi(e);
  await projetDuClient(db, e);
  return ecrire(db, e, {
    cote: e.cote,
    nature: e.nature ?? "page_en_ligne",
    titre,
    envoyeLe,
    lienUrl: v.url,
  });
}

/** Le nom de fichier tel que la base l'admet : sans séparateur ni contrôle, 255 caractères au plus. */
function nomDeFichierPropre(nom: string): string {
  const propre = nom.replace(/[/\\\u0000-\u001f\u007f]/g, "_").trim() || "document";
  if (propre.length <= 255) return propre;
  const ext = extensionDe(propre) ?? "";
  return `${propre.slice(0, 255 - ext.length)}${ext}`;
}

/** Ajoute un FICHIER : stocké en base, après un verdict antivirus « sain ». */
export async function ajouterFichier(
  db: Db,
  e: EntreeDocument & { readonly nom: string; readonly octets: Uint8Array },
  analyser: (octets: Uint8Array) => Promise<VerdictAntivirus>,
): Promise<{ id: string }> {
  verifierTailleAnnoncee(e.octets.length);
  const format = formatDepuisNom(e.nom);
  if (format === null) throw new ErreurDocument(messageFormatRefuse(e.nom));
  if (!signatureConforme(format, e.octets)) {
    throw new ErreurDocument(
      `Ce fichier ne correspond pas à son extension « .${FORMATS[format].extensions[0]} » : il a ` +
        "peut-être été renommé. Enregistrez-le à nouveau dans son format d'origine, puis " +
        "choisissez-le à nouveau.",
    );
  }
  const nom = nomDeFichierPropre(e.nom);
  const titre =
    titreDemande(e) ??
    (nom
      .replace(/\.[A-Za-z0-9]{1,10}$/, "")
      .trim()
      .slice(0, 200) ||
      "Document");
  const envoyeLe = dateDEnvoi(e);
  await projetDuClient(db, e);

  const verdict = await analyser(e.octets);
  if (verdict.issue === "infecte") {
    throw new ErreurDocument(MESSAGES_DOCUMENT.infecte, verdict.signature);
  }
  if (verdict.issue !== "sain") throw new ErreurDocument(MESSAGES_DOCUMENT.antivirusIndisponible);

  const nature: NatureDocumentProjet =
    e.nature ?? (format === "eml" ? "email" : format === "pdf" ? "pdf" : "autre");
  return ecrire(db, e, {
    cote: e.cote,
    nature,
    titre,
    envoyeLe,
    fichierNom: nom,
    fichierFormat: format,
    fichierTailleOctets: e.octets.length,
    fichierSha256: createHash("sha256").update(e.octets).digest("hex"),
    analyseAntivirus: "sain",
    analyseLe: e.maintenant ?? new Date(),
    contenu: { create: { octets: Buffer.from(e.octets) } },
  });
}
