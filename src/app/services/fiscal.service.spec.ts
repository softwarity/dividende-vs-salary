import { TestBed } from '@angular/core/testing';
import { FiscalService } from './fiscal.service';
import { DEFAULT_PARAMS, FiscalParams } from '../models/fiscal.model';

describe('FiscalService', () => {
  let service: FiscalService;
  const p: FiscalParams = DEFAULT_PARAMS;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FiscalService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('IS', () => {
    it('applique le taux réduit sous le seuil', () => {
      expect(service.is(10000, p)).toBeCloseTo(1500, 6);
    });

    it('applique réduit puis normal au-delà du seuil', () => {
      // 42500*0.15 + 7500*0.25 = 6375 + 1875 = 8250
      expect(service.is(50000, p)).toBeCloseTo(8250, 6);
    });

    it('beneficeAvantISpourNet est l’inverse de IS', () => {
      for (const benef of [10000, 36125, 50000, 120000]) {
        const net = benef - service.is(benef, p);
        expect(service.beneficeAvantISpourNet(net, p)).toBeCloseTo(benef, 4);
      }
    });
  });

  describe('IR barème', () => {
    it('ne taxe pas sous le seuil de la première tranche', () => {
      expect(service.irFoyer(10000, p)).toBe(0);
    });

    it('calcule correctement sur la 2e tranche (1 part)', () => {
      // (20000 - 11497) * 0.11 = 935.33
      expect(service.irFoyer(20000, p)).toBeCloseTo(935.33, 2);
    });

    it('le quotient familial réduit l’impôt', () => {
      const un = service.irFoyer(60000, { ...p, partsFiscales: 1 });
      const deux = service.irFoyer(60000, { ...p, partsFiscales: 2 });
      expect(deux).toBeLessThan(un);
    });
  });

  describe('Route dividende (PFU)', () => {
    it('le net après PFU correspond au taux paramétré', () => {
      const r = service.dividende(10000, p);
      expect(r.dividendeBrut).toBeCloseTo(10000 / (1 - 0.314), 4);
      expect(r.pfu).toBeCloseTo(r.dividendeBrut - 10000, 4);
    });

    it('le PFU est révisable', () => {
      const r = service.dividende(10000, { ...p, tauxPFU: 0.3 });
      expect(r.dividendeBrut).toBeCloseTo(10000 / 0.7, 4);
    });

    it('intègre l’IS dans le coût entreprise', () => {
      const r = service.dividende(10000, p);
      expect(r.coutEntreprise).toBeGreaterThan(r.dividendeBrut);
      expect(r.beneficeAvantIS - r.is).toBeCloseTo(r.dividendeBrut, 4);
    });
  });

  describe('Route salaire (résolution inverse)', () => {
    it('le brut résolu reproduit bien le net visé', () => {
      const cible = 40000;
      const r = service.salaire(cible, p);
      const netSocial = r.brut * (1 - p.tauxChargesSalariales);
      expect(netSocial).toBeCloseTo(r.netSocial, 4);
      expect(r.netSocial - r.ir).toBeCloseTo(cible, 0);
    });

    it('le coût entreprise dépasse le net (charges + IR)', () => {
      const r = service.salaire(40000, p);
      expect(r.coutEntreprise).toBeGreaterThan(40000);
      expect(r.tauxPrelevementGlobal).toBeGreaterThan(0);
    });
  });

  describe('Comparaison', () => {
    it('retourne les deux routes et un gagnant', () => {
      const c = service.compare(40000, p);
      expect(c.salaire.coutEntreprise).toBeGreaterThan(0);
      expect(c.dividende.coutEntreprise).toBeGreaterThan(0);
      expect(['salaire', 'dividende', 'egalite']).toContain(c.meilleur);
      expect(c.economie).toBeGreaterThanOrEqual(0);
    });

    it('economie = |différence des coûts|', () => {
      const c = service.compare(40000, p);
      expect(c.economie).toBeCloseTo(
        Math.abs(c.salaire.coutEntreprise - c.dividende.coutEntreprise),
        4,
      );
    });
  });
});
