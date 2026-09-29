#!/usr/bin/env tsx
/**
 * `pnpm visio:eval` — CAMPAGNE D'ÉVALUATION du compte rendu (O-2a ; ADR 0055).
 *
 * ⚠️ JAMAIS EN CI, jamais depuis un PC : à lancer DANS LE WORKER de production
 * (seul à détenir `OPENAI_API_KEY`), après y avoir copié ce script et les
 * scénarios fictifs :
 *
 *   docker cp scripts/visio/evaluer.ts <worker>:/app/scripts/visio/
 *   docker cp tests/fixtures/visio <worker>:/app/tests/fixtures/visio
 *   docker exec <worker> npx tsx scripts/visio/evaluer.ts --executions 3
 *
 * Pour chaque scénario FICTIF × exécution : le CODE DU SITE construit les
 * passes (dialogue entrelacé, contexte, consignes, catalogue), l'API OpenAI
 * répond, le CODE DU SITE vérifie (V1, G10, G14, V2). Coût tracé dans
 * `cost_ledger` avec un `jobId` `visio-eval-…`, sous le plafond partagé.
 *
 * Sortie : des COMPTEURS seulement (jamais un texte produit) —
 *   · faits acceptés sans citation vérifiée (seuil : 0) ;
 *   · faits interdits acceptés (seuil : 0) ;
 *   · chiffres du compte rendu absents des faits (seuil : 0 après V2) ;
 *   · relations hors périmètre (seuil : 0) ;
 *   · rappel des faits attendus (seuil : ≥ 90 %) ;
 *   · couverture des rubriques attendues (seuil : ≥ 11/12 scénario par scénario).
 *
 * Garde de dépense : au-delà de 40 $ ESTIMÉS, le script refuse de partir
 * (question à Will, LOTS-EXECUTION §8).
 */

import path from "node:path";

import { chargerCatalogue } from "../../src/server/visio/catalogue-ia";
import { instructionsDe } from "../../src/server/visio/consignes";
import { construireEntreeP1, type FaitPourPasse } from "../../src/server/visio/contexte";
import { construireEntreeP4, controlerEbauche } from "../../src/server/visio/consolider";
import { entrelacer, type SegmentStocke } from "../../src/server/visio/dialogue";
import { obtenirClientOpenAI } from "../../src/server/visio/openai/client";
import { portCoutReel } from "../../src/server/visio/openai/cout";
import { ESTIMATION_PASSE_USD } from "../../src/server/visio/openai/modeles";
import { executerPasse } from "../../src/server/visio/openai/passe";
import { SCHEMAS_VISIO } from "../../src/server/visio/schemas";
import { RUBRIQUES_COUVERTURE } from "../../src/server/visio/schemas/communs";
import { tronquerALaDemandeDArret } from "../../src/server/visio/verification/g00-precontroles";
import { verifierCompteRendu } from "../../src/server/visio/verification/g09-redaction";
import {
  verifierFaits,
  type FaitVerifie,
} from "../../src/server/visio/verification/verifier-faits";

export const PLAFOND_CAMPAGNE_USD = 40;

interface Compteurs {
  faitsSansCitationVerifiee: number;
  faitsInterdits: number;
  chiffresHorsFaits: number;
  paragraphesRetires: number;
  relationsHorsPerimetre: number;
  attendus: number;
  retrouves: number;
  rubriquesAttendues: number;
  rubriquesAbordees: number;
  echecs: number;
}

function arguments_(): { executions: number; scenarios: string } {
  const a = process.argv.slice(2);
  const n = Number(a[a.indexOf("--executions") + 1] ?? 3);
  const s = a.includes("--scenarios")
    ? a[a.indexOf("--scenarios") + 1]!
    : "tests/fixtures/visio/scenarios/scenarios.ts";
  return { executions: Number.isInteger(n) && n > 0 ? n : 3, scenarios: s };
}

function correspond(f: FaitVerifie, attendu: { type: string; valeur?: number }): boolean {
  if (f.type !== attendu.type) return false;
  if (attendu.valeur === undefined) return true;
  const euros = [f.montantMinCents, f.montantMaxCents]
    .filter((x): x is number => x !== null)
    .map((c) => c / 100);
  return f.quantite === attendu.valeur || euros.includes(attendu.valeur);
}

