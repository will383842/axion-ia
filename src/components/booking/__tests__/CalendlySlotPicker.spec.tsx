/**
 * Le test qui garde la promesse d'ADR 0038 : un calendrier visible tout de
 * suite, et RIEN de Calendly chargé par le navigateur avant que le visiteur
 * clique. Si l'un de ces deux points tombe, le changement perd sa raison d'être
 * — dans un cas on retombe sur le pavé qu'on voulait supprimer, dans l'autre on
 * repose des cookies tiers sans consentement (art. 82).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { CalendlySlotPicker } from "../CalendlySlotPicker";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const FALLBACK = "https://calendly.com/axion-ia/premier-contact";

const DAYS = [
  {
    dateKey: "2026-08-04",
    slots: [
      // 07:00 UTC = 09:00 à Paris en été.
      { startIso: "2026-08-04T07:00:00.000Z", schedulingUrl: `${FALLBACK}/2026-08-04T09:00:00` },
      { startIso: "2026-08-04T12:30:00.000Z", schedulingUrl: `${FALLBACK}/2026-08-04T14:30:00` },
    ],
  },
  {
    dateKey: "2026-08-05",
    slots: [
      { startIso: "2026-08-05T08:00:00.000Z", schedulingUrl: `${FALLBACK}/2026-08-05T10:00:00` },
    ],
  },
] as const;

function setup() {
  cleanup();
  return render(<CalendlySlotPicker days={DAYS} fallbackUrl={FALLBACK} isFr height={720} />);
}

describe("CalendlySlotPicker — grille mensuelle", () => {
  it("rend une vraie grille de dates, pas seulement une liste de jours", () => {
    setup();
    // Le nom du mois, plus les dates SANS créneau de la semaine conservée :
    // c'est cette continuité des jours qui fait un calendrier plutôt qu'une
    // liste. Les créneaux du jeu de test tombent les 4 et 5 août, donc la
    // semaine du lundi 3 au dimanche 9 est rendue en entier.
    expect(screen.getByText(/août 2026/i)).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("9")).toBeInTheDocument();
  });

  it("rogne les semaines sans aucun créneau au lieu d'étaler un mois vide", () => {
    setup();
    // Le 1er août est deux semaines avant les créneaux : sa ligne n'a rien à
    // montrer. L'afficher donnait un calendrier d'apparence vide — le défaut
    // que ce rognage corrige.
    expect(screen.queryByText("1")).toBeNull();
    expect(screen.queryByText("31")).toBeNull();
  });

  it("une date disponible mène par ancre à ses horaires, déjà présents dans la page", () => {
    const { container } = setup();
    const case4 = screen.getByRole("link", { name: /mardi 4 août.*2 créneaux/i });
    expect(case4).toHaveAttribute("href", "#j-2026-08-04");
    // L'ancre doit exister, sinon le clic ne mène nulle part.
    expect(container.querySelector("#j-2026-08-04")).not.toBeNull();
  });

  it("les dates sans créneau sont visibles mais pas cliquables", () => {
    setup();
    // Le 6 août est dans la semaine conservée mais n'a aucun créneau : il doit
    // rester affiché — sinon la grille perd sa continuité — sans être un lien.
    expect(screen.getByText("6")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /6 août/i })).toBeNull();
  });

  it("les cases de la grille sont datées en jour PARISIEN, sans glissement de fuseau", () => {
    setup();
    // 2026-08-04T07:00:00Z = 09:00 à Paris, donc bien le 4 — et pas le 3.
    // Le suffixe « créneaux » distingue la case de la grille des liens
    // d'horaire, dont le libellé porte la même date (« Réserver mardi 4 août… »).
    const case4 = screen.getByRole("link", { name: /mardi 4 août.*créneaux/i });
    expect(case4).toHaveTextContent("4");
  });
});

describe("CalendlySlotPicker", () => {
  it("affiche les créneaux immédiatement, sans clic préalable", () => {
    setup();
    expect(screen.getByRole("link", { name: /09:00/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /14:30/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /10:00/ })).toBeInTheDocument();
  });

  it("les heures sont celles de Paris, et la page le dit", () => {
    setup();
    // 07:00 UTC ne doit JAMAIS s'afficher tel quel : le serveur rend en UTC.
    expect(screen.getByText(/heure de Paris/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^07:00/ })).toBeNull();
  });

  it("n'émet aucun marqueur d'auto-scan Calendly ni aucun script tiers", () => {
    const { container } = setup();
    expect(container.querySelector(".calendly-inline-widget")).toBeNull();
    expect(container.querySelector("[data-url]")).toBeNull();
    expect(container.querySelector("iframe")).toBeNull();
    expect(document.querySelector('script[src*="calendly.com"]')).toBeNull();
  });

  it("chaque créneau est un lien vers sa page de confirmation, en nouvel onglet", () => {
    setup();
    const link = screen.getByRole("link", { name: /09:00/ });
    expect(link).toHaveAttribute("href", DAYS[0].slots[0].schedulingUrl);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("le libellé accessible porte la date complète, pas seulement l'heure", () => {
    setup();
    // « 09:00 » seul est inexploitable pour un lecteur d'écran qui parcourt les liens.
    const link = screen.getByRole("link", { name: /mardi 4 août.*09:00/i });
    expect(link).toBeInTheDocument();
  });

  it("garde une porte de sortie vers le calendrier complet", () => {
    setup();
    const all = screen.getByRole("link", { name: /toutes les disponibilités/i });
    expect(all).toHaveAttribute("href", FALLBACK);
  });

  it("informe en UNE ligne d'où se fait la confirmation — sans redevenir un pavé", () => {
    setup();
    expect(screen.getByText(/Calendly \(États-Unis\)/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sous-traitants/i })).toHaveAttribute(
      "href",
      "/sous-processeurs",
    );
    // Le texte du placeholder d'ADR 0034 ne doit pas revenir par la fenêtre.
    expect(screen.queryByText(/Clauses Contractuelles Types/)).toBeNull();
    expect(screen.queryByText(/dépose ses propres cookies/)).toBeNull();
  });

  it("occupe la même boîte que le repli (CLS = 0)", () => {
    const { container } = setup();
    const box = (container.firstElementChild as HTMLElement).style;
    expect(box.height).toBe("720px");
    expect(box.minWidth).toBe("320px");
  });

  it("n'utilise pas l'appariement bg-terracotta/text-paper (contraste axe, /fr/appel auditée)", () => {
    const { container } = setup();
    expect(container.innerHTML).not.toContain("bg-terracotta text-paper");
  });
});
