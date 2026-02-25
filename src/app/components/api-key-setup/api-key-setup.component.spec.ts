import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { ApiKeySetupComponent } from './api-key-setup.component';
import { DataforseoService } from '../../services/dataforseo.service';

describe('ApiKeySetupComponent', () => {
  let component: ApiKeySetupComponent;
  let fixture: ComponentFixture<ApiKeySetupComponent>;
  let dataforseoSpy: jasmine.SpyObj<DataforseoService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    dataforseoSpy = jasmine.createSpyObj('DataforseoService', ['validateCredentials', 'saveCredentials']);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [ApiKeySetupComponent],
      providers: [
        { provide: DataforseoService, useValue: dataforseoSpy },
        { provide: Router, useValue: routerSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ApiKeySetupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // Initial state
  // ---------------------------------------------------------------------------

  describe('initial state', () => {
    it('should have empty login', () => {
      expect(component.login).toBe('');
    });

    it('should have empty password', () => {
      expect(component.password).toBe('');
    });

    it('should not be validating', () => {
      expect(component.isValidating).toBeFalse();
    });

    it('should have no error message', () => {
      expect(component.errorMessage).toBe('');
    });

    it('should hide password by default', () => {
      expect(component.showPassword).toBeFalse();
    });
  });

  // ---------------------------------------------------------------------------
  // togglePasswordVisibility()
  // ---------------------------------------------------------------------------

  describe('togglePasswordVisibility()', () => {
    it('should show password when currently hidden', () => {
      component.togglePasswordVisibility();
      expect(component.showPassword).toBeTrue();
    });

    it('should hide password when currently shown', () => {
      component.showPassword = true;
      component.togglePasswordVisibility();
      expect(component.showPassword).toBeFalse();
    });
  });

  // ---------------------------------------------------------------------------
  // openDataForSeoSignup()
  // ---------------------------------------------------------------------------

  describe('openDataForSeoSignup()', () => {
    it('should open the DataForSEO registration page in a new tab', () => {
      spyOn(window, 'open');
      component.openDataForSeoSignup();
      expect(window.open).toHaveBeenCalledWith('https://app.dataforseo.com/register', '_blank');
    });
  });

  // ---------------------------------------------------------------------------
  // validateAndSave() — input validation
  // ---------------------------------------------------------------------------

  describe('validateAndSave() — input validation', () => {
    it('should show error and not call service when login is empty', () => {
      component.login = '';
      component.password = 'secret';
      component.validateAndSave();
      expect(component.errorMessage).toBe('Please enter both login and password');
      expect(dataforseoSpy.validateCredentials).not.toHaveBeenCalled();
    });

    it('should show error and not call service when password is empty', () => {
      component.login = 'user@example.com';
      component.password = '';
      component.validateAndSave();
      expect(component.errorMessage).toBe('Please enter both login and password');
      expect(dataforseoSpy.validateCredentials).not.toHaveBeenCalled();
    });

    it('should show error when login is whitespace only', () => {
      component.login = '   ';
      component.password = 'secret';
      component.validateAndSave();
      expect(component.errorMessage).toBe('Please enter both login and password');
      expect(dataforseoSpy.validateCredentials).not.toHaveBeenCalled();
    });

    it('should show error when password is whitespace only', () => {
      component.login = 'user@example.com';
      component.password = '   ';
      component.validateAndSave();
      expect(component.errorMessage).toBe('Please enter both login and password');
      expect(dataforseoSpy.validateCredentials).not.toHaveBeenCalled();
    });

    it('should clear a previous error message before attempting validation', () => {
      component.errorMessage = 'Old error';
      component.login = 'user@example.com';
      component.password = 'secret';
      dataforseoSpy.validateCredentials.and.returnValue(of({ isValid: true }));
      component.validateAndSave();
      // errorMessage is reset at the top of validateAndSave; any new value comes from the result
      expect(dataforseoSpy.validateCredentials).toHaveBeenCalled();
    });

    it('should set isValidating to true while the observable is pending', () => {
      component.login = 'user@example.com';
      component.password = 'secret';
      const pending$ = new Subject<{ isValid: boolean }>();
      dataforseoSpy.validateCredentials.and.returnValue(pending$.asObservable());
      component.validateAndSave();
      expect(component.isValidating).toBeTrue();
    });
  });

  // ---------------------------------------------------------------------------
  // validateAndSave() — successful validation
  // ---------------------------------------------------------------------------

  describe('validateAndSave() — valid credentials', () => {
    beforeEach(() => {
      component.login = 'user@example.com';
      component.password = 'correct-secret';
      dataforseoSpy.validateCredentials.and.returnValue(of({ isValid: true }));
    });

    it('should call validateCredentials with the entered login and password', () => {
      component.validateAndSave();
      expect(dataforseoSpy.validateCredentials).toHaveBeenCalledWith('user@example.com', 'correct-secret');
    });

    it('should save credentials after successful validation', () => {
      component.validateAndSave();
      expect(dataforseoSpy.saveCredentials).toHaveBeenCalledWith({
        login: 'user@example.com',
        password: 'correct-secret',
      });
    });

    it('should navigate to /dashboard', () => {
      component.validateAndSave();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/dashboard']);
    });

    it('should set isValidating to false after completion', () => {
      component.validateAndSave();
      expect(component.isValidating).toBeFalse();
    });

    it('should leave errorMessage empty', () => {
      component.validateAndSave();
      expect(component.errorMessage).toBe('');
    });
  });

  // ---------------------------------------------------------------------------
  // validateAndSave() — invalid credentials (API returns isValid: false)
  // ---------------------------------------------------------------------------

  describe('validateAndSave() — invalid credentials', () => {
    beforeEach(() => {
      component.login = 'user@example.com';
      component.password = 'wrong-password';
    });

    it('should display the error message returned by the API', () => {
      dataforseoSpy.validateCredentials.and.returnValue(of({ isValid: false, error: 'Invalid login or password' }));
      component.validateAndSave();
      expect(component.errorMessage).toBe('Invalid login or password');
    });

    it('should fall back to "Validation failed" when no error is provided', () => {
      dataforseoSpy.validateCredentials.and.returnValue(of({ isValid: false }));
      component.validateAndSave();
      expect(component.errorMessage).toBe('Validation failed');
    });

    it('should set isValidating to false', () => {
      dataforseoSpy.validateCredentials.and.returnValue(of({ isValid: false, error: 'bad creds' }));
      component.validateAndSave();
      expect(component.isValidating).toBeFalse();
    });

    it('should not navigate to dashboard', () => {
      dataforseoSpy.validateCredentials.and.returnValue(of({ isValid: false, error: 'bad creds' }));
      component.validateAndSave();
      expect(routerSpy.navigate).not.toHaveBeenCalled();
    });

    it('should not save credentials', () => {
      dataforseoSpy.validateCredentials.and.returnValue(of({ isValid: false, error: 'bad creds' }));
      component.validateAndSave();
      expect(dataforseoSpy.saveCredentials).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // validateAndSave() — HTTP / network errors
  // ---------------------------------------------------------------------------

  describe('validateAndSave() — HTTP errors', () => {
    beforeEach(() => {
      component.login = 'user@example.com';
      component.password = 'secret';
    });

    it('should show error.error when the error is an object with an error property', () => {
      dataforseoSpy.validateCredentials.and.returnValue(
        throwError(() => ({ error: 'Network error. Please check your internet connection.' }))
      );
      component.validateAndSave();
      expect(component.errorMessage).toBe('Network error. Please check your internet connection.');
    });

    it('should show the message directly when the error is a string', () => {
      dataforseoSpy.validateCredentials.and.returnValue(throwError(() => 'Connection refused'));
      component.validateAndSave();
      expect(component.errorMessage).toBe('Connection refused');
    });

    it('should show a generic message for unknown error shapes', () => {
      dataforseoSpy.validateCredentials.and.returnValue(throwError(() => ({ status: 500 })));
      component.validateAndSave();
      expect(component.errorMessage).toBe('Failed to validate credentials. Please try again.');
    });

    it('should set isValidating to false', () => {
      dataforseoSpy.validateCredentials.and.returnValue(throwError(() => 'error'));
      component.validateAndSave();
      expect(component.isValidating).toBeFalse();
    });

    it('should not navigate to dashboard', () => {
      dataforseoSpy.validateCredentials.and.returnValue(throwError(() => 'error'));
      component.validateAndSave();
      expect(routerSpy.navigate).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Template / DOM
  // ---------------------------------------------------------------------------

  describe('template', () => {
    it('should render the page heading', () => {
      const h1 = fixture.nativeElement.querySelector('h1') as HTMLElement;
      expect(h1.textContent).toContain('Welcome to SearchScout');
    });

    it('should disable submit button when login is empty', () => {
      component.login = '';
      component.password = 'secret';
      fixture.detectChanges();
      const btn = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
      expect(btn.disabled).toBeTrue();
    });

    it('should disable submit button when password is empty', () => {
      component.login = 'user@example.com';
      component.password = '';
      fixture.detectChanges();
      const btn = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
      expect(btn.disabled).toBeTrue();
    });

    it('should enable submit button when both fields are filled', () => {
      component.login = 'user@example.com';
      component.password = 'secret';
      fixture.detectChanges();
      const btn = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
      expect(btn.disabled).toBeFalse();
    });

    it('should disable submit button while isValidating is true', () => {
      component.login = 'user@example.com';
      component.password = 'secret';
      component.isValidating = true;
      fixture.detectChanges();
      const btn = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
      expect(btn.disabled).toBeTrue();
    });

    it('should show "Validate & Save Credentials" when not validating', () => {
      component.isValidating = false;
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Validate & Save Credentials');
    });

    it('should show "Validating..." text when isValidating is true', () => {
      component.isValidating = true;
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Validating...');
    });

    it('should display the error message element when errorMessage is set', () => {
      component.errorMessage = 'Something went wrong';
      fixture.detectChanges();
      const errorEl = fixture.nativeElement.querySelector('.error-message') as HTMLElement;
      expect(errorEl).not.toBeNull();
      expect(errorEl.textContent).toContain('Something went wrong');
    });

    it('should not render the error message element when errorMessage is empty', () => {
      component.errorMessage = '';
      fixture.detectChanges();
      const errorEl = fixture.nativeElement.querySelector('.error-message');
      expect(errorEl).toBeNull();
    });

    it('should render password input as type="password" by default', () => {
      const input = fixture.nativeElement.querySelector('#password') as HTMLInputElement;
      expect(input.type).toBe('password');
    });

    it('should render password input as type="text" when showPassword is true', () => {
      component.showPassword = true;
      fixture.detectChanges();
      const input = fixture.nativeElement.querySelector('#password') as HTMLInputElement;
      expect(input.type).toBe('text');
    });

    it('should call togglePasswordVisibility when the toggle button is clicked', () => {
      spyOn(component, 'togglePasswordVisibility');
      const toggleBtn = fixture.nativeElement.querySelector('.toggle-password') as HTMLButtonElement;
      toggleBtn.click();
      expect(component.togglePasswordVisibility).toHaveBeenCalled();
    });

    it('should call openDataForSeoSignup when the sign-up button is clicked', () => {
      spyOn(component, 'openDataForSeoSignup');
      const signupBtn = fixture.nativeElement.querySelector('.btn-secondary') as HTMLButtonElement;
      signupBtn.click();
      expect(component.openDataForSeoSignup).toHaveBeenCalled();
    });

    it('should call validateAndSave when the form is submitted', () => {
      spyOn(component, 'validateAndSave');
      const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
      form.dispatchEvent(new Event('submit'));
      expect(component.validateAndSave).toHaveBeenCalled();
    });
  });
});
