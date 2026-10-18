/**
 * Chapitres du lecteur des vidéos du site (lot W2.4) : rendus seulement si la vidéo
 * dure au moins 30 s et compte au moins 2 chapitres ; un clic avance la lecture SANS
 * toucher à l'adresse (aucune adresse `?t=` n'est jamais produite par la page) ; un
 * `?t=` ENTRANT positionne la lecture.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/lib/tracking", () => ({ trackFunnel: vi.fn() }));
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

import { VslVideo } from "../VslVideo";

const CHAPITRES = [
  { titre: "Pourquoi relancer", debutSecondes: 0 },
  { titre: "Automatiser sans perdre le ton", debutSecondes: 42 },
];

const BASE = {
  src: "/medias/videos/x/v1/video.mp4",
  poster: "/medias/videos/x/v1/affiche.avif",
  durationLabel: "3 min 04",
  label: "Titre",
  landing: "videos",
} as const;

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
    render(<VslVideo {...BASE} dureeSecondes={29} chapitres={CHAPITRES} />);
    expect(screen.queryByText("Pourquoi relancer")).toBeNull();
  });

  it("rendus à 30 s", () => {
    render(<VslVideo {...BASE} dureeSecondes={30} chapitres={CHAPITRES} />);
    expect(screen.getByText("Pourquoi relancer")).toBeTruthy();
    expect(screen.getByText("Automatiser sans perdre le ton")).toBeTruthy();
  });

  it("un seul chapitre : rien", () => {
    render(<VslVideo {...BASE} dureeSecondes={184} chapitres={CHAPITRES.slice(0, 1)} />);
    expect(screen.queryByText("Pourquoi relancer")).toBeNull();
  });

  it("sans la prop : rétrocompatible (aucune liste)", () => {
    const { container } = render(<VslVideo {...BASE} />);
    expect(container.querySelector("ol")).toBeNull();
  });

  it("le clic positionne currentTime, lance la lecture et ne change NI l'adresse NI l'historique", () => {
    const push = vi.spyOn(window.history, "pushState");
    const replace = vi.spyOn(window.history, "replaceState");
    const { container } = render(<VslVideo {...BASE} dureeSecondes={184} chapitres={CHAPITRES} />);
    const v = container.querySelector("video") as HTMLVideoElement;
    Object.defineProperty(v, "currentTime", { value: 0, configurable: true, writable: true });
    fireEvent.click(screen.getByRole("button", { name: /Automatiser sans perdre le ton/ }));
    expect(v.currentTime).toBe(42);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
    expect(window.location.search).toBe("");
    expect(push).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("horodatage lisible (m:ss) dans la liste", () => {
    render(<VslVideo {...BASE} dureeSecondes={184} chapitres={CHAPITRES} />);
    expect(screen.getByText("0:42")).toBeTruthy();
  });
});

describe("?t= entrant", () => {
  function monter(search: string) {
    window.history.replaceState({}, "", `/fr/videos/x${search}`);
    const { container } = render(<VslVideo {...BASE} dureeSecondes={184} lireDebutDansUrl />);
    return container.querySelector("video") as HTMLVideoElement;
  }

  it("?t=42 → la lecture démarre à 42 s", () => {
    expect(monter("?t=42").currentTime).toBe(42);
  });

  it.each(["?t=abc", "?t=-5", "?t=1.5", "?t=999", "?t=0", ""])("%j → ignoré", (search) => {
    expect(monter(search).currentTime).toBe(0);
  });

  it("sans la prop, l'adresse n'est pas lue", () => {
    window.history.replaceState({}, "", "/fr/videos/x?t=42");
    const { container } = render(<VslVideo {...BASE} dureeSecondes={184} />);
    expect((container.querySelector("video") as HTMLVideoElement).currentTime).toBe(0);
  });
});
