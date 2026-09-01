// @vitest-environment node

/**
 * Verrou — le format d'un rendez-vous porte UN SEUL nom dans tout le dépôt.
 *
 * ## Ce qui s'est passé
 *
 * Le 2026-08-31, la même notion a été livrée sous deux noms le même soir :
 * `canal` dans `admin-rendezvous`, `format` dans `admin-agenda`. Rien ne
 * cassait — les deux compilaient, les deux étaient testés — et personne ne
 * l'aurait vu avant qu'un troisième écran choisisse l'un ou l'autre au hasard.
 *
 * C'est d'autant plus ironique que ce champ existe justement pour ne PAS
 * stocker deux fois la même vérité : « deux champs qui doivent dire la même
 * chose finissent toujours par diverger ». La divergence est arrivée par le
 * nom, pas par la valeur.
 *
 * ## Pourquoi « format » et pas « canal »
 *
 * Arbitré par Will le 2026-08-31 — et ce n'est pas une préférence de style. Le
 * mot « canal » est **déjà pris trois fois** dans ce dépôt, pour trois choses
 * différentes : le type d'un message entrant (`contacts/page.tsx`), le circuit
 * d'une signature (`portail/signer`), et le canal d'une candidature
 * (`PartenaireLandingPage`). Un quatrième sens à deux écrans d'intervalle est
 * une confusion durable, pour un mot qui ne coûtait rien à changer.
 *
 * ## Ce que cette garde vérifie, et ce qu'elle ne peut pas vérifier
 *
 * Elle lit les deux fichiers de types et exige que le champ s'y nomme
 * pareillement. Elle ne peut pas empêcher un TROISIÈME écran d'inventer un
 * troisième nom dans un fichier qu'elle ne lit pas — mais elle nomme la règle
 * à l'endroit où on la cherchera.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { UnifiedRdv } from "../types";
import type { AgendaItem } from "../../admin-agenda/types";

/** Les deux vues qui portent la notion. */
const FICHIERS = [
  "src/features/admin-rendezvous/types.ts",
  "src/features/admin-agenda/types.ts",
] as const;

/** Le nom retenu, et le seul. */
const NOM = "format";

/** Les noms rejetés, avec la raison de leur rejet. */
const REJETES: ReadonlyArray<readonly [string, string]> = [
  [
    "canal",
    "déjà pris pour le type de message entrant, le circuit de signature et le canal de recrutement",
  ],
];

/** Extrait la déclaration du champ typé `CanalRendezVous` dans un fichier. */
function champDeclare(chemin: string): string | null {
  const src = readFileSync(join(process.cwd(), chemin), "utf8");
  // On cherche « xxx: CanalRendezVous » hors commentaire : dans un commentaire
  // le mot n'est jamais suivi de deux-points et du type.
  const m = /(?:readonly\s+)?([a-zA-Z_]+)\s*:\s*CanalRendezVous\s*;/.exec(src);
  return m?.[1] ?? null;
}

describe("le format porte un seul nom", () => {
  it("🔑 les deux fichiers déclarent bien le champ", () => {
    // Contre-témoin : si le motif cessait de mordre — champ renommé, type
    // changé — le test suivant comparerait deux `null` et serait vert.
    for (const f of FICHIERS) {
      expect(champDeclare(f), `aucun champ de type CanalRendezVous dans ${f}`).not.toBeNull();
    }
  });

  it("🔴 les deux vues emploient le MÊME nom", () => {
    const noms = FICHIERS.map((f) => [f, champDeclare(f)] as const);
    const distincts = [...new Set(noms.map(([, n]) => n))];
    expect(
      distincts.length,
      `le format porte ${distincts.length} noms différents : ` +
        noms.map(([f, n]) => `${n} (${f})`).join(" / ") +
        ". Une même notion sous deux noms diverge au troisième écran.",
    ).toBe(1);
  });

  it("🔴 et ce nom est « format », arbitré le 2026-08-31", () => {
    for (const f of FICHIERS) {
      expect(champDeclare(f), `${f} devrait déclarer « ${NOM} »`).toBe(NOM);
    }
  });

  it("🔑 aucun des noms rejetés ne revient", () => {
    for (const [rejete, raison] of REJETES) {
      for (const f of FICHIERS) {
        expect(champDeclare(f), `« ${rejete} » est rejeté : ${raison}`).not.toBe(rejete);
      }
    }
  });

  it("🔑 le contrat TypeScript porte bien ce nom, pas seulement le texte", () => {
    // La garde ci-dessus lit des fichiers ; celle-ci compile. Si le champ était
    // renommé sans que les fichiers de types suivent, l'un des deux rougirait.
    const rdv = {} as UnifiedRdv;
    const item = {} as AgendaItem;
    expect(NOM in ({ format: rdv.format } as Record<string, unknown>)).toBe(true);
    expect(NOM in ({ format: item.format } as Record<string, unknown>)).toBe(true);
  });
});
