export const ACCENTS = {
  green:     { name: "Forest",     l: "#1E6B57", d: "#4FB394" },
  teal:      { name: "Teal",       l: "#0F7A86", d: "#4CC3CF" },
  blue:      { name: "Ocean",      l: "#2160C4", d: "#6EA6F0" },
  indigo:    { name: "Indigo",     l: "#4B48C6", d: "#9592F4" },
  plum:      { name: "Plum",       l: "#8A3FA0", d: "#CB8EDC" },
  rose:      { name: "Rose",       l: "#C2385A", d: "#F2819B" },
  terracotta:{ name: "Terracotta", l: "#B4532A", d: "#EB9367" },
  amber:     { name: "Amber",      l: "#9A6200", d: "#F0B23C" },
  graphite:  { name: "Graphite",   l: "#3D4A55", d: "#AAB7C3" }
};

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const starterBoard = () => {
  const t = s => ({ id: uid(), text: s, done: false, starred: false });
  const l1 = { id: uid(), name: "Project Links", starred: false, todos: [t("Live Tracker Link"), t("Online Project File Link"), t("Presentation Deck Link")] };
  const l2 = { id: uid(), name: "This Week", starred: false, todos: [t("Confirm venue walkthrough"), t("Send vendor shortlist")] };
  const l3 = { id: uid(), name: "Ideas", starred: false, todos: [] };
  return { lists: [l1, l2, l3], activeId: l1.id, notes: [], activeNoteId: null, tab: "lists", updatedAt: Date.now() };
};

export const reorderSubset = (arr, ids) => {
  const set = new Set(ids);
  const slots = [];
  arr.forEach((x, i) => { if (set.has(x.id)) slots.push(i); });
  const byId = Object.fromEntries(arr.map(x => [x.id, x]));
  const out = arr.slice();
  slots.forEach((slot, k) => {
    if (byId[ids[k]]) {
      out[slot] = byId[ids[k]];
    }
  });
  return out;
};


