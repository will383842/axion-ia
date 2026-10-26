/**
 * Le Tour de France IA a son PROPRE type de rendez-vous (2026-10-25) : `tour_de_france_ia`.
 *
 * Avant : la visio de 30 minutes était classée `autre`, donc confondue avec tout appel
 * non classé (même libellé, même titre d'alerte, mêmes statistiques). Ce témoin tient :
 *   1. le classement (URI, nom, slug) ;
 *   2. qu'il reste dans les familles CLIENT (e-mails, CRM, fiche) — jamais hors clients ;
 *   3. le contrat CRM : la valeur envoyée reste dans la liste fermée du CRM ;
 *   4. la lecture des réponses du formulaire (ville, réponses) ;
 *   5. l'onglet, la teinte, le bilan, l'origine et le titre d'alerte.
 */
import { describe, expect, it } from "vitest";

import {
  passeLeFiltre,
  TEINTE_TYPE_RDV,
  TYPES_FILTRABLES,
} from "@/features/admin-rendezvous/type-rdv";
import { agregerBilan } from "@/features/admin-rendezvous/bilan-rendez-vous";
import {
  classerReponse,
  LIBELLE_SOURCE,
  SOURCES,
} from "@/features/admin-rendezvous/origine-rendez-vous";
import { titreReservation } from "@/server/notifications/format";
import { payloadRendezVousAuContrat } from "@/server/crm-sync";
import {
  classerParNom,
  estTypeRendezVous,
  estVisioTourDeFranceIa,
  LIBELLES_TYPE_RENDEZ_VOUS,
  reponsesDesQuestions,
  tableDesTypesConnus,
  typePorteLesReponses,
  TYPES_RENDEZ_VOUS,
  urlsDeReservationConfigurees,
  villeDesReponses,
  villeDuBrut,
} from "../type-rendez-vous";
import { typeEffectif } from "../type-effectif";
import { HORS_ECHANGES_HORS_CLIENTS, familleHorsClients } from "../appel-apporteur";
import { HORS_RDV_SALON } from "../rdv-salon";
import { choixDuTypeRendezVous, configDuChoix } from "../types-reservables";
import { URL_CALENDLY_TOUR_PAR_DEFAUT } from "../urls-par-defaut";
import { typeDuChoix, utmSourceParDefaut, UTM_SOURCE_TOUR } from "../choix-rendez-vous";

const URI_TOUR = "https://api.calendly.com/event_types/TOUR";

describe("le type existe et se nomme", () => {
  it("figure parmi les types classés, avec son libellé", () => {
    expect(TYPES_RENDEZ_VOUS).toContain("tour_de_france_ia");
    expect(estTypeRendezVous("tour_de_france_ia")).toBe(true);
    expect(LIBELLES_TYPE_RENDEZ_VOUS.tour_de_france_ia).toBe("Tour de France IA");
  });
});

describe("le classement", () => {
  it("par le nom, avec ou sans tirets, accents et casse", () => {
    for (const nom of [
      "Tour de France IA",
      "tour-de-france-ia",
      "Visio TOUR DE FRANCE IA – 30 min",
    ]) {
      expect(classerParNom(nom), nom).toBe("tour_de_france_ia");
      expect(estVisioTourDeFranceIa(nom), nom).toBe(true);
    }
  });

  it("contre-témoin : les autres noms ne sont pas pris pour le Tour", () => {
    expect(classerParNom("Diagnostic IA")).toBe("diagnostic");
    expect(classerParNom("Échange apporteur d'affaires")).toBe("apporteur");
    expect(classerParNom("Rencontre salon GOFAB")).toBe("salon");
    expect(classerParNom("Un tour de France cycliste")).toBe("autre");
    expect(estVisioTourDeFranceIa(null)).toBe(false);
  });

  it("par l'URI : l'adresse configurée donne le type, même renommé", () => {
    const table = tableDesTypesConnus(
      [{ uri: URI_TOUR, scheduling_url: URL_CALENDLY_TOUR_PAR_DEFAUT, name: "Renommé" }],
      urlsDeReservationConfigurees(),
    );
    expect(table.get(URI_TOUR)).toBe("tour_de_france_ia");
  });

  it("par le slug, quand l'adresse n'est pas configurée", () => {
    const table = tableDesTypesConnus(
      [{ uri: URI_TOUR, scheduling_url: "https://calendly.com/autre-compte/tour-de-france-ia-v2" }],
      [],
    );
    expect(table.get(URI_TOUR)).toBe("tour_de_france_ia");
  });

  it("à la lecture : la colonne d'abord, le nom en repli", () => {
    expect(typeEffectif({ typeRendezVous: "tour_de_france_ia", eventTypeName: "X" })).toBe(
      "tour_de_france_ia",
    );
    expect(typeEffectif({ typeRendezVous: null, eventTypeName: "Tour de France IA" })).toBe(
      "tour_de_france_ia",
    );
  });
});

describe("la table des rendez-vous réservables", () => {
  it("la page du Tour porte le type propre, et le type retrouve son choix", () => {
    expect(configDuChoix("tour").type).toBe("tour_de_france_ia");
    expect(typeDuChoix("tour")).toBe("tour_de_france_ia");
    expect(choixDuTypeRendezVous("tour_de_france_ia")).toBe("tour");
  });

  it("`autre` ne désigne toujours aucun choix", () => {
    expect(choixDuTypeRendezVous("autre")).toBeNull();
  });
});

