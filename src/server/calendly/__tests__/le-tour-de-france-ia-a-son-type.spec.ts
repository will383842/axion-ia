// La visio du Tour de France IA a son TYPE de rendez-vous (2026-10-25).
//
// Avant : classée `autre`, donc générique. Désormais `tour_de_france_ia`, avec
// un classement par l'URI, un repli par le nom, et des familles client intactes.

import { describe, it, expect } from "vitest";
import {
  LIBELLES_TYPE_RENDEZ_VOUS,
  TYPES_RENDEZ_VOUS,
  classerParNom,
  estTypeRendezVous,
  tableDesTypesConnus,
  typePorteLesReponses,
  urlsDeReservationConfigurees,
} from "@/server/calendly/type-rendez-vous";
import { typeEffectif } from "@/server/calendly/type-effectif";
import { choixDuTypeRendezVous, TYPES_RESERVABLES } from "@/server/calendly/types-reservables";
import { passeLeFiltre, TYPES_FILTRABLES } from "@/features/admin-rendezvous/type-rdv";
import { UTM_SOURCE_TOUR, avecSourceDuChoix } from "@/server/calendly/choix-rendez-vous";
import { URL_CALENDLY_TOUR_PAR_DEFAUT } from "@/server/calendly/urls-par-defaut";

const URI = "https://api.calendly.com/event_types/TOUR-1";

describe("le type tour_de_france_ia", () => {
  it("fait partie des types classés, avec son libellé", () => {
    expect(TYPES_RENDEZ_VOUS).toContain("tour_de_france_ia");
    expect(estTypeRendezVous("tour_de_france_ia")).toBe(true);
    expect(LIBELLES_TYPE_RENDEZ_VOUS.tour_de_france_ia).toBe("Tour de France IA");
  });

  it("la table des réservables le désigne, et il répond dans les deux sens", () => {
    expect(TYPES_RESERVABLES.tour.type).toBe("tour_de_france_ia");
    expect(choixDuTypeRendezVous("tour_de_france_ia")).toBe("tour");
  });

  it("son adresse Calendly est connue : l'URI du type le classe, quel que soit le nom", () => {
    expect(urlsDeReservationConfigurees()).toContainEqual({
      url: URL_CALENDLY_TOUR_PAR_DEFAUT,
      type: "tour_de_france_ia",
    });
    const table = tableDesTypesConnus([
      { uri: URI, scheduling_url: URL_CALENDLY_TOUR_PAR_DEFAUT, name: "Rebaptisé" },
    ]);
    expect(table.get(URI)).toBe("tour_de_france_ia");
  });

  it.each(["Tour de France IA", "tour-de-france-ia", "Visio Tour de France IA (30 min)"])(
    "repli par le nom : « %s »",
    (nom) => {
      expect(classerParNom(nom)).toBe("tour_de_france_ia");
    },
  );

  it("une ligne écrite avant la migration (autre) est relue comme le Tour", () => {
    expect(typeEffectif({ typeRendezVous: "autre", eventTypeName: "Tour de France IA" })).toBe(
      "tour_de_france_ia",
    );
    expect(typeEffectif({ typeRendezVous: null, eventTypeName: "tour-de-france-ia" })).toBe(
      "tour_de_france_ia",
    );
    expect(typeEffectif({ typeRendezVous: "autre", eventTypeName: "Autre chose" })).toBe("autre");
  });

  it("reste un rendez-vous CLIENT et porte ses réponses", () => {
    expect(passeLeFiltre("tour_de_france_ia", "clients")).toBe(true);
    expect(passeLeFiltre("tour_de_france_ia", "apporteurs")).toBe(false);
    expect(passeLeFiltre("tour_de_france_ia", "tour_de_france_ia")).toBe(true);
    expect(passeLeFiltre("diagnostic", "tour_de_france_ia")).toBe(false);
    expect(typePorteLesReponses("tour_de_france_ia")).toBe(true);
  });

  it("a son onglet dans la console", () => {
    expect(TYPES_FILTRABLES).toContain("tour_de_france_ia");
  });
});

describe("l'origine d'une réservation du Tour", () => {
  const vide = { utmSource: null, utmMedium: null, utmCampaign: null, utmContent: null };

  it("sans UTM source, elle porte « tour-de-france-ia »", () => {
    expect(avecSourceDuChoix("tour", vide).utmSource).toBe(UTM_SOURCE_TOUR);
  });
  it("une source déjà posée (campagne) n'est jamais écrasée", () => {
    expect(avecSourceDuChoix("tour", { ...vide, utmSource: "linkedin" }).utmSource).toBe(
      "linkedin",
    );
  });
  it("les autres rendez-vous ne changent pas", () => {
    expect(avecSourceDuChoix("diagnostic", vide)).toBe(vide);
  });
});
