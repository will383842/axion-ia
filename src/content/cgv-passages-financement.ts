/**
 * Passages des CGV relatifs au financement par un tiers et à la certification : EN SOMMEIL.
 *
 * Tant que `QUALIOPI_CERTIFICATION_OBTENUE` n'est pas « true », le texte publié porte la variante
 * `normale` de chaque passage ; ces mots ne figurent alors nulle part. Une fois la certification
 * obtenue, la variante `certifiee` (texte exact de la v3) prend sa place et la version des CGV
 * prend le suffixe `-f` (`cgv-version.ts`).
 *
 * ⚠️ Chaque variante est un FRAGMENT à l'endroit exact où elle s'insère dans l'article : la
 * variante normale est le texte de la v3 moins le passage. Toute retouche d'un côté se répercute
 * de l'autre, et change l'empreinte du texte (`cgv-version.spec.ts`).
 */
import { CGV_AVEC_PASSAGES_FINANCEMENT } from "./cgv-version";

export type IdentifiantPassageCgv = "7.2" | "48.1" | "48.4" | "49.2" | "49.9";

const PASSAGES: Readonly<Record<IdentifiantPassageCgv, { normale: string; certifiee: string }>> = {
  "7.2": {
    normale: "7.2 Le prix est dû par le Client en totalité.",
    certifiee:
      "7.2 Le prix est dû par le Client en totalité, quelle que soit l'issue d'une demande de financement qu'il ferait auprès d'un tiers.",
  },
  "48.1": {
    normale: "il ne vaut ni audit de sécurité, ni vérification de conformité.",
    certifiee: "il ne vaut ni certification, ni audit de sécurité, ni vérification de conformité.",
  },
  "48.4": {
    normale: "à ses conseils, à son expert-comptable ou à un acquéreur",
    certifiee: "à ses conseils, à son expert-comptable, à ses financeurs ou à un acquéreur",
  },
  "49.2": {
    normale: "la formation est commandée et payée par une entreprise. Si une telle",
    certifiee:
      "la formation est commandée et payée par une entreprise, ou financée par un tiers. Si une telle",
  },
  "49.9": {
    normale: "elle ne vaut pas attestation de conformité à une réglementation.",
    certifiee: "elle ne vaut ni certification ni attestation de conformité à une réglementation.",
  },
};

/** Le fragment à publier pour ce passage, selon l'état de la certification. */
export function passageCgv(id: IdentifiantPassageCgv): string {
  return CGV_AVEC_PASSAGES_FINANCEMENT ? PASSAGES[id].certifiee : PASSAGES[id].normale;
}
