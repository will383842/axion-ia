import { act, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));

import { StatutSauvegarde } from "../StatutSauvegarde";
import { useBrouillonAuto, type ReponseSauvegarde } from "../useBrouillonAuto";
import { etatInitial, reducteur } from "../etat";
import type { EtatAssistant } from "../types";

const BASE = "/fr/adm/qualiopi/devis/new";
const neuf = (): EtatAssistant =>
  etatInitial({ validiteParDefaut: "2026-12-08", formulesActives: true, defaultClientId: "c-1" });
const modifie = (e: EtatAssistant, intitule: string) =>
  reducteur(e, { type: "champs", patch: { intitule } });

beforeEach(() => {
  vi.useFakeTimers();
  replace.mockReset();
});
afterEach(() => vi.useRealTimers());

function monter(
  sauver: (i: never) => Promise<ReponseSauvegarde>,
  extra: { brouillonInitial?: { id: string; majLe: string } } = {},
) {
  return renderHook(
    ({ etat, etape }: { etat: EtatAssistant; etape: 1 | "1b" | 2 }) =>
      useBrouillonAuto({
        etat,
        etape,
        urlAssistant: BASE,
        sauverBrouillon: sauver as never,
        ...extra,
      }),
    { initialProps: { etat: neuf(), etape: 1 as 1 | "1b" | 2 } },
  );
}

