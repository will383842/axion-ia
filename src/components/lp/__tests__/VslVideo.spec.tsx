/**
 * Extension de `VslVideo` pour la page VSL apporteurs : ratio 4:5 / 16:9,
 * progression 25/50/75/95 %, piste de sous-titres, transcription repliable —
 * et SURTOUT : rien ne change pour l'appelant historique (`/diagnostic`).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const { trackFunnel, trackVsl } = vi.hoisted(() => ({
  trackFunnel: vi.fn(),
  trackVsl: vi.fn(),
}));
vi.mock("@/lib/tracking", () => ({ trackFunnel }));
vi.mock("@/lib/analytics/vsl-apporteur-events", () => ({ trackVsl }));
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

import { VslVideo } from "../VslVideo";

const BASE = {
  src: "/videos/film-v1.mp4",
  poster: "/videos/film-v1-poster.avif",
  durationLabel: "1 min 20",
  label: "Regardez",
  landing: "vsl-test",
} as const;

// jsdom ne sait pas lire une vidéo : `play()` renvoie `undefined` au lieu d'une promesse.
beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

function film(container: HTMLElement): HTMLVideoElement {
  return container.querySelector("video") as HTMLVideoElement;
}

function avancer(v: HTMLVideoElement, courant: number, duree = 100) {
  Object.defineProperty(v, "duration", { value: duree, configurable: true });
  Object.defineProperty(v, "currentTime", { value: courant, configurable: true, writable: true });
  fireEvent.timeUpdate(v);
}

describe("VslVideo — rétrocompatibilité (appel de /diagnostic)", () => {
  it("16:9, preload=none, aucune piste, aucune transcription, aucun suivi de progression", () => {
    const { container } = render(<VslVideo {...BASE} />);
    const v = film(container);
    expect(v.getAttribute("preload")).toBe("none");
    expect(container.querySelector(".aspect-video")).not.toBeNull();
    expect(container.querySelector('[class*="aspect-[4/5]"]')).toBeNull();
    expect(container.querySelector("track")).toBeNull();
    expect(container.querySelector("details")).toBeNull();
    avancer(v, 99);
    expect(trackVsl).not.toHaveBeenCalled();
  });

  it("le clic sur lecture émet « Landing Video Played » avec le slug", () => {
    render(<VslVideo {...BASE} />);
    fireEvent.click(screen.getByRole("button", { name: /Lire la vidéo \(1 min 20\)/ }));
    expect(trackFunnel).toHaveBeenCalledWith("Landing Video Played", { landing: "vsl-test" });
  });
});

describe("VslVideo — extension", () => {
  it("ratio 4:5 sur téléphone, 16:9 dès md, sans rogner le film", () => {
    const { container } = render(<VslVideo {...BASE} ratio="4:5-mobile" />);
    const boite = container.querySelector('[class*="aspect-[4/5]"]') as HTMLElement;
    expect(boite).not.toBeNull();
    expect(boite.className).toContain("md:aspect-video");
    expect(film(container).className).toContain("object-contain");
  });

  it("ajoute la piste de sous-titres, par défaut en français", () => {
    const { container } = render(
      <VslVideo {...BASE} sousTitres={{ src: "/videos/film-v1.fr.vtt" }} />,
    );
    const piste = container.querySelector("track") as HTMLTrackElement;
    expect(piste.getAttribute("kind")).toBe("captions");
    expect(piste.getAttribute("src")).toBe("/videos/film-v1.fr.vtt");
    expect(piste.getAttribute("srclang")).toBe("fr");
    expect(piste.hasAttribute("default")).toBe(true);
  });

  it("transcription repliable : un <details> fermé, seulement s'il y a des répliques", () => {
    const { container, rerender } = render(
      <VslVideo {...BASE} transcription={["Bonjour.", "Merci."]} />,
    );
    const d = container.querySelector("details") as HTMLDetailsElement;
    expect(d.open).toBe(false);
    expect(d.textContent).toContain("Bonjour.");
    rerender(<VslVideo {...BASE} transcription={[]} />);
    expect(container.querySelector("details")).toBeNull();
  });

  it("progression : 25 / 50 / 75 / 95 %, chaque jalon UNE fois", () => {
    const { container } = render(<VslVideo {...BASE} suiviProgression />);
    const v = film(container);
    avancer(v, 10);
    expect(trackVsl).not.toHaveBeenCalled();
    avancer(v, 26);
    avancer(v, 30);
    avancer(v, 51);
    avancer(v, 80);
    avancer(v, 96);
    avancer(v, 10); // retour en arrière
    avancer(v, 97); // jalon déjà émis
    expect(trackVsl.mock.calls.map((c) => c[1].step)).toEqual(["p25", "p50", "p75", "p95"]);
    expect(trackVsl).toHaveBeenCalledWith("Video Progress", { landing: "vsl-test", step: "p25" });
  });

  it("ne plante pas quand la durée est inconnue (NaN, 0)", () => {
    const { container } = render(<VslVideo {...BASE} suiviProgression />);
    const v = film(container);
    avancer(v, 5, Number.NaN);
    avancer(v, 5, 0);
    expect(trackVsl).not.toHaveBeenCalled();
  });

  it("légende lisible sur fond clair (tone=light)", () => {
    const { container } = render(<VslVideo {...BASE} tone="light" />);
    expect(container.querySelector("figcaption")?.className).toContain("text-fg");
    expect(container.querySelector("figcaption")?.className).not.toContain("text-mocha-fg");
  });
});
