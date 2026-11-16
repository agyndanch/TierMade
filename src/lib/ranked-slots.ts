/**
 * Ranked lists as numbered slots that can be empty, plus a "Not ranked yet"
 * pool. Pure functions shared by the editor and its unit tests.
 *
 * Move rule (dropping onto a slot): the item first leaves where it was; on an
 * empty slot it simply lands there; on an occupied slot it takes the slot and
 * the item there, plus the ones after it, move down one, stopping at the first
 * empty slot, so other gaps are preserved.
 *   1A 2B 3C 4— 5— 6D   drop D on #2  →  1A 2D 3B 4C 5— 6—
 */

export type SlotEntry = { id: string; position: number; unranked: boolean };

export type RankedState<E extends SlotEntry = SlotEntry> = {
  /** index = slot (rank − 1); null = empty. Never ends in null. */
  slots: (E | null)[];
  /** "Not ranked yet", in order */
  pool: E[];
};

/** Highest 0-based slot (#1000), matching the server. */
export const MAX_SLOT = 999;

function trim<E extends SlotEntry>(slots: (E | null)[]): (E | null)[] {
  let end = slots.length;
  while (end > 0 && slots[end - 1] == null) end--;
  return Array.from({ length: end }, (_, i) => slots[i] ?? null);
}

/** Builds state from server entries. Two items claiming one slot (a race) are nudged apart. */
export function fromEntries<E extends SlotEntry>(entries: E[]): RankedState<E> {
  const slots: (E | null)[] = [];
  for (const e of entries.filter((x) => !x.unranked).sort((a, b) => a.position - b.position)) {
    let s = e.position;
    while (slots[s]) s++;
    slots[s] = e;
  }
  const pool = entries.filter((x) => x.unranked).sort((a, b) => a.position - b.position);
  return { slots: trim(slots), pool };
}

export function toOrderPayload(state: RankedState) {
  return [
    ...state.slots.flatMap((e, i) => (e ? [{ id: e.id, tierId: null, position: i, unranked: false }] : [])),
    ...state.pool.map((e, i) => ({ id: e.id, tierId: null, position: i, unranked: true })),
  ];
}

export function allEntries<E extends SlotEntry>(state: RankedState<E>): E[] {
  return [...state.slots.filter((e): e is E => e !== null), ...state.pool];
}

export function findEntry<E extends SlotEntry>(state: RankedState<E>, id: string): E | undefined {
  return allEntries(state).find((e) => e.id === id);
}

/** 0-based slot of an entry, or null when it's in the pool / missing. */
export function slotOf(state: RankedState, id: string): number | null {
  const i = state.slots.findIndex((e) => e?.id === id);
  return i === -1 ? null : i;
}

export function remove<E extends SlotEntry>(state: RankedState<E>, id: string): RankedState<E> {
  return {
    slots: trim(state.slots.map((e) => (e?.id === id ? null : e))),
    pool: state.pool.filter((e) => e.id !== id),
  };
}

export function moveToSlot<E extends SlotEntry>(state: RankedState<E>, id: string, target: number): RankedState<E> {
  const entry = findEntry(state, id);
  if (!entry || target < 0 || target > MAX_SLOT) return state;
  const { slots: without, pool } = remove(state, id);
  const slots = [...without];
  if (slots[target] == null) {
    slots[target] = entry;
  } else {
    let gap = target;
    while (gap < slots.length && slots[gap] != null) gap++;
    if (gap > MAX_SLOT) return state; // nowhere to push the last item
    for (let i = gap; i > target; i--) slots[i] = slots[i - 1];
    slots[target] = entry;
  }
  return { slots: trim(slots), pool };
}

/** Moves an entry into "Not ranked yet" (at `index`, default: the end). */
export function moveToPool<E extends SlotEntry>(state: RankedState<E>, id: string, index?: number): RankedState<E> {
  const entry = findEntry(state, id);
  if (!entry) return state;
  const { slots, pool } = remove(state, id);
  const at = index === undefined ? pool.length : Math.max(0, Math.min(index, pool.length));
  return { slots, pool: [...pool.slice(0, at), entry, ...pool.slice(at)] };
}

/** Closes every gap, keeping the order. */
export function compact<E extends SlotEntry>(state: RankedState<E>): RankedState<E> {
  return { slots: state.slots.filter((e) => e !== null), pool: state.pool };
}

export function hasGaps(state: RankedState): boolean {
  return state.slots.some((e) => e === null);
}

/** Puts a freshly created entry where the server placed it (nudging past a taken slot). */
export function insertNew<E extends SlotEntry>(state: RankedState<E>, entry: E): RankedState<E> {
  if (entry.unranked) return { slots: state.slots, pool: [...state.pool, entry] };
  const slots = [...state.slots];
  let s = entry.position;
  while (slots[s]) s++;
  slots[s] = entry;
  return { slots: trim(slots), pool: state.pool };
}
