/** Faux Redis minimal (SET … EX, MGET, NX) à horloge injectable, partageable entre « processus ». */
export interface FauxRedis {
  set(cle: string, v: string, mode: "EX", s: number, nx?: "NX"): Promise<"OK" | null>;
  mget(...cles: string[]): Promise<Array<string | null>>;
  del(...cles: string[]): Promise<number>;
  readonly ttls: Map<string, number>;
  panne: boolean;
  vider(): void;
  lectures: string[][];
}

export function creerFauxRedis(now: () => number = Date.now): FauxRedis {
  const donnees = new Map<string, { v: string; fin: number }>();
  const ttls = new Map<string, number>();
  const vivant = (c: string): string | null => {
    const e = donnees.get(c);
    if (!e) return null;
    if (now() >= e.fin) {
      donnees.delete(c);
      return null;
    }
    return e.v;
  };
  const r: FauxRedis = {
    panne: false,
    vider() {
      donnees.clear();
      ttls.clear();
      r.lectures.length = 0;
      r.panne = false;
    },
    ttls,
    lectures: [],
    async set(cle, v, _mode, s, nx) {
      if (r.panne) throw new Error("ECONNREFUSED redis://:motdepasse@hote");
      if (nx === "NX" && vivant(cle) !== null) return null;
      donnees.set(cle, { v, fin: now() + s * 1000 });
      ttls.set(cle, s);
      return "OK";
    },
    async mget(...cles) {
      if (r.panne) throw new Error("ECONNREFUSED redis://:motdepasse@hote");
      r.lectures.push(cles);
      return cles.map(vivant);
    },
    async del(...cles) {
      if (r.panne) throw new Error("ECONNREFUSED");
      let n = 0;
      for (const c of cles) if (donnees.delete(c)) n++;
      return n;
    },
  };
  return r;
}
