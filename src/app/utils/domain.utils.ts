/**
 * Strips protocol, www prefix, and path from a domain input string.
 * e.g. "https://www.example.com/path" → "example.com"
 */
export function cleanDomain(input: string): string {
  let cleaned = input.trim().toLowerCase();
  cleaned = cleaned.replace(/^(https?:\/\/)?(www\.)?/, '');
  cleaned = cleaned.replace(/\/.*$/, '');
  return cleaned;
}

/**
 * Returns true if the string is a valid domain name (no protocol or path).
 * e.g. "example.com" → true, "not a domain" → false
 */
export function isValidDomain(domain: string): boolean {
  return /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i.test(domain);
}
