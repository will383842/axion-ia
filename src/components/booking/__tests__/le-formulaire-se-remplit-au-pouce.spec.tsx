/**
 * Verrou — le formulaire de réservation reste utilisable au pouce, sur un
 * téléphone, debout, d'une main.
 *
 * ## Pourquoi une garde plutôt qu'une relecture
 *
 * Les sept décisions « mobile d'abord » de ce formulaire ne se voient pas sur un
 * écran d'ordinateur. Un `type="text"` là où il faut `type="email"` s'affiche
 * exactement pareil ; il ouvre simplement le mauvais clavier sur le téléphone du
 * prospect, qui cherche l'arobase et abandonne. Un `autoComplete` retiré « parce
 * qu'il polluait les tests » oblige à tout saisir à la main. Un champ à 14 px au
 * lieu de 16 fait zoomer iOS à la mise au point et décale la page au moment
 * précis où le visiteur commence à taper.
 *
 * Aucune de ces régressions ne casse quoi que ce soit. Aucune ne se voit en
 * relecture de code. Toutes coûtent des rendez-vous, et aucune ne laisse de
 * trace — on ne mesure pas les gens qui renoncent.
 *
 * ## Ce que ce fichier ne peut PAS vérifier, et il faut le dire
 *
 * Que la page tienne réellement sur un écran de 375 px, que le bouton soit
 * atteignable au pouce, ou que rien ne déborde latéralement. Cela se mesure dans
 * un navigateur, à la main, sur un vrai téléphone — et c'est le dernier critère
 * de fin d'étape du plan. Ici on garde ce qui est vérifiable en unité : les
 * attributs, les tailles déclarées, et l'ordre du document.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";

import { FormulaireReservation } from "../FormulaireReservation";
import type { QuestionEventType } from "@/server/calendly/questions";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const QUESTION: QuestionEventType = {
  libelle: "Quel est votre besoin ?",
  type: "text",
  position: 0,
  requise: true,
  choix: [],
  autreAutorise: false,
  champ: "q0",
};

async function rendre(props: Record<string, unknown> = {}) {
  cleanup();
  render(
    <FormulaireReservation
      debutIso="2026-09-10T09:30:00.000Z"
      creneauLisible="Jeudi 10 septembre à 11 h 30"
      dureeMinutes={45}
      questions={[QUESTION]}
      action={async () => {}}
      locale="fr"
      champLocale="locale"
      champLeurre="website"
      {...props}
    />,
  );
}

function champ(nom: string): HTMLElement {
  const el = document.querySelector(`[name="${nom}"]`);
  if (!el) throw new Error(`champ « ${nom} » absent — le test ne mesure rien`);
  return el as HTMLElement;
}

describe("🔴 le bon clavier s'ouvre", () => {
  it("l'e-mail ouvre un clavier d'e-mail", async () => {
    // Chercher l'arobase dans un clavier alphabétique fait abandonner.
    await rendre();
    const e = champ("email");
    expect(e.getAttribute("type")).toBe("email");
    expect(e.getAttribute("inputmode")).toBe("email");
  });

  it("le téléphone ouvre un pavé numérique AVEC le « + »", async () => {
    // On EXIGE l'indicatif pays. Sans `inputMode="tel"`, le « + » qu'on réclame
    // est introuvable au pouce.
    await rendre();
    const t = champ("telephone");
    expect(t.getAttribute("type")).toBe("tel");
    expect(t.getAttribute("inputmode")).toBe("tel");
  });
});

describe("🔴 le téléphone propose ce qu'il connaît déjà", () => {
  it("les trois champs d'identité portent leur autoComplete", async () => {
    // Sans ces attributs, tout se saisit à la main — et un caractère de travers
    // sur l'e-mail coûte le rendez-vous, sans que personne ne le sache.
    await rendre();
    expect(champ("nom").getAttribute("autocomplete")).toBe("name");
    expect(champ("email").getAttribute("autocomplete")).toBe("email");
    expect(champ("telephone").getAttribute("autocomplete")).toBe("tel");
  });
});

describe("🔴 les cibles se visent au pouce", () => {
  it("chaque champ de saisie fait 16 px de texte — sinon iOS zoome", async () => {
    // En dessous de 16 px, iOS agrandit la page à la mise au point et la
    // décale : le visiteur perd le champ des yeux en commençant à taper.
    await rendre();
    for (const nom of ["nom", "email", "telephone", "fuseau", "q0", "invites"]) {
      expect(
        champ(nom).className,
        `« ${nom} » doit porter text-base (16 px), sinon iOS zoome à la mise au point`,
      ).toContain("text-base");
    }
  });

  it("les champs d'une ligne font 48 px de haut", async () => {
    await rendre();
    for (const nom of ["nom", "email", "telephone", "fuseau"]) {
      expect(champ(nom).className, `« ${nom} » doit faire h-12`).toContain("h-12");
    }
  });

  it("🔴 le choix du format est un BLOC entier cliquable, pas un rond", async () => {
    // On ne vise pas un rond de 16 px au pouce. Le `<label>` doit envelopper le
    // bouton radio pour que toute la surface réponde — y compris le texte
    // explicatif.
    await rendre();
    const radio = document.querySelector('input[name="format"][value="visio"]');
    expect(radio).not.toBeNull();
    const label = radio?.closest("label");
    expect(label, "le bouton radio doit être DANS un <label>").not.toBeNull();
    expect(
      within(label as HTMLElement).getByText(/visioconférence/i),
      "le libellé doit être dans la zone cliquable",
    ).toBeTruthy();
  });

  it("le bouton d'envoi est pleine largeur", async () => {
    await rendre();
    const b = screen.getByRole("button", { name: /confirmer ce rendez-vous/i });
    expect(b.className).toContain("w-full");
    expect(b.className).toContain("h-12");
  });

  it("🔑 le bouton n'est PAS une barre fixe en bas d'écran", async () => {
    // La régression tentante. Une barre fixe recouvrirait la case à cocher de
    // consentement, qui est le dernier champ et le plus facile à oublier.
    await rendre();
    const b = screen.getByRole("button", { name: /confirmer ce rendez-vous/i });
    const conteneur = b.parentElement?.className ?? "";
    expect(conteneur).not.toContain("fixed");
    expect(conteneur).not.toContain("sticky");
  });
});

describe("🔴 une erreur se lit là où elle s'est produite", () => {
  const ERREURS = { email: "Cet e-mail semble incomplet." };

  it("le message est AU-DESSUS du champ, pas seulement en haut de page", async () => {
    // Sur un écran de téléphone, le haut de page est souvent déjà hors de vue
    // quand on découvre le refus.
    await rendre({ erreurs: ERREURS, valeurs: { email: "camille@" } });
    const msg = screen.getByText("Cet e-mail semble incomplet.");
    const input = champ("email");
    // `compareDocumentPosition` : le message PRÉCÈDE le champ dans le document.
    expect(
      msg.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING,
      "le message doit précéder le champ qu'il concerne",
    ).toBeTruthy();
  });

  it("le champ fautif est désigné aux lecteurs d'écran", async () => {
    await rendre({ erreurs: ERREURS, valeurs: { email: "camille@" } });
    const input = champ("email");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toContain("email-erreur");
  });

  it("🔑 un champ SANS erreur ne se déclare pas invalide", async () => {
    // Contre-témoin : `aria-invalid="false"` partout rendrait le test ci-dessus
    // vrai pour la mauvaise raison, et surtout ferait annoncer « invalide » sur
    // des champs corrects.
    await rendre({ erreurs: ERREURS });
    expect(champ("nom").getAttribute("aria-invalid")).toBeNull();
  });

  it("🔴 rien de ce que le visiteur a tapé n'est perdu au re-rendu", async () => {
    // La propriété qui décide s'il va au bout. Elle est invisible en relecture :
    // le formulaire « marche » sans elle.
    await rendre({
      erreurs: ERREURS,
      valeurs: { nom: "Camille Prospect", email: "camille@", q0: "Un audit." },
    });
    expect((champ("nom") as HTMLInputElement).value).toBe("Camille Prospect");
    expect((champ("email") as HTMLInputElement).value).toBe("camille@");
    expect((champ("q0") as HTMLTextAreaElement).value).toBe("Un audit.");
  });
});

describe("🔴 aucun format n'est coché d'avance", () => {
  it("au premier affichage, les deux boutons sont libres", async () => {
    // Pré-cocher ferait réserver une visio à qui n'a rien choisi, et le champ
    // passerait la validation sans que personne n'ait décidé.
    await rendre();
    const radios = document.querySelectorAll<HTMLInputElement>('input[name="format"]');
    expect(radios).toHaveLength(2);
    for (const r of radios) expect(r.checked).toBe(false);
  });

  it("après un refus, le choix du visiteur est retrouvé", async () => {
    await rendre({ valeurs: { format: "telephone" }, erreurs: { nom: "Indiquez votre nom." } });
    const tel = document.querySelector<HTMLInputElement>('input[name="format"][value="telephone"]');
    expect(tel?.checked).toBe(true);
  });
});

describe("🔴 le leurre est invisible SANS être caché", () => {
  it("il n'est ni annoncé, ni atteignable au clavier, ni pré-remplissable", async () => {
    // Les trois manières de transformer un piège à robots en piège à humains :
    // un lecteur d'écran qui l'annonce, une touche de tabulation qui y tombe,
    // ou un navigateur qui le remplit tout seul. Chacune ferait passer un
    // visiteur parfaitement légitime pour une machine — et le pire, c'est qu'on
    // lui rendrait un faux succès, donc il attendrait un rendez-vous qui
    // n'existe pas.
    await rendre();
    const leurre = champ("website") as HTMLInputElement;
    expect(leurre.tabIndex).toBe(-1);
    expect(leurre.getAttribute("autocomplete")).toBe("off");
    expect(leurre.value).toBe("");
    expect(
      leurre.closest("[aria-hidden='true']"),
      "le leurre doit être hors de l'arbre d'accessibilité",
    ).not.toBeNull();
  });

  it("🔑 il n'est PAS de type hidden — un robot soigneux les ignore", async () => {
    // La régression tentante : « c'est un champ technique, mettons-le hidden ».
    // Ce serait rendre le piège inopérant contre exactement les robots qui
    // valent la peine d'être attrapés.
    await rendre();
    expect(champ("website").getAttribute("type")).toBe("text");
  });
});

describe("le créneau et la locale voyagent sans être saisis", () => {
  it("les deux champs cachés sont présents et renseignés", async () => {
    // 🔑 Le créneau est le champ le plus coûteux à perdre : il ne se retape pas,
    // il faut retourner au calendrier. La locale, elle, est la seule chose qui
    // empêche une redirection finale vers la mauvaise langue — une action
    // serveur ne reçoit PAS les paramètres de route.
    await rendre();
    expect((champ("debut") as HTMLInputElement).value).toBe("2026-09-10T09:30:00.000Z");
    expect((champ("locale") as HTMLInputElement).value).toBe("fr");
  });
});
