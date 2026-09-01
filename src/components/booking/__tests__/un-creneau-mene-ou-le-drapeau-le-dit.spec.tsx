/**
 * Verrou — un créneau mène EXACTEMENT là où le drapeau le dit, et nulle part
 * ailleurs.
 *
 * ## Ce qui se joue sur ce seul attribut `href`
 *
 * Le sélecteur de créneaux est la dernière surface avant la réservation : c'est
 * le seul entonnoir du site. Son lien a maintenant deux destinations possibles
 * — la page Calendly, ou notre propre formulaire — et le choix vient d'un
 * drapeau lu par la page, une fois.
 *
 * Les deux façons de se tromper sont muettes, et coûtent la même chose :
 *
 * — **drapeau allumé, liens restés externes** : le formulaire qu'on vient de
 *   construire n'est jamais atteint. Rien ne casse, personne ne s'en aperçoit,
 *   et le travail est invisible.
 * — **drapeau éteint, liens devenus internes** : chaque créneau mène à une
 *   route qui redirige vers `/appel`. Un cul-de-sac circulaire au milieu de
 *   l'entonnoir, et aucune erreur nulle part.
 *
 * ## 🔑 LE `target="_blank"` FAIT PARTIE DE LA DÉCISION
 *
 * Ce n'est pas un détail cosmétique qu'on garderait « au cas où ». Ouvrir NOTRE
 * formulaire dans un nouvel onglet ferait perdre le fil au milieu d'une
 * réservation, et sur un téléphone empilerait une fenêtre de plus à fermer. À
 * l'inverse, le retirer du lien EXTERNE ferait quitter le site.
 *
 * Le comportement par défaut est le lien externe : une propriété oubliée doit
 * rendre le comportement d'avant, jamais le nouveau.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import { CalendlySlotPicker } from "../CalendlySlotPicker";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const CALENDLY = "https://calendly.com/axion-ia/premier-contact";
const DEBUT = "2026-08-04T07:00:00.000Z";

const DAYS = [
  {
    dateKey: "2026-08-04",
    slots: [{ startIso: DEBUT, schedulingUrl: `${CALENDLY}/2026-08-04T09:00:00` }],
  },
] as const;

/** Le lien d'un créneau — celui qui porte l'heure, pas la case de la grille. */
function lienDuCreneau(): HTMLAnchorElement {
  const a = screen
    .getAllByRole("link")
    .find((el) => el.getAttribute("data-cta") === "appel_slot_pick");
  if (!a) throw new Error("aucun lien de créneau rendu — le test ne mesure rien");
  return a as HTMLAnchorElement;
}

function rendre(props: Partial<Parameters<typeof CalendlySlotPicker>[0]> = {}) {
  cleanup();
  render(<CalendlySlotPicker days={DAYS} isFr height={720} dureeMinutes={45} {...props} />);
}

describe("🔴 drapeau ÉTEINT — le créneau mène chez Calendly, comme avant", () => {
  it("le lien est externe et s'ouvre dans un nouvel onglet", () => {
    rendre();
    const a = lienDuCreneau();
    expect(a.getAttribute("href")).toContain("calendly.com");
    expect(a.getAttribute("target"), "un lien externe doit quitter l'onglet").toBe("_blank");
    expect(a.getAttribute("rel")).toContain("noopener");
  });

  it("🔑 c'est le comportement PAR DÉFAUT, propriété absente", () => {
    // Une propriété oubliée doit rendre le comportement d'avant. L'inverse
    // enverrait tous les créneaux vers un formulaire éteint le jour où
    // quelqu'un ajoute un appelant sans lire ce fichier.
    //
    // ⚠️ On rend SANS la propriété plutôt qu'avec `undefined` : sous
    // `exactOptionalPropertyTypes`, les deux ne sont pas la même chose, et
    // c'est l'absence — le cas réel d'un appelant qui l'oublie — qu'il faut
    // mesurer.
    cleanup();
    render(<CalendlySlotPicker days={DAYS} isFr height={720} dureeMinutes={45} />);
    expect(lienDuCreneau().getAttribute("href")).toContain("calendly.com");
  });
});

