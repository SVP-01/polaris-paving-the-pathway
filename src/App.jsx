import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  BrowserRouter,
  NavLink,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams
} from "react-router-dom";
import { createClient } from "@supabase/supabase-js";

// ─── Supabase ────────────────────────────────────────────────────────────────
const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL      || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const hasSupabase       = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
const SUPABASE_CLIENT   = hasSupabase ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// ─── Role config ─────────────────────────────────────────────────────────────
const MENTOR_ID = "ae5ee6bc-7dc6-4a69-b35d-8be85f4db1dc"; // Prem
const MENTEE_ID = "f5a48b8d-1acd-4a65-b449-1d06e29186f7"; // Sonya

// ─── Constants ───────────────────────────────────────────────────────────────
const MILESTONES = [
  { count: 5,  label: "Campfire",     emoji: "🪵" },
  { count: 10, label: "Hiking Boots", emoji: "🥾" },
  { count: 15, label: "Compass",      emoji: "🗺️" },
  { count: 20, label: "Pine Tree",    emoji: "🌲" },
  { count: 25, label: "Summit",       emoji: "🏔️" }
];

const ENCOURAGING_QUOTES = [
  "A mountain is climbed one step at a time.",
  "The expedition is still waiting for you.",
  "Small moves still change the map.",
  "Today can be the first marker on a new trail.",
  "Momentum often starts quietly."
];

const QUICK_EMOJIS   = ["❤️", "👍", "👀", "💯", "👏"];
const WEEKDAYS       = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ─── Context ─────────────────────────────────────────────────────────────────
const AppContext = createContext(null);
function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppContext");
  return ctx;
}

// ─── Utility helpers ─────────────────────────────────────────────────────────
function asArray(v)         { return Array.isArray(v) ? v : []; }
function isoDate(d = new Date()) { return new Date(d).toISOString().slice(0, 10); }

function parseDateOrToday(v) {
  if (!v) return isoDate();
  const d = new Date(`${v}T00:00:00`);
  return Number.isNaN(d.getTime()) ? isoDate() : isoDate(d);
}

function formatLongDate(v) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric"
  }).format(new Date(`${v}T00:00:00`));
}

function formatShortMonth(d) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(d);
}

function startOfMonth(d) {
  const n = new Date(d); n.setDate(1); n.setHours(0,0,0,0); return n;
}

function shiftMonth(d, delta) {
  const n = new Date(d); n.setMonth(n.getMonth() + delta); return startOfMonth(n);
}

function getMondayIndex(d) { const day = d.getDay(); return day === 0 ? 6 : day - 1; }

function buildCalendarGrid(monthDate) {
  const start     = startOfMonth(monthDate);
  const gridStart = new Date(start);
  gridStart.setDate(start.getDate() - getMondayIndex(start));
  return Array.from({ length: 42 }, (_, i) => {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + i);
    return day;
  });
}

function hashString(v) {
  let h = 0;
  for (let i = 0; i < v.length; i++) { h = (h << 5) - h + v.charCodeAt(i); h |= 0; }
  return Math.abs(h);
}

// ─── Error Boundary ──────────────────────────────────────────────────────────
class AppErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, message: "" }; }
  static getDerivedStateFromError(e) { return { hasError: true, message: e?.message || "Render error." }; }
  render() {
    if (this.state.hasError)
      return (
        <main className="min-h-screen bg-slate-100 px-4 py-16">
          <div className="mx-auto max-w-2xl rounded-[2rem] border border-slate-200 bg-white p-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-rose-600">Rendering error</p>
            <h1 className="mt-3 text-2xl font-semibold text-slate-950">The dashboard paused.</h1>
            <p className="mt-2 text-sm text-slate-600">{this.state.message}</p>
          </div>
        </main>
      );
    return this.props.children;
  }
}