describe("sauvegarde automatique", () => {
  it("ne sauvegarde rien au montage", async () => {
    const sauver = vi.fn(async () => ({ data: { id: "b1", majLe: "t1" } }));
    monter(sauver);
    await act(async () => void vi.advanceTimersByTime(10_000));
    expect(sauver).not.toHaveBeenCalled();
  });

  it("une seule sauvegarde, 3 s après la DERNIÈRE frappe", async () => {
    const sauver = vi.fn(async (_i: unknown) => ({ data: { id: "b1", majLe: "t1" } }));
    const { rerender } = monter(sauver);
    rerender({ etat: modifie(neuf(), "A"), etape: 1 });
    await act(async () => void vi.advanceTimersByTime(2000));
    rerender({ etat: modifie(neuf(), "AB"), etape: 1 });
    await act(async () => void vi.advanceTimersByTime(2999));
    expect(sauver).not.toHaveBeenCalled();
    await act(async () => void vi.advanceTimersByTime(1));
    expect(sauver).toHaveBeenCalledTimes(1);
    expect(sauver.mock.calls[0]![0]).toMatchObject({
      donnees: { v: 1, etape: 1, etat: { intitule: "AB" } },
    });
    await act(async () => void vi.advanceTimersByTime(10_000));
    expect(sauver).toHaveBeenCalledTimes(1);
  });

  it("première sauvegarde : router.replace vers ?brouillon=<id> ; ensuite id + attenduMajLe, sans replace", async () => {
    const sauver = vi
      .fn()
      .mockResolvedValueOnce({ data: { id: "b1", majLe: "t1" } })
      .mockResolvedValueOnce({ data: { id: "b1", majLe: "t2" } });
    const { rerender } = monter(sauver);
    rerender({ etat: modifie(neuf(), "A"), etape: 1 });
    await act(async () => void vi.advanceTimersByTime(3000));
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith(`${BASE}?brouillon=b1`, { scroll: false });
    expect(sauver.mock.calls[0]![0]).not.toHaveProperty("id");
    rerender({ etat: modifie(neuf(), "AB"), etape: 1 });
    await act(async () => void vi.advanceTimersByTime(3000));
    expect(sauver.mock.calls[1]![0]).toMatchObject({ id: "b1", attenduMajLe: "t1" });
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it("un brouillon repris envoie tout de suite son id et son attenduMajLe, sans replace", async () => {
    const sauver = vi.fn(async (_i: unknown) => ({ data: { id: "b9", majLe: "t5" } }));
    const { rerender } = monter(sauver, { brouillonInitial: { id: "b9", majLe: "t4" } });
    rerender({ etat: modifie(neuf(), "A"), etape: 1 });
    await act(async () => void vi.advanceTimersByTime(3000));
    expect(sauver.mock.calls[0]![0]).toMatchObject({ id: "b9", attenduMajLe: "t4" });
    expect(replace).not.toHaveBeenCalled();
  });
});

describe("brouillon illisible", () => {
  it("n'envoie jamais l'id ni le majLe du brouillon illisible : un nouveau brouillon est créé", async () => {
    const sauver = vi.fn(async (_i: unknown) => ({ data: { id: "neuf", majLe: "t1" } }));
    const { rerender } = renderHook(
      ({ etat }: { etat: EtatAssistant }) =>
        useBrouillonAuto({
          etat,
          etape: 1,
          urlAssistant: BASE,
          sauverBrouillon: sauver as never,
          brouillonInitial: { id: "casse", majLe: "t0" },
          brouillonIllisible: true,
        }),
      { initialProps: { etat: neuf() } },
    );
    rerender({ etat: modifie(neuf(), "A") });
    await act(async () => void vi.advanceTimersByTime(3000));
    const envoye = sauver.mock.calls[0]![0] as Record<string, unknown>;
    expect(envoye).not.toHaveProperty("id");
    expect(envoye).not.toHaveProperty("attenduMajLe");
    expect(replace).toHaveBeenCalledWith(`${BASE}?brouillon=neuf`, { scroll: false });
  });
});

describe("changement d'étape", () => {
  it("sauvegarderMaintenant attend la réponse et rend ok", async () => {
    let fin: (r: ReponseSauvegarde) => void = () => {};
    const sauver = vi.fn(() => new Promise<ReponseSauvegarde>((r) => (fin = r)));
    const { result } = monter(sauver);
    let resultat: unknown = "attente";
    void result.current
      .sauvegarderMaintenant({ v: 1, etape: "1b", etat: neuf() })
      .then((r) => (resultat = r));
    await act(async () => {});
    expect(resultat).toBe("attente");
    await act(async () => fin({ data: { id: "b1", majLe: "t1" } }));
    expect(resultat).toEqual({ ok: true });
  });

  it("échec : ok false avec le message, statut erreur, l'étape ne bouge pas", async () => {
    const sauver = vi.fn(async () => ({ error: "Base indisponible." }));
    const { result } = monter(sauver);
    let r: unknown;
    await act(async () => {
      r = await result.current.sauvegarderMaintenant({ v: 1, etape: "1b", etat: neuf() });
    });
    expect(r).toEqual({ ok: false, erreur: "Base indisponible." });
    expect(result.current.statut).toBe("erreur");
  });

  it("une exception de l'action devient un message lisible, pas un plantage", async () => {
    const sauver = vi.fn(async () => {
      throw new Error("boom");
    });
    const { result } = monter(sauver);
    let r: { ok: boolean; erreur?: string } | undefined;
    await act(async () => {
      r = await result.current.sauvegarderMaintenant({ v: 1, etape: "1b", etat: neuf() });
    });
    expect(r?.ok).toBe(false);
    expect(r?.erreur).toMatch(/enregistr/i);
  });

  it("deux sauvegardes se suivent : la seconde part avec le majLe de la première", async () => {
    const sauver = vi
      .fn()
      .mockResolvedValueOnce({ data: { id: "b1", majLe: "t1" } })
      .mockResolvedValueOnce({ data: { id: "b1", majLe: "t2" } });
    const { result } = monter(sauver);
    await act(async () => {
      await Promise.all([
        result.current.sauvegarderMaintenant({ v: 1, etape: 1, etat: neuf() }),
        result.current.sauvegarderMaintenant({ v: 1, etape: "1b", etat: neuf() }),
      ]);
    });
    expect(sauver.mock.calls[1]![0]).toMatchObject({ id: "b1", attenduMajLe: "t1" });
  });
});

describe("conflit entre deux onglets", () => {
  it("passe en conflit, n'écrase jamais, ne réessaie pas", async () => {
    const sauver = vi.fn(async () => ({ error: "Modifié ailleurs.", conflit: true as const }));
    const { result, rerender } = monter(sauver, { brouillonInitial: { id: "b1", majLe: "t0" } });
    rerender({ etat: modifie(neuf(), "A"), etape: 1 });
    await act(async () => void vi.advanceTimersByTime(3000));
    expect(result.current.statut).toBe("conflit");
    rerender({ etat: modifie(neuf(), "AB"), etape: 1 });
    await act(async () => void vi.advanceTimersByTime(20_000));
    expect(sauver).toHaveBeenCalledTimes(1);
    let r: { ok: boolean } | undefined;
    await act(async () => {
      r = await result.current.sauvegarderMaintenant({ v: 1, etape: "1b", etat: neuf() });
    });
    expect(r?.ok).toBe(false);
    expect(sauver).toHaveBeenCalledTimes(1);
  });
});

describe("StatutSauvegarde", () => {
  it("zone aria-live=polite à largeur réservée, avec le temps écoulé", () => {
    const t0 = Date.now();
    render(<StatutSauvegarde statut="enregistre" enregistreA={t0 - 12_000} />);
    const zone = screen.getByRole("status");
    expect(zone.getAttribute("aria-live")).toBe("polite");
    expect(zone.className).toMatch(/min-w-/);
    expect(zone.textContent).toBe("Brouillon enregistré automatiquement");
    expect(screen.getByTestId("temps-ecoule").textContent).toBe(" · il y a 12 s");
  });

  it("le compteur « il y a N s » est hors de la zone aria-live", () => {
    render(<StatutSauvegarde statut="enregistre" enregistreA={Date.now() - 12_000} />);
    expect(screen.getByRole("status").contains(screen.getByTestId("temps-ecoule"))).toBe(false);
    expect(screen.getByTestId("temps-ecoule").closest("[aria-live]")).toBeNull();
  });

  it("le temps écoulé avance tout seul", () => {
    const t0 = Date.now();
    render(<StatutSauvegarde statut="enregistre" enregistreA={t0} />);
    act(() => void vi.advanceTimersByTime(65_000));
    expect(screen.getByTestId("temps-ecoule").textContent).toContain("il y a 1 min");
  });

  it("états enregistrement en cours et erreur", () => {
    const { rerender } = render(<StatutSauvegarde statut="enCours" enregistreA={null} />);
    expect(screen.getByRole("status").textContent).toBe("Enregistrement…");
    rerender(<StatutSauvegarde statut="erreur" enregistreA={null} erreur="Base indisponible." />);
    expect(screen.getByRole("status").textContent).toContain("Base indisponible.");
  });

  it("conflit : propose de recharger la dernière version, jamais d'écraser", () => {
    const onRecharger = vi.fn();
    render(<StatutSauvegarde statut="conflit" enregistreA={null} onRecharger={onRecharger} />);
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    screen.getByRole("button", { name: "Recharger la dernière version" }).click();
    expect(onRecharger).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /écraser/i })).toBeNull();
  });

  it("conflit : le focus entre dans l'alertdialog, sur le bouton de rechargement", () => {
    render(<StatutSauvegarde statut="conflit" enregistreA={null} onRecharger={() => {}} />);
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Recharger la dernière version" }),
    );
  });

  it("conflit sans onRecharger : bouton masqué, le focus va sur l'alertdialog", () => {
    render(<StatutSauvegarde statut="conflit" enregistreA={null} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("alertdialog"));
  });
});
