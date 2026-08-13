// Balises de tunnel (`POST /api/funnel`).
//
// ── Ce que ce fichier protège ─────────────────────────────────────────────
// La route est publique et non authentifiée. Deux propriétés doivent tenir :
//
// 1. Elle n'accepte QUE des champs anonymes. La table `funnel_events` ne tient
//    sous l'exemption de consentement de la CNIL que si elle reste dépourvue
//    de donnée identifiante ; si du code client se mettait à joindre un
//    e-mail, la balise doit être REJETÉE, pas silencieusement tronquée.
// 2. Les bornes de longueur correspondent aux colonnes. Une valeur plus longue
//    doit être refusée à l'entrée, sinon c'est Postgres qui échoue — bien plus
//    tard, dans un contexte où l'erreur n'a plus de sens.

import { describe, it, expect } from "vitest";
import {
  funnelEventSchema,
  FUNNEL_EVENT_NAMES,
  FUNNEL_KEYS,
  GAIN_BUCKETS,
} from "@/lib/schemas/funnel-event-schema";
import type { FunnelEvent, FunnelProps } from "@/lib/tracking";
import { gainBucketOf } from "@/lib/tracking";

const BALISE_VALIDE = {
  funnel: "simulateur",
  event: "Simulator Step",
  sessionId: "s-abcdef123456",
} as const;

// ── Verrous de TYPE ────────────────────────────────────────────────────────
// Ils ne s'exécutent pas : ils rendent `pnpm typecheck` rouge en cas de
// dérive. C'est volontaire — une divergence entre le nom émis par le client et
// le nom accepté par le serveur ne produirait sinon qu'un silence, la balise
// étant rejetée sans que personne ne regarde.

/** Tout événement journalisé doit exister dans le vocabulaire d'émission. */
const _evenementsConnus: readonly FunnelEvent[] = FUNNEL_EVENT_NAMES;

/** Les tranches de gain doivent rester alignées sur `gainBucketOf`. */
const _tranchesAlignees: readonly NonNullable<FunnelProps["gainBucket"]>[] = GAIN_BUCKETS;

void _evenementsConnus;
void _tranchesAlignees;

describe("funnelEventSchema — champs obligatoires", () => {
  it("accepte une balise minimale", () => {
    expect(funnelEventSchema.safeParse(BALISE_VALIDE).success).toBe(true);
  });

  it("refuse un tunnel inconnu — sinon les agrégats se dispersent en silence", () => {
    // Sans liste fermée, « Simulateur », « simu » et « simulateur » seraient
    // trois tunnels distincts dans le tableau de bord, sans aucune erreur.
    const r = funnelEventSchema.safeParse({ ...BALISE_VALIDE, funnel: "simu" });
    expect(r.success).toBe(false);
  });

  it("refuse un nom d'événement inconnu", () => {
    const r = funnelEventSchema.safeParse({ ...BALISE_VALIDE, event: "Simulator Finished" });
    expect(r.success).toBe(false);
  });

  it("exige un identifiant de session exploitable", () => {
    expect(funnelEventSchema.safeParse({ ...BALISE_VALIDE, sessionId: "abc" }).success).toBe(false);
    expect(funnelEventSchema.safeParse({ ...BALISE_VALIDE, sessionId: "" }).success).toBe(false);
  });
});

describe("funnelEventSchema — garde anti-fuite de donnée personnelle", () => {
  it("REJETTE toute clé non déclarée, au lieu de l'ignorer", () => {
    // C'est la garde qui maintient l'exemption de consentement. Un `strip()`
    // silencieux laisserait passer la balise en écartant le champ : personne ne
    // saurait jamais que du code client tente d'envoyer une donnée nominative.
    const r = funnelEventSchema.safeParse({ ...BALISE_VALIDE, email: "jean@exemple.fr" });
    expect(r.success).toBe(false);
  });

  it("refuse un montant exact déguisé en tranche", () => {
    // Le montant exact, croisé au secteur et à l'effectif, réidentifie une
    // entreprise. Seules les tranches sont acceptées.
    expect(funnelEventSchema.safeParse({ ...BALISE_VALIDE, gainBucket: "48200" }).success).toBe(
      false,
    );
    expect(funnelEventSchema.safeParse({ ...BALISE_VALIDE, gainBucket: "10k-50k" }).success).toBe(
      true,
    );
  });

  it("accepte exactement les tranches produites par `gainBucketOf`", () => {
    // Verrou d'exécution en complément du verrou de type : si le découpage
    // change côté client sans être reporté ici, toutes les balises portant la
    // nouvelle tranche seraient rejetées — donc invisibles.
    for (const euros of [0, 9_999, 10_000, 49_999, 50_000, 149_999, 500_000, 5_000_000]) {
      const tranche = gainBucketOf(euros);
      expect(funnelEventSchema.safeParse({ ...BALISE_VALIDE, gainBucket: tranche }).success).toBe(
        true,
      );
    }
  });
});

describe("funnelEventSchema — bornes alignées sur les colonnes", () => {
  it.each([
    ["route", 255],
    ["step", 60],
    ["sector", 60],
    ["headcount", 40],
    ["landing", 60],
    ["placement", 40],
    ["locale", 10],
  ])("borne %s à %i caractères", (champ, max) => {
    const limite = { ...BALISE_VALIDE, [champ]: "x".repeat(max) };
    const depasse = { ...BALISE_VALIDE, [champ]: "x".repeat(max + 1) };
    expect(funnelEventSchema.safeParse(limite).success).toBe(true);
    expect(funnelEventSchema.safeParse(depasse).success).toBe(false);
  });

  it("borne l'identifiant de session à la taille de sa colonne", () => {
    expect(
      funnelEventSchema.safeParse({ ...BALISE_VALIDE, sessionId: "s".repeat(64) }).success,
    ).toBe(true);
    expect(
      funnelEventSchema.safeParse({ ...BALISE_VALIDE, sessionId: "s".repeat(65) }).success,
    ).toBe(false);
  });

  it("refuse les rangs d'écran absurdes ou non finis", () => {
    // `Infinity` et les flottants passeraient un simple `z.number()` et
    // feraient échouer l'écriture Postgres, pas la validation.
    for (const valeur of [-1, 201, 1.5, Number.POSITIVE_INFINITY, Number.NaN]) {
      expect(funnelEventSchema.safeParse({ ...BALISE_VALIDE, stepIndex: valeur }).success).toBe(
        false,
      );
    }
    expect(
      funnelEventSchema.safeParse({ ...BALISE_VALIDE, stepIndex: 3, stepTotal: 9 }).success,
    ).toBe(true);
  });

  it("n'accepte que les trois familles d'appareil du tableau de bord", () => {
    expect(funnelEventSchema.safeParse({ ...BALISE_VALIDE, deviceType: "mobile" }).success).toBe(
      true,
    );
    expect(funnelEventSchema.safeParse({ ...BALISE_VALIDE, deviceType: "montre" }).success).toBe(
      false,
    );
  });
});

describe("vocabulaire", () => {
  it("couvre les trois pages du tunnel et les huit événements d'acquisition", () => {
    // `/roi` sert le MÊME questionnaire que `/simulateur` : l'oublier ferait
    // rejeter en silence toutes les balises du site public.
    expect(FUNNEL_KEYS).toEqual(["diagnostic", "simulateur", "roi"]);
    expect(FUNNEL_EVENT_NAMES).toHaveLength(8);
    expect(new Set(FUNNEL_EVENT_NAMES).size).toBe(FUNNEL_EVENT_NAMES.length);
  });
});
