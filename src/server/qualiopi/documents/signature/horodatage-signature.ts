/**
 * Horodatage RFC 3161 d'une signature de devis — suivi et réessais (lot 4 bis).
 *
 * 🔴 La signature NE DÉPEND JAMAIS de l'horodatage. La ligne `document_signature_horodatages` naît
 * `en_attente` dans la transaction de la signature ; on tente un premier jeton aussitôt (sans
 * bloquer le client), et le balayage du worker reprend toutes les 5 minutes ce qui n'a pas abouti.
 * Autorité injoignable, coupée, ou réponse invalide : la ligne reste `en_attente`, l'erreur est
 * notée (texte court, jamais de détail réseau), l'essai suivant s'espace — SANS plafond d'essais :
 * jamais de blocage définitif, un jeton tardif vaut mieux que pas de jeton. Un jeton obtenu est
 * définitif (déclencheur SQL).
 *
 * L'empreinte horodatée est le `selfHash` de la signature : elle porte, par construction, le
 * choix, l'empreinte des CGV, la déclaration du signataire et le code vérifié.
 */

import * as Sentry from "@sentry/nextjs";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  configurationTsa,
  demanderJeton,
  ErreurHorodatage,
  type JetonObtenu,
} from "./horodatage-rfc3161";

/** 5 min, 10, 20… plafonné à 6 h : l'autorité n'est jamais martelée. */
const BASE_MS = 5 * 60 * 1000;
const PLAFOND_MS = 6 * 60 * 60 * 1000;
/** Bail pris pendant un essai : deux passages ne demandent pas deux jetons. */
const BAIL_MS = 10 * 60 * 1000;
/** Une alerte, une seule, quand une signature attend son jeton depuis ~1 jour. */
const ESSAIS_ALERTE = 14;

export function delaiAvantEssai(essais: number): number {
  return Math.min(PLAFOND_MS, BASE_MS * 2 ** Math.max(0, Math.min(essais - 1, 20)));
}

export type IssueHorodatage = "obtenu" | "en_attente" | "coupe" | "pas_du" | "inconnu";

type Fetcher = NonNullable<Parameters<typeof demanderJeton>[0]["fetcher"]>;

export interface OptionsHorodatage {
  readonly maintenant?: Date;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly fetcher?: Fetcher;
}

function messageSur(err: unknown): string {
  // Seules nos propres erreurs (déjà sans détail réseau) sont recopiées.
  return (err instanceof ErreurHorodatage ? err.message : "erreur inattendue").slice(0, 200);
}