describe("🔴 drapeau ALLUMÉ — le créneau reste chez nous", () => {
  it("le lien pointe vers notre formulaire, avec le créneau exact", () => {
    rendre({ reservationDirecte: true, locale: "fr" });
    const href = lienDuCreneau().getAttribute("href") ?? "";
    expect(href).toContain("/fr/appel/reserver");
    expect(href, "sans le créneau, le formulaire n'a rien à confirmer").toContain(
      encodeURIComponent(DEBUT),
    );
    expect(href, "aucun lien ne doit plus sortir vers Calendly").not.toContain("calendly.com");
  });

  it("🔴 il ne s'ouvre PAS dans un nouvel onglet", () => {
    // Le point qu'on oublie en changeant une destination : un nouvel onglet au
    // milieu d'une réservation fait perdre le fil, et sur téléphone il empile
    // une fenêtre de plus à fermer.
    rendre({ reservationDirecte: true, locale: "fr" });
    const a = lienDuCreneau();
    expect(a.getAttribute("target")).toBeNull();
    expect(a.getAttribute("rel")).toBeNull();
  });

  it("la locale est respectée", () => {
    rendre({ reservationDirecte: true, locale: "en" });
    expect(lienDuCreneau().getAttribute("href")).toContain("/en/appel/reserver");
  });
});

describe("🔴 une destination fournie par l'appelant l'emporte", () => {
  it("elle gagne même quand le drapeau est allumé", () => {
    // La troisième destination : le report. L'appelant la fournit, le sélecteur
    // n'a pas à la connaître.
    //
    // 🔑 Le test le plus important du bloc est celui-ci : la fonction doit
    // gagner AUSSI quand `reservationDirecte` est vrai. Sinon deux sources
    // décideraient du même lien, et le comportement dépendrait de l'ordre des
    // `if` — invisible en relecture, et faux un cas sur deux.
    rendre({
      reservationDirecte: true,
      locale: "fr",
      lienDuCreneau: (iso: string) => `/fr/appel/reporter?t=JETON&debut=${encodeURIComponent(iso)}`,
    });
    const href = lienDuCreneau().getAttribute("href") ?? "";
    expect(href).toContain("/fr/appel/reporter");
    expect(href, "le formulaire de réservation ne doit PAS l'emporter").not.toContain(
      "/appel/reserver",
    );
  });

  it("elle gagne aussi quand le drapeau est éteint", () => {
    rendre({
      lienDuCreneau: (iso: string) => `/fr/appel/reporter?t=JETON&debut=${encodeURIComponent(iso)}`,
    });
    const href = lienDuCreneau().getAttribute("href") ?? "";
    expect(href).toContain("/fr/appel/reporter");
    expect(href, "Calendly ne doit pas l'emporter non plus").not.toContain("calendly.com");
  });

  it("🔴 et le lien reste INTERNE — pas de nouvel onglet", () => {
    // Un report se fait dans le fil du parcours. Ouvrir un onglet au milieu
    // ferait perdre le fil, et sur téléphone empilerait une fenêtre à fermer.
    rendre({ lienDuCreneau: () => "/fr/appel/reporter?t=JETON" });
    expect(lienDuCreneau().getAttribute("target")).toBeNull();
  });

  it("le créneau exact lui est transmis", () => {
    rendre({ lienDuCreneau: (iso: string) => `/x?d=${encodeURIComponent(iso)}` });
    expect(lienDuCreneau().getAttribute("href")).toContain(encodeURIComponent(DEBUT));
  });
});

describe("🔑 CONTRE-TÉMOIN — les deux modes rendent des liens DIFFÉRENTS", () => {
  it("sinon les deux blocs ci-dessus mesureraient la même chose", () => {
    rendre();
    const eteint = lienDuCreneau().getAttribute("href");
    rendre({ reservationDirecte: true, locale: "fr" });
    const allume = lienDuCreneau().getAttribute("href");
    expect(eteint).not.toBe(allume);
  });
});
