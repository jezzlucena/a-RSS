import { describe, it, expect } from 'vitest';
import { parseGoogleAudiences } from '../src/services/googleAuth.js';

describe('parseGoogleAudiences', () => {
  it('accepts one id, a comma list, and stray whitespace', () => {
    expect(parseGoogleAudiences('a.apps.googleusercontent.com')).toEqual(['a.apps.googleusercontent.com']);
    expect(parseGoogleAudiences(' web.apps.googleusercontent.com, ios.apps.googleusercontent.com ')).toEqual([
      'web.apps.googleusercontent.com',
      'ios.apps.googleusercontent.com',
    ]);
    expect(parseGoogleAudiences('a\nb')).toEqual(['a', 'b']);
  });

  it('treats unset or blank as unconfigured', () => {
    expect(parseGoogleAudiences(undefined)).toEqual([]);
    expect(parseGoogleAudiences(' , ')).toEqual([]);
  });
});
