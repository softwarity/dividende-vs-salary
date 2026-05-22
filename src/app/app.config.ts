import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideEchartsCore } from 'ngx-echarts';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideEchartsCore({ echarts: () => import('echarts') }),
  ],
};
