import type { VideoPubliee } from "@/server/videos/lecture";

/** Une vidéo publiée de 184 s pour les tests de rendu. */
export function uneVideo(over: Partial<VideoPubliee> = {}): VideoPubliee {
  const slug = over.slug ?? "automatiser-ses-relances";
  const base = `/medias/videos/${slug}/v3`;
  return {
    slug,
    version: 3,
    theme: "automatisation",
    titre: "Automatiser ses relances clients en quelques minutes",
    description:
      "Comment mettre en place des relances clients automatiques sans perdre le ton humain de votre entreprise.",
    resume:
      "RESUME-VISIBLE Les relances clients prennent un temps considérable et sont souvent oubliées au pire moment. Cette vidéo montre comment les automatiser par étapes.",
    aRetenir: ["POINT-UN à retenir", "POINT-DEUX à retenir", "POINT-TROIS à retenir"],
    questions: [
      { question: "QUESTION-UNE ?", reponse: "REPONSE-UNE détaillée." },
      { question: "QUESTION-DEUX ?", reponse: "REPONSE-DEUX détaillée." },
    ],
    chapitres: [
      { titre: "Pourquoi relancer", debutSecondes: 0 },
      { titre: "Automatiser sans perdre le ton", debutSecondes: 42 },
    ],
    fichiers: {
      video: {
        chemin: `${base}/video-1080p.mp4`,
        type: "video/mp4",
        octets: 1,
        largeur: 1920,
        hauteur: 1080,
      },
      affiche169: {
        chemin: `${base}/affiche-16x9.avif`,
        type: "image/avif",
        octets: 1,
        largeur: 1280,
        hauteur: 720,
      },
      vignette43: {
        chemin: `${base}/vignette-4x3.avif`,
        type: "image/avif",
        octets: 1,
        largeur: 960,
        hauteur: 720,
      },
      vignette11: {
        chemin: `${base}/vignette-1x1.avif`,
        type: "image/avif",
        octets: 1,
        largeur: 720,
        hauteur: 720,
      },
      sousTitres: { chemin: `${base}/sous-titres.fr.vtt`, type: "text/vtt", octets: 1 },
    },
    transcription: null,
    dureeSecondes: 184,
    serie: null,
    lien: { type: "service", chemin: "/fr/implementation" },
    iaVoixGeneree: false,
    iaDoubleNumerique: false,
    williamsALImage: false,
    publieeLe: new Date("2026-11-02T09:00:00Z"),
    modifieeLe: new Date("2026-11-05T09:00:00Z"),
    ...over,
  };
}
