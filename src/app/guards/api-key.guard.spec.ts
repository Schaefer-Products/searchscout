import { TestBed } from '@angular/core/testing';
import { CanActivateFn } from '@angular/router';

import { apiKeyGuard } from './api-key.guard';

describe('apiKeyGuard', () => {
  const executeGuard: CanActivateFn = (...guardParameters) =>
    TestBed.runInInjectionContext(() => apiKeyGuard(...guardParameters));

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });
});
