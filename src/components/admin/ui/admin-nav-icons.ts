// Registre des icônes de navigation de la console — refonte UI 2026-08-01 (couche 4).
//
// SOURCE UNIQUE. Ce fichier est la seule table qui associe un libellé d'entrée
// de navigation à son pictogramme. Il est consommé par la barre latérale
// (AdminSidebarNav) ET par les hubs qui reproduisent une grille de modules (le
// hub Qualiopi, notamment) : une même destination se reconnaît ainsi à la même
// forme, où qu'elle apparaisse.
//
// POURQUOI IL EXISTE
// ------------------
// La table vivait dans AdminSidebarNav, et les hubs redéclaraient leurs propres
// emojis dans leur coin. Les deux divergeaient sans que rien ne le signale, et
// 100 des 145 entrées de la barre latérale rendaient la même icône dossier
// générique faute d'entrée dédiée.
//
// Le repli reste FolderOpen pour ne jamais casser un rendu, mais il ne doit plus
// jamais servir : admin-sidebar-icons.test.ts échoue si un libellé de la SSOT
// n'a pas sa ligne ici, ou si une ligne ici ne correspond à aucun libellé.
//
// Les emojis sont volontairement exclus — admin-nav.ts les documente comme
// l'anti-pattern numéro 2 de l'audit A1, et leur dessin dépend du système et de
// la police de l'utilisateur.

import {
  Activity,
  AlertTriangle,
  AppWindow,
  BadgeCheck,
  Banknote,
  BarChart3,
  Bell,
  BellRing,
  Blocks,
  BookOpenText,
  BookUser,
  Boxes,
  Briefcase,
  Building2,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  ChartLine,
  ChartPie,
  CheckCheck,
  CircleDollarSign,
  CirclePlus,
  CircleUser,
  ClipboardCheck,
  ClipboardList,
  Cog,
  Columns3,
  Compass,
  Contact,
  CopyCheck,
  Cpu,
  DatabaseBackup,
  ExternalLink,
  Eye,
  FileChartColumn,
  FileCheck,
  FileCode,
  FileLock,
  FilePlus,
  FilePlusCorner,
  FileSearch,
  FileText,
  FolderArchive,
  FolderKanban,
  FolderOpen,
  FolderUp,
  Frown,
  Gauge,
  GitFork,
  Globe,
  GraduationCap,
  Grid3x3,
  Handshake,
  HelpCircle,
  History,
  Hourglass,
  Image as ImageIcon,
  Images,
  Inbox,
  KeyRound,
  KeySquare,
  LayoutDashboard,
  LayoutTemplate,
  Library,
  LifeBuoy,
  Link as LinkIcon,
  ListChecks,
  ListOrdered,
  Loader,
  Mail,
  MailCheck,
  MapPin,
  MapPinned,
  Megaphone,
  MessagesSquare,
  Mic,
  Microscope,
  MonitorPlay,
  MoveUpRight,
  Network,
  Newspaper,
  NotebookPen,
  Package,
  PackagePlus,
  PenLine,
  PhoneCall,
  PhoneForwarded,
  PiggyBank,
  Presentation,
  QrCode,
  Quote,
  Radar,
  Radio,
  Receipt,
  ReceiptText,
  RefreshCw,
  Rocket,
  Rss,
  Scale,
  ScanSearch,
  ScrollText,
  SearchCheck,
  Send,
  Settings,
  Share2,
  Shield,
  ShieldCheck,
  Siren,
  SlidersHorizontal,
  Smile,
  Star,
  Table2,
  Tag,
  Tags,
  Target,
  Telescope,
  Terminal,
  TrendingUp,
  Trophy,
  Truck,
  Tv,
  Upload,
  UserCheck,
  UserPlus,
  UserRound,
  UserSearch,
  Users,
  UsersRound,
  Wallet,
  WavesHorizontal,
  Waypoints,
  Wrench,
  type LucideIcon,
} from "lucide-react";

/** Icône rendue quand un libellé n'a pas d'entrée dédiée. */
export const ADMIN_NAV_FALLBACK_ICON: LucideIcon = FolderOpen;

