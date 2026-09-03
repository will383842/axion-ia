// @vitest-environment node

/**
 * Verrou — le formulaire de réservation ne fait jamais recommencer, et ne
 * tronque jamais en silence.
 *
 * ## Les trois propriétés, et pourquoi elles se mesurent ensemble
 *
 * **1. Rien de ce qui a été saisi n'est perdu.** Chaque refus renvoie les
 * `valeurs` en même temps que les `erreurs`. Sans elles, le formulaire se
 * re-rendrait vide : au pouce, sur un téléphone, un visiteur qui se trompe d'un
 * caractère sur son e-mail devrait tout retaper. C'est la première cause
 * d'abandon d'un formulaire mobile, et elle ne laisse aucune trace — on ne
 * mesure pas les gens qui renoncent.
 *
 * **2. Toutes les erreurs d'un coup.** Les signaler une par une ferait
 * recommencer autant de fois qu'il y a de fautes.
 *
 * **3. Rien n'est tronqué en silence.** Onze invités sont REFUSÉS avec leur
 * compte, jamais coupés à dix. La coupe existe bien dans `reservation.ts`, mais
 * comme ceinture — si elle servait, cinq personnes ne seraient pas invitées et
 * personne ne l'apprendrait.
 *
 * ## Ce que ce fichier ne mesure PAS, et c'est délibéré
 *
 * La disponibilité réelle du créneau. Elle appartient à Calendly : les créneaux
 * affichés viennent d'un cache de quinze minutes, et un créneau peut se prendre
 * pendant que le visiteur remplit. Valider contre ce cache donnerait une
 * confiance fausse. Ici on vérifie la forme, l'avenir et l'horizon ; l'autorité
 * reste le refus de l'API, que `reserverCreneau` sait nommer `creneau_pris`.
 */

import { describe, expect, it } from "vitest";

import {
  validerFormulaire,
  separerLesInvites,
  fuseauValide,
  FUSEAU_DEFAUT,
  HORIZON_JOURS,
  CHAMPS,
} from "../formulaire-reservation";
import { MAX_INVITES } from "../reservation";
import type { QuestionEventType } from "../questions";

const MAINTENANT = new Date("2026-09-01T12:00:00.000Z");
const CRENEAU = new Date("2026-09-10T09:30:00.000Z").toISOString();
const EVENT_TYPE = "https://api.calendly.com/event_types/7315f013";

const QUESTION_LIBRE: QuestionEventType = {
  libelle: "Quel est votre besoin ?",
  type: "text",
  position: 0,
  requise: true,
  choix: [],
  autreAutorise: false,
  champ: "q0",
};

const QUESTION_LISTE: QuestionEventType = {
  libelle: "Votre effectif ?",
  type: "single_select",
  position: 1,
  requise: false,
  choix: ["1 à 10", "11 à 250", "plus de 250"],
  autreAutorise: false,
  champ: "q1",
};

/** Une saisie complète et correcte, que chaque test dégrade sur un point. */
function saisie(over: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const base: Record<string, string> = {
    [CHAMPS.debut]: CRENEAU,
    [CHAMPS.nom]: "Camille Prospect",
    [CHAMPS.email]: "camille@exemple.fr",
    [CHAMPS.format]: "visio",
    // 🔑 Le numéro fait partie d'une saisie CORRECTE depuis le 2026-09-03 : il
    // est exigé dans les deux formats. Sans lui ici, chaque test de ce fichier
    // échouerait sur le téléphone au lieu du point qu'il dégrade — et le fichier
    // entier mesurerait autre chose que ce qu'il annonce.
    [CHAMPS.telephone]: "+33 6 11 22 33 44",
    [CHAMPS.fuseau]: "Europe/Paris",
    [CHAMPS.consent]: "on",
    q0: "Un audit de nos processus.",
    ...over,
  };
  for (const [k, v] of Object.entries(base)) if (v !== "") fd.set(k, v);
  return fd;
}

function valider(fd: FormData, questions: readonly QuestionEventType[] = [QUESTION_LIBRE]) {
  return validerFormulaire(fd, { questions, eventTypeUri: EVENT_TYPE, maintenant: MAINTENANT });
}

