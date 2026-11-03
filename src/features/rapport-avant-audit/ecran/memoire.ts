/**
 * `AccesRapports` EN MÉMOIRE — pour les tests de l'écran (aucune base, aucun réseau).
 *
 * Se comporte comme le vrai code est attendu se comporter : un rapport n'appartient qu'à son
 * client, seule une base validée (`termine`) se lit et se télécharge, le PDF client
 * ne se télécharge qu'après validation, et un lancement crée une nouvelle version « en attente ».
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

const EXTENSIONS: Readonly<Record<FormatTelechargement, readonly [string, string]>> = {
  "base-json": ["base-audit", "application/json; charset=utf-8"],
  "base-md": ["base-audit", "text/markdown; charset=utf-8"],
  "fiches-md": ["fiches-personnes", "text/markdown; charset=utf-8"],
  "pdf-client": ["rapport-client", "application/pdf"],
};
const SUFFIXES: Readonly<Record<FormatTelechargement, string>> = {
  "base-json": "json",
  "base-md": "md",
  "fiches-md": "md",
  "pdf-client": "pdf",
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
      if (format === "pdf-client" && r.resume.pdfValideLe === null) return null;
      const [prefixe, type] = EXTENSIONS[format];
      return {
        nom: `${prefixe}-v${r.resume.version}.${SUFFIXES[format]}`,
        type,
        contenu:
          format === "pdf-client"
            ? new Uint8Array([0x25, 0x50, 0x44, 0x46])
            : format === "base-json"
              ? JSON.stringify(r.base)
              : `# ${r.base.meta.raisonSociale}\n`,
      };
    },
    async apercuPdf(clientId, rapportId) {
      const r = duClient(clientId, rapportId);
      return lisible(r) ? { retiresPourRelecture: [] } : null;
    },
    async validerPdf(clientId, rapportId, par) {
      const r = duClient(clientId, rapportId);
      if (!lisible(r)) return { ok: false, raison: "Rapport introuvable ou pas terminé." };
      if (r.resume.pdfValideLe === null) {
        r.resume = { ...r.resume, pdfValideLe: maintenant(), pdfValidePar: par };
      }
      return { ok: true };
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
          pdfValideLe: null,
          pdfValidePar: null,
        },
      });
      return { ok: true, rapportId: id };
    },
  };
}
