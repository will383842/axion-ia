/**
 * Tests KB-4 — state machine `KbStatus`. Pure. AUCUNE I/O DB.
 */

import { describe, expect, it } from "vitest";
import { allowedTransitionsFrom, KB_TRANSITIONS, validateTransition } from "./state-machine";

const editorContext = { userRole: "editor", userId: "u1" };
const adminContext = { userRole: "admin", userId: "u2" };
const ownerContext = { userRole: "super_admin", userId: "u3" };
const readerContext = { userRole: "reader", userId: "u4" };

describe("KB_TRANSITIONS — matrice", () => {
  it("contient 17 transitions", () => {
    expect(KB_TRANSITIONS).toHaveLength(17);
  });

  it("toutes ont une description non vide", () => {
    for (const t of KB_TRANSITIONS) expect(t.description).toBeTruthy();
  });

  it("requireDistinctFromAuthor=true uniquement sur review→approved", () => {
    const r = KB_TRANSITIONS.filter((t) => t.requireDistinctFromAuthor);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ from: "review", to: "approved" });
  });
});

describe("validateTransition — allowed", () => {
  it("draft → review (editor)", () => {
    expect(validateTransition("draft", "review", editorContext).ok).toBe(true);
  });
  it("approved → scheduled (editor)", () => {
    expect(validateTransition("approved", "scheduled", editorContext).ok).toBe(true);
  });
  it("published → deprecated (owner)", () => {
    expect(validateTransition("published", "deprecated", ownerContext).ok).toBe(true);
  });
  it("archived → draft (owner)", () => {
    expect(validateTransition("archived", "draft", ownerContext).ok).toBe(true);
  });
  it("review → approved (reviewer ≠ author)", () => {
    expect(
      validateTransition("review", "approved", { ...adminContext, authorId: "other" }).ok,
    ).toBe(true);
  });
});

describe("validateTransition — refus rôle", () => {
  it("draft → archived refusé editor (OWNER only)", () => {
    const d = validateTransition("draft", "archived", editorContext);
    expect(d.ok).toBe(false);
    expect(d.reason).toBe("forbidden_role");
  });
  it("published → deprecated refusé editor", () => {
    expect(validateTransition("published", "deprecated", editorContext).ok).toBe(false);
  });
  it("draft → review refusé reader", () => {
    expect(validateTransition("draft", "review", readerContext).ok).toBe(false);
  });
});

describe("validateTransition — non listées", () => {
  it("draft → published direct refusé", () => {
    const d = validateTransition("draft", "published", editorContext);
    expect(d.ok).toBe(false);
    expect(d.reason).toBe("not_allowed");
  });
  it("archived → published direct refusé", () => {
    expect(validateTransition("archived", "published", ownerContext).ok).toBe(false);
  });
  it("review → published direct refusé", () => {
    expect(validateTransition("review", "published", editorContext).ok).toBe(false);
  });
});

describe("validateTransition — anti auto-approve", () => {
  it("review → approved REFUSÉ si reviewer = auteur", () => {
    const d = validateTransition("review", "approved", {
      ...editorContext,
      authorId: editorContext.userId,
    });
    expect(d.ok).toBe(false);
    expect(d.reason).toBe("must_differ_from_author");
  });
  it("review → approved ACCEPTÉ si pas d'auteur (legacy)", () => {
    expect(validateTransition("review", "approved", { ...editorContext, authorId: null }).ok).toBe(
      true,
    );
  });
});

describe("validateTransition — system trigger", () => {
  it("scheduled → published refusé pour user", () => {
    const d = validateTransition("scheduled", "published", adminContext);
    expect(d.ok).toBe(false);
    expect(d.reason).toBe("system_only");
  });
  it("scheduled → published accepté system=true", () => {
    expect(validateTransition("scheduled", "published", { ...adminContext, system: true }).ok).toBe(
      true,
    );
  });
});

describe("allowedTransitionsFrom", () => {
  it("draft pour editor inclut draft + review, exclut archived", () => {
    const r = allowedTransitionsFrom("draft", "editor");
    expect(r).toContain("draft");
    expect(r).toContain("review");
    expect(r).not.toContain("archived");
  });
  it("draft pour super_admin inclut archived", () => {
    expect(allowedTransitionsFrom("draft", "super_admin")).toContain("archived");
  });
  it("published pour reader []", () => {
    expect(allowedTransitionsFrom("published", "reader")).toEqual([]);
  });
  it("scheduled pour editor = [approved] (system=publish)", () => {
    expect(allowedTransitionsFrom("scheduled", "editor")).toEqual(["approved"]);
  });
});
