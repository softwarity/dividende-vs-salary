export interface IrBracket {
  /** Borne supérieure de la tranche (par part). `null` = dernière tranche (illimitée). */
  upTo: number | null;
  /** Taux marginal de la tranche, ex. 0.30 pour 30 %. */
  rate: number;
}

export interface FiscalParams {
  // --- Dividendes (PFU / flat tax) ---
  /** Taux global du PFU appliqué au dividende brut. Défaut révisé : 31,4 %. */
  tauxPFU: number;

  // --- Impôt sur les sociétés (IS) ---
  isTauxReduit: number; // 15 %
  isSeuil: number; // 42 500 €
  isTauxNormal: number; // 25 %

  // --- Charges sociales SASU (président assimilé salarié), en % du brut ---
  tauxChargesPatronales: number; // ~ 42 %
  tauxChargesSalariales: number; // ~ 22 %

  // --- Impôt sur le revenu (IR) sur la rémunération salaire ---
  abattementSalaireTaux: number; // 10 %
  abattementSalairePlafond: number; // plafond de l'abattement 10 %
  baremeIR: IrBracket[];
  partsFiscales: number;
  /** Autres revenus nets imposables du foyer (hors salaire simulé). */
  autresRevenusImposables: number;

  /** SMIC horaire brut (sert au calcul des trimestres de retraite). */
  smicHoraire: number;
}

export interface SalaireResult {
  netPoche: number;
  netSocial: number; // net avant impôt sur le revenu
  netImposable: number; // après abattement 10 %
  brut: number;
  chargesSalariales: number;
  chargesPatronales: number;
  ir: number; // IR marginal imputable au salaire
  coutEntreprise: number; // super-brut = résultat avant IS nécessaire
  tauxPrelevementGlobal: number; // (coût - net) / coût
}

export interface DividendeResult {
  netPoche: number;
  pfu: number;
  dividendeBrut: number; // bénéfice après IS distribué
  is: number;
  beneficeAvantIS: number;
  coutEntreprise: number; // = beneficeAvantIS
  tauxPrelevementGlobal: number;
}

export interface ComparisonResult {
  netCible: number;
  salaire: SalaireResult;
  dividende: DividendeResult;
  meilleur: 'salaire' | 'dividende' | 'egalite';
  /** Coût épargné en choisissant l'option la moins chère. */
  economie: number;
}

export const DEFAULT_PARAMS: FiscalParams = {
  tauxPFU: 0.314,

  isTauxReduit: 0.15,
  isSeuil: 42500,
  isTauxNormal: 0.25,

  tauxChargesPatronales: 0.42,
  tauxChargesSalariales: 0.22,

  abattementSalaireTaux: 0.1,
  abattementSalairePlafond: 14426,
  baremeIR: [
    { upTo: 11497, rate: 0 },
    { upTo: 29315, rate: 0.11 },
    { upTo: 83823, rate: 0.3 },
    { upTo: 180294, rate: 0.41 },
    { upTo: null, rate: 0.45 },
  ],
  partsFiscales: 1,
  autresRevenusImposables: 0,

  smicHoraire: 12.02,
};

// --- Rémunération mixte ---

export interface MixteResult {
  netCible: number;
  salaire: SalaireResult; // part versée en salaire
  dividende: DividendeResult; // part versée en dividendes
  coutTotal: number; // coût entreprise total (avant IS)
  trimestres: number; // trimestres de retraite validés (0 à 4)
  secuOuverte: boolean; // protection sociale ouverte (salaire > 0)
  /** Brut salaire minimum pour valider 4 trimestres. */
  brutMin4Trimestres: number;
}

// --- Avantages (santé, retraite, titres-resto, chèques-vacances...) ---

/** Avantage à montant annuel (mutuelle, complémentaire retraite, chèques-vacances, autre). */
export interface Avantage {
  actif: boolean;
  /** Valeur reçue par an (€). */
  montantAnnuel: number;
  /** Part financée par la société (0 à 1). */
  partEmployeur: number;
  /** Plafond annuel d'exonération de charges (€). */
  plafondExoAnnuel: number;
}

/** Titres-restaurant : valeur faciale par titre, nombre de titres, part employeur. */
export interface TicketsResto {
  actif: boolean;
  valeurFaciale: number; // par titre
  nbJours: number; // titres / an
  partEmployeur: number; // 0,50 à 0,60
  plafondExoTitre: number; // part employeur exonérée par titre (7,32 € en 2026)
}

export interface AvantagesState {
  mutuelle: Avantage;
  prevoyance: Avantage;
  retraite: Avantage;
  ticketsResto: TicketsResto;
  chequesVacances: Avantage;
  cesu: Avantage;
  transport: Avantage;
  autre: Avantage & { libelle: string };
}

export interface AvantageResult {
  id: string;
  label: string;
  valeurRecue: number; // ce que vous recevez (€/an)
  partEmployeurMontant: number; // financé par la société
  exonere: number; // part employeur exonérée (dans le plafond)
  coutSociete: number; // coût avant IS, financé via la société
  coutPerso: number; // coût avant IS, financé sur votre net
  economie: number; // coutPerso - coutSociete
}

export const DEFAULT_AVANTAGES: AvantagesState = {
  mutuelle: { actif: false, montantAnnuel: 1800, partEmployeur: 1, plafondExoAnnuel: 1800 },
  prevoyance: { actif: false, montantAnnuel: 1500, partEmployeur: 1, plafondExoAnnuel: 1500 },
  retraite: { actif: false, montantAnnuel: 2403, partEmployeur: 1, plafondExoAnnuel: 2403 },
  ticketsResto: {
    actif: false,
    valeurFaciale: 12.2,
    nbJours: 220,
    partEmployeur: 0.6,
    plafondExoTitre: 7.32,
  },
  chequesVacances: { actif: false, montantAnnuel: 547, partEmployeur: 1, plafondExoAnnuel: 547 },
  cesu: { actif: false, montantAnnuel: 2591, partEmployeur: 1, plafondExoAnnuel: 2591 },
  transport: { actif: false, montantAnnuel: 900, partEmployeur: 1, plafondExoAnnuel: 900 },
  autre: { actif: false, libelle: 'Autre avantage', montantAnnuel: 0, partEmployeur: 1, plafondExoAnnuel: 0 },
};