export const ADMIN_NAV_ICONS: Record<string, LucideIcon> = {
  "Tableau de bord": LayoutDashboard,
  // Boîte de réception (refonte 2026-07-29) — les anciens libellés « Contacts »
  // n'avaient aucune entrée ici et retombaient tous sur l'icône dossier
  // générique : cinq lignes visuellement identiques. Un canal = une icône.
  Tout: Inbox,
  "Appels réservés": PhoneCall,
  Messages: Mail,
  Candidatures: UserPlus,
  "Demandes de podcast": Mic,
  Calendrier: CalendarDays,
  Réservations: ClipboardList,
  Devis: FileText,
  Factures: Receipt,
  Paiements: Wallet,
  Échéanciers: CalendarClock,
  "Options 48h": Hourglass,
  Connaissances: BookOpenText,
  Blog: PenLine,
  Catégories: Tag,
  "Cas concrets": Trophy,
  FAQ: HelpCircle,
  "Centre d'aide": LifeBuoy,
  "Vue d'ensemble": Images,
  Bibliothèque: FolderOpen,
  Téléverser: Upload,
  "Import CSV en masse": PackagePlus,
  "File de qualité": ScanSearch,
  Statistiques: BarChart3,
  Étiquettes: Tags,
  "Journaux d'utilisation (RGPD)": Shield,
  Réglages: Settings,
  Newsletter: Mail,
  "Statistiques & SEO": BarChart3,
  "Web Vitals": Activity,
  "Infra & outils": Wrench,
  "Alertes ops": AlertTriangle,
  Utilisateurs: Users,
  "Journaux d'activité": ScrollText,
  Paramètres: Settings,
  "2FA — sécurité": KeyRound,

  // ——— Couche 4, 2026-08-01 : les 99 libellés qui retombaient sur FolderOpen ———
  // Rangés dans l'ordre des groupes de `admin-nav.ts` pour que l'ajout d'une
  // entrée de navigation se pose ici au même endroit que dans la SSOT.

  // Pilotage (groupe `main`)
  "Hub de pilotage": Gauge,
  Planning: CalendarRange,
  "Timeline ressources": Waypoints,
  "Charge formateurs": UsersRound,
  "Pipeline commercial": TrendingUp,
  Prévisionnel: ChartLine,

  // Boîte de réception (groupe `contacts`) — un destinataire = une icône, même
  // logique que les canaux d'entrée traités plus haut.
  "Messages · Clients": Contact,
  "Messages · Presse": Newspaper,
  "Messages · Partenariats": Share2,
  "Messages · Investisseurs": PiggyBank,
  "Messages · Recrutement": UserSearch,

  // Génération de contenus (groupe `content_gen`)
  "Nouvelle campagne": CirclePlus,
  "Campagnes pré-réglées": LayoutTemplate,
  "Générer une seule page": FilePlusCorner,
  "Actualités (news RSS)": Rss,
  "Premiers pas": Rocket,
  Campagnes: Megaphone,
  "Générations en cours": Loader,
  "Observatoire IA 2026": Telescope,
  "À valider": CheckCheck,
  "Contenus publiés": FileCheck,
  "Suivi des publications (kanban)": Columns3,
  "Photos hero Unsplash": ImageIcon,
  "Backfill citations (Sources)": Quote,
  "Couverture des villes": MapPin,
  "Carte de couverture": MapPinned,
  "Ordre de génération des villes": ListOrdered,
  "Équité entre villes": Scale,
  "Qualité des données (pilote)": Microscope,
  "Cockpit géo": Globe,
  "Tableau croisé ville × secteur": Grid3x3,
  "Qualité du contenu": BadgeCheck,
  Coûts: CircleDollarSign,
  "Détection de doublons": CopyCheck,
  "Dérive du ton éditorial": WavesHorizontal,
  "Suivi des vecteurs de similarité": Network,
  "Liens externes": ExternalLink,
  "Base de connaissances (consultation)": Library,
  "Réglages génération": SlidersHorizontal,
  "Sources RSS (actualités)": Radio,
  "Instructions IA (prompts)": Terminal,
  "Suivi des positions": MoveUpRight,
  "Variantes de landing": GitFork,
  "Profil de l'auteur (Manon)": CircleUser,

  // Contenus éditoriaux (groupe `content`)
  "Avis clients": Star,
  "Offres d'emploi": Briefcase,

  // Qualiopi / formation (groupe `qualiopi`)
  "À traiter": ListChecks,
  "Dossiers (pipeline)": FolderKanban,
  Formations: GraduationCap,
  "Formation Engine": Cpu,
  "Validations IA": ShieldCheck,
  Sessions: CalendarCheck,
  Formateurs: Presentation,
  "Accès & connexions formateurs": KeySquare,
  "Rémunération formateurs": Banknote,
  "Cockpit financier": ChartPie,
  "Audits IA": SearchCheck,
  Stagiaires: UserCheck,
  Offres: Package,
  "Entrées récentes": History,
  "Clients (CRM)": Building2,
  "Facturation (Hub)": ReceiptText,
  "Facture directe": FilePlus,
  "Plans récurrents": RefreshCw,
  "Alertes financement (sessions)": BellRing,
  "Barèmes OPCO": Table2,
  Conformité: ClipboardCheck,
  "Indicateurs / BPF": FileChartColumn,
  Pilotage: Compass,
  Appréciations: Smile,
  Réclamations: Frown,
  "Mode auditeur": Eye,
  Veille: Radar,
  Partenariats: Handshake,
  "Sous-traitants": Truck,
  "Moyens pédagogiques": MonitorPlay,
  Incidents: Siren,
  "Revue de direction": NotebookPen,
  Configuration: Cog,
  "Demandes RGPD": FileLock,
  Alertes: Bell,
  "Emails à valider": MailCheck,

  // Documents & interventions (groupe `documents-interventions`)
  "1-to-1": Target,
  Audit: FileSearch,
  Implémentations: Blocks,
  "Sites web": AppWindow,
  Autres: Boxes,
  "Annuaire équipe": BookUser,
  "Importer un kit": FolderUp,

  // Coaching (groupe `coaching-1to1`)
  "Séances 1-to-1": UserRound,

  // Presse (groupe `presse`)
  Communiqués: Send,
  "Kit média": FolderArchive,
  "Couverture médias": Tv,

  // Chatbot (groupe `chatbot`)
  Escalades: PhoneForwarded,
  Conversations: MessagesSquare,
  "Prompt versionné": FileCode,

  // Exploitation (groupe `ops`)
  "Toutes les URLs": LinkIcon,
  "Sauvegardes & DR": DatabaseBackup,
  "QR codes & liens": QrCode,
};

/**
 * Icône d'un libellé de navigation, repli compris.
 *
 * Passer par cette fonction plutôt que d'indexer ADMIN_NAV_ICONS directement :
 * elle garantit un composant valide même si un libellé arrive sans entrée.
 */
export function adminNavIcon(label: string): LucideIcon {
  return ADMIN_NAV_ICONS[label] ?? ADMIN_NAV_FALLBACK_ICON;
}
