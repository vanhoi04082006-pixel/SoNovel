/**
 * External store nhỏ: chip thể loại ở Home → tab Search.
 * Search screen subscribe để biết genre/tag người dùng bấm ở Home.
 */
let pendingGenre: string | null = null;
let pendingTag: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function setSearchFilter(opts: { genre?: string | null; tag?: string | null }) {
  pendingGenre = opts.genre ?? pendingGenre;
  pendingTag = opts.tag ?? pendingTag;
  emit();
}

export function consumeSearchFilter(): { genre: string | null; tag: string | null } {
  const out = { genre: pendingGenre, tag: pendingTag };
  pendingGenre = null;
  pendingTag = null;
  emit();
  return out;
}

export function peekSearchFilter() {
  return { genre: pendingGenre, tag: pendingTag };
}

export function subscribeSearchFilter(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
