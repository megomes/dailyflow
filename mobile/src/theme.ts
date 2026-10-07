/** Design tokens (design/tokens.css, dark — the app is dark-first). */
export const C = {
  bg: '#0B0D12', bar: '#0D1016', surface: '#19191B', elevated: '#29292B', hover: '#242426', active: '#343436',
  border: '#303033', borderSubtle: '#262629', text: '#F3F3F4', text2: '#A1A1A6', muted: '#717176', disabled: '#55555A',
  now: '#DC3D92', focus: '#248CF2', ok: '#19B66A', danger: '#E5484D', warn: '#E5BA43',
} as const;

export const AREA: Record<string, string> = {
  blue: '#248CF2', purple: '#7557E8', pink: '#DC3D92', orange: '#EF6B2E', green: '#19B66A', cyan: '#27A7DC',
  yellow: '#E5BA43', red: '#E5484D', indigo: '#5B6CF0', teal: '#14B8A6', gray: '#8E8E93',
};

/** Area color blended over the surface, like the web blocks (22% fill, 46% border). */
export function tint(hex: string, pct: number, over: string = C.surface): string {
  const p = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const [a, b] = [p(hex), p(over)];
  const mix = a.map((v, i) => Math.round(v * pct + b[i] * (1 - pct)));
  return `#${mix.map(v => v.toString(16).padStart(2, '0')).join('')}`;
}
