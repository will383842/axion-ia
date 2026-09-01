// @vitest-environment node

/**
 * Verrou — un créneau que la PAGE accepte doit être accepté par le VALIDATEUR.
 *
 * ## Le défaut que ce fichier interdit
 *
 * Deux endroits jugent le même créneau, et ils le font par des chemins
 * différents : la page appelle `creneauExploitable` avant d'afficher le
 * formulaire, l'action appelle `validerFormulaire` après l'envoi. Ils partagent
 * les mêmes constantes, mais pas le même code.
 *
 * Si la page devenait plus permissive que le validateur, le visiteur remplirait
 * un formulaire condamné d'avance : sept champs saisis au pouce, puis un refus
 * sur le seul champ qu'il ne peut pas corriger — le créneau. Il faudrait
 * retourner au calendrier, et personne ne le fait deux fois.
 *
 * Si le validateur devenait plus permissif que la page, l'effet serait
 * l'inverse et tout aussi silencieux : une réservation possible que la page
 * refuse d'afficher, donc un créneau visible au calendrier et inaccessible.
 *
 * ## Ce que ce fichier mesure
 *
 * Pas l'égalité des deux codes — leur ACCORD, sur les instants où l'écart
 * pourrait apparaître : de part et d'autre du préavis, de part et d'autre de
 * l'horizon, et sur les valeurs illisibles.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  creneauExploitable,
  validerFormulaire,
  HORIZON_JOURS,
  PREAVIS_MINUTES,
  CHAMPS,
} from "../formulaire-reservation";

const MAINTENANT = new Date("2026-09-01T12:00:00.000Z");
const T = MAINTENANT.getTime();

/** Le validateur accepte-t-il ce créneau ? (le reste de la saisie est correct) */
function validateurAccepteLeCreneau(debutIso: string): boolean {
  const fd = new FormData();
  fd.set(CHAMPS.debut, debutIso);
  fd.set(CHAMPS.nom, "Camille Prospect");
  fd.set(CHAMPS.email, "camille@exemple.fr");
  fd.set(CHAMPS.format, "visio");
  fd.set(CHAMPS.fuseau, "Europe/Paris");
  fd.set(CHAMPS.consent, "on");
  const r = validerFormulaire(fd, {
    questions: [],
    eventTypeUri: "https://api.calendly.com/event_types/x",
    maintenant: MAINTENANT,
  });
  // On n'interroge QUE le créneau : les autres champs sont corrects par
  // construction, donc une erreur ailleurs signalerait un test cassé, pas un
  // désaccord.
  if (r.ok) return true;
  return r.erreurs[CHAMPS.debut] === undefined;
}

/**
 * Les instants où un écart d'implémentation se verrait.
 *
 * 🔑 Choisis AUX BORNES et non au hasard. Une comparaison écrite `>=` d'un côté
 * et `>` de l'autre ne se distingue qu'à la seconde près — un jeu de valeurs
 * « raisonnables » passerait à côté, et c'est exactement le genre d'écart d'une
 * seule seconde qui survit à une relecture.
 */
const INSTANTS: ReadonlyArray<readonly [string, string]> = [
  ["hier", new Date(T - 86_400_000).toISOString()],
  ["il y a une minute", new Date(T - 60_000).toISOString()],
  ["maintenant, pile", new Date(T).toISOString()],
  [
    "une seconde AVANT la fin du préavis",
    new Date(T + PREAVIS_MINUTES * 60_000 - 1_000).toISOString(),
  ],
  ["exactement au préavis", new Date(T + PREAVIS_MINUTES * 60_000).toISOString()],
  ["une seconde APRÈS le préavis", new Date(T + PREAVIS_MINUTES * 60_000 + 1_000).toISOString()],
  ["dans une heure", new Date(T + 3_600_000).toISOString()],
  ["dans une semaine", new Date(T + 7 * 86_400_000).toISOString()],
  ["une seconde AVANT l'horizon", new Date(T + HORIZON_JOURS * 86_400_000 - 1_000).toISOString()],
  ["exactement à l'horizon", new Date(T + HORIZON_JOURS * 86_400_000).toISOString()],
  ["une seconde APRÈS l'horizon", new Date(T + HORIZON_JOURS * 86_400_000 + 1_000).toISOString()],
  ["dans un an", new Date(T + 365 * 86_400_000).toISOString()],
  ["vide", ""],
  ["illisible", "demain matin"],
  ["date impossible", "2026-13-45T99:99:99Z"],
];

