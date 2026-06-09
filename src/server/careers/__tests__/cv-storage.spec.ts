import { describe, it, expect } from "vitest";
import { sanitizeCvFileName, CV_MAX_BYTES, CV_ALLOWED_EXTENSIONS } from "../cv-storage";

describe("sanitizeCvFileName", () => {
  it("conserve l'extension et nettoie le nom", () => {
    expect(sanitizeCvFileName("Mon CV final !.pdf")).toMatch(/\.pdf$/);
  });

  it("neutralise le path-traversal", () => {
    const out = sanitizeCvFileName("../../etc/passwd.pdf");
    expect(out).not.toContain("/");
    expect(out).not.toContain("..");
  });

  it("fallback 'cv' si la base se réduit à vide", () => {
    expect(sanitizeCvFileName("!!!.docx")).toBe("cv.docx");
  });

  it("constantes cohérentes", () => {
    expect(CV_MAX_BYTES).toBe(8 * 1024 * 1024);
    expect(CV_ALLOWED_EXTENSIONS).toContain(".pdf");
    expect(CV_ALLOWED_EXTENSIONS).toContain(".docx");
  });
});
