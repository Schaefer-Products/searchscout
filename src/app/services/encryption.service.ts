import { Injectable } from '@angular/core';
import * as CryptoJS from 'crypto-js';

@Injectable({
  providedIn: 'root'
})
export class EncryptionService {
  private secretKey: string;

  constructor() {
    this.secretKey = this.getOrCreateSecretKey();
  }

  /**
   * Encrypt text using AES encryption
   */
  encrypt(text: string): string {
    return CryptoJS.AES.encrypt(text, this.secretKey).toString();
  }

  /**
   * Decrypt text using AES decryption
   */
  decrypt(ciphertext: string): string {
    try {
      const bytes = CryptoJS.AES.decrypt(ciphertext, this.secretKey);
      return bytes.toString(CryptoJS.enc.Utf8);
    } catch (error) {
      console.error('Decryption failed:', error);
      return '';
    }
  }

  /**
   * Get or create a device-specific encryption key
   * This key is stored in localStorage and stays consistent per browser
   */
  private getOrCreateSecretKey(): string {
    const STORAGE_KEY = 'searchscout_encryption_key';
    let key = localStorage.getItem(STORAGE_KEY);

    if (!key) {
      // Generate a random key for this device
      key = CryptoJS.lib.WordArray.random(256 / 8).toString();
      localStorage.setItem(STORAGE_KEY, key);
    }

    return key;
  }
}