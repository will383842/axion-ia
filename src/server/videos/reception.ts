/**
 * RÉCEPTION DES PUBLICATIONS ET DES RETRAITS DU STUDIO (plan PLAN-W1-W4 §3.3).
 *
 * ⛔ SEUL ÉCRIVAIN de `SiteVideo` (verrouillé par
 * `tests/unit/ci/aucun-ecrivain-de-site-video-hors-reception.spec.ts`).
 *
 * Étapes 6 à 10 : nonce, schéma, gardes de contenu, fichiers, règles de version.
 * Chaque requête SIGNÉE VALIDE laisse une ligne au journal avec la réponse rendue :
 * c'est l'anti-rejeu (nonce unique) ET l'idempotence réseau (même nonce, même
 * corps → la réponse enregistrée est renvoyée telle quelle, sans effet).
 *
 * Aucun appel réseau ni effet de bord dans la transaction : les HEAD de fichiers
 * se font AVANT elle.
 */
import { prisma } from "@/lib/prisma";
import type { Prisma } from "../../../prisma/generated/client";
import { SITE_URL } from "@/lib/site-url";
import { analyserPublication, analyserRetrait, type PublicationVideo } from "./contrat";
import type { EntreeSignee } from "./entree";
import { verifierFichiers } from "./fichiers";
import { controlerContenu, reglagesRuntime } from "./gardes-contenu";
import type { EffetPublication } from "./apres-publication";
import { reponseJson } from "./reponse";

interface Resultat {
  readonly statut: number;
  readonly corps: Record<string, unknown>;
  readonly studioVideoId?: string | null;
  /** Ce qui doit suivre la réponse (cache, edge, IndexNow) — seulement pour un fait NOUVEAU. */
  readonly effet?: EffetPublication;
}

/** Réponse au studio + effet à planifier APRÈS elle (`null` : rien à faire). */
export interface Reception {
  readonly reponse: Response;
  readonly effet: EffetPublication | null;
}

const sansEffet = (reponse: Response): Reception => ({ reponse, effet: null });

const echec = (statut: number, erreur: string, plus: Record<string, unknown> = {}): Resultat => ({
  statut,
  corps: { ok: false, erreur, ...plus },
});

function urlDe(slug: string): string {
  return `${SITE_URL.replace(/\/+$/, "")}/fr/videos/${slug}`;
}

function estUniciteViolee(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
}

function enReponse(r: Resultat, rejeu: boolean): Response {
  return reponseJson(r.statut, r.corps, rejeu ? { "x-axion-rejeu": "1" } : {});
}

/** Le nonce a-t-il déjà été vu ? Rejeu idempotent, ou conflit si le corps diffère. */
async function nonceDejaVu(e: EntreeSignee): Promise<Reception | null> {
  const vu = await prisma.siteVideoReception.findUnique({ where: { nonce: e.nonce } });
  if (!vu) return null;
  if (vu.corpsSha256 === e.corpsSha256) {
    return sansEffet(
      enReponse(
        { statut: vu.reponseStatut, corps: vu.reponseCorps as Record<string, unknown> },
        true,
      ),
    );
  }
  return sansEffet(reponseJson(409, { ok: false, erreur: "nonce_reutilise" }));
}

/** Écrit (dans UNE transaction) ce que `decider` ordonne, plus la ligne de journal. */
async function ecrireEtJournaliser(
  e: EntreeSignee,
  decider: (tx: Prisma.TransactionClient) => Promise<Resultat>,
  studioVideoId: string | null,
): Promise<Reception> {
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const r = await decider(tx);
      await tx.siteVideoReception.create({
        data: {
          nonce: e.nonce,
          methode: e.methode,
          chemin: e.chemin,
          horodatage: e.horodatage,
          corpsSha256: e.corpsSha256,
          studioVideoId: r.studioVideoId ?? studioVideoId,
          reponseStatut: r.statut,
          reponseCorps: r.corps as Prisma.InputJsonValue,
        },
      });
      return r;
    });
    return { reponse: enReponse(resultat, false), effet: resultat.effet ?? null };
  } catch (err) {
    // Deux requêtes simultanées du même nonce : la seconde relit la première.
    if (estUniciteViolee(err)) {
      const concurrent = await nonceDejaVu(e);
      if (concurrent) return concurrent;
    }
    throw err;
  }
}

function lireStudioVideoId(corps: Buffer): string | null {
  try {
    const j = JSON.parse(corps.toString("utf8")) as { studioVideoId?: unknown };
    return typeof j.studioVideoId === "string" && /^[a-z0-9_-]{8,64}$/.test(j.studioVideoId)
      ? j.studioVideoId
      : null;
  } catch {
    return null;
  }
}

function donneesDe(p: PublicationVideo, e: EntreeSignee, maintenant: Date) {
  return {
    version: p.version,
    theme: p.theme,
    serieSlug: p.serie?.slug ?? null,
    serieTitre: p.serie?.titre ?? null,
    serieRang: p.serie?.rang ?? null,
    titre: p.titre,
    description: p.description,
    resume: p.resume,
    aRetenir: p.aRetenir as Prisma.InputJsonValue,
    questions: p.questions as Prisma.InputJsonValue,
    chapitres: p.chapitres as Prisma.InputJsonValue,
    fichiers: p.fichiers as Prisma.InputJsonValue,
    transcription: p.transcription,
    dureeSecondes: p.dureeSecondes,
    lienType: p.lien.type,
    lienChemin: p.lien.chemin,
    iaVoixGeneree: p.ia.voixGeneree,
    iaDoubleNumerique: p.ia.doubleNumerique,
    williamsALImage: p.personnesALImage.williams,
    corpsSha256: e.corpsSha256,
    modifieeLe: maintenant,
  };
}

