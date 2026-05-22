import { Injectable } from '@angular/core';
import {
  AvantageResult,
  AvantagesState,
  ComparisonResult,
  DividendeResult,
  FiscalParams,
  MixteResult,
  SalaireResult,
} from '../models/fiscal.model';
import * as core from './fiscal.core';

/**
 * Service Angular exposant le moteur fiscal pur (fiscal.core).
 * SASU (président assimilé salarié), sens net souhaité -> coût entreprise.
 */
@Injectable({ providedIn: 'root' })
export class FiscalService {
  is(beneficeAvantIS: number, p: FiscalParams): number {
    return core.is(beneficeAvantIS, p);
  }

  beneficeAvantISpourNet(netApresIS: number, p: FiscalParams): number {
    return core.beneficeAvantISpourNet(netApresIS, p);
  }

  irFoyer(revenuImposableTotal: number, p: FiscalParams): number {
    return core.irFoyer(revenuImposableTotal, p);
  }

  netImposableSalaire(netSocial: number, p: FiscalParams): number {
    return core.netImposableSalaire(netSocial, p);
  }

  dividende(netCible: number, p: FiscalParams): DividendeResult {
    return core.dividende(netCible, p);
  }

  salaire(netCible: number, p: FiscalParams): SalaireResult {
    return core.salaire(netCible, p);
  }

  compare(netCible: number, p: FiscalParams): ComparisonResult {
    return core.compare(netCible, p);
  }

  salaireDepuisBrut(brut: number, p: FiscalParams): SalaireResult {
    return core.salaireDepuisBrut(brut, p);
  }

  trimestresValides(brutAnnuel: number, p: FiscalParams): number {
    return core.trimestresValides(brutAnnuel, p);
  }

  brutMin4Trimestres(p: FiscalParams): number {
    return core.brutMin4Trimestres(p);
  }

  mixte(netCible: number, salaireBrut: number, p: FiscalParams): MixteResult {
    return core.mixte(netCible, salaireBrut, p);
  }

  calcAvantages(a: AvantagesState, p: FiscalParams): AvantageResult[] {
    return core.calcAvantages(a, p);
  }
}
