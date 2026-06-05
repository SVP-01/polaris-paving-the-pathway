import React, {
  createContext,
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

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const hasSupabase = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const SUPABASE_CLIENT = hasSupabase
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

const MILSTONES = [
  { count: 5, label: "Campfire", emoji: "🪵" },
  { count: 10, label: "Hiking Boots", emoji: "🥾" },
  { count: 15, label: "Compass", emoji: "🗺️" },
  { count: 20, label: "Pine Tree", emoji: "🌲" },
  { count: 25, label: "Summit", emoji: "🏔️" }
];

const ENCOURAGING_QUOTES = [
  "A mountain is climbed one step at a time.",
  "The expedition is still waiting for you.",
  "Small moves still change the map.",
  "Today can be the first marker on a new trail.",
  "Momentum often starts quietly."
];

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const ExpeditionContext = createContext(null);

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || "Something went wrong rendering the dashboard." };
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="min-h-screen bg-slate-100 px-4 py-16 text-slate-950">
          <div className="mx-auto w-full max-w-2xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-rose-600">
              Rendering error
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">The dashboard paused instead of loading.</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">{this.state.message}</p>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}

function useExpedition() {
  const context = useContext(ExpeditionContext);
  if (!context) {
    throw new Error("useExpedition must be used within ExpeditionContext.");
  }
  return context;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function isoDate(dateLike = new Date()) {
  const date = new Date(dateLike);
  return date.toISOString().slice(0, 10);
}

function parseDateOrToday(value) {
  if (!value) return isoDate();
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? isoDate() : isoDate(date);
}

function formatLongDate(value) {
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function formatShortMonth(date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric"
  }).format(date);
}

function startOfMonth(date) {
  const next = new Date(date);
  next.setDate(1);
  next.setHours(0, 0, 0, 0);
  return next;
}

function shiftMonth(date, delta) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + delta);
  return startOfMonth(next);
}

function getMondayIndex(date) {
  const day = date.getDay();
  return day === 0 ? 6 : day - 1;
}

function buildCalendarGrid(monthDate) {
  const start = startOfMonth(monthDate);
  const gridStart = new Date(start);
  gridStart.setDate(start.getDate() - getMondayIndex(start));
  const days = [];
  for (let i = 0; i < 42; i += 1) {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + i);
    days.push(day);
  }
  return days;
}

function hashString(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function normalizeTaskRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title || "",
    completed: Boolean(row.completed),
    due_date: row.due_date || isoDate(),
    created_at: row.created_at || "",
    updated_at: row.updated_at || ""
  };
}

function normalizeDailyNoteRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    user_id: row.user_id,
    date: row.date || isoDate(),
    note_text: row.note_text || "",
    created_at: row.created_at || "",
    updated_at: row.updated_at || ""
  };
}

function useUserTasks(client, userId) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(Boolean(client && userId));
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let alive = true;
    let channel = null;

    if (!client || !userId) {
      setTasks([]);
      setLoading(false);
      setError("");
      return undefined;
    }

    async function sync() {
      setLoading(true);
      const { data, error: queryError } = await client
        .from("tasks")
        .select("*")
        .eq("user_id", userId)
        .order("due_date", { ascending: true })
        .order("created_at", { ascending: false });

      if (!alive) return;
      if (queryError) {
        setTasks([]);
        setError(queryError.message);
      } else {
        setTasks(asArray(data).map(normalizeTaskRow).filter(Boolean));
        setError("");
      }
      setLoading(false);
    }

    sync();

    channel = client
      .channel(`tasks-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks", filter: `user_id=eq.${userId}` },
        () => sync()
      )
      .subscribe();

    return () => {
      alive = false;
      if (channel) client.removeChannel(channel);
    };
  }, [client, userId, revision]);

  return {
    tasks,
    loading,
    error,
    refresh: () => setRevision((value) => value + 1)
  };
}

function useDailyNotes(client, userId) {
  const [dailyNotes, setDailyNotes] = useState([]);
  const [loading, setLoading] = useState(Boolean(client && userId));
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let alive = true;
    let channel = null;

    if (!client || !userId) {
      setDailyNotes([]);
      setLoading(false);
      setError("");
      return undefined;
    }

    async function sync() {
      setLoading(true);
      const { data, error: queryError } = await client
        .from("daily_notes")
        .select("*")
        .eq("user_id", userId)
        .order("date", { ascending: false });

      if (!alive) return;
      if (queryError) {
        setDailyNotes([]);
        setError(queryError.message);
      } else {
        setDailyNotes(asArray(data).map(normalizeDailyNoteRow).filter(Boolean));
        setError("");
      }
      setLoading(false);
    }

    sync();

    channel = client
      .channel(`daily-notes-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "daily_notes", filter: `user_id=eq.${userId}` },
        () => sync()
      )
      .subscribe();

    return () => {
      alive = false;
      if (channel) client.removeChannel(channel);
    };
  }, [client, userId, revision]);

  return {
    dailyNotes,
    loading,
    error,
    refresh: () => setRevision((value) => value + 1)
  };
}