describe("🔑 CONTRE-TÉMOIN — une saisie correcte passe", () => {
  it("elle construit une demande utilisable telle quelle", () => {
    // Sans ce test, un validateur qui refuserait TOUT ferait passer chaque
    // « refuse » de ce fichier pour la bonne raison apparente.
    const r = valider(saisie());
    expect(r.ok, `refusée à tort : ${JSON.stringify("erreurs" in r ? r.erreurs : {})}`).toBe(true);
    if (!r.ok) return;
    expect(r.demande.format).toBe("visio");
    expect(r.demande.debut.toISOString()).toBe(CRENEAU);
    expect(r.demande.reponses?.[0]).toEqual({
      question: "Quel est votre besoin ?",
      reponse: "Un audit de nos processus.",
      position: 0,
    });
  });

  it("le fuseau absent retombe sur Paris, qui est l'heure affichée", () => {
    // La page annonce « heure de Paris ». Retomber ailleurs ferait réserver une
    // autre heure que celle qui a été lue.
    const fd = saisie();
    fd.delete(CHAMPS.fuseau);
    const r = valider(fd);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.demande.fuseau).toBe(FUSEAU_DEFAUT);
  });
});

describe("🔴 rien de ce que le visiteur a tapé ne se perd", () => {
  it("un refus renvoie TOUTES les valeurs saisies", () => {
    // La propriété qui décide si le visiteur va au bout. Elle est invisible en
    // relecture de code — le validateur « marche » sans elle.
    const r = valider(saisie({ [CHAMPS.email]: "camille@" }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.valeurs[CHAMPS.nom]).toBe("Camille Prospect");
    expect(r.valeurs["q0"]).toBe("Un audit de nos processus.");
    expect(r.valeurs[CHAMPS.format]).toBe("visio");
    // Y compris la valeur fautive : le visiteur doit voir CE QU'IL a tapé pour
    // le corriger, pas un champ vide qui l'oblige à deviner son erreur.
    expect(r.valeurs[CHAMPS.email]).toBe("camille@");
  });

  it("le créneau choisi survit à un refus", () => {
    // 🔑 Le champ le plus coûteux à perdre : il n'est pas retapable, il faut
    // retourner au calendrier et le retrouver.
    const r = valider(saisie({ [CHAMPS.nom]: "" }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.valeurs[CHAMPS.debut]).toBe(CRENEAU);
  });

  it("🔴 toutes les erreurs arrivent ENSEMBLE", () => {
    // Les livrer une par une ferait recommencer autant de fois qu'il y a de
    // fautes — et sur un téléphone, chaque aller-retour perd des gens.
    const r = valider(saisie({ [CHAMPS.nom]: "", [CHAMPS.email]: "x", q0: "" }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(Object.keys(r.erreurs).sort()).toEqual([CHAMPS.email, CHAMPS.nom, "q0"].sort());
  });

  it("chaque erreur est attachée à SON champ", () => {
    // Un message unique en haut de page oblige à chercher ; sur un écran de
    // téléphone la zone fautive est souvent déjà hors de vue.
    const r = valider(saisie({ [CHAMPS.email]: "pas-un-email" }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erreurs[CHAMPS.email]).toBeTruthy();
    expect(r.erreurs[CHAMPS.nom]).toBeUndefined();
  });
});

describe("🔴 les invités sont refusés, jamais coupés", () => {
  it(`plus de ${MAX_INVITES} invités est un REFUS qui donne le compte`, () => {
    const trop = Array.from({ length: MAX_INVITES + 3 }, (_, i) => `i${i}@exemple.fr`).join(", ");
    const r = valider(saisie({ [CHAMPS.invites]: trop }));
    expect(r.ok, "couper en silence ferait croire à douze invitations envoyées").toBe(false);
    if (r.ok) return;
    expect(r.erreurs[CHAMPS.invites]).toContain(String(MAX_INVITES + 3));
    expect(r.erreurs[CHAMPS.invites]).toContain("3");
  });

  it(`exactement ${MAX_INVITES} passe — la borne est la bonne`, () => {
    // Une borne posée à `>=` au lieu de `>` refuserait un cas légitime, et
    // l'écart d'un seul invité ne se verrait pas en relecture.
    const pile = Array.from({ length: MAX_INVITES }, (_, i) => `i${i}@exemple.fr`).join("\n");
    const r = valider(saisie({ [CHAMPS.invites]: pile }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.demande.invites).toHaveLength(MAX_INVITES);
  });

  it("une adresse d'invité malformée est NOMMÉE", () => {
    // Dire « une adresse est invalide » sur une liste de huit ferait relire les
    // huit. On rend celle qui pose problème.
    const r = valider(saisie({ [CHAMPS.invites]: "ok@exemple.fr, cassé@, autre@exemple.fr" }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erreurs[CHAMPS.invites]).toContain("cassé@");
  });

  it("la séparation accepte ce qu'un humain colle vraiment", () => {
    // Virgules, points-virgules, retours à la ligne, espaces multiples : un
    // copier-coller depuis un client de messagerie mélange les quatre.
    expect(separerLesInvites("a@x.fr, b@x.fr;\n c@x.fr\t d@x.fr")).toEqual([
      "a@x.fr",
      "b@x.fr",
      "c@x.fr",
      "d@x.fr",
    ]);
    expect(separerLesInvites("   ")).toEqual([]);
  });
});

describe("🔴 le numéro est obligatoire dans les DEUX formats", () => {
  it("un appel SANS numéro est refusé", () => {
    // 🔴 Calendly accepterait la réservation : le rendez-vous existerait, et
    // personne ne saurait qui appeler avant le jour même.
    const fd = saisie({ [CHAMPS.format]: "telephone" });
    fd.delete(CHAMPS.telephone);
    const r = valider(fd);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erreurs[CHAMPS.telephone]).toBeTruthy();
  });

  it("🔴 une VISIO sans numéro est refusée AUSSI — décision de Will, 2026-09-03", () => {
    // Le contre-témoin du test précédent, et l'inverse exact de ce que ce
    // fichier gardait jusqu'ici (« une visio sans numéro passe — la contrainte
    // ne déborde pas »). Ce qui a changé n'est pas le code, c'est la règle : un
    // rendez-vous en visio se rattrape par téléphone quand le lien ne s'ouvre
    // pas ou que personne ne se connecte, et l'e-mail ne se relit pas pendant
    // ces cinq minutes-là.
    const fd = saisie({ [CHAMPS.format]: "visio" });
    fd.delete(CHAMPS.telephone);
    const r = valider(fd);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erreurs[CHAMPS.telephone]).toBeTruthy();
  });

  it("l'indicatif pays est exigé, quel que soit le format", () => {
    for (const format of ["telephone", "visio"]) {
      const r = valider(saisie({ [CHAMPS.format]: format, [CHAMPS.telephone]: "06 11 22 33 44" }));
      expect(r.ok, `« ${format} » sans indicatif ne devrait pas passer`).toBe(false);
      if (r.ok) return;
      expect(r.erreurs[CHAMPS.telephone]).toContain("+33");
    }
  });

  it("🔑 le numéro suit dans la demande pour les DEUX formats", () => {
    // 🔴 La moitié qui décide si ce champ obligatoire sert à quelque chose.
    // Il ne partait que pour un appel sortant : une visio l'aurait fait saisir
    // puis jeté. `reservation.ts` le range désormais aussi dans
    // `invitee.text_reminder_number`, mais encore faut-il qu'il lui parvienne.
    for (const format of ["telephone", "visio"]) {
      const r = valider(
        saisie({ [CHAMPS.format]: format, [CHAMPS.telephone]: "+33 6 11 22 33 44" }),
      );
      expect(r.ok, `« ${format} » devrait passer`).toBe(true);
      if (!r.ok) return;
      expect(r.demande.telephone, `le numéro doit suivre en « ${format} »`).toBe(
        "+33 6 11 22 33 44",
      );
    }
  });

  it("un format inventé est refusé", () => {
    for (const f of ["", "presentiel", "TELEPHONE", "visioconference"]) {
      const r = valider(saisie({ [CHAMPS.format]: f }));
      expect(r.ok, `« ${f} » ne devrait pas passer`).toBe(false);
    }
  });

  it("🔑 en revanche un espace parasite ne refuse PAS", () => {
    // Premier jet de ce fichier : j'avais rangé « visio  » parmi les refus. À
    // tort — la valeur est nettoyée avant comparaison, et c'est le bon
    // comportement. Refuser une saisie correcte à cause d'un espace collé par le
    // navigateur serait un mur invisible : le visiteur voit « visio » coché et
    // lit qu'il doit choisir un format.
    const r = valider(saisie({ [CHAMPS.format]: " visio " }));
    expect(r.ok).toBe(true);
  });
});

describe("le créneau : forme, avenir, horizon", () => {
  it("🔴 un créneau passé est refusé — l'onglet laissé ouvert une nuit", () => {
    const hier = new Date("2026-08-31T09:00:00.000Z").toISOString();
    const r = valider(saisie({ [CHAMPS.debut]: hier }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erreurs[CHAMPS.debut]).toContain("passé");
  });

  it("un créneau au-delà de l'horizon est refusé", () => {
    const loin = new Date(MAINTENANT.getTime() + (HORIZON_JOURS + 5) * 86_400_000).toISOString();
    const r = valider(saisie({ [CHAMPS.debut]: loin }));
    expect(r.ok).toBe(false);
  });

  it("un créneau illisible est refusé sans lever", () => {
    for (const d of ["", "demain", "2026-13-45T99:99:99Z"]) {
      const r = valider(saisie({ [CHAMPS.debut]: d }));
      expect(r.ok).toBe(false);
    }
  });
});

describe("les questions de l'event-type", () => {
  it("une question requise sans réponse est refusée", () => {
    const r = valider(saisie({ q0: "" }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erreurs["q0"]).toBeTruthy();
  });

  it("🔑 une question FACULTATIVE sans réponse n'envoie PAS de réponse vide", () => {
    // Envoyer une chaîne vide écrirait « (vide) » dans le récapitulatif que Will
    // reçoit — un bruit qu'il faudrait apprendre à ignorer, donc un bruit qui
    // finirait par masquer une vraie réponse manquante.
    const r = valider(saisie(), [QUESTION_LIBRE, QUESTION_LISTE]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.demande.reponses).toHaveLength(1);
    expect(r.demande.reponses?.[0]?.position).toBe(0);
  });

  it("🔴 un menu déroulant se valide contre SES choix", () => {
    // Le HTML d'un `<select>` se réécrit en deux secondes. Une valeur hors liste
    // partirait chez Calendly sans jamais correspondre à rien.
    const r = valider(saisie({ q1: "une valeur inventée" }), [QUESTION_LIBRE, QUESTION_LISTE]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erreurs["q1"]).toBeTruthy();
  });

  it("un choix légitime passe, et garde son libellé EXACT", () => {
    const r = valider(saisie({ q1: "11 à 250" }), [QUESTION_LIBRE, QUESTION_LISTE]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const rep = r.demande.reponses?.find((x) => x.position === 1);
    expect(rep?.question).toBe("Votre effectif ?");
    expect(rep?.reponse).toBe("11 à 250");
  });
});

describe("le fuseau horaire, qui n'est plus demandé au visiteur", () => {
  // Le menu de quinze fuseaux a été retiré du formulaire le 2026-09-02 : il
  // servait un visiteur sur cent et allongeait l'écran pour tous les autres.
  // Le VALIDATEUR, lui, continue de traiter le champ — le formulaire est du
  // HTML natif, et ce qui peut être posté doit être jugé.

  it("🔑 le fuseau par défaut est un fuseau que le moteur sait lire", () => {
    // Le défaut est désormais la SEULE valeur que reçoivent 100 % des
    // réservations. Une faute de frappe ici ne dégraderait plus un cas
    // marginal : elle casserait toutes les réservations, d'un coup.
    expect(fuseauValide(FUSEAU_DEFAUT), `« ${FUSEAU_DEFAUT} » n'est pas un fuseau`).toBe(true);
  });

  it("un fuseau posté à la main, mais légitime, est accepté", () => {
    // Le champ n'est plus rendu ; il reste postable. Refuser Asia/Tokyo parce
    // qu'aucun menu ne le propose serait arbitraire — c'est le moteur qui fait
    // autorité, et c'est lui que Calendly consultera.
    const r = valider(saisie({ [CHAMPS.fuseau]: "Asia/Tokyo" }));
    expect(r.ok).toBe(true);
  });

  it("un fuseau inventé est refusé", () => {
    const r = valider(saisie({ [CHAMPS.fuseau]: "Europe/Atlantide" }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erreurs[CHAMPS.fuseau]).toBeTruthy();
  });
});

describe("le consentement", () => {
  it("sans accord, pas de réservation", () => {
    const fd = saisie();
    fd.delete(CHAMPS.consent);
    const r = valider(fd);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erreurs[CHAMPS.consent]).toBeTruthy();
  });
});
