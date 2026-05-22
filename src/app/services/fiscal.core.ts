import {
  AvantageResult,
  AvantagesState,
  ComparisonResult,
  DividendeResult,
  FiscalParams,
  MixteResult,
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

/** Construit le résultat salaire à partir d'un brut annuel donné. */
export function salaireDepuisBrut(brut: number, p: FiscalParams): SalaireResult {
  const b = Math.max(0, brut);
  const irBase = irFoyer(p.autresRevenusImposables, p);
  const netSocial = b * (1 - p.tauxChargesSalariales);
  const netImposable = netImposableSalaire(netSocial, p);
  const irTotal = irFoyer(p.autresRevenusImposables + netImposable, p);
  const ir = Math.max(0, irTotal - irBase);
  const chargesSalariales = b - netSocial;
  const chargesPatronales = b * p.tauxChargesPatronales;
  const netPoche = netSocial - ir;
  const coutEntreprise = b + chargesPatronales;
  return {
    netPoche,
    netSocial,
    netImposable,
    brut: b,
    chargesSalariales,
    chargesPatronales,
    ir,
    coutEntreprise,
    tauxPrelevementGlobal: coutEntreprise > 0 ? (coutEntreprise - netPoche) / coutEntreprise : 0,
  };
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
  return salaireDepuisBrut((lo + hi) / 2, p);
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

/** Trimestres de retraite validés par un salaire brut annuel (0 à 4). */
export function trimestresValides(brutAnnuel: number, p: FiscalParams): number {
  const seuilTrimestre = 150 * p.smicHoraire; // ~1 803 € en 2026
  if (seuilTrimestre <= 0) return 0;
  return Math.max(0, Math.min(4, Math.floor(brutAnnuel / seuilTrimestre)));
}

/** Brut annuel minimal pour valider 4 trimestres (600 × SMIC horaire). */
export function brutMin4Trimestres(p: FiscalParams): number {
  return 600 * p.smicHoraire;
}

/**
 * Rémunération mixte : une part en salaire (brut >= minimum 4 trimestres),
 * le reste en dividendes pour atteindre le net visé.
 */
export function mixte(netCible: number, salaireBrut: number, p: FiscalParams): MixteResult {
  const cible = Math.max(0, netCible);
  const brutMin = brutMin4Trimestres(p);
  const brut = Math.max(brutMin, salaireBrut);
  const sal = salaireDepuisBrut(brut, p);
  const netDiv = Math.max(0, cible - sal.netPoche);
  const div = dividende(netDiv, p);
  return {
    netCible: cible,
    salaire: sal,
    dividende: div,
    coutTotal: sal.coutEntreprise + div.coutEntreprise,
    trimestres: trimestresValides(brut, p),
    secuOuverte: brut > 0,
    brutMin4Trimestres: brutMin,
  };
}

/** Coût avant IS pour délivrer 1 € net via dividendes (référence d'extraction). */
export function coutParEuroNetDividende(p: FiscalParams): number {
  return dividende(1, p).coutEntreprise;
}

function calcAvantageGenerique(
  id: string,
  label: string,
  valeurRecue: number,
  partEmployeur: number,
  plafondExoAnnuel: number,
  p: FiscalParams,
): AvantageResult {
  const g = coutParEuroNetDividende(p);
  const v = Math.max(0, valeurRecue);
  const partEmp = v * Math.min(1, Math.max(0, partEmployeur));
  const partSal = v - partEmp;
  const exonere = Math.min(partEmp, Math.max(0, plafondExoAnnuel));
  const excedent = partEmp - exonere;
  // Via société : part employeur exonérée 1:1 (déductible + exonérée) ;
  // l'excédent et la part salariale sont financés sur le net (coût × g).
  const coutSociete = exonere + (excedent + partSal) * g;
  // Via perso : tout est payé sur le net.
  const coutPerso = v * g;
  return {
    id,
    label,
    valeurRecue: v,
    partEmployeurMontant: partEmp,
    exonere,
    coutSociete,
    coutPerso,
    economie: coutPerso - coutSociete,
  };
}

/** Calcule la comparaison société vs perso pour chaque avantage actif. */
export function calcAvantages(a: AvantagesState, p: FiscalParams): AvantageResult[] {
  const out: AvantageResult[] = [];
  if (a.mutuelle.actif) {
    out.push(
      calcAvantageGenerique(
        'mutuelle', 'Complémentaire santé',
        a.mutuelle.montantAnnuel, a.mutuelle.partEmployeur, a.mutuelle.plafondExoAnnuel, p,
      ),
    );
  }
  if (a.prevoyance.actif) {
    out.push(
      calcAvantageGenerique(
        'prevoyance', 'Prévoyance',
        a.prevoyance.montantAnnuel, a.prevoyance.partEmployeur, a.prevoyance.plafondExoAnnuel, p,
      ),
    );
  }
  if (a.retraite.actif) {
    out.push(
      calcAvantageGenerique(
        'retraite', 'Complémentaire retraite',
        a.retraite.montantAnnuel, a.retraite.partEmployeur, a.retraite.plafondExoAnnuel, p,
      ),
    );
  }
  if (a.ticketsResto.actif) {
    const t = a.ticketsResto;
    out.push(
      calcAvantageGenerique(
        'ticketsResto', 'Titres-restaurant',
        t.valeurFaciale * t.nbJours, t.partEmployeur, t.plafondExoTitre * t.nbJours, p,
      ),
    );
  }
  if (a.chequesVacances.actif) {
    out.push(
      calcAvantageGenerique(
        'chequesVacances', 'Chèques-vacances',
        a.chequesVacances.montantAnnuel, a.chequesVacances.partEmployeur, a.chequesVacances.plafondExoAnnuel, p,
      ),
    );
  }
  if (a.cesu.actif) {
    out.push(
      calcAvantageGenerique(
        'cesu', 'CESU préfinancé',
        a.cesu.montantAnnuel, a.cesu.partEmployeur, a.cesu.plafondExoAnnuel, p,
      ),
    );
  }
  if (a.transport.actif) {
    out.push(
      calcAvantageGenerique(
        'transport', 'Transport / mobilités durables',
        a.transport.montantAnnuel, a.transport.partEmployeur, a.transport.plafondExoAnnuel, p,
      ),
    );
  }
  if (a.autre.actif) {
    out.push(
      calcAvantageGenerique(
        'autre', a.autre.libelle || 'Autre avantage',
        a.autre.montantAnnuel, a.autre.partEmployeur, a.autre.plafondExoAnnuel, p,
      ),
    );
  }
  return out;
}
