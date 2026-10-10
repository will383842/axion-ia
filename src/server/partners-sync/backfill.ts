/**
 * backfill.ts — `POST /api/partners/backfill` : le rattrapage de l'historique (INT-T21-A,
 * REQ-INT-011, REQ-INT-012).
 *
 * ── Ce que fait le backfill, et ce qu'il ne fait pas ─────────────────────────────────────────
 * Avant l'adoption du canal, des clients, des devis et des candidatures existaient sans qu'aucun
 * événement ait été écrit. Le backfill ne construit RIEN de nouveau : il rappelle, pour chaque fait
 * de la fenêtre, l'UNIQUE fonction d'émission du producteur (`emettreFaitClient`,
 * `emettreDevisSigne`, `emettreDevisEmis`, `emettreCandidatureRecue`), dans une transaction par
 * fait. Les clés de fait sont celles du chemin normal (`<type>:<id>`) : un fait déjà émis ne
 * réécrit rien (ON CONFLICT DO NOTHING), et rejouer le backfill est sans effet. La RELECTURE reste
 * la route unique `GET /api/partners/evenements` (REQ-INT-012) : le backfill alimente la file, c'est
 * elle que Partners relit, charge exacte conservée comprise.
 *
 * ── La fenêtre (HYP-E1-7) ────────────────────────────────────────────────────────────────────
 *   · clients : ceux qui portent un SIREN transmissible, créés depuis le 2026-08-13 OU liés à un
 *     devis de la fenêtre (sans eux, Partners garderait le devis en `en_attente_dependance`) ;
 *   · devis signés : `accepte`, acceptés depuis le 2026-08-13 ;
 *   · devis émis : envoyés dans les six derniers mois (INT-T46-A) ;
 *   · candidatures : déposées depuis le 2026-08-13 et portant la marque « prêt à signer ».
 * Aucun `paiement.recu` antérieur n'est reconstitué : aucune famille ne le produit.
 *
 * ── Un appel = une page ──────────────────────────────────────────────────────────────────────
 * Corps strict `{ famille, apres?, limite? }` ; la réponse rend `suivant` (le dernier identifiant lu,
 * ou `null` en fin de famille). Un fait refusé ou illisible n'arrête pas la page : son identifiant
 * et le NOM de la faute sont rendus dans `refuses`, jamais une valeur ni une donnée de personne.
 *
 * ── La marque « prêt à signer » est jugée par le producteur, pas par la requête de lister ────
 * `lister` ne filtre PAS les candidatures sur la marque : il ne fait que désigner des fiches de la
 * fenêtre. Ce qui part, et ce qui est refusé (corbeille, non-apporteur, sans suite) ou ignoré (pas
 * de marque), est décidé par `emettreCandidatureRecue`, qui relit la fiche dans la transaction.
 * Une requête ne peut donc faire partir aucune candidature que le chemin normal refuserait.
 *
 * ── Authentification ─────────────────────────────────────────────────────────────────────────
 * Celle de la réconciliation : secret de relecture, « <horodatage>.<chemin>\n<corps> », fenêtre de
 * 300 s ; réponse signée « t.corps » avec le secret d'émission et `X-Axionia-Kid`. Débit borné,
 * refusé si le compteur est aveugle.
 *
 * ── Inertie ──────────────────────────────────────────────────────────────────────────────────
 * Canal fermé, build, ou secret absent : 404, avant toute lecture.
 */
import { z } from "zod";

import type { Prisma } from "../../../prisma/generated/client";
import type { RateLimitConfig } from "@/lib/rate-limit";
import { ENTETE_KID, horodatageSignature, kidDe, signerCorps } from "@/server/partners/enveloppe";

import { canalPartnersOuvert, secretPartners, secretRelecture } from "./config";
import { verifierRequetePartners } from "./relecture";

/** HYP-E1-7 : le premier jour de l'historique repris. */
export const FENETRE_BACKFILL_DEPUIS_ISO = "2026-08-13T00:00:00.000Z";
/** Une fonction, pas une constante : la garde d'inertie (R1) refuse toute instruction au chargement. */
export function fenetreBackfillDepuis(): Date {
  return new Date(FENETRE_BACKFILL_DEPUIS_ISO);
}
/** INT-T46-A : les devis émis repris remontent à six mois. */
export const MOIS_DEVIS_EMIS = 6;

export const FAMILLES_BACKFILL = ["clients", "devis_signes", "devis_emis", "candidatures"] as const;
export type FamilleBackfill = (typeof FAMILLES_BACKFILL)[number];

export const LIMITE_BACKFILL_PAR_DEFAUT = 50;
export const LIMITE_BACKFILL_MAX = 100;

