import {
  construireCarte,
  normaliserUrl,
  type EntreeCarte,
} from "@/server/content-gen/strategie/carte-requetes";
import { construireCourbeCtr } from "./courbe-ctr";
import {
  detecterCannibalisation,
  detecterCtrAnormal,
  detecterDeclin,
  detecterJamaisAffichee,
  detecterQuasiGagnante,
  detecterRequeteSansPage,
  type HistoriqueRequete,
  type PageDeclin,
  type PageVue,
  type TendanceSite,
} from "./detecteurs";
import { appliquerGardeFous } from "./garde-fous";
import type { OptionsIntention } from "./intention";
import { classer } from "./score";
import type { LigneRequete, Proposition, Signalement, Sortie, TypePage } from "./types";

export interface EntreeAnalyse {
  readonly lignes: readonly LigneRequete[];
  readonly historiques: readonly HistoriqueRequete[];
  readonly declin: readonly PageDeclin[];
  readonly pages: readonly PageVue[];
  readonly site: TendanceSite;
  readonly intention?: OptionsIntention;
  /** Page qui répond à l'intention d'une requête, si elle existe. Par défaut : aucune. */
  readonly trouverPageCible?: (requete: string, types: readonly TypePage[]) => string | null;
}

/** Point d'entrée unique : six détecteurs, garde-fous, score, tri. Pur et déterministe. */
export function analyser(e: EntreeAnalyse): Sortie {
  const entreesCarte: EntreeCarte[] = e.lignes.map((l) => ({
    requete: l.requete,
    url: l.url,
    source: "gsc",
    position: l.position,
    impressions: l.impressions,
  }));
  const carte = construireCarte(entreesCarte);
  const proprietaire = (r: string) => carte.proprietaire(r);

  const propositions: Proposition[] = [
    ...detecterQuasiGagnante(e.lignes, {
      proprietaire,
      ...(e.intention ? { intention: e.intention } : {}),
    }),
    ...detecterCtrAnormal(e.lignes, { courbe: construireCourbeCtr(e.lignes) }),
    ...detecterRequeteSansPage(e.lignes, {
      trouverPageCible: e.trouverPageCible ?? (() => null),
      ...(e.intention ? { intention: e.intention } : {}),
    }),
  ];
  const signalements: Signalement[] = [];
  for (const s of [
    detecterCannibalisation(e.historiques, { proprietaire }),
    detecterDeclin(e.declin, { site: e.site }),
    detecterJamaisAffichee(e.pages),
  ]) {
    propositions.push(...s.propositions);
    signalements.push(...s.signalements);
  }

  // Une même (page, requête, action) vue par plusieurs détecteurs n'est comptée qu'une fois.
  const meilleures = new Map<string, Proposition>();
  for (const p of propositions) {
    const k = `${normaliserUrl(p.url) || p.url}|${(p.requete ?? "").toLowerCase()}|${p.action}|${normaliserUrl(p.pageCible ?? "")}`;
    const deja = meilleures.get(k);
    if (!deja || p.priorite > deja.priorite) meilleures.set(k, p);
  }
  const filtre = appliquerGardeFous([...meilleures.values()], signalements);
  return {
    propositions: classer(filtre.propositions),
    signalements: [...filtre.signalements].sort(
      (a, b) =>
        a.url.localeCompare(b.url) ||
        a.kind.localeCompare(b.kind) ||
        (a.requete ?? "").localeCompare(b.requete ?? ""),
    ),
  };
}
