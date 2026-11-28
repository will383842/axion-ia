/**
 * Photo d'un collaborateur : dépôt, remplacement, retrait. FONCTIONS SERVEUR RÉUTILISABLES,
 * séparées de tout écran (la console les appelle aujourd'hui ; le questionnaire les appellera).
 *
 * Garanties :
 *  - le type est lu dans les OCTETS (signature JPEG / PNG / WebP), jamais dans le nom ni le MIME ;
 *  - 8 Mo maximum, 400 px minimum de côté, 40 millions de pixels maximum (bombe de décompression) ;
 *  - ré-encodage WebP carré (256 et 1024 px), orientation appliquée puis TOUTES les métadonnées
 *    retirées (EXIF, GPS, profil ICC) : Sharp n'en réécrit aucune sans `withMetadata` ;
 *  - l'original (octets reçus) est gardé dans un dossier PRIVÉ, hors web-root, sous un nom
 *    aléatoire, et n'est jamais servi ; les variantes ont un jeton aléatoire de 128 bits ;
 *  - aucun chemin ne vient de l'utilisateur ; toute suppression vérifie que le chemin est sous
 *    la racine attendue (une valeur falsifiée en base ne peut rien effacer ailleurs) ;
 *  - l'appelant a DÉJÀ vérifié le rôle administrateur : ce module ne lit aucune session.
 */
import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, rmdir, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { revalidatePath } from "next/cache";
import sharp from "sharp";

import { prisma } from "@/lib/prisma";
import { TEAM_CONSENT_VERSION_COURANTE } from "@/lib/equipe/donnees";
import { NOTE_PREUVE_MIN, idSchema } from "@/lib/equipe/console/schemas";
import { getCvStorageBasePath } from "@/server/careers/cv-storage";
import { getReviewMediaBasePath } from "@/server/reviews/photo-storage";

export const PHOTO_MAX_OCTETS = 8 * 1024 * 1024;
export const PHOTO_COTE_MIN = 400;
const PIXELS_MAX = 40_000_000;
const COTE_GRANDE = 1024;
const COTE_PETITE = 256;
const JETON = /^[a-f0-9]{32}$/;
const URL_PUBLIQUE = /^\/api\/equipe\/photo\/([a-f0-9]{32})\/(?:256|1024)$/;

export type ResultatPhoto<T extends object = object> =
  ({ ok: true } & T) | { ok: false; erreur: string };

/** Dossier PRIVÉ des originaux (volume des CV en production, donc déjà sauvegardé). */
export function racinePrivee(): string {
  return resolve(
    process.env["TEAM_PHOTO_PRIVATE_PATH"] ?? join(getCvStorageBasePath(), "equipe-photos"),
  );
}

/** Dossier des variantes publiques (volume des médias d'avis, servi uniquement par la route). */
export function racinePublique(): string {
  return resolve(process.env["TEAM_PHOTO_PUBLIC_PATH"] ?? join(getReviewMediaBasePath(), "equipe"));
}

function sousRacine(racine: string, chemin: string): boolean {
  const r = resolve(chemin);
  return r.startsWith(racine + sep);
}

type Format = "jpeg" | "png" | "webp";