// ─── Data hooks ──────────────────────────────────────────────────────────────
function useTasks(client, userId, role) {
  const [tasks,    setTasks]    = useState([]);
  const [loading,  setLoading]  = useState(Boolean(client && userId));
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let alive = true, channel = null;
    if (!client || !userId) { setTasks([]); setLoading(false); return; }

    async function sync() {
      setLoading(true);
      const col = role === "mentor" ? "mentor_id" : "mentee_id";
      const { data } = await client
        .from("tasks").select("*").eq(col, userId)
        .order("due_date", { ascending: true })
        .order("created_at", { ascending: false });
      if (alive) { setTasks(asArray(data)); setLoading(false); }
    }

    sync();
    const col = role === "mentor" ? "mentor_id" : "mentee_id";
    channel = client
      .channel(`tasks-${userId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "tasks", filter: `${col}=eq.${userId}` },
        () => sync())
      .subscribe();

    return () => { alive = false; if (channel) client.removeChannel(channel); };
  }, [client, userId, role, revision]);

  return { tasks, loading, refresh: () => setRevision(v => v + 1) };
}

function useDailyNotes(client, userId) {
  const [dailyNotes, setDailyNotes] = useState([]);
  const [revision,   setRevision]   = useState(0);

  useEffect(() => {
    let alive = true, channel = null;
    if (!client || !userId) { setDailyNotes([]); return; }

    async function sync() {
      const { data } = await client
        .from("daily_notes").select("*").eq("user_id", userId)
        .order("date", { ascending: false });
      if (alive) setDailyNotes(asArray(data));
    }

    sync();
    channel = client
      .channel(`notes-${userId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "daily_notes", filter: `user_id=eq.${userId}` },
        () => sync())
      .subscribe();

    return () => { alive = false; if (channel) client.removeChannel(channel); };
  }, [client, userId, revision]);

  return { dailyNotes, refresh: () => setRevision(v => v + 1) };
}

// ─── Login Screen ────────────────────────────────────────────────────────────
function LoginScreen({ onSignIn, loading, error }) {
  const [email, setEmail] = useState("");
  const [pass,  setPass]  = useState("");

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-4 py-10">
        <div className="grid w-full gap-8 rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur md:grid-cols-[1.1fr_0.9fr] md:p-8">
          <section className="space-y-6">
            <div className="inline-flex rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-emerald-200">
              Polaris: Paving the Pathway
            </div>
            <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-white md:text-6xl">
              Field-ready planning for the road ahead.
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-300">
              Sign in as Mentor or Mentee to access your private workspace.
            </p>
          </section>

          <form
            className="space-y-4 rounded-[1.5rem] border border-white/10 bg-slate-900/75 p-5"
            onSubmit={e => { e.preventDefault(); onSignIn(email, pass); }}
          >
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-300">Email</span>
              <input
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-emerald-300/50 focus:ring-2 focus:ring-emerald-300/20"
                type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email" placeholder="you@example.com"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-300">Password</span>
              <input
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-emerald-300/50 focus:ring-2 focus:ring-emerald-300/20"
                type="password" value={pass}
                onChange={e => setPass(e.target.value)}
                autoComplete="current-password" placeholder="••••••••"
              />
            </label>
            <button
              className="w-full rounded-2xl bg-emerald-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
              type="submit" disabled={loading || !hasSupabase}
            >
              {loading ? "Signing in…" : "Enter Expedition Log"}
            </button>
            {!hasSupabase && (
              <p className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-100">
                Supabase env vars missing. Add them to <code>.env</code>.
              </p>
            )}
            {error && (
              <p className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-100">{error}</p>
            )}
          </form>
        </div>
      </div>
    </main>
  );
}

// ─── Top Nav ─────────────────────────────────────────────────────────────────
function TopNav() {
  const { role, signOut } = useApp();

  const linkClass = ({ isActive }) =>
    ["rounded-full px-4 py-2 text-sm font-medium transition",
      isActive
        ? "bg-slate-950 text-white shadow-md"
        : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
    ].join(" ");

  const mentorLinks = (
    <>
      <NavLink to="/"         className={linkClass}>Dashboard</NavLink>
      <NavLink to="/calendar" className={linkClass}>Calendar</NavLink>
      <NavLink to="/assign"   className={linkClass}>Assign Task</NavLink>
      <NavLink to="/notes"    className={linkClass}>Notes</NavLink>
    </>
  );

  const menteeLinks = (
    <>
      <NavLink to="/"         className={linkClass}>Dashboard</NavLink>
      <NavLink to="/calendar" className={linkClass}>Calendar</NavLink>
      <NavLink to="/inbox"    className={linkClass}>Inbox</NavLink>
      <NavLink to="/notes"    className={linkClass}>Notes</NavLink>
    </>
  );

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-700">
            Polaris: Paving the Pathway
          </p>
          <h2 className="text-lg font-semibold tracking-tight text-slate-950">
            {role === "mentor" ? "Mentor View — Prem" : "Mentee View — Sonya"}
          </h2>
        </div>
        <nav className="hidden items-center gap-2 md:flex">
          {role === "mentor" ? mentorLinks : menteeLinks}
        </nav>
        <button
          type="button" onClick={signOut}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
        >
          Sign out
        </button>
      </div>
      <div className="mx-auto flex w-full max-w-7xl gap-2 overflow-x-auto px-4 pb-4 md:hidden">
        {role === "mentor" ? mentorLinks : menteeLinks}
      </div>
    </header>
  );
}

