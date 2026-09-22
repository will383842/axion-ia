/**
 * La page « Détection de doublons » montre les paires que le worker a trouvées.
 *
 * Pendant quatre mois elle a affiché « la comparaison … n'est pas encore
 * active » alors que le worker `content-similarity-monitor` écrivait chaque nuit
 * dans `ContentGenConfig.similarity_pairs` — 57 paires en production le 16/09.
 * Le texte rassurant était le seul obstacle entre Will et un travail déjà fait.
 *
 * Les deux sens comptent. Sans le témoin « aucune paire », vider la page
 * passerait au vert ; sans le témoin « N paires », afficher un tableau vide
 * passerait aussi.
 */

import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { PaireSimilaire } from "@/server/content-gen/paires-similaires";
import { SimilarityMonitorV2 } from "../SimilarityMonitorV2";

afterEach(cleanup);

function paire(n: number): PaireSimilaire {
  return {
    jobIdA: `job-a-${n}`,
    jobIdB: `job-b-${n}`,
    contentTypeA: "article",
    contentTypeB: "article",
    titleA: `Premier titre numéro ${n}`,
    titleB: `Second titre numéro ${n}`,
    anchorVilleA: "grenoble",
    anchorVilleB: "lyon",
    jaccard: 0.62,
    detectedAt: "2026-09-16T04:30:00.000Z",
  };
}

describe("SimilarityMonitorV2", () => {
  it("affiche chaque paire, avec un lien vers chacun des deux contenus", () => {
    const paires = [paire(1), paire(2), paire(3)];
    render(
      <SimilarityMonitorV2
        adminPrefix="console"
        paires={paires}
        detecteLe={paires[0]!.detectedAt}
      />,
    );

    for (const p of paires) {
      const a = screen.getByRole("link", { name: p.titleA });
      const b = screen.getByRole("link", { name: p.titleB });
      expect(a).toHaveAttribute("href", `/fr/console/content-gen/jobs/${p.jobIdA}`);
      expect(b).toHaveAttribute("href", `/fr/console/content-gen/jobs/${p.jobIdB}`);
    }
    expect(screen.getAllByText(/62 %/)).toHaveLength(paires.length);
  });

  it("dit la date de la dernière comparaison, en toutes lettres", () => {
    render(
      <SimilarityMonitorV2
        adminPrefix="console"
        paires={[paire(1)]}
        detecteLe="2026-09-16T04:30:00.000Z"
      />,
    );
    expect(screen.getByText(/16 septembre 2026/)).toBeTruthy();
  });

  it("sans paire, dit « aucune » — et ne promet plus une fonction « pas encore active »", () => {
    render(<SimilarityMonitorV2 adminPrefix="console" paires={[]} detecteLe={null} />);
    expect(screen.getByText(/Aucune paire de contenus trop proches/)).toBeTruthy();
    expect(screen.queryByText(/pas encore active/)).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("n'offre AUCUN geste : la page est en lecture seule", () => {
    render(<SimilarityMonitorV2 adminPrefix="console" paires={[paire(1)]} detecteLe={null} />);
    expect(screen.queryByRole("button")).toBeNull();
    for (const mot of [/archiver/i, /fusionner/i, /ignorer/i]) {
      expect(screen.queryByText(mot)).toBeNull();
    }
  });
});
