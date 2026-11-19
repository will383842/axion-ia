// Les trois petits schémas de la section « Des implémentations sur mesure » (serveur pur).
// Dessinés dans la maquette, recopiés tels quels ; la police est celle de la page.
// Chaque schéma garde son `aria-label` : c’est lui qui dit ce que l’image montre.

const CLASSE = "mb-4 block h-auto w-full";

export function SchemaDevis() {
  return (
    <svg
      className={CLASSE}
      viewBox="0 0 320 110"
      role="img"
      aria-label="Exemple : un devis préparé à partir d’un modèle, en attente de validation"
    >
      <g fill="none" strokeWidth="1.5" className="stroke-fg-soft">
        <rect x="8" y="22" width="80" height="66" rx="8" />
        <rect x="120" y="22" width="80" height="66" rx="8" />
        <rect x="232" y="22" width="80" height="66" rx="8" />
        <path d="M92 55h24M204 55h24" strokeWidth="2" className="stroke-terracotta" />
        <path d="m112 50 6 5-6 5M224 50l6 5-6 5" strokeWidth="2" className="stroke-terracotta" />
        <path d="M20 40h56M20 52h40M20 64h48" className="stroke-border-strong" />
        <path d="M132 40h56M132 52h56M132 64h56M132 76h36" className="stroke-border-strong" />
        <path d="m252 58 10 10 22-24" strokeWidth="2.5" className="stroke-success" />
      </g>
      <g fontFamily="inherit" fontSize="13" textAnchor="middle" className="fill-fg-soft">
        <text x="48" y="14">
          Vos notes
        </text>
        <text x="160" y="14">
          Devis préparé
        </text>
        <text x="272" y="14">
          Vous validez
        </text>
      </g>
    </svg>
  );
}

export function SchemaRelances() {
  return (
    <svg
      className={CLASSE}
      viewBox="0 0 320 110"
      role="img"
      aria-label="Exemple : une relance de facture prête, avec sa date d’envoi"
    >
      <g fill="none" strokeWidth="1.5" className="stroke-fg-soft">
        <rect x="8" y="22" width="80" height="66" rx="8" />
        <rect x="120" y="22" width="80" height="66" rx="8" />
        <rect x="232" y="22" width="80" height="66" rx="8" />
        <path d="M92 55h24M204 55h24" strokeWidth="2" className="stroke-terracotta" />
        <path d="m112 50 6 5-6 5M224 50l6 5-6 5" strokeWidth="2" className="stroke-terracotta" />
        <path d="M20 36h56M20 48h56M20 60h56M20 72h56" className="stroke-border-strong" />
        <path d="M132 34h56M132 46h56M132 58h56" className="stroke-border-strong" />
        <circle cx="160" cy="76" r="5" stroke="none" className="fill-terracotta" />
        <path d="M246 34h52M246 46h52M246 58h52" className="stroke-border-strong" />
        <path d="m260 74 6 6 14-16" strokeWidth="2.5" className="stroke-success" />
      </g>
      <g fontFamily="inherit" fontSize="13" textAnchor="middle" className="fill-fg-soft">
        <text x="48" y="14">
          Modèle validé
        </text>
        <text x="160" y="14">
          Date fixée
        </text>
        <text x="272" y="14">
          Relance partie
        </text>
      </g>
    </svg>
  );
}

export function SchemaCourriels() {
  return (
    <svg
      className={CLASSE}
      viewBox="0 0 320 110"
      role="img"
      aria-label="Exemple : une boîte de réception triée en commandes, devis et réclamations"
    >
      <g fill="none" strokeWidth="1.5" className="stroke-fg-soft">
        <rect x="8" y="22" width="110" height="66" rx="8" />
        <path d="M20 36h86M20 48h70M20 60h86M20 72h60" className="stroke-border-strong" />
        <path d="M122 55h30" strokeWidth="2" className="stroke-terracotta" />
        <path d="m146 50 6 5-6 5" strokeWidth="2" className="stroke-terracotta" />
        <rect x="170" y="14" width="140" height="22" rx="6" />
        <rect x="170" y="44" width="140" height="22" rx="6" />
        <rect x="170" y="74" width="140" height="22" rx="6" />
      </g>
      <g fontFamily="inherit" fontSize="13" className="fill-fg-soft">
        <text x="63" y="14" textAnchor="middle">
          Le matin
        </text>
        <text x="180" y="29">
          Commandes
        </text>
        <text x="180" y="59">
          Devis
        </text>
        <text x="180" y="89">
          Réclamations
        </text>
      </g>
    </svg>
  );
}
