// @vitest-environment node

/**
 * Tests — le critère de SÉRIE, et ce qu'il ajoute au critère de TAUX.
 *
 * ## 🔴 Une hypothèse fausse, écartée PAR CE FICHIER
 *
 * La première version de ce test affirmait que l'ancien critère (≥ 3 échecs
 * dans une fenêtre glissante de 6 h) était resté MUET pendant les 43 heures de
 * l'incident du 2026-09-15. **C'est faux, et le test l'a dit avant la PR** :
 * 19 échecs sur 43 heures, c'est plus de 7 fenêtres de 6 heures pour 19
 * événements — par principe des tiroirs, au moins une fenêtre en contient 3.
 * Le premier bloc ci-dessous CONSERVE cette mesure, à l'endroit, pour que
 * personne ne reprenne la mauvaise piste : **le seuil n'était pas le défaut.**
 *
 * ## Ce que la série ajoute quand même, et qui est mesurable
 *
 * Un critère de taux mesure le TRAFIC autant que la panne : il lui faut au
 * moins 0,5 échec par heure. En dessous — un vendredi soir, un week-end, une
 * file peu active — la chaîne peut être morte pendant des jours sans qu'aucune
 * fenêtre n'atteigne 3. Le second bloc éprouve exactement ce cas.
 *
 * La série, elle, ne dépend ni du volume ni de l'espacement : trois échecs
 * d'affilée **sans un seul succès entre eux**, et c'est tout.
 */

import { describe, it, expect } from "vitest";

import {
  analyserSerie,
  depuisCombienDeTemps,
  doitAlerterSerie,
  estEchecDestinataire,
  resumeSerie,
  SERIE_VIDE,
  SEUIL_ECHECS_CONSECUTIFS,
  type LigneEchec,
} from "./serie-echecs";

const AUTH = "Invalid login: 535 Authentication Failed";

function echec(
  heuresApresDepart: number,
  recipient: string,
  error: string | null = AUTH,
): LigneEchec {
  const t = new Date(DEPART.getTime() + heuresApresDepart * 3600_000);
  return { recipient, template: "candidature-accuse-reception", error, failedAt: t, createdAt: t };
}

/** 2026-09-15 13 h 17 — première tentative refusée en production. */
const DEPART = new Date("2026-09-15T13:17:00.000Z");
/** 2026-09-17 08 h 40 — découverte, 43 h plus tard. */
const DECOUVERTE = new Date("2026-09-17T08:40:00.000Z");

/**
 * Les 19 échecs réels, étalés le plus DÉFAVORABLEMENT possible pour la
 * détection : régulièrement, sur les 43 heures. C'est le pire cas pour un
 * critère de taux, et il est réaliste — des accusés de réception de candidature
 * arrivent au fil de l'eau, pas en rafale.
 */
const INCIDENT: LigneEchec[] = Array.from({ length: 19 }, (_, i) =>
  echec((i * 43) / 19, `candidat${i}@exemple.fr`),
);

/**
 * Rejoue le critère de TAUX : un `count` sur `failedAt >= maintenant - 6 h`,
 * évalué à chaque passage horaire du cron. Rend le maximum atteint.
 */
function maxParFenetreDe6h(echecs: readonly LigneEchec[], dureeH: number): number {
  let max = 0;
  for (let h = 0; h <= dureeH; h += 1) {
    const fin = new Date(DEPART.getTime() + h * 3600_000);
    const debut = new Date(fin.getTime() - 6 * 3600_000);
    const dedans = echecs.filter(
      (l) => (l.failedAt as Date) >= debut && (l.failedAt as Date) <= fin,
    ).length;
    max = Math.max(max, dedans);
  }
  return max;
}