describe("🔴 la page et le validateur ne divergent sur aucun instant", () => {
  for (const [nom, iso] of INSTANTS) {
    it(`« ${nom} » : même verdict des deux côtés`, () => {
      const page = creneauExploitable(iso, MAINTENANT);
      const validateur = validateurAccepteLeCreneau(iso);
      expect(
        page,
        page
          ? `la page afficherait le formulaire pour « ${nom} », que le validateur REFUSE : ` +
              `le visiteur saisirait tout pour rien, et sur le seul champ qu'il ne peut pas corriger`
          : `la page REFUSE « ${nom} », que le validateur accepterait : ` +
              `un créneau visible au calendrier et inaccessible`,
      ).toBe(validateur);
    });
  }
});

/**
 * 🔴 CE FICHIER EST DEVENU EN PARTIE TAUTOLOGIQUE, ET IL FAUT LE DIRE.
 *
 * Le tableau ci-dessus compare `creneauExploitable` à `validerFormulaire`. Il a
 * trouvé une vraie divergence — un désaccord d'une seconde aux bornes — et la
 * correction a consisté à faire DÉLÉGUER le validateur à `creneauExploitable`.
 *
 * Depuis, les deux membres de l'égalité sont le même appel. La comparaison ne
 * peut plus rien découvrir : garde et chose gardée partagent l'implémentation,
 * exactement le motif que ce dépôt a rencontré quatre fois le 2026-09-01.
 *
 * Elle garde une valeur, mais une seule : elle rougirait si quelqu'un
 * réintroduisait une comparaison écrite à la main dans le validateur. C'est
 * précisément ce que le contrôle ci-dessous vérifie DIRECTEMENT, sur la source —
 * et lui, il ne peut pas devenir tautologique.
 */
describe("🔴 le validateur ne rejuge PAS le créneau lui-même", () => {
  it("il délègue, et la source le montre", () => {
    const source = readFileSync(
      join(process.cwd(), "src/server/calendly/formulaire-reservation.ts"),
      "utf8",
    );
    // La fenêtre : le corps de `validerFormulaire`, du début jusqu'aux erreurs
    // d'identité — c'est là que vivait la comparaison rejouée.
    const fenetre = /const debutLisible[\s\S]{0,1400}/.exec(source)?.[0] ?? "";
    expect(fenetre, "le bloc du créneau est introuvable : la fenêtre est à refaire").not.toBe("");

    expect(
      fenetre.includes("creneauExploitable("),
      "le validateur doit APPELER `creneauExploitable`, pas rejouer sa comparaison",
    ).toBe(true);

    // ⚠️ ON NE MESURE QUE LE VERDICT, PAS LES COMPARAISONS.
    //
    // Premier jet : un motif qui refusait toute comparaison de bornes dans la
    // fenêtre. Il a rougi tout de suite — sur une comparaison parfaitement
    // légitime, celle qui choisit le MESSAGE (« passé » plutôt que « trop
    // lointain ») à l'intérieur même du bloc de délégation.
    //
    // La distinction est le sujet : ce qui a divergé d'une seconde, ce n'est pas
    // qu'une comparaison existe, c'est qu'elle DÉCIDE. Tant que le `if` porte
    // sur `creneauExploitable`, les branches internes ne peuvent plus contredire
    // la page — elles ne se lisent que lorsque le verdict est déjà tombé.
    expect(
      /if\s*\(\s*!creneauExploitable\(/.test(fenetre),
      "le verdict doit être PORTÉ par `creneauExploitable` : c'est le `if` qui " +
        "compte, pas la présence d'un appel plus bas. Un `if` écrit à la main " +
        "rouvrirait le désaccord d'une seconde avec la page.",
    ).toBe(true);
  });
});

describe("🔑 CONTRE-TÉMOIN — les deux ne disent pas toujours la même chose", () => {
  it("il existe des instants acceptés ET des instants refusés", () => {
    // Sans lui, deux fonctions qui refuseraient TOUT — ou accepteraient tout —
    // passeraient l'accord ci-dessus en étant toutes deux cassées.
    const verdicts = INSTANTS.map(([, iso]) => creneauExploitable(iso, MAINTENANT));
    expect(verdicts, "aucun créneau accepté : les deux fonctions sont cassées").toContain(true);
    expect(verdicts, "aucun créneau refusé : les deux fonctions sont cassées").toContain(false);
  });
});
