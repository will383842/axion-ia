import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useChatStream } from "./useChatStream";

function sseResponse(frames: string[], status = 200): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder();
      for (const f of frames) controller.enqueue(enc.encode(f));
      controller.close();
    },
  });
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/event-stream" },
  });
}

beforeEach(() => {
  // jsdom n'expose pas window.location.pathname en écriture — lecture suffit.
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useChatStream", () => {
  it("streame une réponse SSE : deltas accumulés + done finalise", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        sseResponse([
          'data: {"type":"session","sessionUuid":"s-1"}\n\n',
          'data: {"type":"delta","text":"Bon"}\n\n',
          'data: {"type":"delta","text":"jour"}\n\n',
          'data: {"type":"done"}\n\n',
        ]),
      );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useChatStream());
    await act(async () => {
      await result.current.send("salut");
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0]).toMatchObject({ role: "user", text: "salut" });
    expect(result.current.messages[1]).toMatchObject({
      role: "assistant",
      text: "Bonjour",
      pending: false,
    });
  });

  it("réutilise le sessionUuid renvoyé pour le tour suivant (multi-tours)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        sseResponse([
          'data: {"type":"session","sessionUuid":"s-42"}\n\n',
          'data: {"type":"message","text":"un"}\n\n',
          'data: {"type":"done"}\n\n',
        ]),
      )
      .mockResolvedValueOnce(
        sseResponse(['data: {"type":"message","text":"deux"}\n\n', 'data: {"type":"done"}\n\n']),
      );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useChatStream());
    await act(async () => {
      await result.current.send("premier");
    });
    await act(async () => {
      await result.current.send("second");
    });

    const rawBody = fetchMock.mock.calls[1]?.[1]?.body as string;
    const secondCallBody = JSON.parse(rawBody) as { sessionUuid?: string };
    expect(secondCallBody.sessionUuid).toBe("s-42");
  });

  it("passe en erreur sans perdre la saisie si la réponse n'est pas ok", async () => {
    const fetchMock = vi.fn().mockResolvedValue(sseResponse([], 503));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useChatStream());
    await act(async () => {
      await result.current.send("question");
    });

    expect(result.current.status).toBe("error");
    // La saisie utilisateur reste visible dans le fil.
    expect(result.current.messages[0]).toMatchObject({ role: "user", text: "question" });
  });

  it("ignore une saisie vide", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useChatStream());
    await act(async () => {
      await result.current.send("   ");
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.messages).toHaveLength(0);
  });
});