describe("l'incident du 2026-09-15 — 19 échecs, 43 heures", () => {
  it("🔴 le SEUIL n'était pas le défaut : la fenêtre de 6 h atteint bien 3 ici", () => {
    // Mesure conservée à l'endroit, contre la mauvaise piste. 19 événements
    // dans plus de 7 fenêtres de 6 heures : une fenêtre en contient forcément
    // 3. Chercher la cause du silence dans le seuil est donc une impasse — elle
    // est dans ce que l'alerte DEVIENT une fois levée (cf. `health.spec.ts` :
    // une alerte jamais refermée dé-duplique toutes les suivantes).
    expect(maxParFenetreDe6h(INCIDENT, 43)).toBeGreaterThanOrEqual(3);
  });

  it("🔴 mais le TAUX est aveugle dès que la panne est plus lente que 3 / 6 h", () => {
    // Le cas réel qui vient : une clé révoquée un vendredi soir, sur un
    // week-end sans trafic. Cinq envois en trente heures, espacés de sept
    // heures — jamais 3 dans une même fenêtre, donc JAMAIS d'alerte de taux,
    // quelle que soit la durée de la panne.
    const weekEnd = [0, 7, 14, 21, 28].map((h, i) => echec(h, `personne${i}@exemple.fr`));

    expect(
      maxParFenetreDe6h(weekEnd, 30),
      "si ce nombre atteint 3, ce test ne démontre plus rien : revoir l'espacement",
    ).toBeLessThan(3);

    // La série, elle, est atteinte au troisième — soit après 14 heures de
    // panne, et non jamais.
    expect(doitAlerterSerie(analyserSerie(weekEnd.slice(0, 3)))).toBe(true);
  });

  it("🔴 la série alerte dès le TROISIÈME échec", () => {
    const troisPremiers = INCIDENT.slice(0, SEUIL_ECHECS_CONSECUTIFS);
    expect(doitAlerterSerie(analyserSerie(troisPremiers))).toBe(true);

    // Et a fortiori sur la série complète.
    const serie = analyserSerie(INCIDENT);
    expect(serie.total).toBe(19);
    expect(serie.chaine).toBe(19);
    expect(doitAlerterSerie(serie)).toBe(true);
  });

  it("dit COMBIEN de personnes et DEPUIS QUAND, pas une liste d'identifiants", () => {
    const serie = analyserSerie(INCIDENT);
    expect(serie.destinatairesDistincts).toBe(19);
    expect(serie.depuis).toEqual(DEPART);

    const phrase = resumeSerie(serie, DECOUVERTE);
    expect(phrase).toContain("19 envoi(s)");
    expect(phrase).toContain("19 destinataires distincts");
    expect(phrase).toContain("43 h");
  });

  it("remonte le motif du relais, pour qu'on sache quoi réparer", () => {
    expect(analyserSerie(INCIDENT).motif).toContain("535");
  });
});

describe("ce qui NE doit PAS alerter", () => {
  it("un échec isolé ne lève rien — une adresse invalide arrive tous les jours", () => {
    expect(doitAlerterSerie(analyserSerie([echec(0, "a@b.fr")]))).toBe(false);
  });

  it("deux échecs consécutifs ne lèvent rien non plus", () => {
    expect(doitAlerterSerie(analyserSerie([echec(0, "a@b.fr"), echec(1, "c@d.fr")]))).toBe(false);
  });

  it("🔴 trois REBONDS d'adresse d'affilée ne sont PAS une panne de chaîne", () => {
    // Le piège du critère de série : une campagne de recrutement sur un vieux
    // fichier peut aligner trois adresses mortes. Le relais fonctionne ; crier
    // « aucun e-mail ne part » désarmerait l'alerte avant qu'elle serve.
    const serie = analyserSerie([
      echec(0, "parti@ancienne-boite.fr", "550 5.1.1 <parti@ancienne-boite.fr> User unknown"),
      echec(1, "ferme@exemple.fr", "550 5.1.1 Recipient address rejected: User unknown"),
      echec(2, "plein@exemple.fr", "552 5.2.2 Mailbox full"),
    ]);
    expect(serie.total).toBe(3);
    expect(serie.destinataire).toBe(3);
    expect(serie.chaine).toBe(0);
    expect(doitAlerterSerie(serie)).toBe(false);
  });

  it("une série vide ne lève rien", () => {
    expect(analyserSerie([])).toEqual(SERIE_VIDE);
    expect(doitAlerterSerie(SERIE_VIDE)).toBe(false);
  });
});

