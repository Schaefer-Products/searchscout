import { APP_INITIALIZER, ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { StorageService } from './services/storage.service';
import { CacheService } from './services/cache.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    {
      provide: APP_INITIALIZER,
      useFactory: (storage: StorageService, cache: CacheService) =>
        () => Promise.all([storage.initialize(), cache.initialize()]),
      deps: [StorageService, CacheService],
      multi: true
    }
  ]
};
