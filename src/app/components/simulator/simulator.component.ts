import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { EChartsOption } from 'echarts';
import { FiscalService } from '../../services/fiscal.service';
import {
  AvantagesState,
  DEFAULT_AVANTAGES,
  DEFAULT_PARAMS,
  FiscalParams,
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

  // --- Mode mixte ---
  readonly mixteActif = signal(false);
  readonly salaireBrutMixte = signal(this.fiscal.brutMin4Trimestres(DEFAULT_PARAMS));

  readonly result = computed(() => this.fiscal.compare(this.netCible(), this.params()));

  readonly brutMin = computed(() => this.fiscal.brutMin4Trimestres(this.params()));
  readonly brutMax = computed(() =>
    Math.max(this.brutMin(), this.fiscal.salaire(this.netCible(), this.params()).brut),
  );
  readonly mixteResult = computed(() =>
    this.fiscal.mixte(this.netCible(), this.salaireBrutMixte(), this.params()),
  );

  // Vues unifiées : parts du mix, ou scénarios purs.
  readonly salView = computed(() =>
    this.mixteActif() ? this.mixteResult().salaire : this.result().salaire,
  );
  readonly divView = computed(() =>
    this.mixteActif() ? this.mixteResult().dividende : this.result().dividende,
  );

  constructor() {
    // Garde le brut du curseur dans les bornes valides.
    effect(() => {
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

  toggleMixte(event: Event): void {
    const on = (event.target as HTMLInputElement).checked;
    this.mixteActif.set(on);
    if (on) {
      this.salaireBrutMixte.set(this.brutMin());
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

  // --- Graphe 1 : composition du coût pour chaque route ---
  readonly breakdownOptions = computed<EChartsOption>(() => {
    const s = this.salView();
    const d = this.divView();
    const tooltip = (v: number) => formatEuro(v);
    return {
      grid: { left: 8, right: 24, top: 44, bottom: 8, containLabel: true },
      legend: { top: 0, icon: 'circle', itemWidth: 10, itemHeight: 10 },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        valueFormatter: (v) => tooltip(v as number),
      },
      xAxis: {
        type: 'value',
        axisLabel: { formatter: (v: number) => `${Math.round(v / 1000)} k€` },
      },
      yAxis: { type: 'category', data: ['Salaire', 'Dividende'] },
      series: [
        {
          name: 'Net dans la poche',
          type: 'bar',
          stack: 'total',
          itemStyle: { color: '#14b8a6' },
          emphasis: { focus: 'series' },
          data: [s.netPoche, d.netPoche],
        },
        {
          name: 'Charges sociales',
          type: 'bar',
          stack: 'total',
          itemStyle: { color: '#6366f1' },
          emphasis: { focus: 'series' },
          data: [s.chargesSalariales + s.chargesPatronales, 0],
        },
        {
          name: 'Impôt sur le revenu',
          type: 'bar',
          stack: 'total',
          itemStyle: { color: '#a5b4fc' },
          emphasis: { focus: 'series' },
          data: [s.ir, 0],
        },
        {
          name: 'Impôt sociétés (IS)',
          type: 'bar',
          stack: 'total',
          itemStyle: { color: '#f59e0b' },
          emphasis: { focus: 'series' },
          data: [0, d.is],
        },
        {
          name: 'PFU (flat tax)',
          type: 'bar',
          stack: 'total',
          itemStyle: { color: '#fb7185' },
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
      grid: { left: 8, right: 24, top: 44, bottom: 28, containLabel: true },
      legend: { top: 0, icon: 'circle', itemWidth: 10, itemHeight: 10 },
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
        axisLabel: { formatter: (v: number) => `${Math.round(v / 1000)} k€` },
      },
      yAxis: {
        type: 'value',
        name: 'Coût entreprise',
        axisLabel: { formatter: (v: number) => `${Math.round(v / 1000)} k€` },
      },
      series: [
        {
          name: 'Coût en salaire',
          type: 'line',
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 3, color: '#6366f1' },
          itemStyle: { color: '#6366f1' },
          data: sal,
          markLine: {
            symbol: 'none',
            silent: true,
            lineStyle: { type: 'dashed', color: '#94a3b8' },
            data: [{ xAxis: current }],
          },
        },
        {
          name: 'Coût en dividendes',
          type: 'line',
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 3, color: '#fb7185' },
          itemStyle: { color: '#fb7185' },
          data: div,
        },
      ],
    };
  });
}
