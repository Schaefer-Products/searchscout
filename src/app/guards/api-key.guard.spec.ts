import { TestBed } from '@angular/core/testing';
import { CanActivateFn, Router } from '@angular/router';

import { apiKeyGuard } from './api-key.guard';
import { DataforseoService } from '../services/dataforseo.service';

describe('apiKeyGuard', () => {
  const executeGuard: CanActivateFn = (...guardParameters) =>
    TestBed.runInInjectionContext(() => apiKeyGuard(...guardParameters));

  let mockDataforseo: jasmine.SpyObj<DataforseoService>;
  let mockRouter: jasmine.SpyObj<Router>;

  beforeEach(() => {
    mockDataforseo = jasmine.createSpyObj('DataforseoService', ['hasCredentials']);
    mockRouter = jasmine.createSpyObj('Router', ['navigate']);

    TestBed.configureTestingModule({
      providers: [
        { provide: DataforseoService, useValue: mockDataforseo },
        { provide: Router, useValue: mockRouter }
      ]
    });
  });

  it('should be defined', () => {
    expect(executeGuard).toBeTruthy();
  });

  it('should return true when credentials exist', () => {
    mockDataforseo.hasCredentials.and.returnValue(true);
    const result = executeGuard({} as any, {} as any);
    expect(result).toBeTrue();
  });

  it('should not redirect when credentials exist', () => {
    mockDataforseo.hasCredentials.and.returnValue(true);
    executeGuard({} as any, {} as any);
    expect(mockRouter.navigate).not.toHaveBeenCalled();
  });

  it('should return false when no credentials exist', () => {
    mockDataforseo.hasCredentials.and.returnValue(false);
    const result = executeGuard({} as any, {} as any);
    expect(result).toBeFalse();
  });

  it('should redirect to /setup when no credentials exist', () => {
    mockDataforseo.hasCredentials.and.returnValue(false);
    executeGuard({} as any, {} as any);
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/setup']);
  });
});