/** Soixante pages par heure : de quoi vider l'historique ; refusé si le compteur est aveugle. */
export const DEBIT_BACKFILL: RateLimitConfig = { limit: 60, windowSec: 3600, surPanne: "refuser" };
export const CLE_DEBIT_BACKFILL = "partners:backfill";

export type Limiteur = (cle: string, config: RateLimitConfig) => Promise<{ allowed: boolean }>;

/** Il y a six mois, au jour près (UTC). */
export function debutDevisEmis(maintenant: Date): Date {
  const d = new Date(maintenant.getTime());
  d.setUTCMonth(d.getUTCMonth() - MOIS_DEVIS_EMIS);
  return d;
}

/** Ce que le backfill lit et appelle : injecté par les tests, la base par défaut. */
export interface SourcesBackfill {
  /** Les identifiants de la famille après `apres`, dans l'ordre croissant, au plus `limite`. */
  lister(
    famille: FamilleBackfill,
    page: { apres: string | null; limite: number; maintenant: Date },
  ): Promise<string[]>;
  /** L'émission du producteur, dans sa transaction. `null` = aucun fait à écrire. */
  emettre(famille: FamilleBackfill, id: string): Promise<string | null>;
}

export type FauteBackfill = { id: string; motif: string };

export type BilanBackfill = {
  famille: FamilleBackfill;
  traites: number;
  emis: number;
  ignores: number;
  refuses: FauteBackfill[];
  suivant: string | null;
};

/**
 * Une page d'une famille. Rend le bilan ; `suivant` est le dernier identifiant lu si la page était
 * pleine, `null` sinon (la famille est épuisée).
 */
export async function rattraperUnePage(
  sources: SourcesBackfill,
  famille: FamilleBackfill,
  apres: string | null,
  limite: number,
  maintenant: Date,
): Promise<BilanBackfill> {
  if (!canalPartnersOuvert()) {
    return { famille, traites: 0, emis: 0, ignores: 0, refuses: [], suivant: null };
  }
  const ids = await sources.lister(famille, { apres, limite, maintenant });
  let emis = 0;
  let ignores = 0;
  const refuses: FauteBackfill[] = [];
  for (const id of ids) {
    try {
      if ((await sources.emettre(famille, id)) === null) ignores += 1;
      else emis += 1;
    } catch (e) {
      // Le NOM de la faute, jamais son message : il peut citer une valeur de la fiche.
      refuses.push({ id, motif: e instanceof Error ? e.name : typeof e });
    }
  }
  return {
    famille,
    traites: ids.length,
    emis,
    ignores,
    refuses,
    suivant: ids.length === limite ? (ids.at(-1) ?? null) : null,
  };
}

/**
 * L'émission d'UN fait de l'historique, dans la transaction `tx`, par l'unique fonction d'émission
 * de son producteur.
 *
 * ── REQ-INT-011 : le parent part AVANT l'enfant ───────────────────────────────────────────────
 * Partners garde un devis dont le client manque en `en_attente_dependance` et le rejoue à
 * l'arrivée du parent ; le backfill n'a pas à le lui faire attendre. Pour un devis (signé ou
 * émis), le client destinataire est émis (`client.cree`, clé `client.cree:<id>`) DANS LA MÊME
 * transaction, AVANT le devis : l'ordre ne dépend donc pas de l'ordre dans lequel l'appelant
 * demande les familles, et aucun devis du backfill ne part sans son client. Un client déjà émis
 * ne réécrit rien (même clé de fait).
 */
export async function emettreFaitHistorique(
  tx: Prisma.TransactionClient,
  famille: FamilleBackfill,
  id: string,
): Promise<string | null> {
  if (!canalPartnersOuvert()) return null;
  const { emettreFaitClient, CREATION_CLIENT } = await import("./producteurs/client");
  switch (famille) {
    case "clients":
      return emettreFaitClient(tx, id, CREATION_CLIENT);
    case "candidatures": {
      const { emettreCandidatureRecue } = await import("./producteurs/candidature");
      return emettreCandidatureRecue(tx, id);
    }
    case "devis_signes":
    case "devis_emis": {
      const devis = await tx.devis.findUnique({ where: { id }, select: { clientId: true } });
      if (devis === null) {
        throw new Error(`[partners-sync] backfill : devis ${id} introuvable dans la transaction.`);
      }
      await emettreFaitClient(tx, devis.clientId, CREATION_CLIENT);
      const { emettreDevisSigne, emettreDevisEmis } = await import("./producteurs/devis");
      return famille === "devis_signes" ? emettreDevisSigne(tx, id) : emettreDevisEmis(tx, id);
    }
  }
}