export async function recevoirPublication(e: EntreeSignee): Promise<Reception> {
  const dejaVu = await nonceDejaVu(e);
  if (dejaVu) return dejaVu;

  const studioVideoIdBrut = lireStudioVideoId(e.corps);
  const final = (r: Resultat) => ecrireEtJournaliser(e, async () => r, studioVideoIdBrut);

  // 7. Schéma strict.
  let json: unknown;
  try {
    json = JSON.parse(e.corps.toString("utf8"));
  } catch {
    return final(echec(422, "json_invalide"));
  }
  const analyse = analyserPublication(json);
  if (!analyse.ok) return final(echec(422, "schema_invalide", { champs: analyse.champs }));
  const p = analyse.donnees;

  // 8. Gardes de contenu.
  const violations = controlerContenu(p, reglagesRuntime());
  if (violations.length > 0) return final(echec(422, "contenu_interdit", { violations }));

  // 9. Fichiers (hors transaction : appel réseau).
  const fichiers = await verifierFichiers(p.fichiers);
  if (!fichiers.ok) return final(echec(422, "fichier_injoignable", { fautes: fichiers.fautes }));

  // 10. Règles de version, puis écriture.
  return ecrireEtJournaliser(
    e,
    async (tx) => {
      const maintenant = new Date();
      const existante = await tx.siteVideo.findUnique({
        where: { studioVideoId: p.studioVideoId },
      });
      const sid = p.studioVideoId;

      if (existante) {
        if (existante.slug !== p.slug)
          return { ...echec(409, "slug_immuable"), studioVideoId: sid };
        if (existante.statut === "retiree")
          return { ...echec(409, "video_retiree"), studioVideoId: sid };
        if (p.version < existante.version)
          return { ...echec(409, "version_perimee"), studioVideoId: sid };
        if (p.version === existante.version) {
          if (existante.corpsSha256 !== e.corpsSha256) {
            return { ...echec(409, "version_deja_publiee"), studioVideoId: sid };
          }
          // Rejeu du FAIT (nouveau nonce, même contenu) : 200 sans effet.
          return {
            statut: 200,
            studioVideoId: sid,
            corps: {
              ok: true,
              statut: "publiee",
              slug: p.slug,
              url: urlDe(p.slug),
              version: p.version,
              rejeu: true,
            },
          };
        }
        await tx.siteVideo.update({
          where: { studioVideoId: sid },
          data: donneesDe(p, e, maintenant),
        });
        return {
          statut: 200,
          studioVideoId: sid,
          effet: {
            type: "publication",
            slug: p.slug,
            theme: p.theme,
            serieSlug: p.serie?.slug ?? null,
          },
          corps: {
            ok: true,
            statut: "publiee",
            slug: p.slug,
            url: urlDe(p.slug),
            version: p.version,
            rejeu: false,
          },
        };
      }

      if (await tx.siteVideo.findUnique({ where: { slug: p.slug } })) {
        return { ...echec(409, "slug_deja_pris"), studioVideoId: sid };
      }
      await tx.siteVideo.create({
        data: {
          studioVideoId: sid,
          slug: p.slug,
          statut: "publiee",
          publieeLe: maintenant,
          ...donneesDe(p, e, maintenant),
        },
      });
      return {
        statut: 201,
        studioVideoId: sid,
        effet: {
          type: "publication",
          slug: p.slug,
          theme: p.theme,
          serieSlug: p.serie?.slug ?? null,
        },
        corps: {
          ok: true,
          statut: "publiee",
          slug: p.slug,
          url: urlDe(p.slug),
          version: p.version,
          rejeu: false,
        },
      };
    },
    studioVideoIdBrut,
  );
}

export async function recevoirRetrait(e: EntreeSignee): Promise<Reception> {
  const dejaVu = await nonceDejaVu(e);
  if (dejaVu) return dejaVu;

  const studioVideoIdBrut = lireStudioVideoId(e.corps);
  let json: unknown;
  try {
    json = JSON.parse(e.corps.toString("utf8"));
  } catch {
    return ecrireEtJournaliser(e, async () => echec(422, "json_invalide"), studioVideoIdBrut);
  }
  const analyse = analyserRetrait(json);
  if (!analyse.ok) {
    return ecrireEtJournaliser(
      e,
      async () => echec(422, "schema_invalide", { champs: analyse.champs }),
      studioVideoIdBrut,
    );
  }
  const { studioVideoId, motif } = analyse.donnees;

  return ecrireEtJournaliser(
    e,
    async (tx) => {
      const existante = await tx.siteVideo.findUnique({ where: { studioVideoId } });
      if (!existante) return { ...echec(404, "video_inconnue"), studioVideoId };
      if (existante.statut === "retiree") {
        return {
          statut: 200,
          studioVideoId,
          corps: { ok: true, statut: "retiree", slug: existante.slug, rejeu: true },
        };
      }
      await tx.siteVideo.update({
        where: { studioVideoId },
        data: {
          statut: "retiree",
          retireeLe: new Date(),
          motifRetrait: motif,
          modifieeLe: new Date(),
        },
      });
      return {
        statut: 200,
        studioVideoId,
        effet: {
          type: "retrait",
          slug: existante.slug,
          theme: existante.theme,
          serieSlug: existante.serieSlug,
        },
        corps: { ok: true, statut: "retiree", slug: existante.slug, rejeu: false },
      };
    },
    studioVideoIdBrut,
  );
}
