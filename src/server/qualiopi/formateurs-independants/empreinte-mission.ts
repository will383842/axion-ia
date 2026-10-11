/**
 * EMPREINTE d'une mission (lot L11c, 08b §3.1, T9) — module PUR.
 *
 * Le SHA-256 des seuls faits CONTRACTUELS de la lettre de mission : intitulé,
 * chaque journée avec ses horaires, lieu (adresse, code postal, ville) ou
 * « à distance », tarif et forfait figés, régime de TVA figé, rôle, version du
 * contrat-cadre et version du gabarit de la lettre. Rangée dans
 * `DocumentGenere.metadata.empreinteMission` à l'émission ; recalculée par le
 * moteur. Différente : la lettre est PÉRIMÉE.
 *
 * 🔑 Une donnée NON contractuelle (salle, contact sur place, effectif) ne la
 * change pas : elle n'est pas dans la lettre, elle ne la périme pas.
 */

import { createHash } from "node:crypto";

export interface FaitsEmpreinte {
  readonly intitule: string;
  readonly jours: ReadonlyArray<{ date: string; heureDebut: string; heureFin: string }>;
  readonly distanciel: boolean;
  readonly adresse: string | null;
  readonly codePostal: string | null;
  readonly ville: string | null;
  readonly tarifHtCents: number | null;
  readonly forfaitDeplacementParJourHtCents: number | null;
  readonly regimeTva: string | null;
  readonly role: string;
  readonly versionContratCadre: number | null;
  readonly gabaritVersion: number;
}

const net = (x: string | null): string | null => {
  const t = (x ?? "").trim().replace(/\s+/g, " ");
  return t === "" ? null : t;
};

export function empreinteMission(f: FaitsEmpreinte): string {
  const jours = [...f.jours]
    .map((j) => [j.date, j.heureDebut, j.heureFin] as const)
    .sort((a, b) => (a.join() < b.join() ? -1 : a.join() > b.join() ? 1 : 0));
  const canon = JSON.stringify({
    v: 1,
    intitule: net(f.intitule),
    jours,
    lieu: f.distanciel ? "distanciel" : [net(f.adresse), net(f.codePostal), net(f.ville)],
    tarif: f.tarifHtCents,
    // « Compris » s'écrit 0 ou rien : une seule écriture dans l'empreinte.
    forfait: f.distanciel ? 0 : (f.forfaitDeplacementParJourHtCents ?? 0),
    tva: f.regimeTva,
    role: f.role,
    contrat: f.versionContratCadre,
    gabarit: f.gabaritVersion,
  });
  return createHash("sha256").update(canon).digest("hex");
}

/** L'empreinte rangée dans les métadonnées d'une lettre, ou `null`. */
export function empreinteDeMetadata(metadata: unknown): string | null {
  if (metadata === null || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const e = (metadata as Record<string, unknown>).empreinteMission;
  return typeof e === "string" && /^[0-9a-f]{64}$/.test(e) ? e : null;
}
