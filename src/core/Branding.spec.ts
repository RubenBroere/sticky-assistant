import { describe, it, expect, vi } from 'vitest';
import { getAppName, getToolTitle } from './Branding';

describe('Branding', () => {
  it('should return the app name', () => {
    expect(getAppName()).toBe('Sticky Assistant');
  });

  it('should return a tool title', () => {
    expect(getToolTitle('actionPoints')).toBe('Sticky Assistant - Action Points');
  });

  it('should return the key if tool not found', () => {
    expect(getToolTitle('unknown' as any)).toBe('Sticky Assistant - unknown');
  });
});