/** Les sources de production : la base, et les producteurs, un fait par transaction. */
export async function sourcesDeProduction(): Promise<SourcesBackfill> {
  if (!canalPartnersOuvert()) {
    return { lister: async () => [], emettre: async () => null };
  }
  const { prisma } = await import("@/lib/prisma");
  const pageId = (limite: number) =>
    ({ orderBy: { id: "asc" }, take: limite, select: { id: true } }) as const;

  return {
    async lister(famille, { apres, limite, maintenant }) {
      const depuis = fenetreBackfillDepuis();
      const sixMois = debutDevisEmis(maintenant);
      const apresId = apres === null ? {} : { id: { gt: apres } };
      const base = pageId(limite);
      switch (famille) {
        case "clients": {
          const lignes = await prisma.client.findMany({
            ...base,
            where: {
              ...apresId,
              AND: [
                { OR: [{ siren: { not: null } }, { siret: { not: null } }] },
                {
                  OR: [
                    { createdAt: { gte: depuis } },
                    {
                      devis: {
                        some: {
                          OR: [{ acceptedAt: { gte: depuis } }, { sentAt: { gte: sixMois } }],
                        },
                      },
                    },
                  ],
                },
              ],
            },
          });
          return lignes.map((l) => l.id);
        }
        case "devis_signes": {
          const lignes = await prisma.devis.findMany({
            ...base,
            where: { ...apresId, statut: "accepte", acceptedAt: { gte: depuis } },
          });
          return lignes.map((l) => l.id);
        }
        case "devis_emis": {
          const lignes = await prisma.devis.findMany({
            ...base,
            where: { ...apresId, sentAt: { gte: sixMois } },
          });
          return lignes.map((l) => l.id);
        }
        case "candidatures": {
          const lignes = await prisma.submission.findMany({
            ...base,
            where: { ...apresId, deletedAt: null, submittedAt: { gte: depuis } },
          });
          return lignes.map((l) => l.id);
        }
      }
    },
    async emettre(famille, id) {
      return prisma.$transaction((tx) => emettreFaitHistorique(tx, famille, id));
    },
  };
}

export type DependancesBackfill = {
  sources?: SourcesBackfill;
  maintenantMs?: number;
  limiter?: Limiteur;
  journal?: (ligne: string) => void;
};

/** Construit à l'appel, jamais au chargement : la garde d'inertie (R1) refuse tout effet de module. */
const schemaDemande = () =>
  z
    .object({
      famille: z.enum(FAMILLES_BACKFILL),
      apres: z.string().uuid().nullable().optional(),
      limite: z.number().int().min(1).max(LIMITE_BACKFILL_MAX).optional(),
    })
    .strict();

function texte(statut: number, corps: string): Response {
  return new Response(corps, {
    status: statut,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function repondreBackfill(
  requete: Request,
  dependances: DependancesBackfill = {},
): Promise<Response> {
  if (!canalPartnersOuvert()) return texte(404, "not_found");
  const secretLecture = secretRelecture();
  const secretEmission = secretPartners();
  if (secretLecture === null || secretEmission === null) return texte(404, "not_found");

  const corpsRecu = await requete.text();
  const cible = `${new URL(requete.url).pathname}\n${corpsRecu}`;
  const maintenantMs = dependances.maintenantMs ?? Date.now();
  if (!verifierRequetePartners(requete, cible, secretLecture, maintenantMs))
    return texte(401, "signature_refusee");

  let brut: unknown;
  try {
    brut = JSON.parse(corpsRecu);
  } catch {
    return texte(400, "corps_illisible");
  }
  const demande = schemaDemande().safeParse(brut);
  if (!demande.success) return texte(400, "corps_illisible");

  const limiter = dependances.limiter ?? (await import("@/lib/rate-limit")).checkRateLimit;
  if (!(await limiter(CLE_DEBIT_BACKFILL, DEBIT_BACKFILL)).allowed)
    return texte(429, "debit_depasse");

  const sources = dependances.sources ?? (await sourcesDeProduction());
  const bilan = await rattraperUnePage(
    sources,
    demande.data.famille,
    demande.data.apres ?? null,
    demande.data.limite ?? LIMITE_BACKFILL_PAR_DEFAUT,
    new Date(maintenantMs),
  );

  const journal = dependances.journal ?? ((l: string) => console.warn(l));
  journal(
    `[partners-sync] backfill ${bilan.famille} : ${bilan.traites} lu(s), ${bilan.emis} émis, ` +
      `${bilan.ignores} ignoré(s), ${bilan.refuses.length} refusé(s)`,
  );

  const corps = JSON.stringify(bilan);
  const horodatage = horodatageSignature(new Date(maintenantMs));
  return new Response(corps, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Axionia-Timestamp": horodatage,
      "X-Axionia-Signature": signerCorps(secretEmission, horodatage, corps),
      [ENTETE_KID]: kidDe(secretEmission),
    },
  });
}
