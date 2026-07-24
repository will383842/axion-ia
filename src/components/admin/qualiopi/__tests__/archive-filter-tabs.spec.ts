/**
 * Tests — normalisation du paramètre d'URL des onglets d'archives.
 *
 * L'enjeu : la vue par défaut ne doit JAMAIS montrer les archives, quelle que
 * soit la valeur reçue (paramètre absent, vide, dupliqué, ou forgé à la main).
 */

import { describe, it, expect } from "vitest";

import { parseArchiveFilter, ARCHIVE_FILTER_PARAM } from "../ArchiveFilterTabs";

describe("parseArchiveFilter", () => {
  it("retombe sur « actives » quand le paramètre est absent", () => {
    expect(parseArchiveFilter(undefined)).toBe("actives");
  });

  it("reconnaît les deux vues explicites", () => {
    expect(parseArchiveFilter("archivees")).toBe("archivees");
    expect(parseArchiveFilter("toutes")).toBe("toutes");
  });

  it("accepte « actives » explicitement", () => {
    expect(parseArchiveFilter("actives")).toBe("actives");
  });

  it("retombe sur « actives » sur une valeur inattendue", () => {
    expect(parseArchiveFilter("")).toBe("actives");
    expect(parseArchiveFilter("ARCHIVEES")).toBe("actives");
    expect(parseArchiveFilter("archivée")).toBe("actives");
    expect(parseArchiveFilter("' OR 1=1--")).toBe("actives");
  });

  it("retombe sur « actives » quand le paramètre est dupliqué (tableau)", () => {
    // `?vue=archivees&vue=toutes` → Next fournit un tableau : on ne devine pas.
    expect(parseArchiveFilter(["archivees", "toutes"])).toBe("actives");
    expect(parseArchiveFilter([])).toBe("actives");
  });

  it("expose un nom de paramètre stable", () => {
    expect(ARCHIVE_FILTER_PARAM).toBe("vue");
  });
});