function formatParSignature(o: Buffer): Format | null {
  if (o.length > 12) {
    if (o[0] === 0xff && o[1] === 0xd8 && o[2] === 0xff) return "jpeg";
    if (o.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
      return "png";
    if (
      o.subarray(0, 4).toString("latin1") === "RIFF" &&
      o.subarray(8, 12).toString("latin1") === "WEBP"
    )
      return "webp";
  }
  return null;
}

export type PhotoTraitee = {
  ok: true;
  format: Format;
  v256: Buffer;
  v1024: Buffer;
};

/** Valide les octets et produit les deux variantes WebP. Aucun accès disque ni base. */
export async function traiterPhoto(
  octets: Buffer,
): Promise<PhotoTraitee | { ok: false; erreur: string }> {
  if (octets.length > PHOTO_MAX_OCTETS) {
    return { ok: false, erreur: "La photo dépasse 8 Mo." };
  }
  const format = formatParSignature(octets);
  if (!format) return { ok: false, erreur: "Format refusé : JPEG, PNG ou WebP seulement." };
  try {
    const source = sharp(octets, { limitInputPixels: PIXELS_MAX, failOn: "error" });
    const meta = await source.metadata();
    if (meta.format !== format || !meta.width || !meta.height) {
      return { ok: false, erreur: "Format refusé : JPEG, PNG ou WebP seulement." };
    }
    const tourne = (meta.orientation ?? 1) >= 5;
    const largeur = tourne ? meta.height : meta.width;
    const hauteur = tourne ? meta.width : meta.height;
    if (Math.min(largeur, hauteur) < PHOTO_COTE_MIN) {
      return { ok: false, erreur: `La photo doit mesurer au moins ${PHOTO_COTE_MIN} px de côté.` };
    }
    const grande = Math.min(COTE_GRANDE, largeur, hauteur);
    const variante = (cote: number) =>
      sharp(octets, { limitInputPixels: PIXELS_MAX, failOn: "error" })
        .rotate()
        .resize(cote, cote, { fit: "cover", position: "attention" })
        .webp({ quality: 82 })
        .toBuffer();
    const [v1024, v256] = await Promise.all([variante(grande), variante(COTE_PETITE)]);
    return { ok: true, format, v256, v1024 };
  } catch {
    return { ok: false, erreur: "Image illisible ou trop lourde à décoder." };
  }
}

function extensionOriginal(f: Format): string {
  return f === "jpeg" ? "jpg" : f;
}

function jetonDe(url: string | null): string | null {
  const t = url ? URL_PUBLIQUE.exec(url)?.[1] : undefined;
  return t && JETON.test(t) ? t : null;
}

async function supprimerFichier(chemin: string): Promise<boolean> {
  try {
    await unlink(chemin);
    return true;
  } catch (e) {
    // Déjà absent : sans effet. Toute autre erreur (droits, disque) est journalisée.
    if ((e as { code?: string }).code !== "ENOENT") {
      console.error("[equipe-photo] suppression impossible", (e as { code?: string }).code);
      return false;
    }
    return true;
  }
}

/**
 * Supprime variantes et original d'une fiche. Idempotent ; ignore tout chemin hors racine.
 * Rend le nombre de fichiers qui n'ont PAS pu être supprimés (hors « déjà absent ») : l'effacement
 * réel s'arrête s'il est non nul.
 */
export async function purgerFichiers(photo: {
  photoStoragePath: string | null;
  photoUrl256: string | null;
  photoUrl1024: string | null;
}): Promise<number> {
  let echecs = 0;
  const pub = racinePublique();
  for (const url of [photo.photoUrl256, photo.photoUrl1024]) {
    const jeton = jetonDe(url);
    if (!jeton) continue;
    for (const cote of [COTE_PETITE, COTE_GRANDE]) {
      if (!(await supprimerFichier(join(pub, `${jeton}-${cote}.webp`)))) echecs++;
    }
  }
  const prive = photo.photoStoragePath;
  if (prive && sousRacine(racinePrivee(), prive)) {
    if (!(await supprimerFichier(prive))) echecs++;
    try {
      await rmdir(dirname(prive)); // dossier aléatoire de l'original, s'il est vide
    } catch {
      // non vide ou absent : sans effet
    }
  }
  return echecs;
}

function revalider(slug: string): void {
  revalidatePath("/fr/equipe");
  revalidatePath(`/fr/equipe/${slug}`);
}

function altParDefaut(prenom: string): string {
  return `Photo de ${prenom}`;
}

export interface DepotPhoto {
  readonly memberId: string;
  readonly octets: Buffer;
  /** Identifiant de l'administrateur, « questionnaire » ou « systeme » (journal). */
  readonly acteur: string;
  readonly alt?: string | null;
  /**
   * Accord photo saisi depuis la console, SANS accord déjà enregistré : note de preuve obligatoire.
   * Pour le questionnaire, l'accord est enregistré avant l'appel et ce champ reste absent.
   */
  readonly consentementConsole?: { readonly note: string };
}

export async function deposerPhotoCollaborateur(
  depot: DepotPhoto,
): Promise<ResultatPhoto<{ slug: string }>> {
  const id = idSchema.safeParse(depot.memberId);
  if (!id.success) return { ok: false, erreur: "Identifiant invalide." };
  const avant = await prisma.teamMember.findUnique({ where: { id: id.data } });
  if (!avant) return { ok: false, erreur: "Fiche introuvable." };
  if (avant.erasureRequestedAt) {
    return { ok: false, erreur: "Une demande d'effacement est en cours : fiche verrouillée." };
  }
  const note = depot.consentementConsole?.note.trim() ?? "";
  if (!avant.photoConsentAt && note.length < NOTE_PREUVE_MIN) {
    return {
      ok: false,
      erreur: `L'accord de la personne pour sa photo n'est pas enregistré : une note de preuve (${NOTE_PREUVE_MIN} caractères au moins) est obligatoire.`,
    };
  }
  const alt = (depot.alt ?? "")
    .replace(/[\u0000-\u001F\u007F<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (alt.length > 200) return { ok: false, erreur: "Le texte alternatif dépasse 200 caractères." };

  const t = await traiterPhoto(depot.octets);
  if (!t.ok) return t;

  const jeton = randomBytes(16).toString("hex");
  const pub = racinePublique();
  const cheminPrive = join(racinePrivee(), randomUUID(), `original.${extensionOriginal(t.format)}`);
  const cheminsNeufs = [
    join(pub, `${jeton}-${COTE_PETITE}.webp`),
    join(pub, `${jeton}-${COTE_GRANDE}.webp`),
    cheminPrive,
  ];
  try {
    await mkdir(pub, { recursive: true });
    await mkdir(dirname(cheminPrive), { recursive: true, mode: 0o700 });
    await writeFile(cheminsNeufs[0]!, t.v256);
    await writeFile(cheminsNeufs[1]!, t.v1024);
    await writeFile(cheminPrive, depot.octets, { mode: 0o600 });

    const maintenant = new Date();
    const donnees: Record<string, unknown> = {
      photoKind: "reelle",
      photoStoragePath: cheminPrive,
      photoUrl256: `/api/equipe/photo/${jeton}/${COTE_PETITE}`,
      photoUrl1024: `/api/equipe/photo/${jeton}/${COTE_GRANDE}`,
      photoAlt: alt !== "" ? alt : (avant.photoAlt ?? altParDefaut(avant.firstName)),
    };
    if (!avant.photoConsentAt) {
      donnees["photoConsentAt"] = maintenant;
      donnees["photoConsentVersion"] = TEAM_CONSENT_VERSION_COURANTE.photo.version;
      donnees["consentSource"] = "console";
      // Jamais écrasée : la preuve des accords précédents reste lisible.
      donnees["consentNote"] = avant.consentNote
        ? `${avant.consentNote}\n---\n${maintenant.toISOString().slice(0, 10)} : ${note}`
        : note;
    }
    const ok = await prisma.$transaction(async (tx) => {
      const r = await tx.teamMember.updateMany({
        where: { id: avant.id, updatedAt: avant.updatedAt, erasureRequestedAt: null },
        data: donnees,
      });
      if (r.count !== 1) return false;
      await tx.teamMemberEvent.create({
        data: {
          memberId: avant.id,
          action: "photo_deposee",
          actor: depot.acteur,
          details: {
            remplacement: avant.photoUrl256 !== null,
            consentement_saisi_console: !avant.photoConsentAt,
          },
        },
      });
      return true;
    });
    if (!ok) {
      await Promise.all(cheminsNeufs.map(supprimerFichier));
      return { ok: false, erreur: "La fiche a changé entre-temps : rechargez la page." };
    }
  } catch (e) {
    await Promise.all(cheminsNeufs.map(supprimerFichier));
    throw e;
  }
  await purgerFichiers(avant);
  revalider(avant.slug);
  return { ok: true, slug: avant.slug };
}

export async function retirerPhotoCollaborateur(entree: {
  readonly memberId: string;
  readonly acteur: string;
}): Promise<ResultatPhoto<{ slug: string }>> {
  const id = idSchema.safeParse(entree.memberId);
  if (!id.success) return { ok: false, erreur: "Identifiant invalide." };
  const avant = await prisma.teamMember.findUnique({ where: { id: id.data } });
  if (!avant) return { ok: false, erreur: "Fiche introuvable." };
  const aUnePhoto =
    avant.photoConsentAt !== null ||
    avant.photoKind === "reelle" ||
    avant.photoStoragePath !== null ||
    avant.photoUrl256 !== null ||
    avant.photoUrl1024 !== null;
  if (!aUnePhoto) return { ok: false, erreur: "Cette fiche n'a ni photo ni accord photo." };
  const ok = await prisma.$transaction(async (tx) => {
    const r = await tx.teamMember.updateMany({
      where: { id: avant.id, updatedAt: avant.updatedAt },
      data: {
        photoKind: "avatar",
        photoStoragePath: null,
        photoUrl256: null,
        photoUrl1024: null,
        photoAlt: null,
        // Retrait de la photo = retrait de l'accord photo : une nouvelle photo exige un nouvel accord.
        photoConsentAt: null,
        photoConsentVersion: null,
      },
    });
    if (r.count !== 1) return false;
    await tx.teamMemberEvent.create({
      data: { memberId: avant.id, action: "photo_retiree", actor: entree.acteur },
    });
    return true;
  });
  if (!ok) return { ok: false, erreur: "La fiche a changé entre-temps : rechargez la page." };
  await purgerFichiers(avant);
  revalider(avant.slug);
  return { ok: true, slug: avant.slug };
}
