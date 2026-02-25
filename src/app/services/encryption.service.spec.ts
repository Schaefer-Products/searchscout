import { TestBed } from '@angular/core/testing';

import { EncryptionService } from './encryption.service';

describe('EncryptionService', () => {
  let service: EncryptionService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(EncryptionService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should store an encryption key in localStorage on first use', () => {
    expect(localStorage.getItem('searchscout_encryption_key')).toBeTruthy();
  });

  it('should reuse the same key on subsequent instantiations', () => {
    const storedKey = localStorage.getItem('searchscout_encryption_key');
    // Re-inject — should read the same key from localStorage
    const service2 = TestBed.inject(EncryptionService);
    expect(localStorage.getItem('searchscout_encryption_key')).toBe(storedKey);
  });

  describe('encrypt()', () => {
    it('should return a non-empty string different from the input', () => {
      const plaintext = 'hello world';
      const encrypted = service.encrypt(plaintext);
      expect(encrypted).toBeTruthy();
      expect(encrypted).not.toBe(plaintext);
    });

    it('should produce different ciphertext for different inputs', () => {
      expect(service.encrypt('hello')).not.toBe(service.encrypt('world'));
    });
  });

  describe('decrypt()', () => {
    it('should decrypt an encrypted string back to the original', () => {
      const plaintext = 'secret data 123!@#';
      const encrypted = service.encrypt(plaintext);
      expect(service.decrypt(encrypted)).toBe(plaintext);
    });

    it('should round-trip complex objects serialised as JSON', () => {
      const obj = { login: 'user@example.com', password: 'p@ssw0rd' };
      const json = JSON.stringify(obj);
      const decrypted = service.decrypt(service.encrypt(json));
      expect(JSON.parse(decrypted)).toEqual(obj);
    });

    it('should return an empty string when given invalid ciphertext', () => {
      expect(service.decrypt('not-valid-ciphertext!!!')).toBe('');
    });
  });
});
