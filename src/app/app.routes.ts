import { Routes } from '@angular/router';
import { ApiKeySetupComponent } from './components/api-key-setup/api-key-setup.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';

export const routes: Routes = [
    { path: '', redirectTo: '/setup', pathMatch: 'full' },
    { path: 'setup', component: ApiKeySetupComponent },
    { path: 'dashboard', component: DashboardComponent }
];