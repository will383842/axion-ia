/**
 * Les mots du bloc « accès » doivent TOUS bouger avec la modalité.
 *
 * ## Le défaut d'origine, et pourquoi ce fichier est écrit ainsi
 *
 * Le 2026-09-04, l'alerte `session_contact_sur_place_absent` a été corrigée
 * DEUX FOIS le même jour. La première passe a rendu le message par modalité et
 * a laissé le TITRE commun ; une session en visio s'affichait donc en gras
 * « Session sans contact sur place ni consignes d'accès » au-dessus d'un
 * message qui ne parlait ni de porte ni de consignes.
 *
 * La leçon tenait en une phrase : **trois chaînes du même `return`, une seule
 * dérivée**. Et le témoin de l'époque ne l'a pas vu, parce qu'il cherchait une
 * chaîne au singulier là où le texte était au pluriel — 10/10 vert avec le
 * défaut en gras à l'écran.
 *
 * D'où la forme de ces témoins :
 *
 * 1. On n'inspecte PAS une chaîne choisie à la main. On balaie **toutes** les
 *    clés de l'objet retourné — `Object.keys`, pas une liste recopiée. Ajouter
 *    une sixième chaîne au type l'assujettit automatiquement.
 * 2. On exige que chaque clé DIFFÈRE d'une manière d'entrer à l'autre. C'est
 *    le seul énoncé qui rougisse sur « une seule dérivée sur trois ».
 * 3. On ajoute un témoin POSITIF : le présentiel doit VRAIMENT parler
 *    d'adresse et de salle. Sans lui, renvoyer cinq chaînes vides passerait
 *    tous les témoins négatifs.
 */

import { describe, it, expect } from "vitest";

import {
  libellesAcces,
  maniereDEntrer,
  incoherenceModaliteLieu,
  type LibellesAcces,
} from "@/server/qualiopi/lieu/libelles-acces";

/** Les mots de la PORTE — n'ont aucun sens dans une visioconférence. */
const MOTS_DE_LA_PORTE = ["sur place", "adresse", "salle", "accueil", "étage", "badge", "parking"];

/**
 * Tournures où un mot de la porte est LÉGITIME en visioconférence.
 *
 * 🔴 Ce garde-fou du garde-fou n'est pas de la coquetterie : la première
 * version de ce témoin a fait rougir « Salle d'attente à activer », qui est
 * du vocabulaire de visio pur — Zoom, Teams et Meet appellent tous ainsi le
 * sas où patientent les participants. Une garde lexicale trop large aurait
 * forcé à RETIRER la phrase juste pour la faire taire, et l'écran aurait
 * perdu l'information la plus utile au formateur.
 *
 * C'est la leçon du 2026-09-04, appliquée à ma propre garde : viser la
 * TOURNURE, jamais le mot isolé. Toute entrée ajoutée ici doit être un
 * composé qui n'existe QUE dans le vocabulaire du distanciel.
 */
const TOURNURES_LEGITIMES_EN_VISIO = ["salle d'attente", "salle de réunion virtuelle"];

/**
 * Les mots de la porte réellement présents dans un texte, une fois retirées
 * les tournures de visio qui les contiennent légitimement.
 */
function motsDeLaPorteDans(texte: string): string[] {
  let reste = texte.toLowerCase();
  for (const tournure of TOURNURES_LEGITIMES_EN_VISIO) {
    reste = reste.split(tournure).join(" ");
  }
  return MOTS_DE_LA_PORTE.filter((mot) => reste.includes(mot));
}

/** Balaie toutes les clés du retour, jamais une liste recopiée à la main. */
function chaines(l: LibellesAcces): Array<[string, string]> {
  return Object.entries(l) as Array<[string, string]>;
}

describe("la manière d'entrer se dérive de la modalité", () => {
  it("l'hybride l'emporte sur le type de lieu — c'est le seul qui dise « les deux »", () => {
    expect(maniereDEntrer("sur_site", "hybride")).toBe("les_deux");
    expect(maniereDEntrer("distanciel", "hybride")).toBe("les_deux");
  });

  it("une modalité distancielle suffit, même si le lieu n'a pas suivi", () => {
    // C'est l'état réel d'AXI-SESS-2026-001 : modalité distancielle, lieu resté
    // physique. Les libellés doivent parler visio malgré tout.
    expect(maniereDEntrer("nos_locaux", "distanciel")).toBe("lien");
  });

  it("un lieu distanciel suffit, même sans modalité connue", () => {
    expect(maniereDEntrer("distanciel", null)).toBe("lien");
    expect(maniereDEntrer("distanciel", undefined)).toBe("lien");
  });

  it("par défaut, on suppose une porte", () => {
    expect(maniereDEntrer("", null)).toBe("porte");
    expect(maniereDEntrer("nos_locaux", "presentiel")).toBe("porte");
  });
});