describe("🔑 le Tour reste CLIENT : e-mails, CRM des ventes, fiche", () => {
  it("n'est ni un apporteur ni un formateur", () => {
    expect(
      familleHorsClients({
        typeRendezVous: "tour_de_france_ia",
        eventTypeName: "Tour de France IA",
      }),
    ).toBeNull();
  });

  it("les clauses « hors apporteur » et « hors salon » le contiennent", () => {
    const hors = JSON.stringify(HORS_ECHANGES_HORS_CLIENTS);
    expect(hors).toContain("tour_de_france_ia");
    expect(JSON.stringify(HORS_RDV_SALON)).toContain("tour_de_france_ia");
  });

  it("le filtre « clients » de la console le garde", () => {
    expect(passeLeFiltre("tour_de_france_ia", "clients")).toBe(true);
    expect(passeLeFiltre("tour_de_france_ia", "apporteurs")).toBe(false);
    expect(passeLeFiltre("tour_de_france_ia", "tour_de_france_ia")).toBe(true);
    expect(passeLeFiltre("autre", "tour_de_france_ia")).toBe(false);
  });
});

describe("le contrat CRM", () => {
  it("part sous `autre` (liste fermée du CRM), nommé par la clé libre `circuit`", () => {
    const p = payloadRendezVousAuContrat({
      eventTypeName: "Tour de France IA",
      typeRendezVous: "tour_de_france_ia",
      reponses: [{ question: "Votre ville ?", reponse: "Lyon" }],
    });
    expect(p.typeRendezVous).toBe("autre");
    expect(p["circuit"]).toBe("tour_de_france_ia");
    expect(p.reponses).toEqual([{ question: "Votre ville ?", reponse: "Lyon" }]);
  });

  it("un type absent est reclassé par le nom", () => {
    const p = payloadRendezVousAuContrat({ eventTypeName: "Tour de France IA" });
    expect(p["circuit"]).toBe("tour_de_france_ia");
  });

  it("les autres types ne reçoivent pas de `circuit`", () => {
    const p = payloadRendezVousAuContrat({ eventTypeName: "Diagnostic IA" });
    expect(p["circuit"]).toBeUndefined();
    expect(p.typeRendezVous).toBe("diagnostic");
  });

  it("les réponses du formulaire partent pour ce type", () => {
    expect(typePorteLesReponses("tour_de_france_ia")).toBe(true);
    expect(typePorteLesReponses("salon")).toBe(false);
  });
});

describe("la lecture des réponses du formulaire", () => {
  const qa = [
    { question: "Dans quelle ville est votre entreprise ?", answer: " Lyon " },
    { question: "Combien de personnes ?", answer: "12" },
  ];

  it("lit la ville", () => {
    expect(villeDesReponses(qa)).toBe("Lyon");
    expect(villeDuBrut({ invitee: { questions_and_answers: qa } })).toBe("Lyon");
  });

  it("rend null sans question de ville, sans réponse, ou sur une forme inattendue", () => {
    expect(villeDesReponses([{ question: "Combien ?", answer: "3" }])).toBeNull();
    expect(villeDesReponses([{ question: "Ville", answer: "  " }])).toBeNull();
    expect(villeDesReponses("n'importe quoi")).toBeNull();
    expect(villeDuBrut(null)).toBeNull();
  });

  it("borne la ville à 80 caractères", () => {
    const longue = "A".repeat(200);
    expect(villeDesReponses([{ question: "Ville", answer: longue }])?.length).toBe(80);
  });

  it("les réponses restent bornées pour le CRM", () => {
    expect(reponsesDesQuestions(qa).length).toBe(2);
  });
});

describe("la source UTM", () => {
  it("le Tour a une source par défaut, aucun autre choix", () => {
    expect(utmSourceParDefaut("tour")).toBe(UTM_SOURCE_TOUR);
    expect(UTM_SOURCE_TOUR).toBe("tour-de-france-ia");
    expect(utmSourceParDefaut("diagnostic")).toBeNull();
    expect(utmSourceParDefaut("projet")).toBeNull();
  });
});

describe("la console", () => {
  it("l'onglet existe et la pastille a sa teinte", () => {
    expect(TYPES_FILTRABLES).toContain("tour_de_france_ia");
    expect(TEINTE_TYPE_RDV.tour_de_france_ia).toBe("vert");
  });

  it("le bilan ne montre le Tour que s'il porte au moins un rendez-vous", () => {
    expect(agregerBilan([]).types.map((t) => t.type)).not.toContain("tour_de_france_ia");
    const ligne = {
      typeRendezVous: "tour_de_france_ia",
      eventTypeName: "Tour de France IA",
      status: "active",
      issue: null,
      utmContent: null,
      fiche: false,
      client: false,
      reporte: false,
      n: 2,
    };
    const bilan = agregerBilan([ligne]);
    const duTour = bilan.types.find((t) => t.type === "tour_de_france_ia");
    expect(duTour?.total.reserves).toBe(2);
  });

  it("l'origine : « Tour de France IA » n'est pas lu comme « ChatGPT ou une autre IA »", () => {
    expect(classerReponse("Le Tour de France IA")).toBe("tour_de_france_ia");
    expect(classerReponse("ChatGPT")).toBe("ia");
    expect(SOURCES).toContain("tour_de_france_ia");
    expect(LIBELLE_SOURCE.tour_de_france_ia).toBe("Tour de France IA");
  });
});

describe("l'alerte Telegram", () => {
  it("a son titre réservé, distinct de l'appel client", () => {
    expect(titreReservation("tour_de_france_ia", "Tour de France IA", null)).toBe(
      "Tour de France IA réservé",
    );
    expect(titreReservation("autre", "Autre", null)).toBe("Appel client réservé");
  });
});
