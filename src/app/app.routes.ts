import { Routes } from '@angular/router';
import { ApiKeySetupComponent } from './components/api-key-setup/api-key-setup.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { apiKeyGuard } from './guards/api-key.guard';

export const routes: Routes = [
    { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
    { path: 'setup', component: ApiKeySetupComponent },
    {
        path: 'dashboard',
        component: DashboardComponent,
        canActivate: [apiKeyGuard] // Protected route
    }
];