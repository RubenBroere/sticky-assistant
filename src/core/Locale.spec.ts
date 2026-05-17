import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getLanguage, t, formatMessage } from './Locale';

describe('Locale', () => {
  beforeEach(() => {
    vi.stubGlobal('PropertiesService', {
      getUserProperties: vi.fn().mockReturnValue({
        getProperty: vi.fn().mockReturnValue('en')
      })
    });
  });

  it('should format a message with params', () => {
    expect(formatMessage('Hello {name}', { name: 'World' })).toBe('Hello World');
  });

  it('should return translation for a key', () => {
    expect(t('en', 'toolSelectorTitle')).toBe('Sticky Assistant');
  });

  it('should fallback to english if key not found in language', () => {
    expect(t('nl', 'toolSelectorTitle')).toBe('Sticky Assistant');
  });

  it('should get language from properties', () => {
    expect(getLanguage()).toBe('en');
  });
});
