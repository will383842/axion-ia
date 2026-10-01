/**
 * ⛔ UN APPEL D'UNE HEURE SOUS LIMITE DE DÉBIT FINIT SA TRANSCRIPTION (V2, M1).
 *
 * Une heure d'appel = 2 pistes × 20 tranches = 40 appels de transcription. Au
 * palier 1 (≈ 10 000 jetons/min, ≈ 7 000 par tranche), le 2ᵉ appel de la même
 * minute prend un 429 « limite de débit ». Avant : ce 429 faisait échouer TOUTE
 * l'étape, l'échelle de reprises (5 min … 72 h) se comptait depuis le premier
 * échec sans repartir quand des tranches avaient avancé, et le plafond de 10
 * exécutions imputées tombait avant la 40ᵉ tranche : l'appel n'était jamais
 * transcrit.
 *
 * Désormais :
 *   · un 429 « limite de débit » fait ATTENDRE (`retry-after`, borné) puis
 *     réessayer la MÊME tranche, jusqu'à 3 fois, dans la même exécution ;
 *   · une exécution qui a transcrit au moins une tranche avant d'échouer en
 *     passagère repart sur une échelle NEUVE (`echecs = 0`) et n'est pas
 *     imputée au plafond : elle a avancé.
 *
 * Mutations qui rougissent : retirer la boucle de réessai (1er cas : l'étape
 * échoue au 2ᵉ appel) ; ignorer `noterProgres` dans `traiterErreur` (2ᵉ cas :
 * échec définitif ou plafond avant la fin). Contre-témoin : une exécution qui
 * n'a RIEN transcrit continue l'échelle (3ᵉ cas).
 */

import OpenAI from "openai";
import { describe, expect, it } from "vitest";

import { executerEtape } from "../etapes";
import { classerErreurOpenAI, ErreurVisio } from "../openai/erreurs";
import type { TrancheATraiter } from "../port-donnees";
import { transcrire } from "../recevoir-transcription";
import { depsDeTest, FauxDepot } from "../../../../tests/outils/faux-circuit-visio";
import { fauxClient } from "../../../../tests/outils/faux-openai-visio";
import { enregistrement, portTranscription, T0 } from "./outils-pipeline";

const RENCONTRE = "00000000-0000-4000-8000-0000000000f1";
const vide = { text: "", segments: [] };
const limite = () => new ErreurVisio("passagere", "limite_debit", "OpenAI : rate_limited", 2_000);

function uneHeure() {
  const tranches: TrancheATraiter[] = [];
  for (const piste of ["client", "axion"] as const) {
    for (let n = 0; n < 20; n++) {
      tranches.push({
        id: `${piste}-${n}`,
        piste,
        numero: n,
        debutCaptureEpochMs: T0.getTime() + n * 180_000,
        dureeMs: 180_000,
        niveauFinMuet: true,
        statut: "complete",
        empreinteAnnoncee: "x",
      });
    }
  }
  return enregistrement({ fin: new Date(T0.getTime() + 3_600_000), tranches });
}

/** Un `aTranscrire` qui suit les tranches écrites (une tranche faite n'est pas refaite). */
function portQuiAvance() {
  const e = uneHeure();
  const p = portTranscription(e);
  const faites = new Set<string>();
  p.port.aTranscrire = async () => [
    {
      ...e,
      tranches: e.tranches.map((t) => (faites.has(t.id) ? { ...t, statut: "transcrite" } : t)),
    },
  ];
  const ecrire = p.port.ecrireSegmentsTranche!;
  p.port.ecrireSegmentsTranche = async (tx, a) => {
    faites.add(a.trancheId);
    return ecrire(tx, a);
  };
  return { ...p, faites };
}

describe("un appel d'une heure sous limite de débit finit sa transcription", () => {
  it("un 429 sur deux : la même tranche est réessayée après le délai, l'étape réussit d'une traite", async () => {
    const depot = new FauxDepot();
    const t = depot.ajouter({ rencontreId: RENCONTRE, etape: "transcrire" });
    const { port, faites } = portQuiAvance();
    const reponses: unknown[] = [];
    for (let i = 0; i < 40; i++) reponses.push(vide, limite());
    // La dernière tranche réussit ; le 429 final n'est jamais consommé.
    const f = fauxClient(undefined, { transcriptions: reponses });
    const attentes: number[] = [];
    const deps = {
      ...depsDeTest({ depot, client: f.client, donnees: port, gestionnaires: { transcrire } }),
      attendre: async (ms: number) => {
        attentes.push(ms);
      },
    };
    expect(await executerEtape(deps, t.id)).toBe("reussie");
    expect(faites.size).toBe(40);
    expect(attentes.length).toBe(39);
    expect(attentes.every((ms) => ms === 2_000)).toBe(true);
  });

  it("des 429 en rafale : chaque exécution qui avance repart sur une échelle neuve, sans plafond", async () => {
    const depot = new FauxDepot();
    const t = depot.ajouter({ rencontreId: RENCONTRE, etape: "transcrire" });
    const { port, faites } = portQuiAvance();
    // Une tranche passe, puis quatre 429 (au-delà des 3 réessais) : l'exécution échoue.
    const reponses: unknown[] = [];
    for (let i = 0; i < 40; i++) reponses.push(vide, limite(), limite(), limite(), limite());
    const f = fauxClient(undefined, { transcriptions: reponses });
    const deps = {
      ...depsDeTest({ depot, client: f.client, donnees: port, gestionnaires: { transcrire } }),
      attendre: async () => undefined,
    };
    let issue = "";
    for (let essai = 0; essai < 60 && issue !== "reussie"; essai++) {
      depot.ligne(t.id).prochaineTentativeLe = null;
      issue = await executerEtape(deps, t.id);
      expect(issue).not.toBe("echec_definitif");
      if (issue === "a_reessayer") {
        expect(depot.ligne(t.id)).toMatchObject({ echecs: 0, statut: "a_faire" });
      }
    }
    expect(issue).toBe("reussie");
    expect(faites.size).toBe(40);
  });

  it("contre-témoin : une exécution qui n'a rien transcrit continue l'échelle", async () => {
    const depot = new FauxDepot();
    const t = depot.ajouter({ rencontreId: RENCONTRE, etape: "transcrire" });
    const { port } = portQuiAvance();
    const f = fauxClient(undefined, {
      transcriptions: [limite(), limite(), limite(), limite()],
    });
    const deps = {
      ...depsDeTest({ depot, client: f.client, donnees: port, gestionnaires: { transcrire } }),
      attendre: async () => undefined,
    };
    expect(await executerEtape(deps, t.id)).toBe("a_reessayer");
    expect(depot.ligne(t.id)).toMatchObject({ echecs: 1, interruptions: 0 });
  });

  it("le délai vient de l'en-tête retry-after d'un 429 d'OpenAI", () => {
    const err = new OpenAI.RateLimitError(
      429,
      { message: "Rate limit reached", type: "requests", code: "rate_limit_exceeded" },
      "Rate limit reached",
      { "retry-after": "7" },
    );
    const e = classerErreurOpenAI(err);
    expect(e.code).toBe("limite_debit");
    expect(e.reessayerApresMs).toBe(7_000);
  });
});
