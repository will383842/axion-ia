// CV d'un candidat apporteur + analyse — lecture DÉFENSIVE du JSON `details`.
//
// 2026-09-28 — Les candidats reçus par l'annonce Indeed « Commercial(e) B2B »
// ont envoyé un CV, et ont postulé pour un poste SALARIÉ. Leur fiche vit dans
// le tunnel des apporteurs (Contacts › Commercial) ; il fallait y voir :
//   · qu'ils visaient un salariat — l'échange de 15 minutes doit le lever ;
//   · le CV lui-même, téléchargeable ;
//   · ce que dit le CV, et une analyse écrite à sa lecture.
//
// 🔑 Deux blocs SÉPARÉS de `details.candidature`, volontairement :
// `details.candidature` porte les RÉPONSES du candidat au formulaire, et il part
// tel quel vers Axion Partners (`server/partners/payloads.ts`). Ce qu'on a lu
// dans un CV, ou pensé en le lisant, n'est pas une déclaration du candidat : le
// ranger là ferait parler la personne à notre place.
//
//   details.candidatureSalariee = { canal, annonce }
//   details.cv = { fichier, extrait, analyse, analyseLe }
//
// ⚠️ Module PUR (aucun import serveur) : lu par la fiche console et par la route
// de téléchargement, il ne doit rien tirer d'autre.

export interface CandidatureSalariee {
  /** Canal de l'annonce (`indeed`). */
  readonly canal: string;
  /** Intitulé de l'annonce à laquelle la personne a répondu. */
  readonly annonce: string | null;
}

export interface FichierCv {
  /** Chemin absolu sur le volume CV (`/var/data/cv/<uuid>/<nom>`). */
  readonly storagePath: string;
  readonly nomOriginal: string;
  readonly mimeType: string | null;
  readonly tailleOctets: number | null;
}

export interface ExperienceCv {
  readonly poste: string;
  readonly entreprise: string;
  readonly lieu: string | null;
  readonly periode: string | null;
  readonly resume: string | null;
}

export interface FormationCv {
  readonly diplome: string;
  readonly etablissement: string | null;
  readonly annee: string | null;
}

export interface ExtraitCv {
  readonly email: string | null;
  readonly telephone: string | null;
  readonly ville: string | null;
  readonly pays: string | null;
  readonly linkedin: string | null;
  readonly titre: string | null;
  readonly experienceCommercialeAnnees: number | null;
  readonly experienceB2B: boolean | null;
  readonly experiences: readonly ExperienceCv[];
  readonly formations: readonly FormationCv[];
  readonly competences: readonly string[];
  readonly langues: readonly string[];
  readonly permis: string | null;
  readonly vehicule: boolean | null;
}

export const PROFILS_APPORTEUR = {
  fort: { label: "Profil apporteur : fort", tone: "success" },
  moyen: { label: "Profil apporteur : moyen", tone: "warning" },
  faible: { label: "Profil apporteur : faible", tone: "neutral" },
} as const;
export type ProfilApporteur = keyof typeof PROFILS_APPORTEUR;

export interface AnalyseCv {
  readonly resume: string | null;
  readonly pointsForts: readonly string[];
  readonly pointsVigilance: readonly string[];
  readonly profilApporteur: ProfilApporteur | null;
  readonly avis: string | null;
}

export interface CvCandidat {
  readonly fichier: FichierCv | null;
  readonly extrait: ExtraitCv | null;
  readonly analyse: AnalyseCv | null;
  /** Date ISO de l'analyse. */
  readonly analyseLe: string | null;
}

// ── Lecture défensive ───────────────────────────────────────────────────────

function obj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}
function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}
function bool(v: unknown): boolean | null {
  return typeof v === "boolean" ? v : null;
}
function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function strs(v: unknown): string[] {
  return Array.isArray(v) ? v.map(str).filter((x): x is string => x !== null) : [];
}

export function lireCandidatureSalariee(details: unknown): CandidatureSalariee | null {
  const c = obj(obj(details)?.candidatureSalariee);
  const canal = c ? str(c.canal) : null;
  return canal ? { canal, annonce: str(c?.annonce) } : null;
}

export function lireCvCandidat(details: unknown): CvCandidat | null {
  const cv = obj(obj(details)?.cv);
  if (!cv) return null;

  const f = obj(cv.fichier);
  const storagePath = f ? str(f.storagePath) : null;
  const fichier: FichierCv | null =
    f && storagePath
      ? {
          storagePath,
          nomOriginal: str(f.nomOriginal) ?? "cv",
          mimeType: str(f.mimeType),
          tailleOctets: num(f.tailleOctets),
        }
      : null;

  const e = obj(cv.extrait);
  const extrait: ExtraitCv | null = e
    ? {
        email: str(e.email),
        telephone: str(e.telephone),
        ville: str(e.ville),
        pays: str(e.pays),
        linkedin: str(e.linkedin),
        titre: str(e.titre),
        experienceCommercialeAnnees: num(e.experienceCommercialeAnnees),
        experienceB2B: bool(e.experienceB2B),
        experiences: Array.isArray(e.experiences)
          ? e.experiences.flatMap((raw) => {
              const x = obj(raw);
              const poste = x ? str(x.poste) : null;
              const entreprise = x ? str(x.entreprise) : null;
              if (!x || (!poste && !entreprise)) return [];
              return [
                {
                  poste: poste ?? "Poste non précisé",
                  entreprise: entreprise ?? "—",
                  lieu: str(x.lieu),
                  periode: str(x.periode),
                  resume: str(x.resume),
                },
              ];
            })
          : [],
        formations: Array.isArray(e.formations)
          ? e.formations.flatMap((raw) => {
              const x = obj(raw);
              const diplome = x ? str(x.diplome) : null;
              if (!x || !diplome) return [];
              return [
                {
                  diplome,
                  etablissement: str(x.etablissement),
                  annee: str(x.annee) ?? (num(x.annee) !== null ? String(num(x.annee)) : null),
                },
              ];
            })
          : [],
        competences: strs(e.competences),
        langues: strs(e.langues),
        permis: str(e.permis),
        vehicule: bool(e.vehicule),
      }
    : null;

  const a = obj(cv.analyse);
  const profil = a ? str(a.profilApporteur) : null;
  const analyse: AnalyseCv | null = a
    ? {
        resume: str(a.resume),
        pointsForts: strs(a.pointsForts),
        pointsVigilance: strs(a.pointsVigilance),
        profilApporteur: profil && profil in PROFILS_APPORTEUR ? (profil as ProfilApporteur) : null,
        avis: str(a.avis),
      }
    : null;

  if (!fichier && !extrait && !analyse) return null;
  return { fichier, extrait, analyse, analyseLe: str(cv.analyseLe) };
}
