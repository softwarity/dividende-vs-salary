import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { EChartsOption } from 'echarts';
import { FiscalService } from '../../services/fiscal.service';
import {
  AvantagesState,
  DEFAULT_AVANTAGES,
  DEFAULT_PARAMS,
  DividendeResult,
  FiscalParams,
  SalaireResult,
} from '../../models/fiscal.model';
import { SettingsPanelComponent } from '../settings-panel/settings-panel.component';
import { AvantagesPanelComponent } from '../avantages-panel/avantages-panel.component';
import { formatEuro, formatPct } from '../../utils/format';

const clone = (p: FiscalParams): FiscalParams => ({
  ...p,
  baremeIR: p.baremeIR.map((b) => ({ ...b })),
});

const cloneAvantages = (a: AvantagesState): AvantagesState =>
  JSON.parse(JSON.stringify(a)) as AvantagesState;

export type TypeRemu = 'dividende' | 'mixte' | 'salaire';

const ZERO_SAL: SalaireResult = {
  netPoche: 0, netSocial: 0, netImposable: 0, brut: 0,
  chargesSalariales: 0, chargesPatronales: 0, ir: 0, coutEntreprise: 0,
  tauxPrelevementGlobal: 0,
};
const ZERO_DIV: DividendeResult = {
  netPoche: 0, pfu: 0, dividendeBrut: 0, is: 0,
  beneficeAvantIS: 0, coutEntreprise: 0, tauxPrelevementGlobal: 0,
};

@Component({
  selector: 'app-simulator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgxEchartsDirective, SettingsPanelComponent, AvantagesPanelComponent],
  templateUrl: './simulator.component.html',
})
export class SimulatorComponent {
  private readonly fiscal = inject(FiscalService);

  readonly euro = formatEuro;
  readonly pct = formatPct;

  readonly params = signal<FiscalParams>(clone(DEFAULT_PARAMS));
  readonly netCible = signal(40000);
  readonly avantages = signal<AvantagesState>(cloneAvantages(DEFAULT_AVANTAGES));

  // --- Type de rémunération ---
  readonly typeRemu = signal<TypeRemu>('mixte');
  readonly salaireBrutMixte = signal(this.fiscal.brutMin4Trimestres(DEFAULT_PARAMS));

  readonly types: ReadonlyArray<{ value: TypeRemu; label: string }> = [
    { value: 'dividende', label: 'Full dividende' },
    { value: 'mixte', label: 'Mixte' },
    { value: 'salaire', label: 'Full salaire' },
  ];

  readonly isMixte = computed(() => this.typeRemu() === 'mixte');

  readonly result = computed(() => this.fiscal.compare(this.netCible(), this.params()));

  readonly brutMin = computed(() => this.fiscal.brutMin4Trimestres(this.params()));
  readonly brutMax = computed(() =>
    Math.max(this.brutMin(), this.fiscal.salaire(this.netCible(), this.params()).brut),
  );
  readonly mixteResult = computed(() =>
    this.fiscal.mixte(this.netCible(), this.salaireBrutMixte(), this.params()),
  );

  // Brut effectivement choisi selon le type (pour la position du curseur).
  readonly brutChoisi = computed(() => {
    switch (this.typeRemu()) {
      case 'dividende': return 0;
      case 'salaire': return this.brutMax();
      case 'mixte': return this.salaireBrutMixte();
    }
  });

  // Vues unifiées : dividende pur, mix, ou salaire pur — l'autre côté est zéro.
  readonly salView = computed<SalaireResult>(() => {
    switch (this.typeRemu()) {
      case 'dividende': return ZERO_SAL;
      case 'salaire': return this.result().salaire;
      case 'mixte': return this.mixteResult().salaire;
    }
  });
  readonly divView = computed<DividendeResult>(() => {
    switch (this.typeRemu()) {
      case 'dividende': return this.result().dividende;
      case 'salaire': return ZERO_DIV;
      case 'mixte': return this.mixteResult().dividende;
    }
  });

  // --- Avantages payés par la société (réservés au salaire) ---
  readonly avantagesResults = computed(() =>
    this.fiscal.calcAvantages(this.avantages(), this.params()),
  );
  readonly avantagesActifs = computed(() => this.avantagesResults().length > 0);
  readonly avantagesValeur = computed(() =>
    this.avantagesResults().reduce((s, a) => s + a.valeurRecue, 0),
  );
  readonly avantagesCoutSociete = computed(() =>
    this.avantagesResults().reduce((s, a) => s + a.coutSociete, 0),
  );
  readonly avantagesCoutPerso = computed(() =>
    this.avantagesResults().reduce((s, a) => s + a.coutPerso, 0),
  );
  readonly avantagesEconomie = computed(() =>
    this.avantagesResults().reduce((s, a) => s + a.economie, 0),
  );

