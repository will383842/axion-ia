import { describe, it, expect } from "vitest";
import { splitSseFrames, parseSseFrame, reduceAssistant } from "./sse";
import type { ChatMessage } from "./types";

const base: ChatMessage = { id: "a-1", role: "assistant", text: "", pending: true };

describe("splitSseFrames", () => {
  it("découpe les trames complètes et garde le reste incomplet", () => {
    const { frames, rest } = splitSseFrames(
      'data: {"type":"a"}\n\ndata: {"type":"b"}\n\ndata: {"ty',
    );
    expect(frames).toHaveLength(2);
    expect(rest).toBe('data: {"ty');
  });

  it("ignore les segments vides (keep-alive)", () => {
    const { frames, rest } = splitSseFrames("\n\n\n\n");
    expect(frames).toHaveLength(0);
    expect(rest).toBe("");
  });

  it("ne renvoie aucune trame si le buffer n'a pas de séparateur", () => {
    const { frames, rest } = splitSseFrames('data: {"type":"delta"');
    expect(frames).toHaveLength(0);
    expect(rest).toBe('data: {"type":"delta"');
  });
});

describe("parseSseFrame", () => {
  it("parse une trame data: JSON valide", () => {
    expect(parseSseFrame('data: {"type":"delta","text":"hi"}')).toEqual({
      type: "delta",
      text: "hi",
    });
  });

  it("retourne null sur une charge non-JSON", () => {
    expect(parseSseFrame("data: not-json")).toBeNull();
  });

  it("retourne null si pas de champ type", () => {
    expect(parseSseFrame('data: {"foo":1}')).toBeNull();
  });

  it("retourne null sur une trame sans ligne data:", () => {
    expect(parseSseFrame(": keep-alive")).toBeNull();
  });
});

describe("reduceAssistant", () => {
  it("accumule les deltas sans muter l'entrée", () => {
    const a = reduceAssistant(base, { type: "delta", text: "Bon" });
    const b = reduceAssistant(a, { type: "delta", text: "jour" });
    expect(b.text).toBe("Bonjour");
    expect(base.text).toBe(""); // immuable
    expect(b.pending).toBe(true);
  });

  it("le message final remplace l'accumulation de deltas", () => {
    const withDelta = reduceAssistant(base, { type: "delta", text: "brouillon" });
    const final = reduceAssistant(withDelta, { type: "message", text: "Texte final" });
    expect(final.text).toBe("Texte final");
  });

  it("applique cartes + sendLinks", () => {
    const r = reduceAssistant(base, {
      type: "cards",
      sendLinks: true,
      cards: [{ id: "o1", titre: "Audit", prix: "1 190 € HT", urlFR: "/fr/audit", onQuote: false }],
    });
    expect(r.cards).toHaveLength(1);
    expect(r.sendLinks).toBe(true);
  });

  it("applique sources, rdv et escalade", () => {
    let r = reduceAssistant(base, {
      type: "sources",
      sources: [{ sourceType: "kb", sourceRef: "/fr/audit" }],
    });
    r = reduceAssistant(r, { type: "rdv", url: "/fr/appel" });
    r = reduceAssistant(r, { type: "escalate" });
    expect(r.sources).toHaveLength(1);
    expect(r.rdvUrl).toBe("/fr/appel");
    expect(r.escalated).toBe(true);
  });

  it("done met fin au pending", () => {
    expect(reduceAssistant(base, { type: "done" }).pending).toBe(false);
  });

  it("error met fin au pending (saisie non perdue, texte conservé)", () => {
    const withText = reduceAssistant(base, { type: "delta", text: "partiel" });
    const r = reduceAssistant(withText, { type: "error", message: "server_error" });
    expect(r.pending).toBe(false);
    expect(r.text).toBe("partiel");
  });
});
