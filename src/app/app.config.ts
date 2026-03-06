import { ApplicationConfig, inject, provideAppInitializer } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { StorageService } from './services/storage.service';
import { CacheService } from './services/cache.service';
import { KeywordRatingService } from './services/keyword-rating.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideAppInitializer(async () => {
      const storage = inject(StorageService);
      const cache = inject(CacheService);
      const keywordRating = inject(KeywordRatingService);
      await storage.initialize();
      await Promise.all([
        cache.initialize(),
        keywordRating.initialize(storage.getCurrentDomain() ?? ''),
      ]);
    })
  ]
};
