const eur = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const eur2 = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 2,
});

const pct = new Intl.NumberFormat('fr-FR', {
  style: 'percent',
  maximumFractionDigits: 1,
});

export const formatEuro = (v: number): string => eur.format(Math.round(v));
export const formatEuro2 = (v: number): string => eur2.format(v);
export const formatPct = (v: number): string => pct.format(v);
