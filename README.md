# Dividende vs Salaire — Simulateur SASU

Application web qui répond à une question simple pour un dirigeant de **SASU**
(président assimilé salarié) :

> Pour un **net annuel que je veux réellement dans la poche**, combien cela
> coûte-t-il à ma société si je me rémunère en **salaire** plutôt qu'en
> **dividendes** ?

Le simulateur calcule les deux coûts, désigne l'option la moins chère, et
détaille la décomposition (charges sociales, IR, IS, PFU) avec des graphiques.

## Stack

- **Angular 19** (standalone components, signals)
- **TailwindCSS** (rendu inspiré Material Design)
- **Apache ECharts** (`ngx-echarts`) pour les graphiques

## Modèle fiscal

- **Sens du calcul** : net souhaité dans la poche → coût pour l'entreprise.
- **Dividendes** : PFU (flat tax), taux par défaut **31,4 %**, ajustable.
- **IS** : 15 % jusqu'à 42 500 €, puis 25 % (seuils et taux ajustables).
- **Salaire** : charges sociales forfaitaires SASU + IR au barème avec parts et
  autres revenus du foyer (résolution inverse du brut nécessaire).
- Tous les paramètres sont modifiables dans le panneau « Paramètres fiscaux ».

> Outil pédagogique. Hypothèses simplifiées (IR sans décote ni plafonnement du
> quotient familial, charges forfaitaires). Ne remplace pas un expert-comptable.

Le cœur de calcul, sans dépendance Angular, est isolé dans
[`src/app/services/fiscal.core.ts`](src/app/services/fiscal.core.ts) et testé
dans `fiscal.service.spec.ts`.

## Développement

```bash
npm install
npm start          # http://localhost:4200
npm run build      # build de production dans dist/
npm test           # tests unitaires (Karma/Chrome)
```

## Déploiement GitHub Pages

Le workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
construit l'application et la publie automatiquement sur GitHub Pages à chaque
push.

Le site est servi sous `/<nom-du-repo>/`, d'où le `--base-href
"/dividende-vs-salary/"` du build. Une fois le workflow exécuté, l'application
est disponible à :

```
https://softwarity.github.io/dividende-vs-salary/
```

Si c'est le premier déploiement, vérifie dans **Settings → Pages** que la source
est bien réglée sur **GitHub Actions** (le workflow tente de l'activer
automatiquement).
