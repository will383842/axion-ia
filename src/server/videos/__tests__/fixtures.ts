import type { PublicationVideo } from "../contrat";

/** Une publication valide (vidéo de 184 s), modifiable champ par champ par les tests. */
export function publicationValide(over: Record<string, unknown> = {}): PublicationVideo {
  const slug = (over.slug as string | undefined) ?? "automatiser-ses-relances";
  const version = (over.version as number | undefined) ?? 3;
  const base = `/medias/videos/${slug}/v${version}`;
  return {
    schemaVersion: 1,
    studioVideoId: "vs_01j9abcdefgh",
    version,
    slug,
    langue: "fr",
    titre: "Automatiser ses relances clients en quelques minutes",
    description:
      "Comment mettre en place des relances clients automatiques sans perdre le ton humain de votre entreprise, en trois étapes.",
    resume:
      "Les relances clients prennent un temps considérable et sont souvent oubliées au pire moment. Cette vidéo montre comment les automatiser par étapes : repérer les moments clés du parcours, rédiger des messages courts et sincères, puis contrôler les envois sans les subir. Vous verrez un exemple concret sur un devis resté sans réponse, la façon de garder la main sur le ton, et les erreurs courantes à éviter pour ne pas agacer vos interlocuteurs.",
    aRetenir: [
      "Repérez les trois moments où une relance fait vraiment gagner du temps.",
      "Rédigez des messages courts qui sonnent comme vous, pas comme un robot.",
      "Gardez toujours un contrôle humain avant chaque envoi important.",
    ],
    questions: [
      {
        question: "Faut-il prévenir ses clients qu'une relance est automatisée ?",
        reponse:
          "Ce n'est pas obligatoire pour une relance commerciale classique, mais rester transparent sur l'usage d'outils automatiques renforce la confiance.",
      },
      {
        question: "Combien de relances envoyer au maximum ?",
        reponse:
          "Deux ou trois relances espacées suffisent dans la plupart des cas ; au-delà, le risque d'agacer dépasse le bénéfice attendu.",
      },
    ],
    theme: "automatisation",
    serie: { slug: "gagner-du-temps", titre: "Gagner du temps au quotidien", rang: 2 },
    lien: { type: "service", chemin: "/fr/implementation" },
    dureeSecondes: 184,
    chapitres: [
      { titre: "Pourquoi relancer", debutSecondes: 0 },
      { titre: "Automatiser sans perdre le ton", debutSecondes: 42 },
    ],
    fichiers: {
      video: {
        chemin: `${base}/video-1080p.mp4`,
        type: "video/mp4",
        octets: 18_234_112,
        sha256: "a".repeat(64),
        largeur: 1920,
        hauteur: 1080,
      },
      affiche169: {
        chemin: `${base}/affiche-16x9.avif`,
        type: "image/avif",
        octets: 48_211,
        largeur: 1280,
        hauteur: 720,
      },
      vignette43: {
        chemin: `${base}/vignette-4x3.avif`,
        type: "image/avif",
        octets: 40_100,
        largeur: 960,
        hauteur: 720,
      },
      vignette11: {
        chemin: `${base}/vignette-1x1.avif`,
        type: "image/avif",
        octets: 35_500,
        largeur: 720,
        hauteur: 720,
      },
      sousTitres: { chemin: `${base}/sous-titres.fr.vtt`, type: "text/vtt", octets: 4_100 },
    },
    transcription: null,
    ia: { voixGeneree: true, doubleNumerique: false },
    personnesALImage: { williams: false },
    attestations: { aucunNomNiLogoDeClient: true },
    ...over,
  } as PublicationVideo;
}
