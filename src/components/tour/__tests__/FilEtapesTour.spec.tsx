/**
 * Le fil des trois étapes du Tour : trois éléments visibles, l'étape en cours marquée,
 * l'étape faite en vert avec un Check, aucun mot interdit.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MOTS_INTERDITS } from "@/app/tour-france-ia/__tests__/mots-interdits";

import { FilEtapesTour } from "../FilEtapesTour";

afterEach(cleanup);

const visibles = (c: HTMLElement) => [...c.querySelectorAll("ol > li:not([aria-hidden])")];

describe("le fil des étapes du Tour", () => {
  it("trois éléments, dans l'ordre, et aria-current sur l'étape 1", () => {
    const { container } = render(<FilEtapesTour etapeCourante={1} />);
    expect(container.querySelectorAll("ol").length).toBe(1);
    expect(visibles(container).map((li) => li.textContent)).toEqual([
      "Votre demande",
      "La visio",
      "Votre journée offerte",
    ]);
    const courants = container.querySelectorAll('[aria-current="step"]');
    expect(courants.length).toBe(1);
    expect(courants[0]?.textContent).toBe("Votre demande");
    expect(courants[0]?.className).toMatch(/\btext-terracotta-deep\b/);
    expect(container.querySelector("svg")).toBeNull();
  });

  it("étape 2 : la première est faite (text-sage et Check), la visio est en cours", () => {
    const { container } = render(<FilEtapesTour etapeCourante={2} />);
    const [faite, courante, suivante] = visibles(container);
    expect(faite?.className).toMatch(/\btext-sage\b/);
    expect(faite?.querySelector("svg")).not.toBeNull();
    expect(faite?.getAttribute("aria-current")).toBeNull();
    expect(courante?.getAttribute("aria-current")).toBe("step");
    expect(courante?.textContent).toBe("La visio");
    expect(suivante?.getAttribute("aria-current")).toBeNull();
    expect(container.querySelectorAll('[aria-current="step"]').length).toBe(1);
  });

  it("aucun mot interdit, aucun JavaScript client", () => {
    const { container } = render(<FilEtapesTour etapeCourante={2} />);
    const source = readFileSync(
      join(process.cwd(), "src/components/tour/FilEtapesTour.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(/["']use client["']/);
    for (const motif of MOTS_INTERDITS) {
      expect(container.textContent ?? "", String(motif)).not.toMatch(motif);
      expect(source, String(motif)).not.toMatch(motif);
    }
  });
});
