import { ChangeDetectionStrategy, Component, computed, inject, input, model, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Avantage, AvantagesState, FiscalParams } from '../../models/fiscal.model';
import { FiscalService } from '../../services/fiscal.service';
import { formatEuro } from '../../utils/format';

type GenericKey = 'mutuelle' | 'prevoyance' | 'retraite' | 'chequesVacances' | 'cesu';

@Component({
  selector: 'app-avantages-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <section class="mat-card overflow-hidden">
      <button
        type="button"
        (click)="open.set(!open())"
        class="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <span class="flex items-center gap-2 font-medium text-slate-700">
          <span class="material-symbols-rounded text-accent-600">card_giftcard</span>
          Avantages payés par la société (réservés au salaire)
        </span>
        <span class="flex items-center gap-3">
          @if (totalEconomie() > 0) {
            <span class="mat-chip bg-accent-50 text-accent-700">
              + {{ euro(totalEconomie()) }} / an
            </span>
          }
          <span class="material-symbols-rounded text-slate-400">
            {{ open() ? 'expand_less' : 'expand_more' }}
          </span>
        </span>
      </button>

      @if (open()) {
        <div class="space-y-3 border-t border-slate-100 px-5 py-5">
          <p class="text-sm text-slate-500">
            Ces avantages ne sont possibles qu'avec un <strong>salaire</strong> : la société
            les finance (charge déductible, exonérée dans les limites), donc bien moins cher
            que de les payer avec votre argent net. Chaque avantage est optionnel.
          </p>

          <!-- Avantages génériques (montant annuel) -->
          @for (key of genericKeys; track key) {
            @let av = avantages()[key];
            <div class="rounded-lg border border-slate-200 p-3">
              <label class="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox" class="h-4 w-4 accent-accent-600"
                  [checked]="av.actif"
                  (change)="patchAv(key, { actif: checked($event) })"
                />
                <span class="font-medium text-slate-700">{{ labels[key] }}</span>
              </label>

              @if (av.actif) {
                <div class="mt-3 grid gap-3 sm:grid-cols-3">
                  <label class="mat-field">
                    <span class="mat-label">Montant annuel (€)</span>
                    <input type="number" step="100" class="mat-input"
                      [value]="av.montantAnnuel"
                      (input)="patchAv(key, { montantAnnuel: num($event) })" />
                  </label>
                  <label class="mat-field">
                    <span class="mat-label">Part société (%)</span>
                    <input type="number" step="5" class="mat-input"
                      [value]="pct(av.partEmployeur)"
                      (input)="patchAv(key, { partEmployeur: num($event) / 100 })" />
                  </label>
                  <label class="mat-field">
                    <span class="mat-label">Plafond exonéré (€)</span>
                    <input type="number" step="100" class="mat-input"
                      [value]="av.plafondExoAnnuel"
                      (input)="patchAv(key, { plafondExoAnnuel: num($event) })" />
                  </label>
                </div>
                @if (resultById(key); as res) {
                  <ng-container [ngTemplateOutlet]="resultLine" [ngTemplateOutletContext]="{ res }" />
                }
              }
            </div>
          }

          <!-- Titres-restaurant -->
          <div class="rounded-lg border border-slate-200 p-3">
            <label class="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox" class="h-4 w-4 accent-accent-600"
                [checked]="avantages().ticketsResto.actif"
                (change)="patchTicket({ actif: checked($event) })"
              />
              <span class="font-medium text-slate-700">Titres-restaurant</span>
            </label>
            @if (avantages().ticketsResto.actif) {
              @let t = avantages().ticketsResto;
              <div class="mt-3 grid gap-3 sm:grid-cols-4">
                <label class="mat-field">
                  <span class="mat-label">Valeur / titre (€)</span>
                  <input type="number" step="0.5" class="mat-input"
                    [value]="t.valeurFaciale"
                    (input)="patchTicket({ valeurFaciale: num($event) })" />
                </label>
                <label class="mat-field">
                  <span class="mat-label">Titres / an</span>
                  <input type="number" step="10" class="mat-input"
                    [value]="t.nbJours"
                    (input)="patchTicket({ nbJours: num($event) })" />
                </label>
                <label class="mat-field">
                  <span class="mat-label">Part société (%)</span>
                  <input type="number" step="1" class="mat-input"
                    [value]="pct(t.partEmployeur)"
                    (input)="patchTicket({ partEmployeur: num($event) / 100 })" />
                </label>
                <label class="mat-field">
                  <span class="mat-label">Exo / titre (€)</span>
                  <input type="number" step="0.01" class="mat-input"
                    [value]="t.plafondExoTitre"
                    (input)="patchTicket({ plafondExoTitre: num($event) })" />
                </label>
              </div>
              @if (resultById('ticketsResto'); as res) {
                <ng-container [ngTemplateOutlet]="resultLine" [ngTemplateOutletContext]="{ res }" />
              }
            }
          </div>

          <!-- Autre -->
          <div class="rounded-lg border border-slate-200 p-3">
            <label class="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox" class="h-4 w-4 accent-accent-600"
                [checked]="avantages().autre.actif"
                (change)="patchAutre({ actif: checked($event) })"
              />
              <span class="font-medium text-slate-700">Autre avantage exonéré</span>
            </label>
            @if (avantages().autre.actif) {
              @let o = avantages().autre;
              <div class="mt-3 grid gap-3 sm:grid-cols-4">
                <label class="mat-field">
                  <span class="mat-label">Libellé</span>
                  <input type="text" class="mat-input"
                    [value]="o.libelle"
                    (input)="patchAutre({ libelle: text($event) })" />
                </label>
                <label class="mat-field">
                  <span class="mat-label">Montant annuel (€)</span>
                  <input type="number" step="100" class="mat-input"
                    [value]="o.montantAnnuel"
                    (input)="patchAutre({ montantAnnuel: num($event) })" />
                </label>
                <label class="mat-field">
                  <span class="mat-label">Part société (%)</span>
                  <input type="number" step="5" class="mat-input"
                    [value]="pct(o.partEmployeur)"
                    (input)="patchAutre({ partEmployeur: num($event) / 100 })" />
                </label>
                <label class="mat-field">
                  <span class="mat-label">Plafond exonéré (€)</span>
                  <input type="number" step="100" class="mat-input"
                    [value]="o.plafondExoAnnuel"
                    (input)="patchAutre({ plafondExoAnnuel: num($event) })" />
                </label>
              </div>
              @if (resultById('autre'); as res) {
                <ng-container [ngTemplateOutlet]="resultLine" [ngTemplateOutletContext]="{ res }" />
              }
            }
          </div>

          @if (totalEconomie() > 0) {
            <p class="rounded-lg bg-accent-50 px-4 py-3 text-sm text-accent-800">
              Économie totale en passant par la société :
              <strong>{{ euro(totalEconomie()) }} / an</strong> (à pouvoir d'achat égal).
            </p>
          }

          <p class="text-[11px] leading-relaxed text-slate-400">
            Modèle simplifié : la part employeur exonérée évite le « sur-coût » d'extraction
            de l'argent personnel (référence : coût d'un euro net en dividende). Les plafonds
            sont ceux de 2026, ajustables. CSG/CRDS résiduelle et réintégration IR éventuelle
            non détaillées.
          </p>
        </div>
      }
    </section>

    <ng-template #resultLine let-res="res">
      <div class="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 text-sm">
        <span class="text-slate-500">
          Via société : <strong class="text-slate-700">{{ euro(res.coutSociete) }}</strong>
          · via perso : <strong class="text-slate-700">{{ euro(res.coutPerso) }}</strong>
        </span>
        <span class="mat-chip bg-accent-50 text-accent-700">économie {{ euro(res.economie) }}</span>
      </div>
    </ng-template>
  `,
  imports: [NgTemplateOutlet],
})
export class AvantagesPanelComponent {
  private readonly fiscal = inject(FiscalService);

  readonly avantages = model.required<AvantagesState>();
  readonly params = input.required<FiscalParams>();
  readonly open = signal(false);
  readonly euro = formatEuro;

  readonly genericKeys: GenericKey[] = ['mutuelle', 'prevoyance', 'retraite', 'chequesVacances', 'cesu'];
  readonly labels: Record<GenericKey, string> = {
    mutuelle: 'Complémentaire santé',
    prevoyance: 'Prévoyance',
    retraite: 'Complémentaire retraite',
    chequesVacances: 'Chèques-vacances',
    cesu: 'CESU préfinancé (garde, aide à domicile)',
  };

  readonly results = computed(() => this.fiscal.calcAvantages(this.avantages(), this.params()));
  readonly totalEconomie = computed(() => this.results().reduce((s, r) => s + r.economie, 0));

  resultById(id: string) {
    return this.results().find((r) => r.id === id);
  }

  num(event: Event): number {
    const v = parseFloat((event.target as HTMLInputElement).value);
    return Number.isFinite(v) ? v : 0;
  }

  text(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  checked(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }

  pct(v: number): number {
    return Math.round(v * 1000) / 10;
  }

  patchAv(key: GenericKey, partial: Partial<Avantage>): void {
    this.avantages.update((a) => ({ ...a, [key]: { ...a[key], ...partial } }));
  }

  patchTicket(partial: Partial<AvantagesState['ticketsResto']>): void {
    this.avantages.update((a) => ({ ...a, ticketsResto: { ...a.ticketsResto, ...partial } }));
  }

  patchAutre(partial: Partial<AvantagesState['autre']>): void {
    this.avantages.update((a) => ({ ...a, autre: { ...a.autre, ...partial } }));
  }
}
