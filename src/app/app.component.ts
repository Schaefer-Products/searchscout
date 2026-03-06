import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { UndoToastComponent } from './components/undo-toast/undo-toast.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, UndoToastComponent],
  template: `<router-outlet></router-outlet>
<app-undo-toast></app-undo-toast>`,
  styleUrls: ['./app.component.scss'],
  changeDetection: ChangeDetectionStrategy.Default
})
export class AppComponent {
  title = 'searchscout';
}