function useCurrentMonth(initialDate = new Date()) {
  const [monthDate, setMonthDate] = useState(startOfMonth(initialDate));

  return [monthDate, setMonthDate];
}

function LoginScreen({ onSignIn, loading, error }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-4 py-10">
        <div className="grid w-full gap-8 rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur md:grid-cols-[1.1fr_0.9fr] md:p-8">
          <section className="space-y-6">
            <div className="inline-flex rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-emerald-200">
              Polaris: Paving the Pathway
            </div>
            <div className="space-y-4">
              <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-white md:text-6xl">
                Field-ready planning for the road ahead.
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
                Sign in to view your private task map, daily notes, and the month’s progress
                across the expedition.
              </p>
            </div>
          </section>

          <form
            className="space-y-4 rounded-[1.5rem] border border-white/10 bg-slate-900/75 p-5"
            onSubmit={(event) => {
              event.preventDefault();
              onSignIn(email, password);
            }}
          >
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-300">Email</span>
              <input
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-emerald-300/50 focus:ring-2 focus:ring-emerald-300/20"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-300">Password</span>
              <input
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-emerald-300/50 focus:ring-2 focus:ring-emerald-300/20"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
              />
            </label>

            <button
              className="w-full rounded-2xl bg-emerald-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
              type="submit"
              disabled={loading || !hasSupabase}
            >
              {loading ? "Signing in..." : "Enter Expedition Log"}
            </button>

            {!hasSupabase ? (
              <p className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-100">
                Supabase environment variables are missing. Add them to `.env` to enable login.
              </p>
            ) : null}

            {error ? (
              <p className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-100">
                {error}
              </p>
            ) : null}
          </form>
        </div>
      </div>
    </main>
  );
}

function TopNav() {
  const { signOut } = useExpedition();

  const linkClass = ({ isActive }) =>
    [
      "rounded-full px-4 py-2 text-sm font-medium transition",
      isActive
        ? "bg-slate-950 text-white shadow-md"
        : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
    ].join(" ");

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-700">
            Polaris: Paving the Pathway
          </p>
          <h2 className="text-lg font-semibold tracking-tight text-slate-950">
            Daily terrain, mapped cleanly.
          </h2>
        </div>

        <nav className="hidden items-center gap-2 md:flex">
          <NavLink to="/" className={linkClass}>
            Dashboard
          </NavLink>
          <NavLink to="/calendar" className={linkClass}>
            Calendar
          </NavLink>
          <NavLink to="/tasks" className={linkClass}>
            Tasks
          </NavLink>
          <NavLink to="/notes" className={linkClass}>
            Notes
          </NavLink>
        </nav>

        <button
          type="button"
          onClick={signOut}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
        >
          Sign out
        </button>
      </div>

      <div className="mx-auto flex w-full max-w-7xl gap-2 overflow-x-auto px-4 pb-4 md:hidden">
        <NavLink to="/" className={linkClass}>
          Dashboard
        </NavLink>
        <NavLink to="/calendar" className={linkClass}>
          Calendar
        </NavLink>
        <NavLink to="/tasks" className={linkClass}>
          Tasks
        </NavLink>
        <NavLink to="/notes" className={linkClass}>
          Notes
        </NavLink>
      </div>
    </header>
  );
}