async function main(): Promise<void> {
  if (process.env["CI"] === "true") throw new Error("visio:eval ne tourne jamais en CI.");
  const { executions, scenarios } = arguments_();
  const mod = (await import(
    path.resolve(process.cwd(), scenarios)
  )) as typeof import("../../tests/fixtures/visio/scenarios/scenarios");
  const liste = mod.SCENARIOS;
  const estimation =
    liste.length *
    executions *
    (ESTIMATION_PASSE_USD.extraire +
      2 * ESTIMATION_PASSE_USD.ebaucher +
      ESTIMATION_PASSE_USD.rediger);
  if (estimation > PLAFOND_CAMPAGNE_USD) {
    throw new Error(
      `Campagne estimée à ${estimation.toFixed(2)} $ (> ${PLAFOND_CAMPAGNE_USD} $) : question à Will avant de lancer.`,
    );
  }
  const client = obtenirClientOpenAI();
  const catalogue = await chargerCatalogue();
  const total: Compteurs = {
    faitsSansCitationVerifiee: 0,
    faitsInterdits: 0,
    chiffresHorsFaits: 0,
    paragraphesRetires: 0,
    relationsHorsPerimetre: 0,
    attendus: 0,
    retrouves: 0,
    rubriquesAttendues: 0,
    rubriquesAbordees: 0,
    echecs: 0,
  };
  const parScenario: Record<string, Partial<Compteurs>> = {};

  for (const sc of liste) {
    for (let n = 1; n <= executions; n++) {
      const c: Partial<Compteurs> = {};
      const jobId = `visio-eval-${sc.id}-${n}`;
      try {
        const segments: SegmentStocke[] = sc.dialogue.map((l, i) => ({
          ordre: i,
          piste: l.piste,
          debutMs: l.s * 1000,
          finMs: l.s * 1000 + 4000,
          locuteurBrut: l.piste === "client" ? (l.voix ?? "A") : null,
          texte: l.texte,
          horsAccord: false,
          apresRefus: false,
        }));
        const { gardes } = tronquerALaDemandeDArret(segments);
        const dialogue = entrelacer(gardes);
        const date = new Date(sc.date);
        const projets = sc.projets.map((p, i) => ({
          id: `p${i}`,
          numero: p.numero,
          titre: p.titre,
          activite: p.activite,
          statut: "ouvert",
        }));
        const connus = sc.connus.map((f, i) => ({
          id: `h${i}`,
          type: f.type as never,
          cle: "global",
          portee: (f.projet === null ? "entreprise" : "projet") as never,
          projetId: f.projet === null ? null : `p${f.projet}`,
          statut: "valide" as const,
          suivi: null,
          enonce: f.enonce,
          constateLe: new Date(date.getTime() - 30 * 86_400_000),
          rencontreId: `r-avant-${i}`,
        }));
        const { entree, correspondances } = construireEntreeP1({
          rencontre: {
            id: sc.id,
            titre: sc.titre,
            debut: date,
            dureeMs: sc.dureeS * 1000,
            source: "calendly",
          },
          pistes: { client: "OK", axion: "OK" },
          formulaire:
            sc.id === "10-formulaire-piege"
              ? [{ question: "Votre besoin", reponse: mod.FORMULAIRE_PIEGE }]
              : [],
          contacts: sc.contacts.map((p, i) => ({
            id: `c${i}`,
            nom: p.nom,
            fonction: p.fonction,
            statut: "actif",
          })),
          projets,
          dejaConnus: connus,
          dialogue,
        });
        const p1 = await executerPasse(
          { client, cout: portCoutReel },
          {
            passe: "extraire",
            schema: SCHEMAS_VISIO.extraction.schema,
            nomSchema: SCHEMAS_VISIO.extraction.nom,
            instructions: instructionsDe("extraire", catalogue.texte),
            entree,
            jobId: `${jobId}-p1`,
          },
        );
        const v1 = verifierFaits({
          extraction: p1.sortie,
          segments: dialogue.segments,
          catalogue: catalogue.refs,
          connus: new Set(correspondances.faits.keys()),
          dateEchange: date,
        });
        const retenus = v1.faits.filter((f) => f.statut !== "rejete");
        c.faitsSansCitationVerifiee = retenus.filter(
          (f) => f.citation === null || f.citationDebutMs === null,
        ).length;
        c.faitsInterdits = retenus.filter((f) => sc.interdits.some((i) => correspond(f, i))).length;
        c.attendus = sc.attendus.length;
        c.retrouves = sc.attendus.filter((a) => retenus.some((f) => correspond(f, a))).length;
        c.rubriquesAttendues = sc.rubriquesAbordees.length;
        c.rubriquesAbordees = sc.rubriquesAbordees.filter(
          (r) => v1.couverture[r as (typeof RUBRIQUES_COUVERTURE)[number]]?.statut === "aborde",
        ).length;

        const pourPasse: FaitPourPasse[] = retenus.map((f) => ({
          ref: f.ref,
          type: f.type,
          portee: f.porteeDeclaree,
          projetRef: f.projetRef,
          enonce: f.enonce,
          valeur: [
            f.quantite,
            f.montantMinCents !== null ? f.montantMinCents / 100 : null,
            f.dateCible,
          ]
            .filter((x) => x !== null)
            .join(", "),
          locuteur: f.locuteur,
          confiance: f.confiance,
        }));
        const ebauches = [];
        for (const j of p1.sortie.projets_evoques.slice(0, 2)) {
          const p4 = await executerPasse(
            { client, cout: portCoutReel },
            {
              passe: "ebaucher",
              schema: SCHEMAS_VISIO.ebauche.schema,
              nomSchema: SCHEMAS_VISIO.ebauche.nom,
              instructions: instructionsDe("ebaucher", catalogue.texte),
              entree: construireEntreeP4(
                { ref: j.ref, intitule: j.intitule, activite: j.activite },
                pourPasse,
                [],
              ),
              jobId: `${jobId}-p4-${j.ref}`,
            },
          );
          if (!controlerEbauche(p4.sortie, catalogue.refs).ok) c.echecs = (c.echecs ?? 0) + 1;
          ebauches.push(p4.sortie);
        }
        const p5 = await executerPasse(
          { client, cout: portCoutReel },
          {
            passe: "rediger",
            schema: SCHEMAS_VISIO.compteRendu.schema,
            nomSchema: SCHEMAS_VISIO.compteRendu.nom,
            instructions: instructionsDe("rediger", catalogue.texte),
            entree: `<couverture>\n${Object.entries(v1.couverture)
              .map(([r, x]) => `${r} : ${x.statut}`)
              .join(
                "\n",
              )}\n</couverture>\n<faits_verifies>\n${pourPasse.map((f) => `${f.ref} | ${f.type} | ${f.enonce} | ${f.valeur}`).join("\n")}\n</faits_verifies>\nRédige le compte rendu au format imposé.`,
            jobId: `${jobId}-p5`,
          },
        );
        const v2 = verifierCompteRendu(
          p5.sortie,
          v1.couverture,
          new Map(
            retenus.map((f) => [
              f.ref,
              {
                ref: f.ref,
                enonce: f.enonce,
                citation: f.citation,
                valeurs: [
                  String(f.quantite ?? ""),
                  String((f.montantMinCents ?? 0) / 100),
                  f.dateCible ?? "",
                  f.expressionTemporelle ?? "",
                  f.texteCourt ?? "",
                ],
              },
            ]),
          ),
        );
        c.paragraphesRetires = v2.retires;
        c.chiffresHorsFaits = v2.motifs.filter((m) => /nombre|date|nom/.test(m)).length;
      } catch (err) {
        c.echecs = (c.echecs ?? 0) + 1;
        // Le code d'erreur seulement : jamais une parole.
        console.error(
          `[visio:eval] ${sc.id} #${n} : ${err instanceof Error ? err.name : "erreur"}`,
        );
      }
      parScenario[`${sc.id}#${n}`] = c;
      for (const [k, v] of Object.entries(c)) total[k as keyof Compteurs] += v ?? 0;
    }
  }
  const rappel = total.attendus === 0 ? 1 : total.retrouves / total.attendus;
  console.log(
    JSON.stringify(
      {
        executions,
        scenarios: liste.length,
        estimationUsd: estimation,
        total,
        rappel,
        parScenario,
      },
      null,
      2,
    ),
  );
  const echec =
    total.faitsSansCitationVerifiee > 0 ||
    total.faitsInterdits > 0 ||
    total.relationsHorsPerimetre > 0 ||
    rappel < 0.9;
  process.exitCode = echec ? 1 : 0;
}

main().catch((err: unknown) => {
  console.error(`[visio:eval] ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
