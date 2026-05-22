import { ChangeDetectionStrategy, Component, model, output, signal } from '@angular/core';
import { FiscalParams } from '../../models/fiscal.model';

@Component({
  selector: 'app-settings-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mat-card overflow-hidden">
      <button
        type="button"
        (click)="open.set(!open())"
        class="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <span class="flex items-center gap-2 font-medium text-slate-700">
          <span class="material-symbols-rounded text-primary-600">tune</span>
          Paramètres fiscaux (tout est ajustable)
        </span>
        <span class="material-symbols-rounded text-slate-400">
          {{ open() ? 'expand_less' : 'expand_more' }}
        </span>
      </button>

      @if (open()) {
        <div class="space-y-6 border-t border-slate-100 px-5 py-5">
          <!-- Dividendes -->
          <div>
            <div class="mb-3 flex items-center justify-between gap-2">
              <h3 class="text-xs font-semibold uppercase tracking-wide text-accent-600">
                Dividendes
              </h3>
              <a
                class="inline-flex items-center gap-1 text-[11px] text-primary-600 hover:underline"
                href="https://entreprendre.service-public.fr/vosdroits/F32963"
                target="_blank" rel="noopener noreferrer"
              >
                source officielle
                <span class="material-symbols-rounded text-[13px]">open_in_new</span>
              </a>
            </div>
            <div class="grid gap-4 sm:grid-cols-2">
              <label class="mat-field">
                <span class="mat-label">Taux PFU (flat tax)</span>
                <div class="relative">
                  <input
                    type="number" step="0.1" class="mat-input pr-8"
                    [value]="pct(params().tauxPFU)"
                    (input)="patch({ tauxPFU: num($event) / 100 })"
                  />
                  <span class="pointer-events-none absolute right-3 top-2.5 text-slate-400">%</span>
                </div>
              </label>
            </div>
          </div>

          <!-- IS -->
          <div>
            <div class="mb-3 flex items-center justify-between gap-2">
              <h3 class="text-xs font-semibold uppercase tracking-wide text-accent-600">
                Impôt sur les sociétés (IS)
              </h3>
              <a
                class="inline-flex items-center gap-1 text-[11px] text-primary-600 hover:underline"
                href="https://www.service-public.fr/professionnels-entreprises/vosdroits/F23575"
                target="_blank" rel="noopener noreferrer"
              >
                source officielle
                <span class="material-symbols-rounded text-[13px]">open_in_new</span>
              </a>
            </div>
            <div class="grid gap-4 sm:grid-cols-3">
              <label class="mat-field">
                <span class="mat-label">Taux réduit</span>
                <input type="number" step="0.1" class="mat-input"
                  [value]="pct(params().isTauxReduit)"
                  (input)="patch({ isTauxReduit: num($event) / 100 })" />
              </label>
              <label class="mat-field">
                <span class="mat-label">Seuil taux réduit (€)</span>
                <input type="number" step="100" class="mat-input"
                  [value]="params().isSeuil"
                  (input)="patch({ isSeuil: num($event) })" />
              </label>
              <label class="mat-field">
                <span class="mat-label">Taux normal</span>
                <input type="number" step="0.1" class="mat-input"
                  [value]="pct(params().isTauxNormal)"
                  (input)="patch({ isTauxNormal: num($event) / 100 })" />
              </label>
            </div>
          </div>

          <!-- Charges sociales -->
          <div>
            <div class="mb-3 flex items-center justify-between gap-2">
              <h3 class="text-xs font-semibold uppercase tracking-wide text-accent-600">
                Charges sociales SASU (% du brut)
              </h3>
              <a
                class="inline-flex items-center gap-1 text-[11px] text-primary-600 hover:underline"
                href="https://www.urssaf.fr/portail/home/employeur/creer/choisir-une-forme-juridique/le-statut-du-dirigeant/les-dirigeants-assimiles-salarie.html"
                target="_blank" rel="noopener noreferrer"
              >
                source officielle
                <span class="material-symbols-rounded text-[13px]">open_in_new</span>
              </a>
            </div>
            <div class="grid gap-4 sm:grid-cols-2">
              <label class="mat-field">
                <span class="mat-label">Charges patronales</span>
                <input type="number" step="0.1" class="mat-input"
                  [value]="pct(params().tauxChargesPatronales)"
                  (input)="patch({ tauxChargesPatronales: num($event) / 100 })" />
              </label>
              <label class="mat-field">
                <span class="mat-label">Charges salariales</span>
                <input type="number" step="0.1" class="mat-input"
                  [value]="pct(params().tauxChargesSalariales)"
                  (input)="patch({ tauxChargesSalariales: num($event) / 100 })" />
              </label>
            </div>
          </div>

          <!-- IR : barème + abattement -->
          <div>
            <div class="mb-3 flex items-center justify-between gap-2">
              <h3 class="text-xs font-semibold uppercase tracking-wide text-accent-600">
                Barème de l'impôt sur le revenu
              </h3>
              <a
                class="inline-flex items-center gap-1 text-[11px] text-primary-600 hover:underline"
                href="https://www.service-public.fr/particuliers/vosdroits/F1419"
                target="_blank" rel="noopener noreferrer"
              >
                barème officiel
                <span class="material-symbols-rounded text-[13px]">open_in_new</span>
              </a>
            </div>

            <div>
              <span class="mat-label">Barème IR (par part)</span>
              <div class="overflow-hidden rounded-lg border border-slate-200">
                <table class="w-full text-sm">
                  <thead class="bg-slate-50 text-slate-500">
                    <tr>
                      <th class="px-3 py-2 text-left font-medium">Jusqu'à (€)</th>
                      <th class="px-3 py-2 text-left font-medium">Taux (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (b of params().baremeIR; track $index) {
                      <tr class="border-t border-slate-100">
                        <td class="px-3 py-1.5">
                          @if (b.upTo === null) {
                            <span class="text-slate-400">au-delà</span>
                          } @else {
                            <input type="number" step="100"
                              class="w-full rounded border border-slate-200 px-2 py-1"
                              [value]="b.upTo"
                              (input)="patchBracket($index, { upTo: num($event) })" />
                          }
                        </td>
                        <td class="px-3 py-1.5">
                          <input type="number" step="0.1"
                            class="w-full rounded border border-slate-200 px-2 py-1"
                            [value]="pct(b.rate)"
                            (input)="patchBracket($index, { rate: num($event) / 100 })" />
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>

            <p class="mt-2 text-[11px] leading-relaxed text-slate-400">
              Un abattement de 10 % pour frais professionnels (plafonné à
              {{ nf(params().abattementSalairePlafond) }} €) est appliqué automatiquement —
              <a class="text-primary-600 hover:underline" target="_blank" rel="noopener noreferrer"
                href="https://www.impots.gouv.fr/particulier/questions/comment-puis-je-beneficier-de-la-deduction-forfaitaire-de-10">
                source</a>.
            </p>
          </div>

          <div class="flex justify-end">
            <button type="button" class="mat-btn-ghost" (click)="reset.emit()">
              <span class="material-symbols-rounded">restart_alt</span>
              Réinitialiser
            </button>
          </div>
        </div>
      }
    </section>
  `,
})
export class SettingsPanelComponent {
  readonly params = model.required<FiscalParams>();
  readonly open = signal(false);
  reset = output<void>();

  private readonly nfFr = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

  pct(v: number): number {
    return Math.round(v * 1000) / 10;
  }

  nf(v: number): string {
    return this.nfFr.format(v);
  }

  num(event: Event): number {
    const v = parseFloat((event.target as HTMLInputElement).value);
    return Number.isFinite(v) ? v : 0;
  }

  patch(partial: Partial<FiscalParams>): void {
    this.params.update((p) => ({ ...p, ...partial }));
  }

  patchBracket(index: number, partial: Partial<FiscalParams['baremeIR'][number]>): void {
    this.params.update((p) => ({
      ...p,
      baremeIR: p.baremeIR.map((b, i) => (i === index ? { ...b, ...partial } : b)),
    }));
  }
}