// ─── Calendar (shared, role-aware) ───────────────────────────────────────────
function CalendarMonth({ selectedDate, onPickDate }) {
  const { tasks } = useApp();
  const [displayMonth, setDisplayMonth] = useState(
    startOfMonth(selectedDate ? new Date(`${selectedDate}T00:00:00`) : new Date())
  );

  useEffect(() => {
    if (selectedDate) setDisplayMonth(startOfMonth(new Date(`${selectedDate}T00:00:00`)));
  }, [selectedDate]);

  const today = isoDate();

  // Build a map: date → { total, accepted, completed }
  const byDate = useMemo(() => {
    const map = new Map();
    asArray(tasks).forEach(t => {
      const key = t.due_date;
      if (!key) return;
      const e = map.get(key) || { total: 0, accepted: 0, completed: 0, pending: 0 };
      e.total += 1;
      if (t.status === "accepted")  e.accepted  += 1;
      if (t.status === "completed") e.completed += 1;
      if (t.status === "pending")   e.pending   += 1;
      map.set(key, e);
    });
    return map;
  }, [tasks]);

  const monthDays = useMemo(() => buildCalendarGrid(displayMonth), [displayMonth]);

  const todayStats = byDate.get(today) || { total: 0, completed: 0 };
  const pct = todayStats.total ? Math.round((todayStats.completed / todayStats.total) * 100) : 0;

  const weatherTheme =
    pct >= 100 ? "sunny" : pct >= 50 ? "partly" : pct >= 10 ? "rain" : "storm";

  const weatherCard =
    weatherTheme === "sunny"  ? "bg-gradient-to-br from-amber-100 via-yellow-50 to-emerald-100 text-slate-950" :
    weatherTheme === "partly" ? "bg-gradient-to-br from-slate-100 via-slate-200 to-slate-300 text-slate-950" :
    weatherTheme === "rain"   ? "bg-gradient-to-br from-slate-200 via-slate-300 to-slate-400 text-slate-950" :
                                "bg-gradient-to-br from-slate-950 via-slate-800 to-slate-900 text-slate-100";

  return (
    <section className={`relative overflow-hidden rounded-[2rem] border border-white/40 p-4 shadow-sm md:p-6 ${weatherCard}`}>
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-700">Calendar</p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight">{formatShortMonth(displayMonth)}</h3>
        </div>
        <div className="rounded-full border border-white/60 bg-white/70 px-3 py-1 text-xs font-medium text-slate-700">
          Today: {pct}% complete
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between gap-3">
        <button type="button"
          onClick={() => setDisplayMonth(d => shiftMonth(d, -1))}
          className="rounded-full border border-slate-200 bg-white/85 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white"
        >← Previous</button>
        <span className="text-sm font-semibold text-slate-700">{displayMonth.getFullYear()}</span>
        <button type="button"
          onClick={() => setDisplayMonth(d => shiftMonth(d, 1))}
          className="rounded-full border border-slate-200 bg-white/85 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white"
        >Next →</button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-widest text-slate-500">
        {WEEKDAYS.map(d => <div key={d} className="py-2">{d}</div>)}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-1">
        {monthDays.map(day => {
          const key   = isoDate(day);
          const stats = byDate.get(key) || { total: 0, completed: 0, accepted: 0, pending: 0 };
          const muted = day.getMonth() !== displayMonth.getMonth();

          // Color: green if tasks exist and completed, amber if accepted/pending, default
          const cellColor =
            stats.completed > 0
              ? "bg-emerald-100 border-emerald-300 text-emerald-950"
              : stats.accepted > 0 || stats.pending > 0
              ? "bg-amber-50 border-amber-200 text-amber-950"
              : "bg-white/70 border-slate-200 text-slate-700";

          return (
            <button
              key={key} type="button"
              onClick={() => onPickDate(key)}
              className={[
                "min-h-16 rounded-xl border p-2 text-left transition hover:-translate-y-0.5 hover:shadow-md",
                muted ? "opacity-40" : "opacity-100",
                cellColor,
                selectedDate === key ? "ring-2 ring-slate-900 ring-offset-1" : ""
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-1">
                <span className="text-xs font-semibold">{day.getDate()}</span>
                {stats.total > 0 && (
                  <span className="text-[9px] font-bold">{stats.completed}/{stats.total}</span>
                )}
              </div>
              {stats.pending > 0 && (
                <div className="mt-1 text-[9px] leading-3 opacity-70">{stats.pending} pending</div>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ─── Milestone row ───────────────────────────────────────────────────────────
function MilestoneRow() {
  const { tasks } = useApp();
  const completedCount = useMemo(() => asArray(tasks).filter(t => t.status === "completed").length, [tasks]);

  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {MILESTONES.map(m => {
        const unlocked = completedCount >= m.count;
        return (
          <div key={m.count}
            className={["min-w-[148px] rounded-3xl border px-4 py-3 transition",
              unlocked
                ? "border-emerald-300 bg-emerald-50 text-emerald-950 shadow-sm"
                : "border-slate-200 bg-white text-slate-400"
            ].join(" ")}
          >
            <div className="flex items-center justify-between">
              <span className="text-2xl">{m.emoji}</span>
              <span className="text-xs font-bold uppercase tracking-widest">{m.count}</span>
            </div>
            <p className="mt-3 text-sm font-semibold">{m.label}</p>
            <p className="mt-1 text-[11px] leading-4 opacity-70">
              {unlocked ? "Unlocked" : "Locked"}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ─── Daily breakdown (calendar detail) ───────────────────────────────────────
function DailyBreakdownPanel({ selectedDate }) {
  const { tasks, dailyNotes, role, client, userId, refresh } = useApp();
  const [noteDraft, setNoteDraft] = useState("");
  const [saving,    setSaving]    = useState(false);

  const resolved = parseDateOrToday(selectedDate);

  const dayTasks = useMemo(
    () => asArray(tasks).filter(t => t.due_date === resolved),
    [tasks, resolved]
  );

  const selectedNote = useMemo(
    () => asArray(dailyNotes).find(n => n.date === resolved) || null,
    [dailyNotes, resolved]
  );

  useEffect(() => { setNoteDraft(selectedNote?.note_text || ""); }, [selectedNote?.id, resolved]);

  const saveNote = async () => {
    if (!noteDraft.trim() || !client || !userId) return;
    setSaving(true);
    await client.from("daily_notes").upsert(
      { user_id: userId, date: resolved, note_text: noteDraft.trim() },
      { onConflict: "user_id,date" }
    );
    setSaving(false);
    refresh();
  };

  const quoteIndex = hashString(resolved) % ENCOURAGING_QUOTES.length;

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm md:p-6">
      <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-700">Daily Breakdown</p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{formatLongDate(resolved)}</h3>
        </div>
        <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-medium text-slate-700">
          {dayTasks.length} task{dayTasks.length !== 1 ? "s" : ""}
        </div>
      </div>

      {dayTasks.length === 0 ? (
        <p className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          No tasks on this date.
        </p>
      ) : (
        <div className="grid gap-3">
          {dayTasks.map(task => (
            <TaskCard key={task.id} task={task} compact />
          ))}
        </div>
      )}

      {dayTasks.filter(t => t.status === "completed").length === 0 && dayTasks.length > 0 && (
        <div className="mt-4 rounded-[1.5rem] border border-amber-200 bg-amber-50 p-4 text-amber-950">
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">Motivation</p>
          <p className="mt-2 text-sm leading-6">{ENCOURAGING_QUOTES[quoteIndex]}</p>
        </div>
      )}

      <div className="mt-6 space-y-3">
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-slate-700">Field Note (One-liner)</span>
          <input
            value={noteDraft}
            onChange={e => setNoteDraft(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); saveNote(); } }}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-300/20"
            placeholder="A short note for this date…"
          />
        </label>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-slate-500">
            {selectedNote?.note_text
              ? <span>Saved: <span className="font-medium text-slate-900">{selectedNote.note_text}</span></span>
              : "No note saved yet."}
          </p>
          <button type="button" onClick={saveNote} disabled={saving || !noteDraft.trim()}
            className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50"
          >
            {saving ? "Saving…" : selectedNote?.note_text ? "Update Note" : "Save Note"}
          </button>
        </div>
      </div>
    </section>
  );
}

// ─── TaskCard (inline, used in calendar breakdown & lists) ───────────────────
function TaskCard({ task, compact = false }) {
  const { role, client, userId, refresh } = useApp();
  const [declineModal,    setDeclineModal]    = useState(false);
  const [declineReason,   setDeclineReason]   = useState("");
  const [feedbackDraft,   setFeedbackDraft]   = useState(task.mentor_feedback || "");
  const [ratingDraft,     setRatingDraft]     = useState(task.mentee_rating   || 5);
  const [reflectionDraft, setReflectionDraft] = useState(task.mentee_reflection || "");
  const [saving,          setSaving]          = useState(false);

  const update = async (patch) => {
    setSaving(true);
    await client.from("tasks").update(patch).eq("id", task.id);
    setSaving(false);
    refresh();
  };

  const statusBadge = {
    pending:   "bg-amber-100 text-amber-800",
    accepted:  "bg-blue-100 text-blue-800",
    declined:  "bg-rose-100 text-rose-800",
    completed: "bg-emerald-100 text-emerald-800"
  }[task.status] || "";

  return (
    <article className={["rounded-2xl border p-4 transition",
      task.status === "completed" ? "border-emerald-200 bg-emerald-50 opacity-75" :
      task.status === "declined"  ? "border-rose-200 bg-rose-50" :
      task.status === "accepted"  ? "border-blue-200 bg-blue-50" :
      "border-slate-200 bg-slate-50"
    ].join(" ")}>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className={["font-semibold text-slate-950 leading-snug", task.status === "completed" ? "line-through opacity-60" : ""].join(" ")}>
            {task.title}
          </p>
          {!compact && task.description && (
            <p className="mt-1 text-sm text-slate-600 leading-5">{task.description}</p>
          )}
          <p className="mt-1 text-xs text-slate-500">Due {task.due_date}</p>
          {task.resource_link && (
            <a href={task.resource_link} target="_blank" rel="noreferrer"
              className="mt-1 inline-block text-xs text-emerald-700 underline underline-offset-2">
              Resource ↗
            </a>
          )}
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusBadge}`}>
          {task.status}
        </span>
      </div>

      {/* ── MENTEE ACTIONS ────────────────────────────────── */}
      {role === "mentee" && (
        <>
          {/* Pending: accept or decline */}
          {task.status === "pending" && (
            <div className="mt-3 flex gap-2 flex-wrap">
              <button type="button" disabled={saving}
                onClick={() => update({ status: "accepted" })}
                className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400 disabled:opacity-50"
              >Accept</button>
              <button type="button"
                onClick={() => setDeclineModal(true)}
                className="rounded-full border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50"
              >Decline</button>
            </div>
          )}

          {/* Accepted: show completion form */}
          {task.status === "accepted" && (
            <div className="mt-3 space-y-3 border-t border-blue-200 pt-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-blue-700">Submit completion</p>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-700">Interest Rating: {ratingDraft}/10</span>
                <input type="range" min={1} max={10} value={ratingDraft}
                  onChange={e => setRatingDraft(Number(e.target.value))}
                  className="w-full accent-emerald-500"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-700">Reflection</span>
                <textarea rows={2} value={reflectionDraft}
                  onChange={e => setReflectionDraft(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-300"
                  placeholder="What did you take away from this task?"
                />
              </label>
              <button type="button" disabled={saving || !reflectionDraft.trim()}
                onClick={() => update({ status: "completed", mentee_rating: ratingDraft, mentee_reflection: reflectionDraft.trim() })}
                className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {saving ? "Submitting…" : "Mark Complete"}
              </button>
            </div>
          )}

          {/* Completed: read-only view */}
          {task.status === "completed" && (
            <div className="mt-3 border-t border-emerald-200 pt-3 space-y-1">
              <p className="text-xs text-emerald-700 font-semibold">Your submission</p>
              <p className="text-sm text-slate-700">Rating: <strong>{task.mentee_rating}/10</strong></p>
              <p className="text-sm text-slate-700">Reflection: {task.mentee_reflection}</p>
              {task.mentor_feedback && (
                <p className="mt-2 text-sm text-emerald-800">
                  Mentor reply: <strong>{task.mentor_emoji} {task.mentor_feedback}</strong>
                </p>
              )}
            </div>
          )}

          {/* Declined: show reason */}
          {task.status === "declined" && task.rejection_reason && (
            <p className="mt-2 text-sm text-rose-700">Your note: {task.rejection_reason}</p>
          )}
        </>
      )}

      {/* ── MENTOR ACTIONS ────────────────────────────────── */}
      {role === "mentor" && (
        <>
          {task.status === "declined" && task.rejection_reason && (
            <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-rose-700">Declined by mentee</p>
              <p className="mt-1 text-sm text-rose-900">"{task.rejection_reason}"</p>
            </div>
          )}

          {task.status === "completed" && (
            <div className="mt-3 space-y-3 border-t border-emerald-200 pt-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">Mentee submission</p>
              <p className="text-sm text-slate-700">Rating: <strong>{task.mentee_rating}/10</strong></p>
              <p className="text-sm text-slate-700">Reflection: {task.mentee_reflection}</p>

              {task.mentor_feedback ? (
                <p className="text-sm text-slate-600">Your reply: {task.mentor_emoji} {task.mentor_feedback}</p>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2 flex-wrap">
                    {QUICK_EMOJIS.map(emoji => (
                      <button key={emoji} type="button"
                        onClick={() => update({ mentor_emoji: emoji })}
                        className={["rounded-full border px-3 py-1 text-sm transition",
                          task.mentor_emoji === emoji
                            ? "border-emerald-400 bg-emerald-100"
                            : "border-slate-200 bg-white hover:bg-slate-50"
                        ].join(" ")}
                      >{emoji}</button>
                    ))}
                  </div>
                  <input value={feedbackDraft} onChange={e => setFeedbackDraft(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-300"
                    placeholder="One-liner reply to mentee…"
                  />
                  <button type="button" disabled={saving || !feedbackDraft.trim()}
                    onClick={() => update({ mentor_feedback: feedbackDraft.trim() })}
                    className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400 disabled:opacity-50"
                  >{saving ? "Saving…" : "Send Reply"}</button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── DECLINE MODAL ─────────────────────────────────── */}
      {declineModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl">
            <p className="text-xs font-semibold uppercase tracking-widest text-rose-700">Decline Task</p>
            <h3 className="mt-2 text-lg font-semibold text-slate-950">Why are you declining?</h3>
            <p className="mt-1 text-sm text-slate-600">Required — one clear sentence for your mentor.</p>
            <textarea rows={3} value={declineReason}
              onChange={e => setDeclineReason(e.target.value)}
              className="mt-4 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-950 outline-none focus:border-rose-300"
              placeholder="I need more time / this conflicts with…"
            />
            <div className="mt-4 flex gap-3">
              <button type="button"
                onClick={() => { setDeclineModal(false); setDeclineReason(""); }}
                className="flex-1 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >Cancel</button>
              <button type="button"
                disabled={saving || !declineReason.trim()}
                onClick={async () => {
                  await update({ status: "declined", rejection_reason: declineReason.trim() });
                  setDeclineModal(false);
                  setDeclineReason("");
                }}
                className="flex-1 rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-400 disabled:opacity-50"
              >{saving ? "Sending…" : "Send Decline"}</button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE: Dashboard (shared, role-aware hero)
// ═══════════════════════════════════════════════════════════════════════════
function DashboardPage() {
  const { tasks, role } = useApp();
  const params   = useParams();
  const navigate = useNavigate();
  const selectedDate = parseDateOrToday(params.date || isoDate());

  const completedCount = useMemo(
    () => asArray(tasks).filter(t => t.status === "completed").length,
    [tasks]
  );

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 space-y-6">
      {/* Hero stat bar */}
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-700">Expedition Log</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 md:text-5xl">
          {role === "mentor" ? "Mentor Dashboard" : "Mentee Dashboard"}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          {role === "mentor"
            ? "Assign tasks, track mentee progress, and celebrate completions."
            : "Check your task inbox, manage accepted tasks, and submit reflections."}
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Completed Tasks</p>
            <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{completedCount}</div>
            <p className="mt-1 text-sm text-slate-500">Unlock badges every 5 completions.</p>
          </div>
          <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Elevation Gain</p>
            <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              {completedCount * 10} ft
            </div>
            <p className="mt-1 text-sm text-slate-500">Every completed task adds 10 ft.</p>
          </div>
        </div>

        <div className="mt-6">
          <MilestoneRow />
        </div>
      </section>

      <CalendarMonth
        selectedDate={selectedDate}
        onPickDate={date => navigate(`/day/${date}`)}
      />

      <DailyBreakdownPanel selectedDate={selectedDate} />
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE: Calendar
// ═══════════════════════════════════════════════════════════════════════════
function CalendarPage() {
  const params   = useParams();
  const navigate = useNavigate();
  const selectedDate = parseDateOrToday(params.date || isoDate());

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 space-y-6">
      <CalendarMonth
        selectedDate={selectedDate}
        onPickDate={date => navigate(`/calendar/${date}`)}
      />
      <DailyBreakdownPanel selectedDate={selectedDate} />
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE: Mentor — Assign Task
// ═══════════════════════════════════════════════════════════════════════════
function AssignTaskPage() {
  const { client, userId, tasks, refresh } = useApp();
  const [title,       setTitle]       = useState("");
  const [description, setDescription] = useState("");
  const [dueDate,     setDueDate]     = useState(isoDate());
  const [resource,    setResource]    = useState("");
  const [saving,      setSaving]      = useState(false);
  const [success,     setSuccess]     = useState(false);

  const accepted  = useMemo(() => asArray(tasks).filter(t => t.status === "accepted"),  [tasks]);
  const declined  = useMemo(() => asArray(tasks).filter(t => t.status === "declined"),  [tasks]);
  const completed = useMemo(() => asArray(tasks).filter(t => t.status === "completed"), [tasks]);

  const submit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    await client.from("tasks").insert({
      mentor_id:     userId,
      mentee_id:     MENTEE_ID,
      title:         title.trim(),
      description:   description.trim(),
      due_date:      dueDate,
      resource_link: resource.trim() || null,
      status:        "pending"
    });
    setTitle(""); setDescription(""); setDueDate(isoDate()); setResource("");
    setSaving(false); setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
    refresh();
  };

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 space-y-6">

      {/* Task creator */}
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-700">Assign a Task</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Create new assignment</h1>
        <p className="mt-1 text-sm text-slate-600">This will appear in Sonya's inbox immediately.</p>

        <div className="mt-6 space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-slate-700">Task Title *</span>
            <input value={title} onChange={e => setTitle(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-300/20"
              placeholder="Read chapter 3 of Deep Work…"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-slate-700">Description / Reason</span>
            <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-300/20"
              placeholder="Why this task matters and what you want the mentee to get out of it…"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-slate-700">Due Date</span>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none focus:border-emerald-300"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-slate-700">Resource Link (optional)</span>
              <input value={resource} onChange={e => setResource(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none focus:border-emerald-300"
                placeholder="YouTube URL, website, book title…"
              />
            </label>
          </div>

          <div className="flex items-center gap-4">
            <button type="button" disabled={saving || !title.trim()} onClick={submit}
              className="rounded-full bg-slate-950 px-6 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
            >{saving ? "Assigning…" : "Assign Task →"}</button>
            {success && (
              <p className="text-sm font-medium text-emerald-700">✓ Task sent to Sonya's inbox!</p>
            )}
          </div>
        </div>
      </section>

      {/* Active dashboard: accepted */}
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-700 mb-1">Assigned & Accepted</p>
        <h2 className="text-xl font-semibold text-slate-950 mb-4">Tasks in progress</h2>
        {accepted.length === 0
          ? <p className="text-sm text-slate-500">No accepted tasks yet.</p>
          : <div className="grid gap-3 md:grid-cols-2">{accepted.map(t => <TaskCard key={t.id} task={t} />)}</div>
        }
      </section>

      {/* Declined */}
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-rose-700 mb-1">Declined / Returned</p>
        <h2 className="text-xl font-semibold text-slate-950 mb-4">Mentee explanations</h2>
        {declined.length === 0
          ? <p className="text-sm text-slate-500">No declined tasks.</p>
          : <div className="grid gap-3 md:grid-cols-2">{declined.map(t => <TaskCard key={t.id} task={t} />)}</div>
        }
      </section>

      {/* Completed reviews */}
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700 mb-1">Completed Reviews</p>
        <h2 className="text-xl font-semibold text-slate-950 mb-4">Leave feedback</h2>
        {completed.length === 0
          ? <p className="text-sm text-slate-500">No completed tasks yet.</p>
          : <div className="grid gap-3 md:grid-cols-2">{completed.map(t => <TaskCard key={t.id} task={t} />)}</div>
        }
      </section>
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE: Mentee — Inbox
// ═══════════════════════════════════════════════════════════════════════════
function InboxPage() {
  const { tasks } = useApp();

  const pending   = useMemo(() => asArray(tasks).filter(t => t.status === "pending"),   [tasks]);
  const accepted  = useMemo(() => asArray(tasks).filter(t => t.status === "accepted"),  [tasks]);
  const declined  = useMemo(() => asArray(tasks).filter(t => t.status === "declined"),  [tasks]);
  const completed = useMemo(() => asArray(tasks).filter(t => t.status === "completed"), [tasks]);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 space-y-6">

      {/* Pending inbox */}
      <section className="rounded-[2rem] border border-amber-200 bg-amber-50 p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-700 mb-1">Pending Inbox</p>
        <h1 className="text-2xl font-semibold text-slate-950 mb-4">
          {pending.length > 0 ? `${pending.length} new assignment${pending.length > 1 ? "s" : ""} from Prem` : "Inbox clear"}
        </h1>
        {pending.length === 0
          ? <p className="text-sm text-slate-600">No pending tasks. You're all caught up!</p>
          : <div className="grid gap-3 md:grid-cols-2">{pending.map(t => <TaskCard key={t.id} task={t} />)}</div>
        }
      </section>

      {/* Accepted — active tasks */}
      <section className="rounded-[2rem] border border-blue-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-700 mb-1">Active Tasks</p>
        <h2 className="text-xl font-semibold text-slate-950 mb-4">Accepted & in progress</h2>
        {accepted.length === 0
          ? <p className="text-sm text-slate-500">No active tasks.</p>
          : <div className="grid gap-3 md:grid-cols-2">{accepted.map(t => <TaskCard key={t.id} task={t} />)}</div>
        }
      </section>

      {/* Completed */}
      <section className="rounded-[2rem] border border-emerald-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700 mb-1">Completed</p>
        <h2 className="text-xl font-semibold text-slate-950 mb-4">Permanent record</h2>
        {completed.length === 0
          ? <p className="text-sm text-slate-500">Nothing completed yet.</p>
          : <div className="grid gap-3 md:grid-cols-2">{completed.map(t => <TaskCard key={t.id} task={t} />)}</div>
        }
      </section>

      {/* Declined */}
      {declined.length > 0 && (
        <section className="rounded-[2rem] border border-rose-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-rose-700 mb-1">Declined</p>
          <h2 className="text-xl font-semibold text-slate-950 mb-4">Tasks you declined</h2>
          <div className="grid gap-3 md:grid-cols-2">{declined.map(t => <TaskCard key={t.id} task={t} />)}</div>
        </section>
      )}
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE: Notes
// ═══════════════════════════════════════════════════════════════════════════
function NotesPage() {
  const { dailyNotes } = useApp();
  const navigate = useNavigate();
  const notes = asArray(dailyNotes);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-700">Notes</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Daily field notes</h1>
        <p className="mt-1 text-sm text-slate-600">One-liner archive per date.</p>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {notes.length === 0
            ? <p className="text-sm text-slate-500">No notes saved yet.</p>
            : notes.map(note => (
              <button key={note.id} type="button"
                onClick={() => navigate(`/day/${note.date}`)}
                className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{note.date}</p>
                <p className="mt-2 text-sm leading-6 text-slate-950">{note.note_text}</p>
              </button>
            ))
          }
        </div>
      </section>
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════════════
function AppRoutes() {
  const { role } = useApp();

  return (
    <>
      <TopNav />
      <AppErrorBoundary>
        <Routes>
          <Route path="/"              element={<DashboardPage />} />
          <Route path="/day/:date"     element={<DashboardPage />} />
          <Route path="/calendar"      element={<CalendarPage  />} />
          <Route path="/calendar/:date" element={<CalendarPage />} />
          <Route path="/notes"         element={<NotesPage     />} />
          {role === "mentor" && <Route path="/assign" element={<AssignTaskPage />} />}
          {role === "mentee" && <Route path="/inbox"  element={<InboxPage      />} />}
          <Route path="*"              element={<Navigate to="/" replace />} />
        </Routes>
      </AppErrorBoundary>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ROOT
// ═══════════════════════════════════════════════════════════════════════════
export default function App() {
  const [session,     setSession]     = useState(null);
  const [authLoading, setAuthLoading] = useState(Boolean(SUPABASE_CLIENT));
  const [authError,   setAuthError]   = useState("");
  const [appReady,    setAppReady]    = useState(false);

  const client = SUPABASE_CLIENT;
  const userId = session?.user?.id || "";
  const role   = userId === MENTOR_ID ? "mentor" : userId === MENTEE_ID ? "mentee" : null;

  const tasksState = useTasks(client, userId, role);
  const notesState = useDailyNotes(client, userId);

  // Combined refresh
  const refresh = useCallback(() => {
    tasksState.refresh();
    notesState.refresh();
  }, [tasksState.refresh, notesState.refresh]);

  useEffect(() => {
    let alive = true, sub = null;
    async function init() {
      if (!client) { setAppReady(true); setAuthLoading(false); return; }
      const { data, error } = await client.auth.getSession();
      if (!alive) return;
      if (error) setAuthError(error.message);
      setSession(data.session || null);
      setAuthLoading(false);
      setAppReady(true);
      const listener = client.auth.onAuthStateChange((_e, s) => { if (alive) setSession(s || null); });
      sub = listener.data.subscription;
    }
    init();
    return () => { alive = false; sub?.unsubscribe(); };
  }, [client]);

  const signIn = async (email, password) => {
    if (!client) return;
    setAuthLoading(true); setAuthError("");
    const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
    setAuthLoading(false);
    if (error) setAuthError(error.message);
  };

  const signOut = async () => { if (client) await client.auth.signOut(); };

  const ctx = useMemo(() => ({
    client, session, userId, role,
    tasks:      tasksState.tasks,
    tasksLoading: tasksState.loading,
    dailyNotes: notesState.dailyNotes,
    refresh, signOut
  }), [client, session, userId, role, tasksState.tasks, tasksState.loading, notesState.dailyNotes]);

  if (!appReady) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="rounded-[2rem] border border-white/10 bg-white/5 px-6 py-8 text-center backdrop-blur">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-200">Expedition Log</p>
          <h1 className="mt-3 text-3xl font-semibold">Loading secure session…</h1>
        </div>
      </main>
    );
  }

  if (!session) {
    return <LoginScreen onSignIn={signIn} loading={authLoading} error={authError} />;
  }

  if (!role) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="rounded-[2rem] border border-rose-400/20 bg-rose-400/10 px-6 py-8 text-center max-w-sm">
          <p className="text-rose-200 font-semibold">This account isn't registered as a Mentor or Mentee.</p>
          <button type="button" onClick={signOut}
            className="mt-4 rounded-full border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/10"
          >Sign out</button>
        </div>
      </main>
    );
  }

  return (
    <AppContext.Provider value={ctx}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppContext.Provider>
  );
}
