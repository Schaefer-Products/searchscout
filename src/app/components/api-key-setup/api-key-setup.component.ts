import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataforseoService } from '../../services/dataforseo.service';
import { Logger } from '../../utils/logger';

@Component({
  selector: 'app-api-key-setup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './api-key-setup.component.html',
  styleUrls: ['./api-key-setup.component.scss']
})
export class ApiKeySetupComponent {
  private dataforseoService = inject(DataforseoService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  login: string = '';
  password: string = '';
  isValidating: boolean = false;
  errorMessage: string = '';
  showPassword: boolean = false;

  /**
   * Validate and save credentials
   */
  validateAndSave(): void {
    // Reset state
    this.errorMessage = '';

    // Validation
    if (!this.login.trim() || !this.password.trim()) {
      this.errorMessage = 'Please enter both login and password';
      return;
    }

    this.isValidating = true;
    Logger.log('Starting validation...'); // Debug log

    // Validate credentials via Sandbox
    this.dataforseoService.validateCredentials(this.login, this.password).subscribe({
      next: (result) => {
        Logger.log('Validation result:', result); // Debug log
        this.isValidating = false;

        if (result.isValid) {
          // Save credentials
          this.dataforseoService.saveCredentials({
            login: this.login,
            password: this.password
          });
          Logger.log('Credentials saved, navigating to dashboard...'); // Debug log

          // Navigate to main app (dashboard doesn't exist yet, so this will show blank)
          // We'll create dashboard in Feature 2
          this.router.navigate(['/dashboard']);
        } else {
          this.errorMessage = result.error || 'Validation failed';
          Logger.log('Validation failed:', this.errorMessage);
          this.cdr.detectChanges(); // Force change detection
        }
      },
      error: (error) => {
        Logger.error('Validation error:', error); // Debug log
        this.isValidating = false;

        // Handle the error object properly
        if (typeof error === 'object' && error.error) {
          this.errorMessage = error.error;
        } else if (typeof error === 'string') {
          this.errorMessage = error;
        } else {
          this.errorMessage = 'Failed to validate credentials. Please try again.';
        }

        this.cdr.detectChanges(); // Force change detection
      },
      complete: () => {
        Logger.log('Validation observable completed'); // Debug log
      }
    });
  }

  /**
   * Toggle password visibility
   */
  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  /**
   * Open DataForSEO signup in new tab
   */
  openDataForSeoSignup(): void {
    window.open('https://app.dataforseo.com/register', '_blank');
  }
}