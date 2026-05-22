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
  abattementSalairePlafond: 14171,
  baremeIR: [
    { upTo: 11497, rate: 0 },
    { upTo: 29315, rate: 0.11 },
    { upTo: 83823, rate: 0.3 },
    { upTo: 180294, rate: 0.41 },
    { upTo: null, rate: 0.45 },
  ],
  partsFiscales: 1,
  autresRevenusImposables: 0,
};