describe("🔴 les CINQ chaînes bougent, pas une seule", () => {
  const surSite = libellesAcces("nos_locaux", "presentiel");
  const aDistance = libellesAcces("distanciel", "distanciel");
  const hybride = libellesAcces("sur_site", "hybride");

  it("le type expose au moins cinq chaînes — sinon le balayage ne balaie rien", () => {
    // Témoin POSITIF. Sans lui, vider `LibellesAcces` rendrait toute la suite
    // verte en ne parcourant aucune itération.
    expect(chaines(surSite).length).toBeGreaterThanOrEqual(5);
  });

  it("AUCUNE chaîne n'est commune au présentiel et au distanciel", () => {
    for (const [cle, valeurSurSite] of chaines(surSite)) {
      const valeurADistance = aDistance[cle as keyof LibellesAcces];
      expect(
        valeurADistance,
        `« ${cle} » sert la MÊME phrase sur site et en visio :\n  ${valeurSurSite}\n` +
          `C'est exactement le défaut du 2026-09-04 — trois chaînes du même return, ` +
          `une seule dérivée. Une chaîne qui ne bouge pas avec la modalité n'a pas ` +
          `été dérivée : elle a été recopiée.`,
      ).not.toBe(valeurSurSite);
    }
  });

  it("l'hybride ne recopie ni l'un ni l'autre", () => {
    for (const [cle, valeurHybride] of chaines(hybride)) {
      expect(valeurHybride, `« ${cle} » recopie le présentiel`).not.toBe(
        surSite[cle as keyof LibellesAcces],
      );
      expect(valeurHybride, `« ${cle} » recopie le distanciel`).not.toBe(
        aDistance[cle as keyof LibellesAcces],
      );
    }
  });
});

describe("🔴 le distanciel ne garde AUCUN mot de la porte", () => {
  const aDistance = libellesAcces("distanciel", "distanciel");

  it("aucune des cinq chaînes ne parle d'adresse, de salle ni d'accueil", () => {
    for (const [cle, valeur] of chaines(aDistance)) {
      const trouves = motsDeLaPorteDans(valeur);
      expect(
        trouves,
        `« ${cle} » contient ${trouves.map((m) => `« ${m} »`).join(", ")} alors ` +
          `qu'il n'y a ni porte ni salle dans une visioconférence :\n  ${valeur}`,
      ).toEqual([]);
    }
  });

  it("la garde vise la TOURNURE, pas le mot — « salle d'attente » passe", () => {
    // Contre-témoin, et il est indispensable. Une garde lexicale trop large
    // interdit la phrase qui PROTÈGE : « salle d'attente » est du vocabulaire
    // de visio pur, et la faire rougir forcerait à la retirer de l'écran.
    expect(motsDeLaPorteDans("Salle d'attente à activer avant l'heure")).toEqual([]);
  });

  it("…mais une VRAIE salle est bien attrapée", () => {
    // Témoin POSITIF de la garde elle-même : sans lui, on ne saurait pas
    // distinguer « la tournure est tolérée » de « la sonde ne mesure rien ».
    expect(motsDeLaPorteDans("Salle Vercors, 2e étage, badge à l'accueil")).toEqual(
      expect.arrayContaining(["salle", "étage", "badge", "accueil"]),
    );
  });

  it("mais le présentiel, LUI, les dit vraiment", () => {
    // Témoin POSITIF, et il est indispensable : sans lui, renvoyer cinq chaînes
    // vides passerait le témoin négatif ci-dessus les yeux fermés. Un témoin
    // négatif seul ne prouve jamais qu'une sonde MESURE.
    const surSite = libellesAcces("nos_locaux", "presentiel");
    const tout = chaines(surSite)
      .map(([, v]) => v)
      .join(" ")
      .toLowerCase();
    expect(tout).toContain("sur place");
    expect(tout).toContain("adresse");
    expect(tout).toContain("salle");
  });

  it("l'aide en visio annonce le LIEN, puisque c'est ce qui part", () => {
    expect(aDistance.aide.toLowerCase()).toContain("lien de connexion");
  });

  it("l'aide hybride annonce les deux manières d'entrer", () => {
    const h = libellesAcces("sur_site", "hybride").aide.toLowerCase();
    expect(h).toContain("adresse");
    expect(h).toContain("lien de connexion");
  });
});

describe("une modalité qui contredit son lieu se dit à l'écran", () => {
  it("🔴 distanciel + lieu physique : l'état réel d'AXI-SESS-2026-001", () => {
    const msg = incoherenceModaliteLieu("nos_locaux", "distanciel");
    expect(msg).not.toBeNull();
    expect(msg).toContain("à distance");
  });

  it("présentiel + lieu distanciel se signale aussi", () => {
    expect(incoherenceModaliteLieu("distanciel", "presentiel")).not.toBeNull();
  });

  it("l'hybride ne se contredit jamais — c'est sa définition", () => {
    expect(incoherenceModaliteLieu("sur_site", "hybride")).toBeNull();
    expect(incoherenceModaliteLieu("distanciel", "hybride")).toBeNull();
    expect(incoherenceModaliteLieu("nos_locaux", "hybride")).toBeNull();
  });

  it("un lieu NON PRÉCISÉ ne contredit rien — il n'affirme rien", () => {
    // Contre-témoin : une garde trop large ferait rougir la session qu'on vient
    // de créer et dont le lieu n'est pas encore saisi. Elle deviendrait du
    // bruit, et on apprendrait à l'ignorer.
    expect(incoherenceModaliteLieu("", "distanciel")).toBeNull();
    expect(incoherenceModaliteLieu(null, "distanciel")).toBeNull();
    expect(incoherenceModaliteLieu(undefined, "presentiel")).toBeNull();
  });

  it("les accords ordinaires restent muets", () => {
    expect(incoherenceModaliteLieu("distanciel", "distanciel")).toBeNull();
    expect(incoherenceModaliteLieu("nos_locaux", "presentiel")).toBeNull();
    expect(incoherenceModaliteLieu("sur_site", "presentiel")).toBeNull();
  });
});
