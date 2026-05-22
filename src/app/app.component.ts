import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SimulatorComponent } from './components/simulator/simulator.component';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SimulatorComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {}
