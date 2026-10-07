// @vitest-environment node

/**
 * Verrou — la question « Comment nous avez-vous connu ? » s'affiche et part TELLE
 * QUELLE sur les quatre parcours (2026-10-05).
 *
 * Will vient de poser cette liste déroulante OBLIGATOIRE (neuf choix) sur les
 * quatre types chez Calendly. Notre formulaire remplace celui de Calendly : la
 * règle de `questions.ts` est qu'une question qu'il ne sait pas rendre le FERME, et
 * qu'une question qu'il rend part avec son libellé EXACT — Calendly apparie les
 * réponses sur le texte, casse et accents compris.
 *
 * Quatre preuves, pour CHAQUE type :
 *   1. l'événement se résout et la question est rendable (le formulaire n'est pas
 *      fermé) ;
 *   2. le formulaire l'affiche : libellé exact, liste de neuf choix, obligatoire ;
 *   3. sans réponse, la saisie est REFUSÉE (c'est une question requise) ;
 *   4. avec une réponse, elle part dans `questions_and_answers` avec son libellé
 *      exact, sa position, et le choix tel quel.
 *
 * Les NEUF choix ci-dessous sont des valeurs d'essai : rien ne dépend de leur
 * texte, et c'est justement ce qu'on prouve — le code les lit chez Calendly.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FormulaireReservation } from "@/components/booking/FormulaireReservation";
import { resoudreEventTypePourReservation } from "../availability";
import { CHAMPS, validerFormulaire } from "../formulaire-reservation";
import { corpsDeLaDemande } from "../reservation";
import {
  CHOIX_RENDEZ_VOUS,
  configDuChoix,
  formatsProposes,
  urlConfigureeDuChoix,
  type ChoixRendezVous,
} from "../types-reservables";

/** Le libellé EXACT de la question — espace avant le point d'interrogation compris. */
const LIBELLE = "Comment nous avez-vous connu ?";

const CHOIX_DE_LA_LISTE = [
  "Recherche Google",
  "LinkedIn",
  "Facebook",
  "Instagram",
  "Bouche-à-oreille",
  "Salon ou événement",
  "Article ou presse",
  "Recommandation d'un partenaire",
  "Autre",
] as const;

const USER_URI = "https://api.calendly.com/users/USER";

/** La question telle que l'API Calendly la renvoie : liste déroulante, requise, neuf choix. */
function questionConnu(position: number): Record<string, unknown> {
  return {
    name: LIBELLE,
    type: "single_select",
    position,
    enabled: true,
    required: true,
    answer_choices: [...CHOIX_DE_LA_LISTE],
    include_other: false,
  };
}

/** Le compte : quatre événements, chacun avec SES questions et la question commune en plus. */
function simulerLeCompte() {
  const types = CHOIX_RENDEZ_VOUS.map((choix, i) => ({
    uri: `https://api.calendly.com/event_types/T${i}`,
    name: configDuChoix(choix).nom,
    slug: configDuChoix(choix).route,
    active: true,
    duration: 30,
    scheduling_url: urlConfigureeDuChoix(choix),
    custom_questions: [
      // Une question propre au type, avant la commune : la position de la
      // question commune n'est donc PAS la même d'un type à l'autre.
      {
        name: "Votre société ?",
        type: "string",
        position: 0,
        enabled: true,
        required: false,
        answer_choices: [],
        include_other: false,
      },
      questionConnu(1 + i),
    ],
    locations: [{ kind: "google_conference" }, { kind: "physical", location: "Lyon" }],
  }));
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url.includes("/users/me")) {
        return Promise.resolve(new Response(JSON.stringify({ resource: { uri: USER_URI } })));
      }
      if (url.includes("/event_types?")) {
        return Promise.resolve(new Response(JSON.stringify({ collection: types })));
      }
      return Promise.resolve(new Response("{}", { status: 404 }));
    }),
  );
  process.env.CALENDLY_API_TOKEN = "pat_test_token";
}

beforeEach(() => {
  for (const v of [
    "NEXT_PUBLIC_CALENDLY_APPEL_URL",
    "NEXT_PUBLIC_CALENDLY_DIAGNOSTIC_URL",
    "CALENDLY_APPORTEUR_URL",
    "CALENDLY_SALON_URL",
  ]) {
    delete process.env[v];
  }
  simulerLeCompte();
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.CALENDLY_API_TOKEN;
});

function saisie(champsQuestion: Record<string, string>, format: string): FormData {
  const fd = new FormData();
  fd.set(CHAMPS.debut, new Date(Date.now() + 3 * 86_400_000).toISOString());
  fd.set(CHAMPS.nom, "Camille Martin");
  fd.set(CHAMPS.email, "camille@exemple.fr");
  fd.set(CHAMPS.format, format);
  fd.set(CHAMPS.telephone, "+33 6 12 34 56 78");
  fd.set(CHAMPS.consent, "on");
  for (const [champ, valeur] of Object.entries(champsQuestion)) fd.set(champ, valeur);
  return fd;
}