  // Coût rémunération entreprise (avant ajout des avantages), tous types confondus.
  readonly coutRemu = computed(
    () => this.salView().coutEntreprise + this.divView().coutEntreprise,
  );
  // Avantages : déductibles via société quand il y a un salaire,
  // sinon auto-financés sur le net (coût « perso »).
  readonly avantagesCoutTotal = computed(() =>
    this.typeRemu() === 'dividende' ? this.avantagesCoutPerso() : this.avantagesCoutSociete(),
  );
  readonly coutTotalAvecAvantages = computed(
    () => this.coutRemu() + this.avantagesCoutTotal(),
  );

  // Économie d'IS apportée par la déductibilité du salaire + charges :
  // IS qui serait dû si ce flux était un bénéfice taxable au lieu d'être déduit.
  readonly economieISSalaire = computed(() =>
    this.fiscal.is(this.salView().coutEntreprise, this.params()),
  );

  // Coût avant l'abattement (déductibilité) d'IS : coût entreprise + IS hypothétique.
  readonly coutSalaireSansAbattementIS = computed(
    () => this.salView().coutEntreprise + this.economieISSalaire(),
  );

  constructor() {
    // Garde le brut du curseur dans les bornes valides (uniquement en mode mixte).
    effect(() => {
      if (this.typeRemu() !== 'mixte') return;
      const min = this.brutMin();
      const max = this.brutMax();
      const v = this.salaireBrutMixte();
      const clamped = Math.min(max, Math.max(min, v));
      if (clamped !== v) {
        this.salaireBrutMixte.set(clamped);
      }
    });
  }

  setNet(event: Event): void {
    const v = parseFloat((event.target as HTMLInputElement).value);
    this.netCible.set(Number.isFinite(v) && v >= 0 ? v : 0);
  }

  parseNum(event: Event): number {
    const v = parseFloat((event.target as HTMLInputElement).value);
    return Number.isFinite(v) ? v : 0;
  }

  patchParams(partial: Partial<FiscalParams>): void {
    this.params.update((p) => ({ ...p, ...partial }));
  }

  resetParams(): void {
    this.params.set(clone(DEFAULT_PARAMS));
  }

  setType(t: TypeRemu): void {
    this.typeRemu.set(t);
    if (t === 'mixte') {
      const min = this.brutMin();
      const max = this.brutMax();
      const v = this.salaireBrutMixte();
      const clamped = Math.min(max, Math.max(min, v));
      if (clamped !== v) {
        this.salaireBrutMixte.set(clamped);
      }
    }
  }

  setSalaireBrutMixte(event: Event): void {
    const v = parseFloat((event.target as HTMLInputElement).value);
    if (Number.isFinite(v)) {
      this.salaireBrutMixte.set(v);
    }
  }

  trimestres(brut: number): number {
    return this.fiscal.trimestresValides(brut, this.params());
  }

  readonly copied = signal(false);

