/**
 * Chapitres et `?t=` entrant : île cliente PROPRE à la page vidéo (lot W2.4). Le lecteur
 * partagé `VslVideo` (aussi chargé par /diagnostic et la page vidéo de l'apporteur) ne
 * doit plus embarquer ce code : chaque octet de plus s'y paie sur des pages publiques
 * existantes (cliquet « Poids du bundle »).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/lib/tracking", () => ({ trackFunnel: vi.fn() }));

import { ChapitresVideo } from "../ChapitresVideo";

const CHAPITRES = [
  { titre: "Pourquoi relancer", debutSecondes: 0 },
  { titre: "Automatiser sans perdre le ton", debutSecondes: 42 },
];

function monter(props: Partial<React.ComponentProps<typeof ChapitresVideo>> = {}) {
  return render(
    <>
      <video id="lecteur-test" />
      <ChapitresVideo
        videoId="lecteur-test"
        dureeSecondes={184}
        chapitres={CHAPITRES}
        videoSlug="x"
        {...props}
      />
    </>,
  );
}

function lecteur(container: HTMLElement) {
  const v = container.querySelector("video") as HTMLVideoElement;
  Object.defineProperty(v, "currentTime", { value: 0, configurable: true, writable: true });
  return v;
}

beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
  window.history.replaceState({}, "", "/fr/videos/x");
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("chapitres", () => {
  it("aucun chapitre rendu à 29 s", () => {
    monter({ dureeSecondes: 29 });
    expect(screen.queryByText("Pourquoi relancer")).toBeNull();
  });

  it("rendus à 30 s", () => {
    monter({ dureeSecondes: 30 });
    expect(screen.getByText("Pourquoi relancer")).toBeTruthy();
    expect(screen.getByText("Automatiser sans perdre le ton")).toBeTruthy();
  });

  it("un seul chapitre : rien", () => {
    monter({ chapitres: CHAPITRES.slice(0, 1) });
    expect(screen.queryByText("Pourquoi relancer")).toBeNull();
  });

  it("le clic positionne currentTime, lance la lecture et ne change NI l'adresse NI l'historique", () => {
    const push = vi.spyOn(window.history, "pushState");
    const replace = vi.spyOn(window.history, "replaceState");
    const { container } = monter();
    const v = lecteur(container);
    fireEvent.click(screen.getByRole("button", { name: /Automatiser sans perdre le ton/ }));
    expect(v.currentTime).toBe(42);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
    expect(window.location.search).toBe("");
    expect(push).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("horodatage lisible (m:ss) dans la liste", () => {
    monter();
    expect(screen.getByText("0:42")).toBeTruthy();
  });
});

describe("?t= entrant", () => {
  function avec(search: string) {
    window.history.replaceState({}, "", `/fr/videos/x${search}`);
    const { container } = monter({ chapitres: undefined, lireDebutDansUrl: true });
    return container.querySelector("video") as HTMLVideoElement;
  }

  it("?t=42 → la lecture démarre à 42 s", () => {
    expect(avec("?t=42").currentTime).toBe(42);
  });

  it.each(["?t=abc", "?t=-5", "?t=1.5", "?t=999", "?t=0", ""])("%j → ignoré", (search) => {
    expect(avec(search).currentTime).toBe(0);
  });

  it("sans la prop, l'adresse n'est pas lue", () => {
    window.history.replaceState({}, "", "/fr/videos/x?t=42");
    const { container } = monter({ chapitres: undefined });
    expect((container.querySelector("video") as HTMLVideoElement).currentTime).toBe(0);
  });
});

describe("poids du lecteur partagé", () => {
  const source = readFileSync(resolve(__dirname, "../../lp/VslVideo.tsx"), "utf8");

  it("VslVideo n'importe plus les chapitres et ne lit plus l'adresse", () => {
    expect(source).not.toMatch(/content\/videos\/chapitres/);
    expect(source).not.toMatch(/URLSearchParams|window\.location/);
  });
});

describe("poids de la page vidéo", () => {
  const page = readFileSync(resolve(__dirname, "../PageVideo.tsx"), "utf8");

  it("l'île des chapitres est chargée à la demande, pas dans le chunk de la page", () => {
    expect(page).toMatch(/ChapitresVideoDiffere/);
    expect(page).not.toMatch(/from "@\/components\/videos\/ChapitresVideo"/);
  });
});
