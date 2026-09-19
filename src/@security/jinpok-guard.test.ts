import { describe, expect, it } from 'vitest';
import { isAllowedJinpokHostname } from './jinpok-guard';

describe('isAllowedJinpokHostname', () => {
  it.each([
    'localhost',
    '127.0.0.1',
    'jinpok-x7k9m2.vercel.app',
    'jinpok-studio.vercel.app',
    'jinpok-studio-cptkdgh-arts-projects.vercel.app',
    'jinpok-studio-8n9urltv5-cptkdgh-arts-projects.vercel.app',
  ])('공식 및 로컬 주소 %s를 허용한다', (hostname) => {
    expect(isAllowedJinpokHostname(hostname)).toBe(true);
  });

  it.each([
    'jinpok-studio.vercel.app.evil.example',
    'evil-jinpok-studio.vercel.app',
    'jinpok-studio-attacker.vercel.app',
  ])('허용 주소를 흉내 낸 %s를 거부한다', (hostname) => {
    expect(isAllowedJinpokHostname(hostname)).toBe(false);
  });
});