function MilestoneRow() {
  const { completedCount } = useExpedition();

  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {MILSTONES.map((milestone) => {
        const unlocked = completedCount >= milestone.count;
        return (
          <div
            key={milestone.count}
            className={[
              "min-w-[160px] rounded-3xl border px-4 py-3 transition",
              unlocked
                ? "border-emerald-300 bg-emerald-50 text-emerald-950 shadow-sm"
                : "border-slate-200 bg-white text-slate-500"
            ].join(" ")}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-2xl">{milestone.emoji}</span>
              <span className="text-xs font-semibold uppercase tracking-[0.3em]">
                {milestone.count}
              </span>
            </div>
            <p className="mt-3 text-sm font-semibold">{milestone.label}</p>
            <p className="mt-1 text-xs leading-5 text-current/70">
              {unlocked ? "Unlocked" : "Locked until progress reaches this interval"}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function HeroVideo() {
  const videoRef = useRef(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleVisibilityChange = () => {
      const video = videoRef.current;
      if (!video) return;

      if (document.hidden) {
        video.muted = true;
        return;
      }

      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      const rect = wrapper.getBoundingClientRect();
      const isVisible = rect.top < window.innerHeight && rect.bottom > 0 && rect.left < window.innerWidth && rect.right > 0;

      if (isVisible) {
        video.muted = false;
        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch(() => {
            const currentVideo = videoRef.current;
            if (currentVideo) {
              currentVideo.muted = true;
            }
          });
        }
      } else {
        video.muted = true;
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    handleVisibilityChange();

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return (
    <div className="my-10 flex justify-center py-2">
      <div ref={wrapperRef} className="w-full max-w-4xl overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-950 shadow-[0_24px_90px_rgba(15,23,42,0.2)]">
        <video
          ref={videoRef}
          className="block h-auto w-full object-cover"
          src="/expedition-home.mp4"
          autoPlay
          loop
          controls
          playsInline
          preload="auto"
        />
      </div>
    </div>
  );
}

function CalendarMonth({ selectedDate, onPickDate }) {
  const { tasks } = useExpedition();
  const [displayMonth, setDisplayMonth] = useCurrentMonth(
    selectedDate ? new Date(`${selectedDate}T00:00:00`) : new Date()
  );

  useEffect(() => {
    if (selectedDate) {
      const next = new Date(`${selectedDate}T00:00:00`);
      setDisplayMonth(startOfMonth(next));
    }
  }, [selectedDate]);

  const tasksArray = asArray(tasks);
  const byDate = useMemo(() => {
    const map = new Map();
    tasksArray.forEach((task) => {
      const key = task.due_date || isoDate();
      const existing = map.get(key) || { total: 0, completed: 0, pending: 0 };
      existing.total += 1;
      if (task.completed) existing.completed += 1;
      else existing.pending += 1;
      map.set(key, existing);
    });
    return map;
  }, [tasksArray]);

  const monthDays = useMemo(() => buildCalendarGrid(displayMonth), [displayMonth]);
  const currentMonthIndex = displayMonth.getMonth();
  const currentYear = displayMonth.getFullYear();

  const today = isoDate();
  const todayStats = byDate.get(today) || { total: 0, completed: 0, pending: 0 };
  const completionPercent = todayStats.total
    ? Math.round((todayStats.completed / todayStats.total) * 100)
    : 0;

  const weatherTheme =
    completionPercent >= 100
      ? "sunny"
      : completionPercent >= 50
        ? "partly"
        : completionPercent >= 10
          ? "rain"
          : "storm";

  const selectedWeather =
    weatherTheme === "sunny"
      ? {
          label: "Sunny",
          card: "bg-gradient-to-br from-amber-100 via-yellow-50 to-emerald-100 text-slate-950"
        }
      : weatherTheme === "partly"
        ? {
            label: "Partly Cloudy",
            card: "bg-gradient-to-br from-slate-100 via-slate-200 to-slate-300 text-slate-950"
          }
        : weatherTheme === "rain"
          ? {
              label: "Raining",
              card: "bg-gradient-to-br from-slate-200 via-slate-300 to-slate-400 text-slate-950"
            }
          : {
              label: "Storming",
              card: "bg-gradient-to-br from-slate-950 via-slate-800 to-slate-900 text-slate-100"
            };

  return (
    <section
      className={[
        "relative overflow-hidden rounded-[2rem] border border-white/40 p-4 shadow-sm transition-all duration-500 ease-out md:p-6",
        selectedWeather.card,
        weatherTheme === "storm" ? "weather-stormy" : ""
      ].join(" ")}
    >
      {weatherTheme === "storm" ? <div className="weather-storm-overlay" /> : null}

      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-700">
            Green Calendar
          </p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
            {formatShortMonth(displayMonth)}
          </h3>
        </div>

        <div className="flex items-center gap-3">
          <div className="inline-flex items-center rounded-full border border-white/60 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-800 shadow-sm">
            <span>{selectedWeather.label}</span>
            <span className="ml-2 text-[10px] font-black text-slate-500">▼</span>
          </div>

          <div className="rounded-full border border-white/60 bg-white/70 px-3 py-1 text-xs font-medium text-slate-700">
            Today: {completionPercent}% complete
          </div>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setDisplayMonth((date) => shiftMonth(date, -1))}
          className="rounded-full border border-slate-200 bg-white/85 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-white"
        >
          ← Previous
        </button>

        <div className="text-sm font-semibold text-slate-700">
          {currentYear}
        </div>

        <button
          type="button"
          onClick={() => setDisplayMonth((date) => shiftMonth(date, 1))}
          className="rounded-full border border-slate-200 bg-white/85 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-white"
        >
          Next →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">
        {WEEKDAYS.map((day) => (
          <div key={day} className="py-2">
            {day}
          </div>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-2">
        {monthDays.map((day) => {
          const dateKey = isoDate(day);
          const stats = byDate.get(dateKey) || { total: 0, completed: 0, pending: 0 };
          const unlocked =
            stats.completed >= 3
              ? "bg-emerald-700 text-white border-emerald-800"
              : stats.completed >= 1
                ? "bg-emerald-100 text-emerald-950 border-emerald-200"
                : "bg-rose-100 text-rose-900 border-rose-200";
          const muted = day.getMonth() !== currentMonthIndex;

          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => onPickDate(dateKey)}
              className={[
                "min-h-24 rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-md",
                muted ? "opacity-45" : "opacity-100",
                unlocked,
                selectedDate === dateKey ? "ring-2 ring-slate-900 ring-offset-1" : ""
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-semibold">{day.getDate()}</span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.2em]">
                  {stats.completed}
                </span>
              </div>
              <div className="mt-4 text-[11px] leading-4 opacity-80">
                {stats.completed === 0
                  ? "0 complete"
                  : stats.completed === 1
                    ? "1 task complete"
                    : `${stats.completed} tasks complete`}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function DailyBreakdownPanel({ selectedDate }) {
  const { tasks, dailyNotes, addDailyNote, toggleTask } = useExpedition();
  const [noteDraft, setNoteDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const resolvedDate = parseDateOrToday(selectedDate);
  const selectedTaskList = useMemo(
    () => asArray(tasks).filter((task) => task.due_date === resolvedDate),
    [tasks, resolvedDate]
  );
  const selectedNote = useMemo(
    () => asArray(dailyNotes).find((note) => note.date === resolvedDate) || null,
    [dailyNotes, resolvedDate]
  );

  useEffect(() => {
    setNoteDraft(selectedNote?.note_text || "");
  }, [selectedNote?.id, resolvedDate]);

  const pendingTasks = selectedTaskList.filter((task) => !task.completed);
  const completedTasks = selectedTaskList.filter((task) => task.completed);
  const completedCount = completedTasks.length;

  const quoteIndex = hashString(resolvedDate) % ENCOURAGING_QUOTES.length;
  const motivation = ENCOURAGING_QUOTES[quoteIndex];

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm md:p-6">
      <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-700">
            Daily Breakdown
          </p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
            {formatLongDate(resolvedDate)}
          </h3>
        </div>

        <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-medium text-slate-700">
          {selectedTaskList.length} tasks on this date
        </div>
      </div>

      {selectedTaskList.length ? (
        <div className="grid gap-4">
          <div>
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-[0.28em] text-slate-500">
              Pending Tasks
            </h4>
            <div className="grid gap-3">
              {pendingTasks.length ? (
                pendingTasks.map((task) => (
                  <article
                    key={task.id}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                  >
                    <div>
                      <p className="font-medium text-slate-950">{task.title}</p>
                      <p className="text-xs text-slate-500">Due {task.due_date}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleTask(task.id, !task.completed)}
                      className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                    >
                      Mark complete
                    </button>
                  </article>
                ))
              ) : (
                <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  No pending tasks for this date.
                </p>
              )}
            </div>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-[0.28em] text-slate-500">
              Completed Tasks
            </h4>
            <div className="grid gap-3">
              {completedTasks.length ? (
                completedTasks.map((task) => (
                  <article
                    key={task.id}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 opacity-70"
                  >
                    <div>
                      <p className="font-medium text-slate-700 line-through">{task.title}</p>
                      <p className="text-xs text-slate-500">Completed</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleTask(task.id, false)}
                      className="rounded-full border border-emerald-300 bg-white px-4 py-2 text-sm font-medium text-emerald-900 transition hover:bg-emerald-100"
                    >
                      Undo
                    </button>
                  </article>
                ))
              ) : (
                <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                  No completed tasks yet for this day.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
          No tasks were scheduled on this date.
        </div>
      )}

      {completedCount === 0 ? (
        <div className="mt-5 rounded-[1.5rem] border border-amber-200 bg-amber-50 p-4 text-amber-950">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-700">
            Red Day Motivation
          </p>
          <p className="mt-2 text-sm leading-6">{motivation}</p>
        </div>
      ) : null}

      <form
        className="mt-6 space-y-3"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!noteDraft.trim()) return;
          setSaving(true);
          await addDailyNote(resolvedDate, noteDraft.trim());
          setSaving(false);
        }}
      >
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-slate-700">
            Today&apos;s Field Note (One-liner)
          </span>
          <input
            value={noteDraft}
            onChange={(event) => setNoteDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-300/20"
            placeholder="A short localized note for this date..."
          />
        </label>

        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-slate-500">
            {selectedNote?.note_text ? (
              <span>
                Saved note: <span className="font-medium text-slate-900">{selectedNote.note_text}</span>
              </span>
            ) : (
              "No field note saved for this day yet."
            )}
          </p>

          <button
            type="submit"
            disabled={saving || !noteDraft.trim()}
            className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving..." : selectedNote?.note_text ? "Update Note" : "Save Note"}
          </button>
        </div>
      </form>
    </section>
  );
}

function DashboardPage() {
  const { tasks } = useExpedition();
  const params = useParams();
  const navigate = useNavigate();
  const selectedDate = parseDateOrToday(params.date || isoDate());

  const completedCount = useMemo(
    () => asArray(tasks).filter((task) => task.completed).length,
    [tasks]
  );

  const elevationGain = completedCount * 10;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-6">
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-700">
              Expedition Log
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">
              The Expedition Log
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-slate-600 md:text-base">
              A clean, private dashboard for tracking progress, daily tasks, and localized field notes.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                  Total Elevation Gain
                </p>
                <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                  {elevationGain} ft
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  Every completed task contributes 10 ft to the total gain.
                </p>
              </div>

              <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                  Completed Tasks
                </p>
                <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                  {completedCount}
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  Unlock badges every 5 completed tasks.
                </p>
              </div>
            </div>
          </div>

          <MilestoneRow />
        </div>
      </section>

      <HeroVideo />

      <div className="grid gap-6">
      <CalendarMonth
          selectedDate={selectedDate}
          onPickDate={(date) => {
            navigate(`/day/${date}`);
          }}
        />

        <DailyBreakdownPanel selectedDate={selectedDate} />
      </div>
    </main>
  );
}

function CalendarPage() {
  const params = useParams();
  const navigate = useNavigate();
  const selectedDate = parseDateOrToday(params.date || isoDate());

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6">
      <div className="grid gap-6">
      <CalendarMonth
          selectedDate={selectedDate}
          onPickDate={(date) => {
            navigate(`/calendar/${date}`);
          }}
        />
        <DailyBreakdownPanel selectedDate={selectedDate} />
      </div>
    </main>
  );
}

function TasksPage() {
  const { tasks, addTask, toggleTask, tasksLoading } = useExpedition();
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState(isoDate());
  const [saving, setSaving] = useState(false);

  const taskArray = asArray(tasks);
  const today = isoDate();

  const upcoming = useMemo(
    () => taskArray.filter((task) => !task.completed && task.due_date >= today),
    [taskArray, today]
  );
  const completed = useMemo(
    () => taskArray.filter((task) => task.completed),
    [taskArray]
  );

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-700">Tasks</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            Daily task queue
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Add a task, set a due date, and keep the queue moving.
          </p>
        </div>

        <form
          className="grid gap-4 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1.3fr_0.7fr_auto]"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!title.trim()) return;
            setSaving(true);
            await addTask({ title: title.trim(), due_date: dueDate });
            setTitle("");
            setDueDate(isoDate());
            setSaving(false);
          }}
        >
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Task title</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-300/20"
              placeholder="Pack the map tools"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Due date</span>
            <input
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-300/20"
            />
          </label>

          <button
            type="submit"
            disabled={saving}
            className="self-end rounded-2xl bg-slate-950 px-5 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Adding..." : "Add Task"}
          </button>
        </form>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <section className="rounded-[1.5rem] border border-slate-200 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-500">
              Upcoming
            </h2>
            <div className="mt-4 grid gap-3">
              {tasksLoading ? (
                <p className="text-sm text-slate-500">Loading tasks...</p>
              ) : upcoming.length ? (
                upcoming.map((task) => (
                  <article
                    key={task.id}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                  >
                    <div>
                      <p className="font-medium text-slate-950">{task.title}</p>
                      <p className="text-xs text-slate-500">Due {task.due_date}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleTask(task.id, true)}
                      className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400"
                    >
                      Complete
                    </button>
                  </article>
                ))
              ) : (
                <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  No upcoming tasks.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-[1.5rem] border border-slate-200 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-500">
              Completed
            </h2>
            <div className="mt-4 grid gap-3">
              {completed.length ? (
                completed.map((task) => (
                  <article
                    key={task.id}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 opacity-80"
                  >
                    <div>
                      <p className="font-medium text-slate-700 line-through">{task.title}</p>
                      <p className="text-xs text-slate-500">Due {task.due_date}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleTask(task.id, false)}
                      className="rounded-full border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-100"
                    >
                      Undo
                    </button>
                  </article>
                ))
              ) : (
                <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  No completed tasks yet.
                </p>
              )}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function NotesPage() {
  const { dailyNotes } = useExpedition();
  const notesArray = asArray(dailyNotes);
  const navigate = useNavigate();

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-700">Notes</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            Daily field notes
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            A localized one-liner archive for each date.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {notesArray.length ? (
            notesArray.map((note) => (
              <button
                key={note.id}
                type="button"
                onClick={() => navigate(`/day/${note.date}`)}
                className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                  {note.date}
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-950">{note.note_text}</p>
              </button>
            ))
          ) : (
            <p className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              No daily notes saved yet.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

function FallbackPage() {
  return <Navigate to="/" replace />;
}

function AppRoutes() {
  return (
    <>
      <TopNav />
      <AppErrorBoundary>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/day/:date" element={<DashboardPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/calendar/:date" element={<CalendarPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/notes" element={<NotesPage />} />
          <Route path="*" element={<FallbackPage />} />
        </Routes>
      </AppErrorBoundary>
    </>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(Boolean(SUPABASE_CLIENT));
  const [authError, setAuthError] = useState("");
  const [appReady, setAppReady] = useState(false);

  const client = SUPABASE_CLIENT;
  const userId = session?.user?.id || "";

  const tasksState = useUserTasks(client, userId);
  const notesState = useDailyNotes(client, userId);

  useEffect(() => {
    let alive = true;
    let subscription = null;

    async function init() {
      if (!client) {
        setAppReady(true);
        setAuthLoading(false);
        return;
      }

      const { data, error } = await client.auth.getSession();
      if (!alive) return;
      if (error) setAuthError(error.message);
      setSession(data.session || null);
      setAuthLoading(false);
      setAppReady(true);

      const listener = client.auth.onAuthStateChange((_event, nextSession) => {
        if (alive) {
          setSession(nextSession || null);
        }
      });
      subscription = listener.data.subscription;
    }

    init();

    return () => {
      alive = false;
      if (subscription) subscription.unsubscribe();
    };
  }, [client]);

  const completedCount = useMemo(
    () => asArray(tasksState.tasks).filter((task) => task.completed).length,
    [tasksState.tasks]
  );

  const today = isoDate();

  const addTask = async ({ title, due_date }) => {
    if (!client || !userId) return;
    const { error } = await client.from("tasks").insert({
      user_id: userId,
      title,
      completed: false,
      due_date
    });
    if (error) {
      setAuthError(error.message);
    }
  };

  const toggleTask = async (taskId, completed) => {
    if (!client || !userId) return;
    const { error } = await client.from("tasks").update({ completed }).eq("id", taskId);
    if (error) {
      setAuthError(error.message);
    }
  };

  const addDailyNote = async (date, note_text) => {
    if (!client || !userId) return;
    const { error } = await client.from("daily_notes").upsert(
      {
        user_id: userId,
        date,
        note_text
      },
      {
        onConflict: "user_id,date"
      }
    );
    if (error) {
      setAuthError(error.message);
    }
  };

  const signIn = async (email, password) => {
    if (!client) return;
    setAuthLoading(true);
    setAuthError("");
    const { error } = await client.auth.signInWithPassword({
      email: email.trim(),
      password
    });
    setAuthLoading(false);
    if (error) setAuthError(error.message);
  };

  const signOut = async () => {
    if (!client) return;
    await client.auth.signOut();
  };

  const contextValue = useMemo(
    () => ({
      client,
      session,
      userId,
      tasks: tasksState.tasks,
      tasksLoading: tasksState.loading,
      dailyNotes: notesState.dailyNotes,
      dailyNotesLoading: notesState.loading,
      completedCount,
      signOut,
      addTask,
      toggleTask,
      addDailyNote
    }),
    [
      client,
      session,
      userId,
      tasksState.tasks,
      tasksState.loading,
      notesState.dailyNotes,
      notesState.loading,
      completedCount,
      signOut,
      addTask,
      toggleTask,
      addDailyNote
    ]
  );

  if (!appReady) {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-4">
          <div className="rounded-[2rem] border border-white/10 bg-white/5 px-6 py-8 text-center backdrop-blur">
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-emerald-200">
              Expedition Log
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">Loading secure session...</h1>
          </div>
        </div>
      </main>
    );
  }

  if (!session) {
    return <LoginScreen onSignIn={signIn} loading={authLoading} error={authError} />;
  }

  return (
    <ExpeditionContext.Provider value={contextValue}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </ExpeditionContext.Provider>
  );
}
