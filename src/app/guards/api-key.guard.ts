import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { CanActivateFn } from '@angular/router';
import { DataforseoService } from '../services/dataforseo.service';

export const apiKeyGuard: CanActivateFn = (route, state) => {
  const dataforseoService = inject(DataforseoService);
  const router = inject(Router);

  if (dataforseoService.hasCredentials()) {
    return true;
  } else {
    // Redirect to setup if no credentials
    router.navigate(['/setup']);
    return false;
  }
};