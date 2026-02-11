import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div style="padding: 2rem; text-align: center;">
      <h1>✅ Credentials Saved Successfully!</h1>
      <p>Dashboard coming in Feature 2...</p>
    </div>
  `,
  styles: [`
    h1 { color: #667eea; }
    p { color: #718096; }
  `]
})
export class DashboardComponent { }