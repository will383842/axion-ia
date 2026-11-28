/**
 * Quota d'inspection d'URL PARTAGÉ (P5). Google accorde 2 000 inspections par jour et par
 * propriété, et 600 par minute. UN seul compteur Redis par jour du Pacifique
 * (`gsc:inspection:quota:<jour>`, un hash : un champ par usage), trois usages qui ne se mangent
 * pas entre eux : suivi après publication (200), rotation (1 400), console manuelle (400).
 *
 * La réservation est ATOMIQUE (script Lua) : deux workers ne peuvent pas dépasser le plafond.
 * Module sans I/O direct : le magasin est injecté.
 */
export const CLE_QUOTA_PREFIXE = "gsc:inspection:quota:";
export const PLAFOND_JOUR = 2000;
export const QUOTA_PAR_USAGE = { suivi: 200, rotation: 1400, manuel: 400 } as const;
export type UsageQuota = keyof typeof QUOTA_PAR_USAGE;
/** 600 par minute chez Google ; on reste à la moitié (5 appels par seconde). */
export const DEBIT_MAX_PAR_MINUTE = 300;
export const INTERVALLE_MIN_MS = Math.ceil(60_000 / DEBIT_MAX_PAR_MINUTE);

const FORMAT_PACIFIQUE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Los_Angeles",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Le quota de Google se remet à zéro à minuit, heure du Pacifique. */
export function jourPacifique(date: Date): string {
  return FORMAT_PACIFIQUE.format(date);
}

export function cleQuota(jour: string): string {
  return `${CLE_QUOTA_PREFIXE}${jour}`;
}

export interface MagasinQuota {
  /** Réserve jusqu'à `n` appels pour `usage` ; rend le nombre accordé (0 au plafond). */
  reserver(
    cle: string,
    usage: UsageQuota,
    n: number,
    plafondUsage: number,
    plafondTotal: number,
  ): Promise<number>;
}

export async function reserverInspections(
  magasin: MagasinQuota,
  usage: UsageQuota,
  n: number,
  maintenant: Date,
): Promise<number> {
  const demande = Math.floor(n);
  if (!(demande > 0)) return 0;
  return magasin.reserver(
    cleQuota(jourPacifique(maintenant)),
    usage,
    demande,
    QUOTA_PAR_USAGE[usage],
    PLAFOND_JOUR,
  );
}

/**
 * Suivi après publication (existant) : il passe par le MÊME compteur que la rotation. `max` est
 * le plafond que l'appelant s'était fixé ; il ne peut pas dépasser la part du suivi (200).
 */
export async function reserverSuivi(
  magasin: MagasinQuota,
  n: number,
  max: number,
  maintenant: Date,
): Promise<number> {
  const demande = Math.floor(n);
  if (!(demande > 0)) return 0;
  return magasin.reserver(
    cleQuota(jourPacifique(maintenant)),
    "suivi",
    demande,
    Math.min(Math.max(0, Math.floor(max)), QUOTA_PAR_USAGE.suivi),
    PLAFOND_JOUR,
  );
}

const SCRIPT_RESERVER = `
local h = redis.call('HGETALL', KEYS[1])
local total = 0
local deja = 0
for i = 1, #h, 2 do
  local v = tonumber(h[i + 1]) or 0
  total = total + v
  if h[i] == ARGV[1] then deja = v end
end
local n = tonumber(ARGV[2])
local accorde = math.min(n, tonumber(ARGV[3]) - deja, tonumber(ARGV[4]) - total)
if accorde < 0 then accorde = 0 end
if accorde > 0 then
  redis.call('HINCRBY', KEYS[1], ARGV[1], accorde)
  redis.call('EXPIRE', KEYS[1], 172800)
end
return accorde
`;

interface RedisEval {
  eval(script: string, numKeys: number, ...args: Array<string | number>): Promise<unknown>;
}

export function magasinQuotaRedis(redis: RedisEval): MagasinQuota {
  return {
    reserver: async (cle, usage, n, plafondUsage, plafondTotal) => {
      const r = await redis.eval(SCRIPT_RESERVER, 1, cle, usage, n, plafondUsage, plafondTotal);
      return Number(r) || 0;
    },
  };
}
