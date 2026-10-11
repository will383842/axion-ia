/**
 * Formateurs indépendants — le PORT du contrôle registre (L4, `SourceRegistre`) branché
 * sur le client COMMUN du registre des entreprises (FAC-5, lot L1 pour l'enrichissement).
 *
 * Un seul appel par SIRET : l'établissement et la liste des numéros de déclaration du
 * même SIREN viennent de la même réponse (mémorisée le temps d'un contrôle). Aucun client
 * HTTP n'est recréé ici. Une réponse « introuvable » ou « indisponible » vaut « muette » :
 * le contrôle en fait un orange, jamais une conclusion.
 *
 * Module neutre (ni `server-only`, ni Next).
 */

import {
  lireEtablissementParSiret,
  type ResultatRegistre,
} from "@/server/registre-entreprises/annuaire";

import type { FaitsEntreprise, FaitsListeOF } from "./controle-regles";
import type { SourceRegistre } from "./controle";

export function sourceRegistreCommune(
  lire: (siret: string) => Promise<ResultatRegistre> = (s) =>
    lireEtablissementParSiret(s, { enrichi: true }),
): SourceRegistre {
  let memo: { siret: string; r: Promise<ResultatRegistre> } | null = null;
  const reponse = (siret: string) => {
    if (memo?.siret !== siret) memo = { siret, r: lire(siret) };
    return memo.r;
  };
  let dernierSiret: string | null = null;

  return {
    async lireEntreprise(siret: string): Promise<FaitsEntreprise | null> {
      dernierSiret = siret;
      const r = await reponse(siret);
      if (!r.ok) return null;
      // Le client ne sépare pas l'état de l'unité légale de celui de l'établissement :
      // inactif = établissement fermé (vrai aussi pour une unité légale cessée).
      return {
        siren: r.entreprise.siren,
        etatAdministratif: "A",
        naf: r.entreprise.naf,
        etablissement: { siret: r.entreprise.siret ?? siret, ouvert: r.entreprise.active },
      };
    },
    async lireListeOF(siren: string): Promise<FaitsListeOF | null> {
      if (dernierSiret === null) return null;
      const r = await reponse(dernierSiret);
      if (!r.ok || r.entreprise.siren !== siren) return null;
      const liste = r.entreprise.enrichissement?.ndaListe ?? null;
      return liste === null ? null : { ndaDuSiren: liste, sirenDuNda: null };
    },
  };
}
