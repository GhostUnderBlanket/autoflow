const TAG_PALETTES = [
  'bg-purple-400/10 text-purple-300 border-purple-400/25',
  'bg-blue-400/10 text-blue-300 border-blue-400/25',
  'bg-emerald-400/10 text-emerald-300 border-emerald-400/25',
  'bg-yellow-400/10 text-yellow-300 border-yellow-400/25',
  'bg-pink-400/10 text-pink-300 border-pink-400/25',
  'bg-orange-400/10 text-orange-300 border-orange-400/25',
  'bg-cyan-400/10 text-cyan-300 border-cyan-400/25',
  'bg-red-400/10 text-red-300 border-red-400/25',
];

export function tagColor(tag: string): string {
  let h = 0;
  for (const c of tag) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  return TAG_PALETTES[Math.abs(h) % TAG_PALETTES.length];
}
