import { Injectable, inject } from '@angular/core';
import { EncryptionService } from './encryption.service';

export interface ApiCredentials {
  login: string;
  password: string;
}

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private readonly API_CREDS_KEY = 'searchscout_api_credentials';
  private encryption = inject(EncryptionService);

  /**
   * Save encrypted API credentials to localStorage
   */
  saveCredentials(credentials: ApiCredentials): void {
    const json = JSON.stringify(credentials);
    const encrypted = this.encryption.encrypt(json);
    localStorage.setItem(this.API_CREDS_KEY, encrypted);
  }

  /**
   * Retrieve and decrypt API credentials from localStorage
   */
  getCredentials(): ApiCredentials | null {
    const encrypted = localStorage.getItem(this.API_CREDS_KEY);

    if (!encrypted) {
      return null;
    }

    try {
      const decrypted = this.encryption.decrypt(encrypted);
      if (!decrypted) {
        return null;
      }
      return JSON.parse(decrypted) as ApiCredentials;
    } catch (error) {
      console.error('Failed to retrieve credentials:', error);
      return null;
    }
  }

  /**
   * Check if credentials exist in storage
   */
  hasCredentials(): boolean {
    return this.getCredentials() !== null;
  }

  /**
   * Remove credentials from storage
   */
  clearCredentials(): void {
    localStorage.removeItem(this.API_CREDS_KEY);
  }
}