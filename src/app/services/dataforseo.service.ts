import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { StorageService, ApiCredentials } from './storage.service';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class DataforseoService {
  private http = inject(HttpClient);
  private storage = inject(StorageService);

  /**
   * Validate API credentials using DataForSEO Sandbox
   * This is a FREE test call that doesn't consume credits
   */
  validateCredentials(login: string, password: string): Observable<ValidationResult> {
    const url = `${environment.dataforSeoSandboxUrl}/dataforseo_labs/google/ranked_keywords/live`;

    // Minimal test request
    const body = [{
      target: 'example.com',
      location_code: 2840,
      language_code: 'en',
      limit: 1
    }];

    const headers = this.createAuthHeaders(login, password);

    return this.http.post<any>(url, body, { headers }).pipe(
      map(response => {
        console.log('DataForSEO response:', response); // Debug log
        // DataForSEO returns status_code 20000 for success
        if (response.status_code === 20000) {
          return { isValid: true };
        } else if (response.status_code === 40100) {
          // Specific error for unauthorized
          return {
            isValid: false,
            error: 'Invalid login or password. Check your credentials at https://app.dataforseo.com/api-access'
          };
        } else {
          return {
            isValid: false,
            error: `API returned status: ${response.status_code} - ${response.status_message}`
          };
        }
      }),
      catchError(error => {
        console.error('HTTP error:', error); // Debug log
        // Handle HTTP errors (401 = unauthorized, etc.)
        let errorMessage = 'Failed to validate credentials';

        if (error.status === 0) {
          errorMessage = 'Network error. Please check your internet connection.';
        } else if (error.error?.status_message) {
          errorMessage = error.error.status_message;
        }

        return throwError(() => ({ isValid: false, error: errorMessage }));
      })
    );
  }

  /**
   * Get stored credentials
   */
  getStoredCredentials(): ApiCredentials | null {
    return this.storage.getCredentials();
  }

  /**
   * Save credentials after validation
   */
  saveCredentials(credentials: ApiCredentials): void {
    this.storage.saveCredentials(credentials);
  }

  /**
   * Remove stored credentials
   */
  clearCredentials(): void {
    this.storage.clearCredentials();
  }

  /**
   * Check if user has stored credentials
   */
  hasCredentials(): boolean {
    return this.storage.hasCredentials();
  }

  /**
   * Create HTTP headers with Basic Authentication
   */
  private createAuthHeaders(login: string, password: string): HttpHeaders {
    const credentials = btoa(`${login}:${password}`);
    return new HttpHeaders({
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json'
    });
  }

  /**
   * Create headers using stored credentials
   */
  getAuthHeaders(): HttpHeaders | null {
    const creds = this.getStoredCredentials();
    if (!creds) {
      return null;
    }
    return this.createAuthHeaders(creds.login, creds.password);
  }
}