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

/* ---------- CRM Constants & Helpers ---------- */
export const PLANS = ["Boardroom", "QBR", "FT 1", "FT 2", "FT 3", "FT Continuity", "Alumni"];
export const SESSION_TYPES = ["Session", "MoM", "Review", "Call"];

export const LABELS = {
  bleeding: {
    name: "Bleeding",
    stage: "Safety",
    avatar: "The Firefighter",
    keywords: ["Cash Flow", "No Leads", "Chaos"],
    icon: '<path d="M12 2.8l8 3v6.1c0 4.7-3.4 8.6-8 9.6-4.6-1-8-4.9-8-9.6V5.8z"/><path d="M12 8.2v7.2M8.4 11.8h7.2"/>'
  },
  slipping: {
    name: "Slipping",
    stage: "Structure",
    avatar: "The Hamster",
    keywords: ["Low Conversion", "Low Margin"],
    icon: '<rect x="8.5" y="2.8" width="7" height="6" rx="1.2"/><rect x="2.8" y="15.2" width="7" height="6" rx="1.2"/><rect x="14.2" y="15.2" width="7" height="6" rx="1.2"/><path d="M12 8.8v3.2M6.3 15.2V12h11.4v3.2"/>'
  },
  stable: {
    name: "Stable",
    stage: "Scale",
    avatar: "The Sleeping Giant",
    keywords: ["No Rhythm", "No Marketing", "Extra Capacity"],
    icon: '<path d="M3 20h18"/><rect x="4.5" y="13" width="3.6" height="7" rx=".8"/><rect x="10.2" y="9" width="3.6" height="11" rx=".8"/><rect x="15.9" y="4.5" width="3.6" height="15.5" rx=".8"/>'
  },
  leading: {
    name: "Leading",
    stage: "Speed",
    avatar: "The Rocket",
    keywords: ["AI", "Automation", "Apps & Dashboards"],
    icon: '<path d="M13.5 2.5L4.5 13.5h6.5l-1 8 9-11h-6.5z"/>'
  }
};

export const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const parseYMD = v => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || "");
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
};

export const today0 = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export function addMonths(d, n) {
  const y = d.getFullYear(), m = d.getMonth() + n, last = new Date(y, m + 1, 0).getDate();
  return new Date(y, m, Math.min(d.getDate(), last));
}

export const fmtDate = v => {
  const d = parseYMD(v);
  return d ? d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "";
};

export function timeLeft(end) {
  const e = parseYMD(end);
  if (!e) return null;
  const t = today0(), days = Math.round((e - t) / 864e5);
  const [a, b] = days >= 0 ? [t, e] : [e, t];
  let m = 0;
  while (addMonths(a, m + 1) <= b) m++;
  const d = Math.round((b - addMonths(a, m)) / 864e5);
  const span = [m ? `${m} month${m > 1 ? "s" : ""}` : "", d || !m ? `${d} day${d === 1 ? "" : "s"}` : ""].filter(Boolean).join(" ");
  const label = days === 0 ? "Expires today" : days > 0 ? `${span} left` : `Expired ${span} ago`;
  return { days, label, status: days < 0 ? "expired" : days <= 30 ? "soon" : "ok" };
}

export const nextFollowUp = m =>
  (m.followUps || []).filter(f => !f.done && f.date).sort((x, y) => x.date.localeCompare(y.date))[0] || null;

export function dueInfo(f) {
  if (!f) return null;
  const d = Math.round((parseYMD(f.date) - today0()) / 864e5);
  return {
    label: d === 0 ? "Follow up today" : d < 0 ? `Follow-up overdue · ${fmtDate(f.date)}` : `Follow up ${fmtDate(f.date)}`,
    status: d < 0 ? "expired" : d === 0 ? "soon" : "ok",
    days: d
  };
}

export function crmMatches(m, f) {
  if (!f) return true;
  const tl = timeLeft(m.end), nf = nextFollowUp(m);
  if (f.kind === "expiring") return tl && tl.days >= 0 && tl.days <= 30;
  if (f.kind === "expired") return tl && tl.days < 0;
  if (f.kind === "due") return nf && nf.date <= ymd(today0());
  if (f.kind === "plan") return m.plan === f.plan;
  if (f.kind === "label") return f.label === "none" ? !m.label : m.label === f.label;
  return true;
}

export const waLink = mobile => {
  let d = (mobile || "").replace(/\D/g, "");
  if (d.length === 10) d = "91" + d;
  return d.length >= 11 ? `https://wa.me/${d}` : "";
};

export function normLinkedIn(v) {
  v = String(v || '').slice(0, 300).trim();
  if (!v) return "";
  if (!/^https?:\/\//i.test(v)) v = "https://" + v.replace(/^\/+/, "");
  try {
    const u = new URL(v);
    if (!/(^|\.)linkedin\.com$/i.test(u.hostname) || u.username || u.password) return "";
    u.protocol = "https:";
    u.hash = "";
    return u.href;
  } catch {
    return "";
  }
}

export const initials = n =>
  (n || "?").trim().split(/\s+/).slice(0, 2).map(w => w.charAt(0).toUpperCase()).join("") || "?";

export function dayName(v) {
  const d = parseYMD(v);
  if (!d) return "";
  const diff = Math.round((d - today0()) / 864e5);
  const day = d.toLocaleDateString(undefined, { weekday: "long" });
  return diff === 0 ? `${day} · Today` : diff === -1 ? `${day} · Yesterday` : diff === 1 ? `${day} · Tomorrow` : day;
}

export const fmtDow = v => {
  const d = parseYMD(v);
  return d ? d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : "";
};

export function squareImage(file, size = 240) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) {
      reject(new Error("type"));
      return;
    }
    const fr = new FileReader();
    fr.onerror = reject;
    fr.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("decode"));
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = c.height = size;
        const g = c.getContext("2d"), m = Math.min(img.width, img.height);
        g.fillStyle = "#fff";
        g.fillRect(0, 0, size, size);
        g.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, size, size);
        resolve(c.toDataURL("image/jpeg", 0.85));
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}


