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
import { SUBPROCESSORS } from "@/content/subprocessors";
import { COULEURS_MARQUE } from "@/lib/brand/couleurs-marque";

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
  return render(<CalendlySlotPicker days={DAYS} isFr height={720} />);
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
    const href = link.getAttribute("href") ?? "";
    // Le lien PART de l'URL de créneau — on ne compare plus par égalité stricte
    // depuis qu'il porte les couleurs de la charte (voir le cas suivant).
    expect(href.startsWith(DAYS[0].slots[0].schedulingUrl)).toBe(true);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("le lien sortant porte les couleurs de la charte, DÉRIVÉES des jetons", () => {
    // 🔴 Ce cas garde deux choses à la fois.
    //
    // 1. Que les paramètres soient là : mesuré le 2026-08-28, Calendly les
    //    honore AUSSI sur ses pages autonomes (0 occurrence sans, 2 avec). Sans
    //    eux, le visiteur passe d'une page à sa charte à une page grise.
    // 2. Que la couleur soit celle des JETONS et pas une valeur recopiée. Le
    //    `c2410c` qui traînait dans le widget ne correspondait à aucune couleur
    //    du site — l'audit d'accessibilité du 2026-07-26 avait déplacé le
    //    terracotta sans que la copie suive.
    setup();
    const href = screen.getByRole("link", { name: /09:00/ }).getAttribute("href") ?? "";
    const params = new URL(href).searchParams;
    expect(params.get("primary_color")).toBe(COULEURS_MARQUE.terracotta.replace("#", ""));
    expect(params.get("text_color")).toBe(COULEURS_MARQUE.fg.replace("#", ""));
    expect(params.get("background_color")).toBe(COULEURS_MARQUE.bg.replace("#", ""));
  });

  it("le libellé accessible porte la date complète, pas seulement l'heure", () => {
    setup();
    // « 09:00 » seul est inexploitable pour un lecteur d'écran qui parcourt les liens.
    const link = screen.getByRole("link", { name: /mardi 4 août.*09:00/i });
    expect(link).toBeInTheDocument();
  });

  it("n'affiche plus de pied de boîte — ni lien global, ni mention de confirmation", () => {
    // Retiré le 2026-07-31 sur demande de Will. Ces deux éléments avaient chacun
    // leur test ; ils sont remplacés par celui-ci, pour que le retrait soit une
    // décision tenue et pas une régression silencieuse.
    setup();
    expect(screen.queryByRole("link", { name: /toutes les disponibilités/i })).toBeNull();
    expect(screen.queryByText(/Calendly \(États-Unis\)/)).toBeNull();
    expect(screen.queryByRole("link", { name: /sous-traitants/i })).toBeNull();
  });

  it("le pavé d'ADR 0034 ne revient pas par la fenêtre", () => {
    setup();
    expect(screen.queryByText(/Clauses Contractuelles Types/)).toBeNull();
    expect(screen.queryByText(/dépose ses propres cookies/)).toBeNull();
  });

  it("⚠️ Calendly reste déclaré comme sous-traitant, malgré le retrait de la mention", () => {
    // La mention retirée était une INFORMATION de transparence, pas un recueil
    // de consentement — mais elle ne doit pas être le seul endroit où Calendly
    // apparaissait. Ce test verrouille la contrepartie du retrait : la
    // divulgation vit désormais uniquement dans `/sous-processeurs`, et ce
    // fichier-là est la source de cette page.
    const noms = SUBPROCESSORS.map((s) => s.name).join(" | ");
    expect(noms).toMatch(/Calendly/i);
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

/**
 * L'affichage « un seul jour à la fois », façon Calendly, repose entièrement sur
 * une feuille de style émise avec le composant. jsdom n'applique pas `:has()` :
 * on vérifie donc le CSS PRODUIT, pas son effet visuel — l'effet, lui, a été
 * constaté dans un navigateur réel.
 */
describe("CalendlySlotPicker — un seul jour d'horaires à la fois", () => {
  function styleEmis(): string {
    const { container } = setup();
    return container.querySelector("style")?.textContent ?? "";
  }

  it("masque les jours non ciblés, et déplie le premier jour à l'arrivée", () => {
    const css = styleEmis();
    // Une ancre active → tout le reste disparaît.
    expect(css).toContain("[data-axion-jours]:has(>li:target)>li:not(:target){display:none}");
    // Aucune ancre → seul le premier jour porteur reste, comme Calendly qui
    // présélectionne la première date disponible.
    expect(css).toContain(
      "[data-axion-jours]:not(:has(>li:target))>li:not(:first-child){display:none}",
    );
  });

  it("relie chaque pastille de date à son jour, sans JavaScript", () => {
    const css = styleEmis();
    for (const day of DAYS) {
      expect(css).toContain(`:has(#j-${day.dateKey}:target) a[href="#j-${day.dateKey}"]`);
    }
  });

  it("garde le repli intact là où `:has()` manque, et ne casse pas les tests", () => {
    // La garde `@supports` porte DEUX promesses : un navigateur sans `:has()`
    // affiche tous les jours (comportement d'avant, aucun créneau perdu), et
    // jsdom — dont le moteur de sélecteurs lève une `SyntaxError` sur `:has()`
    // — ignore le bloc au lieu de faire tomber toute la suite.
    expect(styleEmis()).toMatch(/^@supports selector\(:has\(\*\)\)\{/);
  });

  it("ne colle aucune couleur en dur dans le style émis (linter anti-hex, tokens)", () => {
    const css = styleEmis();
    expect(css).toContain("var(--color-terracotta)");
    expect(css).toContain("var(--color-mocha-fg)");
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });

  it("n'écrit dans la feuille de style que des clés de date validées", () => {
    // Le contenu du `<style>` est concaténé à partir de valeurs venues de l'API
    // Calendly : une clé mal formée ne doit jamais pouvoir sortir de la règle.
    cleanup();
    const { container } = render(
      <CalendlySlotPicker
        days={[{ dateKey: '2026-08-04"}</style><script>alert(1)</script>', slots: [] }, ...DAYS]}
        isFr
        height={720}
      />,
    );
    const css = container.querySelector("style")?.textContent ?? "";
    expect(css).not.toContain("<script");
    expect(css).not.toContain("</style");
    expect(css).not.toContain("alert(1)");
    // La clé bidon est écartée : c'est le 4 août, premier jour VALIDE, qui sert
    // de sélection par défaut.
    expect(css).toContain('a[href="#j-2026-08-04"]');
  });
});