describe("le doute profite à l'alerte", () => {
  it("🔴 un motif ABSENT compte comme une panne de chaîne", () => {
    // Un prédicat qui échoue fermé recréerait le silence de 43 heures : un
    // relais rendant une erreur qu'on n'a pas prévue redeviendrait invisible.
    const serie = analyserSerie([
      echec(0, "a@b.fr", null),
      echec(1, "c@d.fr", ""),
      echec(2, "e@f.fr", "   "),
    ]);
    expect(serie.chaine).toBe(3);
    expect(doitAlerterSerie(serie)).toBe(true);
  });

  it("🔴 un motif INCONNU compte comme une panne de chaîne", () => {
    const serie = analyserSerie([
      echec(0, "a@b.fr", "451 4.3.0 Temporary server error, please retry"),
      echec(1, "c@d.fr", "quelque chose que personne n'a prévu"),
      echec(2, "e@f.fr", "ECONNREFUSED 10.0.0.1:587"),
    ]);
    expect(serie.chaine).toBe(3);
    expect(doitAlerterSerie(serie)).toBe(true);
  });

  it("un mélange alerte dès que trois échecs de CHAÎNE sont là", () => {
    const serie = analyserSerie([
      echec(0, "mort@exemple.fr", "550 5.1.1 User unknown"),
      echec(1, "a@b.fr", AUTH),
      echec(2, "c@d.fr", AUTH),
      echec(3, "e@f.fr", AUTH),
    ]);
    expect(serie.total).toBe(4);
    expect(serie.destinataire).toBe(1);
    expect(serie.chaine).toBe(3);
    expect(doitAlerterSerie(serie)).toBe(true);
  });
});

describe("estEchecDestinataire — le classement, motif par motif", () => {
  const boiteDEnFace = [
    "550 5.1.1 <x@y.fr>: Recipient address rejected: User unknown in virtual mailbox table",
    "553 5.1.3 Invalid address",
    "552 5.2.2 Mailbox full",
    "5.2.1 mailbox disabled",
    "No such user here",
    "Invalid recipients: x@y.fr",
  ];
  const notreChaine = [
    AUTH,
    "535 5.7.8 Username and Password not accepted",
    "421 4.7.0 Try again later, too many connections",
    "454 4.7.0 Temporary authentication failure",
    "ETIMEDOUT",
    "Daily sending quota exceeded",
    // Un « 550 » nu, sans mot désignant la boîte : rejet de politique côté
    // relais (réputation, SPF). C'est NOTRE problème, pas celui du destinataire.
    "550 Message rejected due to policy",
  ];

  it("🔴 reconnaît les refus imputables au destinataire", () => {
    for (const m of boiteDEnFace) {
      expect(estEchecDestinataire(m), `classé « chaîne » à tort : ${m}`).toBe(true);
    }
  });

  it("🔑 CONTRE-TÉMOIN : n'avale PAS les pannes de chaîne", () => {
    // Sans ce bloc, un prédicat qui rendrait `true` pour tout passerait le test
    // précédent en paraissant juste — et éteindrait l'alerte sur l'incident même
    // qu'on répare.
    for (const m of notreChaine) {
      expect(estEchecDestinataire(m), `classé « destinataire » à tort : ${m}`).toBe(false);
    }
    expect(estEchecDestinataire(null)).toBe(false);
  });
});

describe("depuisCombienDeTemps", () => {
  const t0 = new Date("2026-09-15T13:17:00.000Z");
  const plus = (ms: number): Date => new Date(t0.getTime() + ms);

  it("rend des minutes sous l'heure, des heures sous deux jours, puis des jours", () => {
    expect(depuisCombienDeTemps(t0, plus(20 * 60_000))).toBe("20 min");
    expect(depuisCombienDeTemps(t0, plus(43 * 3600_000))).toBe("43 h");
    expect(depuisCombienDeTemps(t0, plus(50 * 3600_000))).toBe("2 j 2 h");
    expect(depuisCombienDeTemps(t0, plus(72 * 3600_000))).toBe("3 j");
  });

  it("ne rend jamais de durée négative", () => {
    expect(depuisCombienDeTemps(t0, plus(-3600_000))).toBe("0 min");
  });
});
