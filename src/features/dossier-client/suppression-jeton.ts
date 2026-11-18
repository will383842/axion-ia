// Le jeton de la DOUBLE VALIDATION de la suppression manuelle (demande de Will du 26/10/2026).
//
// Première validation (bilan + mot EFFACER) → le serveur délivre ce jeton signé, valable 5 minutes,
// lié au type, à la cible, à l'acteur et à une EMPREINTE du bilan. Deuxième validation (recopie du
// numéro de la fiche ou du code de contrôle) → le serveur relit le jeton, puis recalcule le bilan
// dans la transaction : si ce qui serait supprimé a changé entre les deux, rien n'est supprimé.
//
// Module pur : `node:crypto` seulement, ni base ni `next/*`.

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import type { TypeCible } from "./suppression-manuelle";

export const DUREE_JETON_SUPPRESSION_MS = 5 * 60_000;

const DOMAINE = "suppression-manuelle:v1\n";
const FORME = /^[A-Za-z0-9_-]{1,800}\.[A-Za-z0-9_-]{43}$/;
const TYPES: ReadonlyArray<string> = ["questionnaire", "rencontre", "client", "personne"];

/** Les cibles d'un jeton : celles de la suppression manuelle, et une PERSONNE retirée d'une fiche. */
export type TypeJeton = TypeCible | "personne";

export interface ContenuJeton {
  readonly t: TypeJeton;
  /** La cible. */
  readonly i: string;
  /** L'acteur (super-administrateur). */
  readonly a: string;
  /** L'empreinte du bilan relu à la première validation. */
  readonly b: string;
  /** L'échéance, en millisecondes. */
  readonly e: number;
}

/** La clé HMAC, ou `null` si la production n'a pas de secret (aucune suppression possible). */
function cle(): Buffer | null {
  const secret = process.env["AUTH_SECRET"];
  if (secret && secret.length > 0) {
    return createHash("sha256").update(`axion-suppression-manuelle|${secret}`).digest();
  }
  if (process.env.NODE_ENV === "production") return null;
  return createHash("sha256").update("axion-suppression-manuelle|dev").digest();
}

const signer = (k: Buffer, corps: string): string =>
  createHmac("sha256", k).update(`${DOMAINE}${corps}`).digest("base64url");

/** Ce qui serait supprimé, résumé : change dès qu'un compteur change. */
export function empreinteBilan(b: {
  readonly type: string;
  readonly id: string;
  readonly compteurs: ReadonlyArray<{ readonly libelle: string; readonly n: number }>;
}): string {
  const lignes = b.compteurs.map((c) => [c.libelle, c.n] as const).sort();
  return createHash("sha256")
    .update(JSON.stringify([b.type, b.id, lignes]))
    .digest("base64url")
    .slice(0, 22);
}

export function creerJetonSuppression(
  c: {
    readonly type: TypeJeton;
    readonly id: string;
    readonly acteurId: string;
    readonly empreinte: string;
  },
  maintenant: number = Date.now(),
): string | null {
  const k = cle();
  if (k === null) return null;
  const contenu: ContenuJeton = {
    t: c.type,
    i: c.id,
    a: c.acteurId,
    b: c.empreinte,
    e: maintenant + DUREE_JETON_SUPPRESSION_MS,
  };
  const corps = Buffer.from(JSON.stringify(contenu)).toString("base64url");
  return `${corps}.${signer(k, corps)}`;
}

export const MOTIF_JETON_INVALIDE =
  "Confirmation invalide : recommencez depuis le début (mot EFFACER).";

export function lireJetonSuppression(
  jeton: string,
  maintenant: number = Date.now(),
):
  | { readonly ok: true; readonly contenu: ContenuJeton }
  | { readonly ok: false; readonly motif: string } {
  const k = cle();
  if (k === null) {
    return {
      ok: false,
      motif: "Suppression indisponible : la clé de signature manque sur le serveur.",
    };
  }
  if (!FORME.test(jeton)) return { ok: false, motif: MOTIF_JETON_INVALIDE };
  const [corps = "", signature = ""] = jeton.split(".");
  const attendue = Buffer.from(signer(k, corps));
  const recue = Buffer.from(signature);
  if (attendue.length !== recue.length || !timingSafeEqual(attendue, recue)) {
    return { ok: false, motif: MOTIF_JETON_INVALIDE };
  }
  let brut: unknown;
  try {
    brut = JSON.parse(Buffer.from(corps, "base64url").toString("utf8"));
  } catch {
    return { ok: false, motif: MOTIF_JETON_INVALIDE };
  }
  const o = brut as Partial<Record<keyof ContenuJeton, unknown>> | null;
  if (
    o === null ||
    typeof o !== "object" ||
    typeof o.t !== "string" ||
    !TYPES.includes(o.t) ||
    typeof o.i !== "string" ||
    typeof o.a !== "string" ||
    typeof o.b !== "string" ||
    typeof o.e !== "number"
  ) {
    return { ok: false, motif: MOTIF_JETON_INVALIDE };
  }
  if (o.e <= maintenant) {
    return { ok: false, motif: "La première validation a expiré (5 minutes) : recommencez." };
  }
  return {
    ok: true,
    contenu: { t: o.t as TypeJeton, i: o.i, a: o.a, b: o.b, e: o.e },
  };
}

/** Pour comparer ce que Will a recopié au code attendu : casse et espaces ne comptent pas. */
export const normaliserCode = (s: string): string => s.trim().toUpperCase().replace(/\s+/g, "");
