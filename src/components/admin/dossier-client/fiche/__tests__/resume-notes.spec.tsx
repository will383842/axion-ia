import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  notesFindMany: vi.fn(),
  projetFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    clientNote: { findMany: h.notesFindMany },
    projet: { findMany: h.projetFindMany },
  },
}));
vi.mock("@/features/dossier-client/fiche/actions-notes", () => ({
  ajouterNoteFormAction: vi.fn(),
  basculerEpingleFormAction: vi.fn(),
}));

import { resumeNotes } from "../ResumeNotes";
import type { ContexteFiche } from "../contexte";

const ctx = (voitEchanges: boolean): ContexteFiche =>
  ({
    clientId: "11111111-1111-4111-8111-111111111111",
    peutEcrire: true,
    voitEchanges,
  }) as unknown as ContexteFiche;

beforeEach(() => {
  h.notesFindMany.mockReset();
  h.projetFindMany.mockReset();
});

describe("resumeNotes", () => {
  it("sans droit de voir les échanges : rien n'est rendu ni lu", async () => {
    expect(await resumeNotes(ctx(false))).toBeNull();
    expect(h.notesFindMany).not.toHaveBeenCalled();
    expect(h.projetFindMany).not.toHaveBeenCalled();
  });

  it("lecture en échec : le rendu annonce « Lecture impossible »", async () => {
    h.notesFindMany.mockRejectedValue(new Error("panne"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const el = await resumeNotes(ctx(true));
    expect(renderToStaticMarkup(el as React.ReactElement)).toMatch(/lecture impossible/i);
  });
});
