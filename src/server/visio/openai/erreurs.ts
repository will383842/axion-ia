/**
 * Classes d'erreur du circuit visio (ADR 0055 ; LOTS-EXECUTION §1.4).
 *
 * La classification des erreurs du SDK est celle de content-gen
 * (`mapOpenAiError`), réutilisée TELLE QUELLE : c'est elle qui distingue un
 * 429 « limite de débit » (passager) d'un 429 « crédit épuisé » (définitif
 * tant qu'un humain n'a pas rechargé), deux cas qu'une première version de
 * content-gen confondait (audit du 21/07 et du 01/09).
 *
 *   rate_limited, down, timeout → passagere (reprises espacées)
 *   auth_failed                 → configuration (suspendu + alerte)
 *   quota_exhausted             → quota (TOUT le circuit suspendu + alerte)
 *   cost_cap_reached            → plafond (suspendu jusqu'au 1er du mois)
 *   content_filter              → contenu (un essai de plus, puis échec)
 *
 * Le circuit n'appelle JAMAIS `recordPermanentProviderFailure` ni le kill
 * switch de content-gen : un plafond ou un quota se constate, il ne se
 * déclenche pas d'ici (`un-plafond-atteint-suspend-le-circuit-sans-toucher-au-kill-switch-de-content-gen.spec.ts`).
 */

import type { ClasseErreur, CodeErreurVisio } from "../../../../prisma/generated/client";
import { ProviderError } from "@/server/content-gen/providers/IProvider";
import { mapOpenAiError } from "@/server/content-gen/providers/openai";

/** Une erreur du circuit : une classe (ce qu'on fait) et un code (ce qui s'est passé). */
export class ErreurVisio extends Error {
  constructor(
    readonly classe: ClasseErreur,
    readonly code: CodeErreurVisio,
    message: string,
  ) {
    super(message);
    this.name = "ErreurVisio";
  }
}

/**
 * L'appel à OpenAI a été ANNULÉ par l'arrêt du worker (SIGTERM, V1 F3). Ce
 * n'est pas une erreur du fournisseur : l'étape est relâchée sans compter
 * d'essai. `envoye` dit si la requête était partie (on a pu être facturé :
 * l'estimation est alors inscrite au registre des coûts).
 */
export class AppelInterrompu extends Error {
  constructor(readonly envoye: boolean) {
    super("appel OpenAI annulé par l'arrêt du worker");
    this.name = "AppelInterrompu";
  }
}

const PAR_CODE_FOURNISSEUR: Readonly<
  Record<ProviderError["code"], { classe: ClasseErreur; code: CodeErreurVisio }>
> = {
  rate_limited: { classe: "passagere", code: "limite_debit" },
  down: { classe: "passagere", code: "fournisseur_indisponible" },
  timeout: { classe: "passagere", code: "delai_depasse" },
  auth_failed: { classe: "configuration", code: "authentification_openai" },
  quota_exhausted: { classe: "quota", code: "quota_epuise" },
  cost_cap_reached: { classe: "plafond", code: "plafond_atteint" },
  content_filter: { classe: "contenu", code: "refus_modele" },
  invalid_response: { classe: "contenu", code: "sortie_invalide" },
  unknown: { classe: "passagere", code: "inconnu" },
};

/** Codes Prisma / PostgreSQL d'une base pas encore migrée (§2.5). */
const CODES_SCHEMA_EN_RETARD = new Set(["P2021", "P2022", "22P02", "42703", "42P01"]);

/**
 * Le code d'une erreur de base. Une requête SQL BRUTE (`$executeRaw`,
 * `$queryRaw` : écriture finale, programmation d'une étape) ne lève pas le
 * code PostgreSQL mais `P2010` ; le vrai code (`42703`, `42P01`, `22P02`…) est
 * dans `meta.code` (V1, F2).
 */
function codeDe(err: unknown): string | null {
  if (typeof err !== "object" || err === null) return null;
  const e = err as { code?: unknown; meta?: { code?: unknown } };
  if (e.code === "P2010" && typeof e.meta?.code === "string") return e.meta.code;
  if (typeof e.code === "string") return e.code;
  if (typeof e.meta?.code === "string") return e.meta.code;
  return null;
}

/**
 * Traduit n'importe quelle erreur levée pendant une étape en `ErreurVisio`.
 * Le message n'emporte JAMAIS de parole : seulement le libellé technique.
 */
export function classerErreurOpenAI(err: unknown): ErreurVisio {
  if (err instanceof ErreurVisio) return err;
  const code = codeDe(err);
  if (code !== null && CODES_SCHEMA_EN_RETARD.has(code)) {
    return new ErreurVisio(
      "schema_en_retard",
      "schema_en_retard",
      `base pas encore migrée (${code})`,
    );
  }
  if (
    err instanceof Error &&
    /PII_ENCRYPTION_KEY|\[chiffrer-parole\]|\[pii-crypto\]|unable to authenticate data/.test(
      err.message,
    )
  ) {
    return new ErreurVisio(
      "configuration",
      "cle_chiffrement_absente",
      "clé de chiffrement absente ou différente",
    );
  }
  const fournisseur = err instanceof ProviderError ? err : mapOpenAiError(err);
  const cible = PAR_CODE_FOURNISSEUR[fournisseur.code];
  return new ErreurVisio(cible.classe, cible.code, `OpenAI : ${fournisseur.code}`);
}