/** Tente d'obtenir le jeton d'UNE ligne, si son heure est venue. Ne lève jamais. */
export async function horodaterLigne(
  horodatageId: string,
  options: OptionsHorodatage = {},
): Promise<IssueHorodatage> {
  const maintenant = options.maintenant ?? new Date();
  try {
    const { url } = configurationTsa(options.env ?? process.env);
    if (url === null) return "coupe";

    // Bail : seule la requête qui gagne cette écriture demande un jeton.
    const pris = await prisma.documentSignatureHorodatage.updateMany({
      where: { id: horodatageId, statut: "en_attente", prochainEssaiAt: { lte: maintenant } },
      data: {
        dernierEssaiAt: maintenant,
        essais: { increment: 1 },
        prochainEssaiAt: new Date(maintenant.getTime() + BAIL_MS),
      },
    });
    if (pris.count === 0) return "pas_du";

    const ligne = await prisma.documentSignatureHorodatage.findUnique({
      where: { id: horodatageId },
      select: { empreinteSha256: true, essais: true },
    });
    if (ligne === null) return "inconnu";

    let jeton: JetonObtenu;
    try {
      jeton = await demanderJeton({
        empreinteHex: ligne.empreinteSha256,
        url,
        maintenant,
        ...(options.fetcher === undefined ? {} : { fetcher: options.fetcher }),
      });
    } catch (err) {
      await prisma.documentSignatureHorodatage.updateMany({
        where: { id: horodatageId, statut: "en_attente" },
        data: {
          derniereErreur: messageSur(err),
          prochainEssaiAt: new Date(maintenant.getTime() + delaiAvantEssai(ligne.essais)),
        },
      });
      if (ligne.essais === ESSAIS_ALERTE) {
        Sentry.captureMessage(
          "Horodatage RFC 3161 : une signature attend son jeton depuis longtemps",
          {
            level: "warning",
            tags: { action: "horodatage-signature:attente_longue" },
            extra: { horodatageId, essais: ligne.essais },
          },
        );
      }
      return "en_attente";
    }

    const ecrit = await prisma.documentSignatureHorodatage.updateMany({
      where: { id: horodatageId, statut: "en_attente" },
      data: {
        statut: "obtenu",
        jeton: jeton.jeton,
        jetonSha256: createHash("sha256").update(jeton.jeton).digest("hex"),
        horodateAt: jeton.genTime,
        autorite: jeton.autorite,
        derniereErreur: null,
      },
    });
    return ecrit.count === 1 ? "obtenu" : "pas_du";
  } catch (err) {
    // La base elle-même est en panne : rien à écrire, le balayage reprendra.
    Sentry.captureException(err, { tags: { action: "horodatage-signature:ligne" } });
    return "en_attente";
  }
}

/** Premier essai, juste après la signature : la ligne est retrouvée par sa signature. */
export async function horodaterSignature(
  signatureId: string,
  options: OptionsHorodatage = {},
): Promise<IssueHorodatage> {
  try {
    const ligne = await prisma.documentSignatureHorodatage.findUnique({
      where: { signatureId },
      select: { id: true },
    });
    if (ligne === null) return "inconnu";
    return await horodaterLigne(ligne.id, options);
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "horodatage-signature:signature" } });
    return "en_attente";
  }
}

/** Prisma : table (P2021) ou colonne (P2022) inexistante — la migration n'est pas encore passée. */
function tableAbsente(err: unknown): boolean {
  const code = (err as { code?: unknown } | null)?.code;
  return code === "P2021" || code === "P2022";
}

export interface BilanHorodatages {
  readonly tentes: number;
  readonly obtenus: number;
  readonly enAttente: number;
}

/** Le balayage du worker : reprend les lignes dont l'heure est venue. Ne lève jamais. */
export async function passerHorodatages(
  options: OptionsHorodatage & { readonly limite?: number } = {},
): Promise<BilanHorodatages> {
  const maintenant = options.maintenant ?? new Date();
  const bilan = { tentes: 0, obtenus: 0, enAttente: 0 };
  let dues: { id: string }[];
  try {
    dues = await prisma.documentSignatureHorodatage.findMany({
      where: { statut: "en_attente", prochainEssaiAt: { lte: maintenant } },
      orderBy: { prochainEssaiAt: "asc" },
      take: options.limite ?? 20,
      select: { id: true },
    });
  } catch (err) {
    // Fenêtre app/worker (AGENTS.md) : le worker est reconstruit ~50 minutes AVANT l'app, dont
    // l'entrypoint joue la migration. Tant que la table n'existe pas, le balayage n'a rien à faire —
    // pas d'alerte toutes les 5 minutes pour un état attendu et transitoire.
    if (tableAbsente(err)) return bilan;
    Sentry.captureException(err, { tags: { action: "horodatage-signature:balayage" } });
    return bilan;
  }
  for (const { id } of dues) {
    const issue = await horodaterLigne(id, { ...options, maintenant });
    if (issue === "coupe") break; // autorité coupée : inutile d'insister sur le reste
    if (issue === "pas_du" || issue === "inconnu") continue;
    bilan.tentes++;
    if (issue === "obtenu") bilan.obtenus++;
    else bilan.enAttente++;
  }
  return bilan;
}
