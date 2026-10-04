import { vi } from 'vitest';
const original = Date.prototype.toLocaleDateString;
// These upstream assertions use English month names; pin only the implicit
// locale in tests so Windows' Chinese locale does not change the expectation.
export function englishDateLocale(): void {
  vi.spyOn(Date.prototype, 'toLocaleDateString').mockImplementation(function (this: Date, locales, options) {
    return original.call(this, locales ?? 'en-US', options);
  });
}
