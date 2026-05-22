import {
  ComparisonResult,
  DividendeResult,
  FiscalParams,
  SalaireResult,
} from '../models/fiscal.model';

/**
 * Cœur de calcul fiscal (fonctions pures, sans dépendance Angular).
 * SASU, président assimilé salarié. Sens : net souhaité -> coût entreprise.
 */

/** Impôt sur les sociétés pour un bénéfice avant IS donné. */
export function is(beneficeAvantIS: number, p: FiscalParams): number {
  const b = Math.max(0, beneficeAvantIS);
  const reduit = Math.min(b, p.isSeuil) * p.isTauxReduit;
  const normal = Math.max(0, b - p.isSeuil) * p.isTauxNormal;
  return reduit + normal;
}

/** Inverse de l'IS : bénéfice avant IS nécessaire pour un net après IS donné. */
export function beneficeAvantISpourNet(netApresIS: number, p: FiscalParams): number {
  const seuilNet = p.isSeuil * (1 - p.isTauxReduit);
  if (netApresIS <= seuilNet) {
    return netApresIS / (1 - p.isTauxReduit);
  }
  return p.isSeuil + (netApresIS - seuilNet) / (1 - p.isTauxNormal);
}

/** Impôt sur le revenu du foyer (barème + quotient familial). */
export function irFoyer(revenuImposableTotal: number, p: FiscalParams): number {
  const parts = Math.max(1, p.partsFiscales);
  const parQuotient = Math.max(0, revenuImposableTotal) / parts;
  let tax = 0;
  let borneBasse = 0;
  for (const tranche of p.baremeIR) {
    const borneHaute = tranche.upTo ?? Infinity;
    if (parQuotient <= borneBasse) break;
    const assiette = Math.min(parQuotient, borneHaute) - borneBasse;
    tax += assiette * tranche.rate;
    borneBasse = borneHaute;
  }
  return tax * parts;
}

/** Revenu imposable d'un salaire net (abattement 10 % plafonné). */
export function netImposableSalaire(netSocial: number, p: FiscalParams): number {
  const abattement = Math.min(netSocial * p.abattementSalaireTaux, p.abattementSalairePlafond);
  return Math.max(0, netSocial - abattement);
}

/** Route dividende : du net visé jusqu'au coût (bénéfice avant IS). */
export function dividende(netCible: number, p: FiscalParams): DividendeResult {
  const cible = Math.max(0, netCible);
  const dividendeBrut = cible / (1 - p.tauxPFU);
  const pfu = dividendeBrut - cible;
  const beneficeAvantIS = beneficeAvantISpourNet(dividendeBrut, p);
  const isMontant = beneficeAvantIS - dividendeBrut;
  const coutEntreprise = beneficeAvantIS;
  return {
    netPoche: cible,
    pfu,
    dividendeBrut,
    is: isMontant,
    beneficeAvantIS,
    coutEntreprise,
    tauxPrelevementGlobal: coutEntreprise > 0 ? (coutEntreprise - cible) / coutEntreprise : 0,
  };
}

/** Net dans la poche produit par un salaire brut donné. */
function netPocheFromBrut(brut: number, irBase: number, p: FiscalParams): number {
  const netSocial = brut * (1 - p.tauxChargesSalariales);
  const netImp = netImposableSalaire(netSocial, p);
  const irTotal = irFoyer(p.autresRevenusImposables + netImp, p);
  const irSalaire = Math.max(0, irTotal - irBase);
  return netSocial - irSalaire;
}

/** Route salaire : du net visé jusqu'au coût (super-brut), par résolution inverse. */
export function salaire(netCible: number, p: FiscalParams): SalaireResult {
  const cible = Math.max(0, netCible);
  const irBase = irFoyer(p.autresRevenusImposables, p);

  let lo = 0;
  let hi = Math.max(1000, cible * 5);
  while (netPocheFromBrut(hi, irBase, p) < cible) {
    hi *= 2;
    if (hi > 1e12) break;
  }
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (netPocheFromBrut(mid, irBase, p) < cible) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  const brut = (lo + hi) / 2;

  const netSocial = brut * (1 - p.tauxChargesSalariales);
  const netImposable = netImposableSalaire(netSocial, p);
  const irTotal = irFoyer(p.autresRevenusImposables + netImposable, p);
  const ir = Math.max(0, irTotal - irBase);
  const chargesSalariales = brut - netSocial;
  const chargesPatronales = brut * p.tauxChargesPatronales;
  const coutEntreprise = brut + chargesPatronales;

  return {
    netPoche: cible,
    netSocial,
    netImposable,
    brut,
    chargesSalariales,
    chargesPatronales,
    ir,
    coutEntreprise,
    tauxPrelevementGlobal: coutEntreprise > 0 ? (coutEntreprise - cible) / coutEntreprise : 0,
  };
}

/** Compare les deux routes pour un net visé identique. */
export function compare(netCible: number, p: FiscalParams): ComparisonResult {
  const sal = salaire(netCible, p);
  const div = dividende(netCible, p);
  const diff = sal.coutEntreprise - div.coutEntreprise;
  let meilleur: ComparisonResult['meilleur'];
  if (Math.abs(diff) < 1) {
    meilleur = 'egalite';
  } else {
    meilleur = diff > 0 ? 'dividende' : 'salaire';
  }
  return { netCible, salaire: sal, dividende: div, meilleur, economie: Math.abs(diff) };
}