describe.each(CHOIX_RENDEZ_VOUS.map((c) => [c]))("parcours « %s »", (choix: ChoixRendezVous) => {
  it("1. la question est rendable : le formulaire n'est PAS fermé", async () => {
    const et = await resoudreEventTypePourReservation(urlConfigureeDuChoix(choix));
    expect(et, "l'événement doit se résoudre et ses questions se lire").not.toBeNull();
    const q = et?.questions.find((x) => x.libelle === LIBELLE);
    expect(q, "la question doit être lue chez Calendly").toBeDefined();
    expect(q?.type).toBe("single_select");
    expect(q?.requise).toBe(true);
    expect(q?.choix).toEqual([...CHOIX_DE_LA_LISTE]);
    expect(q?.choix).toHaveLength(9);
  });

  it("2. le formulaire l'affiche : libellé exact, neuf choix, obligatoire", async () => {
    const et = await resoudreEventTypePourReservation(urlConfigureeDuChoix(choix));
    if (!et) throw new Error("événement non résolu");
    const html = renderToStaticMarkup(
      <FormulaireReservation
        debutIso="2026-10-08T09:00:00.000Z"
        creneauLisible="Jeudi 8 octobre à 11:00"
        dureeMinutes={et.dureeMinutes ?? 30}
        questions={et.questions}
        action={async () => {}}
        formats={formatsProposes(choix, et.lieux?.formats)}
        locale="fr"
        champLocale="locale"
        champLeurre="website"
      />,
    );
    // Le libellé, tel qu'il est écrit chez Calendly (le `?` n'est pas échappé en HTML).
    expect(html).toContain(LIBELLE);
    const q = et.questions.find((x) => x.libelle === LIBELLE);
    expect(html).toContain(`<select id="${q?.champ}" name="${q?.champ}"`);
    const select = html.slice(html.indexOf(`<select id="${q?.champ}"`));
    const options = select.slice(0, select.indexOf("</select>"));
    for (const c of CHOIX_DE_LA_LISTE) {
      // L'apostrophe est échappée en HTML : on compare au texte, pas au balisage.
      expect(options.replace(/&#x27;/g, "'")).toContain(`value="${c}"`);
    }
    // Obligatoire : l'étoile et l'attribut.
    expect(options.slice(0, 400)).toContain("required");
  });

  it("3. sans réponse, la saisie est REFUSÉE — c'est une question requise", async () => {
    const et = await resoudreEventTypePourReservation(urlConfigureeDuChoix(choix));
    if (!et) throw new Error("événement non résolu");
    const formats = formatsProposes(choix, et.lieux?.formats);
    const r = validerFormulaire(saisie({}, formats[0] ?? "visio"), {
      questions: et.questions,
      eventTypeUri: et.uri,
      formats,
    });
    expect(r.ok).toBe(false);
    const champ = et.questions.find((x) => x.libelle === LIBELLE)?.champ ?? "";
    if (!r.ok) expect(r.erreurs[champ]).toBe("Cette réponse est nécessaire.");
  });

  it("3 bis. une valeur hors liste est refusée (le HTML se réécrit en deux secondes)", async () => {
    const et = await resoudreEventTypePourReservation(urlConfigureeDuChoix(choix));
    if (!et) throw new Error("événement non résolu");
    const champ = et.questions.find((x) => x.libelle === LIBELLE)?.champ ?? "";
    const formats = formatsProposes(choix, et.lieux?.formats);
    const r = validerFormulaire(saisie({ [champ]: "Un choix inventé" }, formats[0] ?? "visio"), {
      questions: et.questions,
      eventTypeUri: et.uri,
      formats,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreurs[champ]).toBe("Choisissez une des réponses proposées.");
  });

  it("4. avec une réponse, elle part chez Calendly avec son libellé EXACT", async () => {
    const et = await resoudreEventTypePourReservation(urlConfigureeDuChoix(choix));
    if (!et) throw new Error("événement non résolu");
    const q = et.questions.find((x) => x.libelle === LIBELLE);
    const formats = formatsProposes(choix, et.lieux?.formats);
    const r = validerFormulaire(
      saisie({ [q?.champ ?? ""]: "Salon ou événement" }, formats[0] ?? "visio"),
      { questions: et.questions, eventTypeUri: et.uri, formats },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const envoye = corpsDeLaDemande(r.demande)["questions_and_answers"] as Array<
      Record<string, unknown>
    >;
    expect(envoye).toContainEqual({
      question: LIBELLE,
      answer: "Salon ou événement",
      position: q?.position,
    });
  });
});
