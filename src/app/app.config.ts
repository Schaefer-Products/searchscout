import { ApplicationConfig, inject, provideAppInitializer } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { StorageService } from './services/storage.service';
import { CacheService } from './services/cache.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideAppInitializer(() => {
      const storage = inject(StorageService);
      const cache = inject(CacheService);
      return Promise.all([storage.initialize(), cache.initialize()]);
    })
  ]
};
