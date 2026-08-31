// @vitest-environment node
//
// Environnement `node` : lecture de fichiers du dépôt.

/**
 * Verrou — un invité tiers ne doit atteindre NI l'export NI l'effacement d'une
 * réservation qui n'est pas la sienne.
 *
 * ## Le défaut que ce témoin ferme, et d'où il venait
 *
 * Le 2026-08-31 (PR #900), l'export et l'effacement RGPD ont été élargis pour
 * chercher l'adresse **dans tout le JSON** de la réservation :
 *
 * ```sql
 * WHERE position(lower($email) in lower(raw_payload::text)) > 0
 * ```
 *
 * L'intention était de rattraper une réservation captée mais jamais enrichie,
 * dont la colonne `inviteeEmail` serait nulle alors que le JSON porterait
 * l'adresse. **Ce cas n'existe pas, et il ne peut pas exister** — mesuré le jour
 * même sur les 18 lignes de production :
 *
 *   · `invitee_email IS NULL` **et** une adresse dans le payload → **0 ligne** ;
 *   · les 5 captures navigateur ne contiennent **aucune arobase** : le
 *     `postMessage` de Calendly ne transporte que deux URI, jamais de PII ;
 *   · toute ligne enrichie par l'API a, par construction, sa colonne remplie.
 *
 * En revanche, l'élargissement ouvrait un vrai trou. Le `raw_payload` contient
 * `event_guests` : les personnes que le prospect ajoute lui-même au rendez-vous
 * via « Ajouter des invités ». Mesuré : **13 lignes sur 18 portent déjà la clé**
 * (aucune avec un invité réel à ce jour — le défaut était donc latent).
 *
 * Un invité s'authentifie légitimement : le jeton d'export part à SA propre
 * adresse. Avec la recherche élargie, il obtenait :
 *
 *   · à l'export — la fiche complète du prospect : nom, téléphone, notes
 *     internes écrites sur lui, et surtout `cancelUrl` / `rescheduleUrl`, des
 *     URL-capacités qui laissent **annuler le rendez-vous d'autrui sans aucune
 *     authentification** ;
 *   · à l'effacement — l'anonymisation de toute la ligne, donc la destruction
 *     de la réservation du prospect.
 *
 * ## Ce que ce test vérifie, et ce qu'il refuse de vérifier
 *
 * Il ne rejoue pas une requête SQL — il n'y a pas de base ici. Il vérifie que le
 * MOTIF fautif a disparu des deux chemins, et que le filtre par colonne est bien
 * ce qui reste. C'est une garde de forme, assumée comme telle : la garde de fond
 * est que le cas rattrapé n'existe pas, et cela se mesure en base, pas en test.
 *
 * 🔑 Le contre-témoin est la moitié qui compte : il exige que la recherche par
 * `inviteeEmail` SOIT présente. Sans lui, supprimer purement et simplement la
 * fonction ferait passer ce fichier au vert — on aurait fermé la fuite en
 * cassant le droit d'accès, et rien ne l'aurait dit.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const RACINE = process.cwd();

function lire(relatif: string): string {
  return readFileSync(join(RACINE, relatif), "utf8");
}

/**
 * Retire les commentaires avant toute recherche.
 *
 * 🔑 Sans ce filtre, le commentaire qui EXPLIQUE le défaut ferait rougir la
 * garde qui le surveille — et on serait tenté de supprimer l'explication plutôt
 * que de corriger la mesure. Le piège s'est produit deux fois le même jour, sur
 * ce fichier et sur `tests/unit/ci/gate-mobile-et-inp.spec.ts` : une garde doit
 * mesurer ce qui est EXÉCUTÉ, jamais ce qui est écrit à côté.
 *
 * Volontairement grossier — blocs `/* *\/` et lignes `//`. Il ne s'agit pas
 * d'analyser du TypeScript, seulement de ne pas confondre du texte avec du code.
 */
function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
}

/** Les deux chemins par lesquels une personne exerce ses droits. */
const CHEMINS = [
  { nom: "effacement (art. 17)", fichier: "src/lib/rgpd-erase.ts" },
  { nom: "export (art. 15)", fichier: "src/app/api/gdpr-export/route.ts" },
] as const;

/**
 * Le motif fautif : une comparaison de l'adresse contre le JSON entier.
 *
 * Volontairement large — `raw_payload::text` suffirait, mais quelqu'un qui
 * réintroduirait le défaut sous une autre forme (`::text ILIKE`, `strpos`,
 * `jsonb_pretty`) doit rougir aussi. Un motif trop étroit ne garde que la
 * formulation qu'on a nous-même écrite.
 */
const MOTIF_FAUTIF = /raw_payload\s*::\s*text/i;

describe("un invité tiers n'atteint pas la réservation d'un prospect", () => {
  for (const { nom, fichier } of CHEMINS) {
    it(`🔴 ${nom} : ne cherche PAS l'adresse dans la charge brute`, () => {
      const src = sansCommentaires(lire(fichier));
      expect(
        MOTIF_FAUTIF.test(src),
        `${fichier} compare l'adresse au JSON entier. Or ce JSON contient ` +
          `event_guests : un invité ajouté par le prospect trouverait la fiche ` +
          `de ce dernier — téléphone, notes internes, et les liens d'annulation ` +
          `qui agissent sans authentification.`,
      ).toBe(false);
    });

    it(`🔑 CONTRE-TÉMOIN — ${nom} : cherche toujours par l'adresse de l'invité principal`, () => {
      const src = sansCommentaires(lire(fichier));
      expect(
        /inviteeEmail/.test(src),
        `${fichier} ne filtre plus sur inviteeEmail : on aurait fermé la fuite ` +
          `en supprimant le droit d'accès lui-même. Le titulaire de la ` +
          `réservation doit TOUJOURS retrouver la sienne.`,
      ).toBe(true);
    });
  }

  it("🔑 aucune requête SQL brute ne subsiste sur cette table dans les deux chemins", () => {
    // `$queryRaw` n'est pas interdit en soi ; il l'est ICI, parce qu'il a servi
    // à contourner le filtre par colonne. Le rendre visible évite qu'il
    // revienne « juste pour un cas particulier ».
    for (const { fichier } of CHEMINS) {
      const src = sansCommentaires(lire(fichier));
      expect(
        /\$queryRaw[\s\S]{0,200}calendly_events/i.test(src),
        `${fichier} interroge calendly_events en SQL brut — c'est par là que la ` +
          `fuite était entrée.`,
      ).toBe(false);
    }
  });
});
