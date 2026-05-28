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

  // Coût total entreprise, avantages financés par la société inclus.
  // Le salaire (ou la part salaire du mix) rend les avantages déductibles et exonérés ;
  // en dividende pur ils doivent être auto-financés sur le net (coût « perso »).
  readonly coutMixteAvecAvantages = computed(
    () => this.mixteResult().coutTotal + this.avantagesCoutSociete(),
  );
  readonly coutSalaireAvecAvantages = computed(
    () => this.result().salaire.coutEntreprise + this.avantagesCoutSociete(),
  );
  readonly coutDividendeAvecAvantages = computed(
    () => this.result().dividende.coutEntreprise + this.avantagesCoutPerso(),
  );
  readonly meilleurAvecAvantages = computed<'salaire' | 'dividende' | 'egalite'>(() => {
    const diff = this.coutSalaireAvecAvantages() - this.coutDividendeAvecAvantages();
    if (Math.abs(diff) < 1) return 'egalite';
    return diff > 0 ? 'dividende' : 'salaire';
  });

  // Économie d'IS apportée par la déductibilité du salaire + charges :
  // IS qui serait dû si ce flux était un bénéfice taxable au lieu d'être déduit.
  readonly economieISSalaire = computed(() =>
    this.fiscal.is(this.salView().coutEntreprise, this.params()),
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
    L.push(
      `- Mode : ${this.mixteActif() ? 'Rémunération mixte (salaire + dividendes)' : 'Comparaison salaire pur vs dividende pur'}`,
    );
    L.push('', '### Taux retenus', '');
    L.push(`- PFU (dividendes) : ${pc(p.tauxPFU)}`);
    L.push(`- IS : ${pc(p.isTauxReduit)} jusqu'à ${e(p.isSeuil)}, puis ${pc(p.isTauxNormal)}`);
    L.push(`- Charges patronales : ${pc(p.tauxChargesPatronales)} · salariales : ${pc(p.tauxChargesSalariales)}`);
    L.push(`- Abattement frais pro : ${pc(p.abattementSalaireTaux)} (plafond ${e(p.abattementSalairePlafond)})`);
    const bareme = p.baremeIR
      .map((b) => `${b.upTo === null ? 'au-delà' : e(b.upTo)} : ${pc(b.rate)}`)
      .join(' · ');
    L.push(`- Barème IR (par part) : ${bareme}`, '');

    if (this.mixteActif()) {
      const mr = this.mixteResult();
      const surcout = mr.coutTotal - this.result().dividende.coutEntreprise;
      L.push('## Résultat — rémunération mixte', '');
      L.push(`- **Coût total entreprise** : ${e(mr.coutTotal)} / an`);
      L.push(`- Trimestres validés : ${mr.trimestres}/4 · protection sociale : ${mr.secuOuverte ? 'ouverte' : 'non'}`);
      L.push(`- Surcoût vs 100 % dividende : ${e(surcout)} / an`, '');
      L.push('| | Part salaire | Part dividendes |', '|---|---|---|');
      L.push(`| Coût entreprise | ${e(mr.salaire.coutEntreprise)} | ${e(mr.dividende.coutEntreprise)} |`);
      L.push(`| Net perçu | ${e(mr.salaire.netPoche)} | ${e(mr.dividende.netPoche)} |`);
      L.push(`| Salaire brut | ${e(mr.salaire.brut)} | — |`, '');
    } else {
      const r = this.result();
      L.push('## Résultat — comparaison', '');
      L.push('| | Salaire | Dividende |', '|---|---|---|');
      L.push(`| **Coût entreprise** | ${e(r.salaire.coutEntreprise)} | ${e(r.dividende.coutEntreprise)} |`);
      L.push(`| Taux de prélèvement global | ${pc(r.salaire.tauxPrelevementGlobal)} | ${pc(r.dividende.tauxPrelevementGlobal)} |`);
      L.push(`| Brut salaire / Bénéfice avant IS | ${e(r.salaire.brut)} | ${e(r.dividende.beneficeAvantIS)} |`);
      L.push(`| Impôt sociétés (IS) | 0 € (déductible) | ${e(r.dividende.is)} |`);
      L.push(`| Charges sociales / PFU | ${e(r.salaire.chargesPatronales + r.salaire.chargesSalariales)} | ${e(r.dividende.pfu)} |`);
      L.push(`| Impôt sur le revenu | ${e(r.salaire.ir)} | — |`, '');
      const reco =
        r.meilleur === 'egalite'
          ? 'Les deux options se valent.'
          : r.meilleur === 'dividende'
            ? `Les dividendes sont plus avantageux : économie ${e(r.economie)} / an.`
            : `Le salaire est plus avantageux : économie ${e(r.economie)} / an.`;
      L.push(`**${reco}**`, '');
    }

    const av = this.fiscal.calcAvantages(this.avantages(), p);
    if (av.length) {
      const totalEco = av.reduce((s, x) => s + x.economie, 0);
      const coutSoc = av.reduce((s, x) => s + x.coutSociete, 0);
      const valeur = av.reduce((s, x) => s + x.valeurRecue, 0);
      const baseCout = this.mixteActif()
        ? this.mixteResult().coutTotal
        : this.result().salaire.coutEntreprise;
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
