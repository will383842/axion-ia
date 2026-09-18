/**
 * L'AFFICHAGE COMMUN de l'accusé de réception automatique — candidatures et
 * messages. Défaut relevé par Will le 2026-09-18 : l'écran « Messages » disait
 * « Sans réponse » et rien d'autre. La lecture est verrouillée par
 * `features/admin-submissions/__tests__/l-accuse-du-message-se-voit-dans-la-console.spec.ts`.
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import {
  BlocAccuse,
  LigneAccuse,
  MentionAccuse,
  badgeAccuse,
  libelleCompactAccuse,
  phraseAccuse,
  type AccuseAffiche,
} from "./AccuseReceptionAuto";

const BASE: AccuseAffiche = {
  etat: "envoye",
  date: new Date("2026-09-16T06:16:04Z"),
  essais: 1,
  motif: null,
  rebond: null,
  rattachement: "exact",
  absenceVoulue: null,
};

describe("les mots viennent de l'écran « E-mails envoyés »", () => {
  it("badge : libellés et tons du journal, jamais retapés", () => {
    expect(badgeAccuse(BASE)).toEqual({ tone: "success", libelle: "Envoyé" });
    expect(badgeAccuse({ ...BASE, etat: "echec" })).toEqual({
      tone: "destructive",
      libelle: "Échec",
    });
    expect(badgeAccuse({ ...BASE, etat: "rebond", rebond: "soft" }).libelle).toBe(
      "Rebond temporaire",
    );
    expect(badgeAccuse({ ...BASE, etat: "rebond", rebond: "hard" }).libelle).toBe(
      "Rebond définitif",
    );
  });

  it("mention de liste : « automatique », statut et date à l'heure de Paris", () => {
    expect(libelleCompactAccuse(BASE)).toBe("Accusé auto. : envoyé le 16/09");
    expect(libelleCompactAccuse({ ...BASE, etat: "absent", date: null })).toBe(
      "Aucun accusé auto. trouvé",
    );
    expect(
      libelleCompactAccuse({ ...BASE, etat: "absent", date: null, absenceVoulue: "voulu" }),
    ).toBe("Pas d’accusé auto. (voulu)");
  });
});

describe("les phrases sont NEUTRES — une candidature comme un message", () => {
  it("rappelle qu'un accusé n'est pas une réponse, sans nommer le type de demande", () => {
    const p = phraseAccuse(BASE);
    expect(p).toContain("Ce n’est pas une réponse");
    expect(p).not.toMatch(/candidature|message/i);
  });

  it("un rebond TEMPORAIRE ne met jamais l'adresse en doute, ni ne sonne l'alerte", () => {
    const soft: AccuseAffiche = { ...BASE, etat: "rebond", rebond: "soft", motif: "Mailbox full" };
    expect(phraseAccuse(soft)).toContain("l’adresse n’est pas en cause");
    expect(phraseAccuse(soft)).not.toContain("erronée");
    const html = renderToStaticMarkup(<BlocAccuse accuse={soft} />);
    expect(html).not.toContain('role="alert"');
    expect(html).toContain("Motif : Mailbox full");
  });

  it("un rebond DÉFINITIF dit que l'adresse est probablement erronée, en alerte", () => {
    const hard: AccuseAffiche = { ...BASE, etat: "rebond", rebond: "hard" };
    expect(phraseAccuse(hard)).toContain("probablement erronée");
    expect(renderToStaticMarkup(<BlocAccuse accuse={hard} />)).toContain('role="alert"');
  });

  it("l'échec est en alerte, avec son motif", () => {
    const html = renderToStaticMarkup(
      <BlocAccuse accuse={{ ...BASE, etat: "echec", motif: "Invalid login: 535" }} />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("Motif : Invalid login: 535");
  });

  it("l'absence voulue se dit sans être habillée en panne", () => {
    const html = renderToStaticMarkup(
      <BlocAccuse
        accuse={{
          ...BASE,
          etat: "absent",
          date: null,
          rattachement: null,
          absenceVoulue: "Aucun accusé, et c’est voulu : dossier en cours.",
        }}
      />,
    );
    expect(html).toContain("Non envoyé (voulu)");
    expect(html).not.toContain('role="alert"');
  });
});

describe("rendu serveur, sans JavaScript client", () => {
  it("les trois formes se rendent en HTML statique", () => {
    expect(renderToStaticMarkup(<MentionAccuse accuse={BASE} />)).toContain("Accusé auto.");
    expect(renderToStaticMarkup(<LigneAccuse accuse={BASE} />)).toContain(
      "Accusé de réception automatique",
    );
    expect(renderToStaticMarkup(<BlocAccuse accuse={BASE} />)).toContain("16 sept. 2026");
  });
});