  exportMarkdown(): void {
    const md = this.buildMarkdown();
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'simulation-dividende-vs-salaire.md';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async copyMarkdown(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.buildMarkdown());
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      /* presse-papiers indisponible */
    }
  }

  private buildMarkdown(): string {
    const p = this.params();
    const net = this.netCible();
    const e = this.euro;
    const pc = this.pct;
    const L: string[] = [];

    L.push('# Simulation Dividende vs Salaire (SASU)', '');
    L.push(`_Généré le ${new Date().toLocaleDateString('fr-FR')}_`, '');

    L.push('## Paramètres', '');
    L.push(`- **Net annuel souhaité (dans la poche)** : ${e(net)}`);
    L.push(`- Parts fiscales : ${p.partsFiscales}`);
    L.push(`- Autres revenus imposables : ${e(p.autresRevenusImposables)}`);
    const modeLabel = ({
      dividende: 'Full dividende (100 %)',
      mixte: 'Rémunération mixte (salaire + dividendes)',
      salaire: 'Full salaire (100 %)',
    } as const)[this.typeRemu()];
    L.push(`- Mode : ${modeLabel}`);
    L.push('', '### Taux retenus', '');
    L.push(`- PFU (dividendes) : ${pc(p.tauxPFU)}`);
    L.push(`- IS : ${pc(p.isTauxReduit)} jusqu'à ${e(p.isSeuil)}, puis ${pc(p.isTauxNormal)}`);
    L.push(`- Charges patronales : ${pc(p.tauxChargesPatronales)} · salariales : ${pc(p.tauxChargesSalariales)}`);
    L.push(`- Abattement frais pro : ${pc(p.abattementSalaireTaux)} (plafond ${e(p.abattementSalairePlafond)})`);
    const bareme = p.baremeIR
      .map((b) => `${b.upTo === null ? 'au-delà' : e(b.upTo)} : ${pc(b.rate)}`)
      .join(' · ');
    L.push(`- Barème IR (par part) : ${bareme}`, '');

    const t = this.typeRemu();
    const sal = this.salView();
    const div = this.divView();

    L.push('## Résultat', '');
    L.push(`- **Coût rémunération entreprise** : ${e(this.coutRemu())} / an`);
    if (t === 'mixte') {
      const mr = this.mixteResult();
      L.push(`- Trimestres validés : ${mr.trimestres}/4 · protection sociale : ${mr.secuOuverte ? 'ouverte' : 'non'}`);
      L.push(`- Surcoût vs 100 % dividende : ${e(mr.coutTotal - this.result().dividende.coutEntreprise)} / an`);
    } else if (t === 'salaire') {
      L.push(`- Trimestres validés : ${this.fiscal.trimestresValides(sal.brut, p)}/4 · protection sociale ouverte`);
    } else {
      L.push('- Aucun trimestre, droits sociaux fermés (dividende pur).');
    }
    L.push('');

    if (t !== 'dividende') {
      L.push('### Part salaire', '');
      L.push(`- Coût entreprise : ${e(sal.coutEntreprise)} · brut : ${e(sal.brut)}`);
      L.push(`- IR : ${e(sal.ir)} · net perçu : ${e(sal.netPoche)}`, '');
    }
    if (t !== 'salaire') {
      L.push('### Part dividende', '');
      L.push(`- Coût entreprise : ${e(div.coutEntreprise)} · bénéfice avant IS : ${e(div.beneficeAvantIS)}`);
      L.push(`- IS : ${e(div.is)} · PFU : ${e(div.pfu)} · net perçu : ${e(div.netPoche)}`, '');
    }

    const av = this.fiscal.calcAvantages(this.avantages(), p);
    if (av.length) {
      const totalEco = av.reduce((s, x) => s + x.economie, 0);
      const coutSoc = av.reduce((s, x) => s + x.coutSociete, 0);
      const valeur = av.reduce((s, x) => s + x.valeurRecue, 0);
      const baseCout = this.coutRemu();
      L.push('## Avantages payés par la société', '');
      L.push('| Avantage | Via société | Via perso | Économie |', '|---|---|---|---|');
      for (const a of av) {
        L.push(`| ${a.label} | ${e(a.coutSociete)} | ${e(a.coutPerso)} | ${e(a.economie)} |`);
      }
      L.push('', `**Économie totale via la société : ${e(totalEco)} / an.**`);
      L.push(
        `Coût total entreprise (rémunération + avantages) : **${e(baseCout + coutSoc)} / an** ` +
          `— vous recevez ${e(net)} net + ${e(valeur)} d'avantages en nature.`,
        '',
      );
    }

    L.push('## Hypothèses', '');
    L.push('- Statut SASU : président assimilé salarié (charges forfaitaires sur le brut).');
    L.push("- Salaire et charges déductibles (réduisent l'IS) ; dividendes versés après IS, non déductibles.");
    L.push(`- Dividendes au PFU (${pc(p.tauxPFU)}), hors barème de l'IR.`);
    L.push('- IR : barème + parts, sans décote ni plafonnement du quotient familial.');
    L.push('- Mode mixte : salaire minimum = 4 trimestres (600 × SMIC).');
    L.push('- Outil pédagogique : ne remplace pas l’avis d’un expert-comptable.', '');

    return L.join('\n');
  }

  // --- Graphe 1 : composition du coût pour chaque route ---
  readonly breakdownOptions = computed<EChartsOption>(() => {
    const s = this.salView();
    const d = this.divView();
    const tooltip = (v: number) => formatEuro(v);
    return {
      backgroundColor: 'transparent',
      textStyle: { color: '#c9d1d9' },
      grid: { left: 8, right: 24, top: 44, bottom: 8, containLabel: true },
      legend: { top: 0, icon: 'circle', itemWidth: 10, itemHeight: 10, textStyle: { color: '#c9d1d9' } },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        valueFormatter: (v) => tooltip(v as number),
      },
      xAxis: {
        type: 'value',
        axisLabel: { color: '#8b949e', formatter: (v: number) => `${Math.round(v / 1000)} k€` },
        axisLine: { lineStyle: { color: '#30363d' } },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
      },
      yAxis: {
        type: 'category',
        data: ['Salaire', 'Dividende'],
        axisLabel: { color: '#c9d1d9' },
        axisLine: { lineStyle: { color: '#30363d' } },
      },
      series: [
        {
          name: 'Net dans la poche',
          type: 'bar',
          stack: 'total',
          itemStyle: { color: '#3fb950' },
          emphasis: { focus: 'series' },
          data: [s.netPoche, d.netPoche],
        },
        {
          name: 'Charges sociales',
          type: 'bar',
          stack: 'total',
          itemStyle: { color: '#58a6ff' },
          emphasis: { focus: 'series' },
          data: [s.chargesSalariales + s.chargesPatronales, 0],
        },
        {
          name: 'Impôt sur le revenu',
          type: 'bar',
          stack: 'total',
          itemStyle: { color: '#a371f7' },
          emphasis: { focus: 'series' },
          data: [s.ir, 0],
        },
        {
          name: 'Impôt sociétés (IS)',
          type: 'bar',
          stack: 'total',
          itemStyle: { color: '#d97757' },
          emphasis: { focus: 'series' },
          data: [0, d.is],
        },
        {
          name: 'PFU (flat tax)',
          type: 'bar',
          stack: 'total',
          itemStyle: { color: '#f85149' },
          emphasis: { focus: 'series' },
          data: [0, d.pfu],
        },
      ],
    };
  });

  // --- Graphe 2 : coût entreprise selon le net visé (point de croisement) ---
  readonly curveOptions = computed<EChartsOption>(() => {
    const p = this.params();
    const current = this.netCible();
    const maxNet = Math.max(100000, current * 2);
    const steps = 40;
    const xs: number[] = [];
    const sal: [number, number][] = [];
    const div: [number, number][] = [];
    for (let i = 0; i <= steps; i++) {
      const net = (maxNet / steps) * i;
      xs.push(net);
      sal.push([net, Math.round(this.fiscal.salaire(net, p).coutEntreprise)]);
      div.push([net, Math.round(this.fiscal.dividende(net, p).coutEntreprise)]);
    }
    return {
      backgroundColor: 'transparent',
      textStyle: { color: '#c9d1d9' },
      grid: { left: 8, right: 24, top: 44, bottom: 28, containLabel: true },
      legend: { top: 0, icon: 'circle', itemWidth: 10, itemHeight: 10, textStyle: { color: '#c9d1d9' } },
      tooltip: {
        trigger: 'axis',
        valueFormatter: (v) => formatEuro(v as number),
        axisPointer: { type: 'cross' },
      },
      xAxis: {
        type: 'value',
        name: 'Net visé',
        nameLocation: 'middle',
        nameGap: 30,
        nameTextStyle: { color: '#8b949e' },
        axisLabel: { color: '#8b949e', formatter: (v: number) => `${Math.round(v / 1000)} k€` },
        axisLine: { lineStyle: { color: '#30363d' } },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
      },
      yAxis: {
        type: 'value',
        name: 'Coût entreprise',
        nameTextStyle: { color: '#8b949e' },
        axisLabel: { color: '#8b949e', formatter: (v: number) => `${Math.round(v / 1000)} k€` },
        axisLine: { lineStyle: { color: '#30363d' } },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
      },
      series: [
        {
          name: 'Coût en salaire',
          type: 'line',
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 3, color: '#58a6ff' },
          itemStyle: { color: '#58a6ff' },
          data: sal,
          markLine: {
            symbol: 'none',
            silent: true,
            lineStyle: { type: 'dashed', color: '#8b949e' },
            data: [{ xAxis: current }],
          },
        },
        {
          name: 'Coût en dividendes',
          type: 'line',
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 3, color: '#f85149' },
          itemStyle: { color: '#f85149' },
          data: div,
        },
      ],
    };
  });
}
