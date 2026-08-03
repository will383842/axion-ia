/**
 * Coquille de l'espace stagiaire — navigation, identité, refus d'accès.
 *
 * Composée par CHAQUE page plutôt que par le layout : seule la page sait quelle
 * section elle est. Le chargement des données passe par `cache()`, donc l'appeler
 * dans la coquille ET dans la page ne coûte qu'une seule série de requêtes.
 */

import { CalendarDays, CircleCheckBig, FileText, UserRound } from "lucide-react";

import { EspaceShell, type EspaceNavItem } from "@/components/espace/EspaceShell";
import { QuitterPortailButton } from "@/components/portail/QuitterPortailButton";
import { quitterPortailAction } from "@/server/actions/qualiopi/portail";
import type { EspaceStagiaire } from "@/server/qualiopi/portail/portail-service";

import { chargerEspaceStagiaire, questionnairesEnAttente, type RaisonRefus } from "./_chargement";

/**
 * Chemins ABSOLUS, locale comprise. Les espaces privés ne sont pas déclarés
 * dans `pathnames` : on n'y inscrit pas de routes internes, et le `Link` typé
 * de `@/i18n/navigation` les refuserait donc.
 */
function base(locale: string): string {
  return `/${locale}/portail/mon-espace`;
}

export type SectionStagiaire = "accueil" | "formations" | "documents" | "compte";

/**
 * L'ordre suit le parcours : ce qu'on doit faire, ce qu'on suit, ce qu'on garde,
 * ses propres données. **Quatre entrées au plus** — au-delà, la barre du bas
 * devient illisible sur un téléphone, et c'est là que la majorité des
 * bénéficiaires ouvrent ce portail.
 */
function construireNavigation(aFaire: number, locale: string): readonly EspaceNavItem[] {
  const BASE = base(locale);
  return [
    {
      cle: "accueil",
      href: BASE,
      label: "À faire",
      icone: CircleCheckBig,
      // Pas de pastille à zéro : « 0 » inquiète sans rien signaler.
      ...(aFaire > 0 ? { enAttente: aFaire } : {}),
    },
    {
      cle: "formations",
      href: `${BASE}/formations`,
      label: "Mes formations",
      labelCourt: "Formations",
      icone: CalendarDays,
    },
    {
      cle: "documents",
      href: `${BASE}/documents`,
      label: "Mes documents",
      labelCourt: "Documents",
      icone: FileText,
    },
    {
      cle: "compte",
      href: `${BASE}/mon-compte`,
      label: "Mon compte",
      labelCourt: "Compte",
      icone: UserRound,
    },
  ];
}

export interface CoquilleStagiaireProps {
  section: SectionStagiaire;
  locale: string;
  /** Reçoit l'espace chargé — évite à la page de le recharger elle-même. */
  children: (espace: EspaceStagiaire) => React.ReactNode;
}

export async function CoquilleStagiaire({ section, locale, children }: CoquilleStagiaireProps) {
  const resultat = await chargerEspaceStagiaire();
  if (resultat.etat === "refus") return <AccesRefuse raison={resultat.raison} />;

  const { espace } = resultat;

  return (
    <EspaceShell
      titreEspace="Mon espace"
      sousTitreEspace="Votre formation et vos documents"
      navigation={construireNavigation(questionnairesEnAttente(espace).length, locale)}
      sectionActive={section}
      utilisateur={{ nom: `${espace.trainee.prenom} ${espace.trainee.nom}`.trim() }}
      actionSortie={<QuitterPortailButton quitterAction={quitterPortailAction} locale={locale} />}
    >
      {children(espace)}
    </EspaceShell>
  );
}

/**
 * Refus d'accès — message DIFFÉRENCIÉ selon la cause.
 *
 * Les trois cas n'appellent pas la même action du bénéficiaire, et le dernier
 * doit continuer à dire « contactez l'organisme de formation » : il couvre aussi
 * les pannes Prisma et les échecs de déchiffrement.
 */
function AccesRefuse({ raison }: { raison: RaisonRefus }) {
  const messages: Record<RaisonRefus, string> = {
    absente: "Vous n’êtes pas connecté. Utilisez le lien qui vous a été transmis par courriel.",
    expiree: "Votre lien a expiré ou a été révoqué. Demandez-en un nouveau pour vous reconnecter.",
    introuvable: "Votre profil est introuvable. Contactez l’organisme de formation.",
  };

  return (
    <div className="bg-bg flex min-h-screen items-center justify-center px-4">
      <div className="border-border bg-paper max-w-md rounded-xl border p-8 text-center">
        <p className="text-mocha font-serif text-lg font-semibold">Accès impossible</p>
        <p className="text-fg-soft mt-2 text-sm leading-relaxed">{messages[raison]}</p>
      </div>
    </div>
  );
}
