/**
 * `AccesRapports` EN MÉMOIRE — pour les tests de l'écran (aucune base, aucun réseau).
 *
 * Se comporte comme le vrai code est attendu se comporter : un rapport n'appartient qu'à son
 * client, seule une base validée (`termine`) se lit et se télécharge, les documents de la
 * version 2 ne se téléchargent que pour une base `base-audit/2`, et un lancement crée une nouvelle version « en attente ».
 */

import type { BaseAudit } from "../base-audit-schema";
import {
  STATUTS_AVEC_BASE,
  STATUTS_EN_COURS,
  type AccesRapports,
  type FichierRapport,
  type FormatTelechargement,
  type ResumeRapport,
} from "./contrat";

export interface RapportEnMemoire {
  readonly clientId: string;
  resume: ResumeRapport;
  readonly base: BaseAudit | null;
}

export interface OptionsMemoire {
  readonly rapports?: ReadonlyArray<RapportEnMemoire>;
  readonly maintenant?: () => Date;
  readonly branche?: boolean;
}

const EXTENSIONS: Readonly<Record<FormatTelechargement, readonly [string, string, string]>> = {
  "synthese-html": ["INTERNE-synthese", "text/html; charset=utf-8", "html"],
  "automatisations-html": ["INTERNE-automatisations", "text/html; charset=utf-8", "html"],
  "schema-html": ["INTERNE-schema", "text/html; charset=utf-8", "html"],
  "base-json": ["base-audit", "application/json; charset=utf-8", "json"],
};

export function creerAccesEnMemoire(
  opts: OptionsMemoire = {},
): AccesRapports & { readonly rapports: RapportEnMemoire[] } {
  const rapports: RapportEnMemoire[] = [...(opts.rapports ?? [])];
  const maintenant = opts.maintenant ?? (() => new Date());
  let compteur = 0;

  const duClient = (clientId: string, rapportId: string): RapportEnMemoire | undefined =>
    rapports.find((r) => r.clientId === clientId && r.resume.id === rapportId);
  const lisible = (r: RapportEnMemoire | undefined): r is RapportEnMemoire & { base: BaseAudit } =>
    r !== undefined && r.base !== null && STATUTS_AVEC_BASE.includes(r.resume.statut);

  return {
    branche: opts.branche ?? true,
    rapports,
    async listerRapports(clientId) {
      return rapports
        .filter((r) => r.clientId === clientId)
        .map((r) => r.resume)
        .sort((a, b) => b.version - a.version);
    },
    async lireBase(clientId, rapportId) {
      const r = duClient(clientId, rapportId);
      return lisible(r) ? r.base : null;
    },
    async lirePropositions(clientId, rapportId) {
      const r = duClient(clientId, rapportId);
      return lisible(r) ? r.base.propositions_fiche : [];
    },
    async telecharger(clientId, rapportId, format): Promise<FichierRapport | null> {
      const r = duClient(clientId, rapportId);
      if (!lisible(r)) return null;
      if (
        format !== "base-json" &&
        format !== "synthese-html" &&
        r.resume.versionSchema !== "base-audit/2"
      ) {
        return null;
      }
      const [prefixe, type, suffixe] = EXTENSIONS[format];
      return {
        nom: `${prefixe}-v${r.resume.version}.${suffixe}`,
        type,
        contenu:
          format === "base-json"
            ? JSON.stringify(r.base)
            : `<!doctype html><title>${r.base.meta.raisonSociale}</title>`,
      };
    },
    async lancer(clientId, par) {
      const duMeme = rapports.filter((r) => r.clientId === clientId);
      if (duMeme.some((r) => STATUTS_EN_COURS.includes(r.resume.statut))) {
        return { ok: false, raison: "Une analyse est déjà en cours." };
      }
      compteur += 1;
      const id = `memoire-${compteur}`;
      rapports.push({
        clientId,
        base: null,
        resume: {
          id,
          version: duMeme.reduce((m, r) => Math.max(m, r.resume.version), 0) + 1,
          statut: "en_attente",
          etape: null,
          progression: 0,
          jetonsEntree: 0,
          jetonsSortie: 0,
          lanceLe: maintenant(),
          termineLe: null,
          lancePar: par,
          reponsesJusquau: null,
          erreur: null,
          versionSchema: null,
        },
      });
      return { ok: true, rapportId: id };
    },
  };
}
