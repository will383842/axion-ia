/**
 * Tests — L0-08 : les sorties `llms*.txt` ne nomment aucune ville.
 *
 * Décision de Will (2026-10-18) : Axion-IA se présente comme une entreprise qui
 * intervient partout en France. « Grenoble » / « Grenoblois » n'y figurent plus.
 * Les pages légales (siège) ne sont pas concernées et ne sont pas lues ici.
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/seo", () => ({ SITE_URL: "https://axion-ia.com" }));

import { GET as getLlms } from "./llms.txt/route";
import { GET as getLlmsFull } from "./llms-full.txt/route";

const SORTIES = [
  ["llms.txt", await getLlms().text()],
  ["llms-full.txt", await getLlmsFull().text()],
] as const;

describe.each(SORTIES)("%s — sans ville, partout en France", (_nom, corps) => {
  it("ne contient ni « Grenoble » ni « Grenoblois » (insensible à la casse)", () => {
    expect(corps).not.toMatch(/grenobl/i);
  });

  it("dit que l'entreprise intervient partout en France", () => {
    expect(corps).toMatch(/partout en France/i);
  });
});
