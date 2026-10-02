import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
  type User,
} from "firebase/auth";
import { collection, doc, onSnapshot } from "firebase/firestore";
import {
  CalendarDays,
  Map,
  Clock3,
  CheckSquare,
  Settings as SettingsIcon,
  Plus,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  Share2,
  Trash2,
  ArrowUpRight,
  Compass,
  LogOut,
  Check,
  Save,
} from "lucide-react";
import tzlookup from "tz-lookup";
import { api, auth, configured, db } from "./firebase";
import { observeClock, followCalendarDay } from "./day-clock";
import { startingLayout } from "./map-start";
import {Popover} from "./Popover";
import { Dropdown, ColorPicker, Toast } from "./Controls";
import { DateField, TimeField, SymbolPicker, SymbolIcon, FloatingChecklist, TimezonePicker } from "./PlannerControls";
const MapPanel = lazy(() => import("./MapPanel"));
import {
  defaultLayout,
  defaultSettings,
  emptyDay,
  type Day,
  type Trip,
  type Layout,
  type Settings,
  type Pin,
} from "./types";
const today = () => new Date().toLocaleDateString("en-CA");
const maxDate = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toLocaleDateString("en-CA");
};

type Edit = {
  kind: "pins" | "blocks" | "tasks" | "connections";
  item: Record<string, any>;
  base?: Record<string, any>;
};
function Input({ label, ...props }: any) {
  if (props.type === "date") return <DateField label={label} {...props} />;
  if (props.type === "time") return <TimeField label={label} {...props} />;
  if (props.type === "color") return <ColorPicker label={label} {...props} />;
  return (
    <label className="field">
      <span>{label}</span>
      <input {...props} />
    </label>
  );
}
function Select({ label, children, ...props }: any) {
  return <div className="field"><span>{label}</span><Dropdown aria-label={label} {...props}>{children}</Dropdown></div>;
}
function Modal({ title, children, onClose }: any) {
  const box = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    box.current
      ?.querySelector<HTMLElement>("input,button,select,textarea")
      ?.focus();
    const handler = (event: KeyboardEvent) => {
      if (!box.current?.contains(document.activeElement)) return;
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
      if (event.key === "Tab") {
        const elements = Array.from(
          box.current?.querySelectorAll<HTMLElement>(
            "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)",
          ) ?? [],
        );
        const first = elements[0],
          last = elements.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-shade"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={box}
        className={`modal${title === "Your preferences" ? " settings-modal" : /pin|place|time block/i.test(title) ? " item-modal" : /^(Create|Edit) trip$/.test(title) ? " trip-modal" : /task/i.test(title) ? " task-modal" : title === "Share trip" ? " share-modal" : title === "Confirm deletion" ? " confirm-modal" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <h2>{title}</h2>
          <button className="icon" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
function TripFeatures({ className = "" }: { className?: string }) {
  return (
    <div className={"art-badges " + className}>
      <span><Map size={16} /> Map pins</span>
      <span><Clock3 size={16} /> Daily schedule</span>
      <span><CheckSquare size={16} /> Linked tasks</span>
    </div>
  );
}

function AuthScreen({ onError }: { onError: (s: string) => void }) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [register, setRegister] = useState(false),
    [busy, setBusy] = useState(false);
  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
    } catch (e: any) {
      onError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <div className="auth-map-background" aria-hidden="true" />
      <div className="auth-art">
        <div className="brand">
          <Compass />
          <strong>Journas</strong>
        </div>
        <div className="art-copy">
          <span className="eyebrow">
            COLLABORATIVE TRIP PLANNER
          </span>
          <h1>
            A daily planner
            <br />
            for your trips.
          </h1>
          <p>
            Add places to a map, schedule visits, and link tasks for each day.
            Share a trip to plan with others in real time. Each traveler keeps
            their own workspace layout.
          </p>
          <TripFeatures />
        </div>
      </div>
      <section className="auth-form">
        <div className="brand mobile-brand">
          <Compass />
          <strong>Journas</strong>
        </div>
        <h2>{register ? "Create an account" : "Sign in to Journas"}</h2>
        <p>
          Plan each day with a map, schedule, and task list. Sign in to save your
          trips and collaborate on shared itineraries.
        </p>
        <TripFeatures className="mobile-features" />
        {!configured ? (
          <div className="setup-message">
            <h3>Connect your travel workspace</h3>
            <p>
              Firebase is not configured yet. Follow the setup guide in the
              repository to enable secure accounts and saved trips.
            </p>
            <code>VITE_FIREBASE_* environment variables</code>
          </div>
        ) : (
          <>
            <button
              className="google button"
              disabled={busy}
              onClick={() =>
                run(() => signInWithPopup(auth!, new GoogleAuthProvider()))
              }
            >
              <img className="google-logo" src="/google-logo.svg" alt="" width="20" height="20" /> Continue with Google
            </button>
            <div className="divider">or continue with email</div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  if (register) {
                    const cred = await createUserWithEmailAndPassword(
                      auth!,
                      email,
                      password,
                    );
                    await sendEmailVerification(cred.user);
                  } else
                    await signInWithEmailAndPassword(auth!, email, password);
                });
              }}
            >
              <Input
                label="Email address"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e: any) => setEmail(e.target.value)}
              />
              <Input
                label="Password"
                type="password"
                required
                minLength={8}
                autoComplete={register ? "new-password" : "current-password"}
                value={password}
                onChange={(e: any) => setPassword(e.target.value)}
              />
              <button className="button primary full" disabled={busy}>
                {busy
                  ? "Please wait…"
                  : register
                    ? "Create account"
                    : "Sign in"}
                <ArrowUpRight size={17} />
              </button>
            </form>
            <button
              className="text-button"
              onClick={() => {
                if (!email) {
                  onError("Enter your email address first.");
                  return;
                }
                run(async () => {
                  await sendPasswordResetEmail(auth!, email);
                  onError("Password reset email sent.");
                });
              }}
            >
              Forgot password?
            </button>
            <p className="auth-switch">
              {register ? "Already have an account?" : "New to Journas?"}{" "}
              <button
                className="text-button"
                onClick={() => setRegister(!register)}
              >
                {register ? "Sign in" : "Create an account"}
              </button>
            </p>
          </>
        )}
        <footer>Your trips and preferences are saved to your account.</footer>
      </section>
    </main>
  );
}
export default function App() {
  const [user, setUser] = useState<User | null>(null),
    [ready, setReady] = useState(!configured),
    [trips, setTrips] = useState<Trip[]>([]),
    [trip, setTrip] = useState<Trip | null>(null),
    [date, setDate] = useState(today()),
    [day, setDay] = useState<Day>(emptyDay),
    [layout, setLayout] = useState<Layout>(defaultLayout),
    [settings, setSettings] = useState<Settings>(defaultSettings),
    [message, setMessage] = useState(""),
    [status, setStatus] = useState("All changes saved"),
    [modal, setModal] = useState<string | null>(null),
    [edit, rawSetEdit] = useState<Edit | null>(null),
    [calendar, setCalendar] = useState(false),
    [month, setMonth] = useState(today().slice(0, 7)),
    [shareLink, setShareLink] = useState(""),
    [shareMode, setShareMode] = useState("viewer"),
    [shareTrip, setShareTrip] = useState(
      Boolean(new URLSearchParams(location.search).get("share")),
    ),
    [publicMode, setPublicMode] = useState<"viewer" | "editor">("viewer"),
    [shareReady, setShareReady] = useState(false),
    [joinedToken, setJoinedToken] = useState<string | null>(null),
    [conflict, setConflict] = useState<any>(null),
    [saving, setSaving] = useState(false),
    [manualSaving, setManualSaving] = useState(false);
  const [movingPinId,setMovingPinId]=useState<string|null>(null);
  const [lodgingDraft,setLodgingDraft]=useState<Trip["lodging"]>(undefined);
  const [lodgingView,setLodgingView]=useState(defaultLayout());
  const [profileOpen,setProfileOpen]=useState(false);const profileAnchor=useRef<HTMLDivElement>(null);
  const [ambiguousTime,setAmbiguousTime]=useState(false);
  const [optimisticTasks,setOptimisticTasks]=useState<Record<string,{checked:boolean;saving:boolean}>>({});
  const [taskPage,setTaskPage]=useState(0),[memberPage,setMemberPage]=useState(0),[connectionPage,setConnectionPage]=useState(0);
  const [hourHeight,setHourHeight]=useState(28);
  const [settingsMapView,setSettingsMapView]=useState(defaultLayout());
  const [confirmation,setConfirmation]=useState<{message:string;resolve:(answer:boolean)=>void}|null>(null);
  const confirmAction=(message:string)=>new Promise<boolean>(resolve=>setConfirmation({message,resolve}));

  const token = new URLSearchParams(location.search).get("share");
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const tripRef = useRef(trip);
  tripRef.current = trip;
  const dateRef = useRef(date);
  dateRef.current = date;
  const dirty = useRef(false);
  const layoutLoading = useRef(false);
  const scroller = useRef<HTMLDivElement>(null);
  const calendarBox = useRef<HTMLDivElement>(null);
  const profilePhoto = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!calendar) return;
    const outside = (event: PointerEvent) => {
      const node = event.target as HTMLElement;
      if (!calendarBox.current?.contains(node) && !node.closest(".date-button")) setCalendar(false);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setCalendar(false); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [calendar]);
  const [time, setTime] = useState(new Date());
  useEffect(()=>{const element=scroller.current;if(!element)return;const observer=new ResizeObserver(()=>setHourHeight(element.clientHeight/24));observer.observe(element);return()=>observer.disconnect();},[layout.timeline,ready,user?.uid]);
  useEffect(()=>{setMemberPage(0);},[trip?.id,modal]);
  useEffect(()=>{setConnectionPage(0);},[edit?.item.id]);
  useEffect(()=>{setAmbiguousTime(false);},[edit?.item.start,edit?.item.end,edit?.item.timezone,date]);

  useEffect(() => {
    if (!message) return;
    const timeout = setTimeout(() => setMessage(""), 5000);
    return () => clearTimeout(timeout);
  }, [message]);
  function setEdit(value: Edit | null) {
    if (value && !value.base)
      value = {
        ...value,
        base:
          edit && edit.item.id === value.item.id
            ? (edit.base ?? structuredClone(value.item))
            : structuredClone(value.item),
      };
    rawSetEdit(value);
  }
  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setReady(true);
    });
  }, []);
  useEffect(() => {
    return observeClock(() => setTime(new Date()));
  }, []);
  useEffect(() => {
    const dark =
      settings.theme === "dark" ||
      (settings.theme === "system" &&
        matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.documentElement.style.setProperty("--accent", settings.accent);
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const fn = () => {
      if (settings.theme === "system")
        document.documentElement.dataset.theme = mq.matches ? "dark" : "light";
    };
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, [settings.theme, settings.accent]);
  async function refresh() {
    const result = await api<{ trips: Trip[] }>("trip.list");
    setTrips(result.trips);
    return result.trips;
  }
  useEffect(() => {
    if (!user) return;
    Promise.all([refresh(), api<{ settings: Settings }>("settings.get")])
      .then(async ([list, r]) => {
        const preferences = { ...defaultSettings, ...r.settings };
        setSettings(preferences);
        if (!token && !list.some((t) => t.startDate <= today() && t.endDate >= today()))
          setLayout(await startingLayout(preferences));
        if (!token)
          setTrip(
            list.find((t) => t.startDate <= today() && t.endDate >= today()) ??
              null,
          );
      })
      .catch((e) => setMessage(e.message));
  }, [user?.uid]);
  useEffect(() => {
    if (!token || joinedToken === token) return;
    let cancelled = false;
    setShareTrip(true);
    setShareReady(false);
    api<{ trip: Trip; day: Day; mode: "viewer" | "editor" }>("share.read", {
      token,
    })
      .then((r) => {
        if (cancelled) return;
        setTrip(r.trip);
        setDay(r.day);
        setPublicMode(r.mode);
        setDate(r.trip.startDate);
        setMonth(r.trip.startDate.slice(0, 7));
        setShareReady(true);
      })
      .catch((e) => {
        if (!cancelled) setMessage(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [token, joinedToken]);
  useEffect(() => {
    if (user && modal === "share-auth") setModal("trip");
  }, [user?.uid, modal]);
  useEffect(() => {
    if (!token || !shareTrip || !shareReady || joinedToken === token) return;
    let cancelled = false;
    api<{ trip: Trip; day: Day; mode: "viewer" | "editor" }>("share.read", {
      token,
      date,
    })
      .then(async (r) => {
        if (cancelled) return;
        setDay(r.day);
        setPublicMode(r.mode);
        const local = localStorage.getItem(
          `journas-viewlayout:${user?.uid ?? "guest"}:${r.trip.id}:${date}`,
        );
        const nextLayout = local ? JSON.parse(local) : await startingLayout(settings, tripRef.current?.lodging);
        if (cancelled) return;
        setLayout({ ...defaultLayout(), ...nextLayout });
      })
      .catch((e) => {
        if (!cancelled) {
          setDay(emptyDay());
          setMessage(e.message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, date, shareTrip, shareReady, joinedToken, user?.uid]);
  useEffect(() => {
    if (
      !trip ||
      !user ||
      shareTrip ||
      !db ||
      date < trip.startDate ||
      date > trip.endDate
    )
      return;
    let cancelled = false;
    layoutLoading.current=true;
    api<{ trip: Trip; day: Day; layout: Layout | null }>("trip.get", {
      tripId: trip.id,
      date,
    })
      .then(async (r) => {
        if (cancelled) return;
        setDay(r.day);
        const local = localStorage.getItem(
          `journas-layout:${user.uid}:${trip.id}:${date}`,
        );
        const restored = local ? JSON.parse(local) : r.layout;
        const nextLayout = restored ?? await startingLayout(settings, tripRef.current?.lodging);
        if (cancelled) return;
        setLayout({ ...defaultLayout(), ...nextLayout });
        dirty.current = Boolean(local);
        requestAnimationFrame(()=>requestAnimationFrame(()=>{if(!cancelled)layoutLoading.current=false;}));
        const draft = localStorage.getItem(
          `journas-drafts:${user.uid}:${trip.id}:${date}`,
        );
        if (draft) {
          const pending = Object.values(JSON.parse(draft)) as Edit[];
          if (pending.length) {
            setEdit(pending[0]);
            setMessage(
              `Recovered ${pending.length} unsaved draft(s). Review and save them.`,
            );
          }
        }
        setTimeout(() => {
          if (scroller.current)
            scroller.current.scrollTop = restored?.scroll ?? 400;
        }, 0);
      })
      .catch((e) => {layoutLoading.current=false;setMessage(e.message);});
    const stop = onSnapshot(
      collection(db, "trips", trip.id, "days", date, "items"),
      (snap) => {
        const next = emptyDay();
        snap.forEach((d) => {
          const item: any = { ...d.data(), id: d.id };
          if (["pins", "blocks", "tasks", "connections"].includes(item.kind))
            (next as any)[item.kind].push(item);
        });
        if (!cancelled) setDay(next);
      },
      (e) => {
        if (e.code === "permission-denied") lostAccess();
        else if (!cancelled)
          setMessage(
            "Live updates are temporarily unavailable. Please reconnect.",
          );
      },
    );
    const lostAccess = () => {
      if (cancelled) return;
      cancelled = true;
      setTrip(null);
      setDay(emptyDay());
      setEdit(null);
      setConflict(null);
      setModal(null);
      void refresh().catch(() => {});
      setMessage("This trip was deleted or you no longer have access.");
    };
    const stopTrip = onSnapshot(
      doc(db, "trips", trip.id),
      (snap) => {
        if (!snap.exists() || snap.data()?.deleted) {
          lostAccess();
        } else if (!snap.data()?.memberIds?.includes(user.uid)) {
          lostAccess();
        } else if (!cancelled) {
          const updated = { ...snap.data(), id: snap.id } as Trip;
          setTrip(updated);
          setTrips((current) =>
            current.map((value) => (value.id === updated.id ? updated : value)),
          );
        }
      },
      (error) => {
        if (error.code === "permission-denied") lostAccess();
        else if (!cancelled)
          setMessage(
            "Live updates are temporarily unavailable. Please reconnect.",
          );
      },
    );
    return () => {
      cancelled = true;
      stop();
      stopTrip();
    };
  }, [trip?.id, date, user?.uid, shareTrip]);
  useEffect(() => {
    if (!token || !shareTrip || !shareReady || joinedToken === token) return;
    const id = setInterval(
      () =>
        api<{ trip: Trip; day: Day }>("share.read", { token, date })
          .then((r) => setDay(r.day))
          .catch((e) => {
            setDay(emptyDay());
            setMessage(e.message);
          }),
      15000,
    );
    return () => clearInterval(id);
  }, [token, date, shareTrip, shareReady, joinedToken]);
  async function saveLayout() {
    setTime(new Date());
    if (!dirty.current || !tripRef.current) return;
    if (shareTrip) {
      localStorage.setItem(
        `journas-viewlayout:${user?.uid ?? "guest"}:${tripRef.current.id}:${dateRef.current}`,
        JSON.stringify(layoutRef.current),
      );
      dirty.current = false;
      setStatus("Workspace saved on this device");
      return;
    }
    if (!user) return;
    try {
      setStatus("Saving workspace…");
      await api("layout.save", {
        tripId: tripRef.current.id,
        date: dateRef.current,
        layout: layoutRef.current,
      });
      dirty.current = false;
      localStorage.removeItem(
        `journas-layout:${user.uid}:${tripRef.current.id}:${dateRef.current}`,
      );
      setStatus("All changes saved");
    } catch (e: any) {
      setStatus("Save pending");
      setMessage(e.message);
    }
  }
  const autosave = useRef<() => Promise<void>>(async () => {});
  autosave.current = async () => {
    await saveLayout();
    if (user && trip && !readonly) {
      const pending = localStorage.getItem(
        `journas-drafts:${user.uid}:${trip.id}:${date}`,
      );
      if (pending) {
        for (const draft of Object.values(JSON.parse(pending)) as Edit[])
          await mutate(draft.kind, draft.item, false, draft.base);
      }
    }
  };
  async function saveManually() {
    if (manualSaving) return;
    setManualSaving(true);
    try {
      await autosave.current();
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setTime(new Date());
      setManualSaving(false);
    }
  }
  useEffect(() => {
    const run = () => void autosave.current();
    const id = setInterval(run, 300000);
    window.addEventListener("online", run);
    return () => {
      clearInterval(id);
      window.removeEventListener("online", run);
    };
  }, []);
  function changeLayout(patch: Partial<Layout>) {
    if (
      Object.entries(patch).every(
        ([key, value]) =>
          JSON.stringify(layoutRef.current[key as keyof Layout]) ===
          JSON.stringify(value),
      )
    )
      return;
    dirty.current = true;
    setLayout((l) => ({ ...l, ...patch }));
    if (shareTrip && trip)
      localStorage.setItem(
        `journas-viewlayout:${user?.uid ?? "guest"}:${trip.id}:${date}`,
        JSON.stringify({ ...layoutRef.current, ...patch }),
      );
    else if (user && trip)
      localStorage.setItem(
        `journas-layout:${user.uid}:${trip.id}:${date}`,
        JSON.stringify({ ...layoutRef.current, ...patch }),
      );
  }
  async function switchDate(value: string) {
    if (shareTrip && trip)
      value =
        value < trip.startDate
          ? trip.startDate
          : value > trip.endDate
            ? trip.endDate
            : value;
    await saveLayout();
    layoutLoading.current=true;
    setDate(value);
    setDay(emptyDay());
    setLayout(trip?.lodging ? { ...defaultLayout(), center:[trip.lodging.lng,trip.lodging.lat],zoom:14 } : defaultLayout());
    setCalendar(false);
    if (!trip || value < trip.startDate || value > trip.endDate) {
      const initial = await startingLayout(settings, tripRef.current?.lodging);
      if (dateRef.current === value) setLayout(initial);
    }
  }
  const previousToday = useRef(today());
  useEffect(() => {
    const currentToday = today();
    if (currentToday !== previousToday.current) {
      const oldToday = previousToday.current;
      previousToday.current = currentToday;
      const nextDate = followCalendarDay(dateRef.current, oldToday, currentToday);
      if (nextDate && !shareTrip) void switchDate(nextDate);
    }
  }, [time]);
  const readonly =
    shareTrip || !user || !trip || date < trip.startDate || date > trip.endDate;
  let timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (settings.clock === "utc") timezone = "UTC";
  if (settings.clock === "lodging" && trip?.lodging) timezone=trip.lodging.timezone;
  if (settings.clock === "destination") {
    timezone = settings.timezone || timezone;
    const first = [...day.blocks]
      .sort((a, b) => a.start.localeCompare(b.start))
      .find((b) => b.pinId);
    const pin = day.pins.find((p) => p.id === first?.pinId) ?? day.pins[0];
    if (!settings.timezone && pin)
      try {
        timezone = tzlookup(pin.lat, pin.lng);
      } catch {}
  }
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone });
  } catch {
    timezone = "UTC";
  }
  const displayedToday = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(time);
  const clockParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(time)
    .split(":");
  const nowMinutes = Number(clockParts[0]) * 60 + Number(clockParts[1]);
  function displayTime(epoch: number | undefined, fallback: string) {
    return epoch
      ? new Intl.DateTimeFormat("en-GB", {
          timeZone: timezone,
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        }).format(epoch)
      : fallback;
  }
  async function mutate(
    kind: string,
    item: Record<string, any>,
    force = false,
    baseline?: Record<string, any>,
  ) {
    if (!trip) return false;
    setSaving(true);
    setStatus("Saving…");
    const { id, versions, ...fields } = item;
    if (kind === "blocks" && !fields.timezone) fields.timezone = timezone;
    const existing = (day as any)[kind].find((x: any) => x.id === id);
    const original = existing
      ? (baseline ??
        (edit && edit.item.id === id ? (edit.base ?? existing) : existing))
      : undefined;
    const patch = Object.fromEntries(
      Object.entries(fields).filter(
        ([key, value]) =>
          ![
            "kind",
            "updatedAt",
            "createdAt",
            "updatedBy",
            "startEpoch",
            "endEpoch",
          ].includes(key) &&
          JSON.stringify(original?.[key]) !== JSON.stringify(value),
      ),
    );
    const base = force ? (conflict?.current?.versions ?? {}) : (versions ?? {});
    if (!Object.keys(patch).length) {
      setEdit(null);
      setSaving(false);
      return true;
    }
    const draft: Edit = { kind: kind as Edit["kind"], item, base: original };
    const draftKey = `journas-drafts:${user?.uid}:${trip.id}:${date}`;
    const drafts = JSON.parse(localStorage.getItem(draftKey) ?? "{}");
    localStorage.setItem(draftKey, JSON.stringify({ ...drafts, [id]: draft }));
    try {
      await api("item.patch", {
        tripId: trip.id,
        date,
        kind,
        id,
        patch,
        baseVersions: base,
      });
      const pending = JSON.parse(localStorage.getItem(draftKey) ?? "{}");
      delete pending[id];
      if (Object.keys(pending).length)
        localStorage.setItem(draftKey, JSON.stringify(pending));
      else localStorage.removeItem(draftKey);
      setEdit(null);
      setConflict(null);
      setTime(new Date());
      setStatus("All changes saved");
      return true;
    } catch (e: any) {
      if (e.code === "AMBIGUOUS_TIME") {
        setAmbiguousTime(true); setStatus("Choose the occurrence of the repeated hour");
        setEdit({
          ...draft,
          item: { ...item, timezone: item.timezone || timezone },
        });
        setMessage(
          "This hour occurs twice due to daylight saving. Choose the earlier or later occurrence, then save.",
        );
      } else if (e.code === "CONFLICT")
        setConflict({
          draft,
          current: e.current,
          fields: e.details?.fields ?? [],
        });
      else if (e.status === 409) {
        setMessage(e.message);
        setStatus("Save pending — draft kept on this device");
      } else {
        setMessage(e.message);
        setStatus("Save pending — draft kept on this device");
      }
      return false;
    } finally {
      setSaving(false);
    }
  }
  async function remove(kind: string, item: any) {
    if (!trip || !await confirmAction("Delete this item? Linked items will be kept."))
      return;
    try {
      await api("item.delete", {
        tripId: trip.id,
        date,
        kind,
        id: item.id,
        baseVersions: item.versions ?? {},
      });
      setEdit(null);
    } catch (e: any) {
      setMessage(e.message);
    }
  }
  async function toggleTask(task:Day['tasks'][number]) {
    if(!trip||readonly||optimisticTasks[task.id]?.saving)return;
    const tripId=trip.id,dayDate=date,checked=!task.checked;
    setOptimisticTasks(previous=>({...previous,[task.id]:{checked,saving:true}}));
    const draft={kind:'tasks',item:{...task,checked},base:task};
    const key=`journas-drafts:${user?.uid}:${tripId}:${dayDate}`;
    const drafts=JSON.parse(localStorage.getItem(key)??'{}');localStorage.setItem(key,JSON.stringify({...drafts,[task.id]:draft}));
    try{
      const result=await api<{item:Day['tasks'][number]}>('item.patch',{tripId,date:dayDate,kind:'tasks',id:task.id,patch:{checked},baseVersions:task.versions});
      if(tripRef.current?.id===tripId&&dateRef.current===dayDate)setDay(previous=>({...previous,tasks:previous.tasks.map(t=>t.id===task.id?result.item:t)}));
      const pending=JSON.parse(localStorage.getItem(key)??'{}');delete pending[task.id];if(Object.keys(pending).length)localStorage.setItem(key,JSON.stringify(pending));else localStorage.removeItem(key);
      setTime(new Date());
    }catch(e:any){
      setMessage(e.message);setStatus('Save pending — draft kept on this device');
      if(e.code==='CONFLICT')setConflict({draft,current:e.current,fields:e.details?.fields??[]});
    }finally{setOptimisticTasks(previous=>{const next={...previous};delete next[task.id];return next;});}
  }
  async function logout(){await saveLayout();await signOut(auth!);setTrip(null);setTrips([]);setSettings(defaultSettings);setShareLink('');setProfileOpen(false);setModal(null);}
  function newItem(kind: Edit["kind"], extras: any = {}) {
    setAmbiguousTime(false);
    if (readonly) {
      setMessage("Choose or create a trip to start planning.");
      return;
    }
    const base =
      kind === "pins"
        ? {
            title: "",
            note: "",
            color: settings.accent,
            symbol: "icon:stay",
            lng: layout.center[0],
            lat: layout.center[1],
          }
        : kind === "blocks"
          ? {
              start: "09:00",
              end: "10:00",
              title: "",
              detail: "",
              color: settings.accent,
              symbol: "icon:stay",
              pinId: null,
              overrides: [],
              timezone,
              disambiguation: null,
            }
          : kind === "tasks"
            ? { title: "", checked: false, pinId: null, blockId: null }
            : {
                from: day.pins[0]?.id ?? "",
                to: day.pins[1]?.id ?? "",
                arrow: true,
              };
    setEdit({
      kind,
      item: { id: crypto.randomUUID(), versions: {}, ...base, ...extras },
    });
  }
  async function saveSettings(next: Settings) {
    try {
      await api("settings.save", { settings: next });
      setSettings(next);
      if (!trip) setLayout(await startingLayout(next));
      setMessage("Preferences saved.");
    } catch (e: any) {
      setMessage(e.message);
    }
  }
  const taskIsCurrent=(task:Day['tasks'][number])=>{
    if(optimisticTasks[task.id]?.checked??task.checked)return false;const block=day.blocks.find(b=>b.id===task.blockId);if(!block)return false;
    if(block.startEpoch&&block.endEpoch)return block.startEpoch<=time.getTime()&&time.getTime()<block.endEpoch;
    const minute=(value:string)=>{const [h,m]=value.split(':').map(Number);return h*60+m;};return date===displayedToday&&nowMinutes>=minute(block.start)&&nowMinutes<minute(block.end);
  };
  const taskPageSize=Math.max(1,Math.floor((layout.todoHeight-112)/52));
  const taskPages=Math.max(1,Math.ceil(day.tasks.length/taskPageSize));const currentTaskPage=Math.min(taskPage,taskPages-1);
  const visibleTasks=[...day.tasks].sort((a,b)=>Number(taskIsCurrent(b))-Number(taskIsCurrent(a))).slice(currentTaskPage*taskPageSize,(currentTaskPage+1)*taskPageSize);
  if (!ready)
    return (
      <div className="loading">
        <Compass /> Finding your next adventure…
      </div>
    );
  if (!user && !token)
    return (
      <>
        <AuthScreen onError={setMessage} />
        <Toast message={message} onDismiss={() => setMessage("")} />
      </>
    );
  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="/">
          <Compass />
          <strong>Journas</strong>
        </a>
        <div className="trip-selector">
          {trips.length || (shareTrip && trip) ? <Dropdown
            aria-label="Choose trip"
            placeholder="Choose a trip"
            value={trip?.id ?? ""}
            onChange={async (e: any) => {
              await saveLayout();
              setShareTrip(false);
              history.replaceState({}, "", location.pathname);
              const selected =
                trips.find((t) => t.id === e.target.value) ?? null;
              setTrip(selected);
              if (
                selected &&
                (date < selected.startDate || date > selected.endDate)
              )
                setDate(selected.startDate);
              setDay(emptyDay());
              setLayout(defaultLayout());
              if (!selected) setLayout(await startingLayout(settings, trip?.lodging));
            }}
          >
            {shareTrip && trip && (
              <option value={trip.id}>{trip.name}</option>
            )}
            {trips.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Dropdown> : <span className="no-trips">No trips created yet</span>}
          <button
            className="icon"
            title="Create trip"
            aria-label="Create trip"
            onClick={() => {setLodgingDraft(undefined);setLodgingView({...layout});setModal("new-trip");}}
            disabled={!user || trips.length >= 100}
          >
            <Plus size={18} />
          </button>
        </div>
        <div className="date-picker">
          <button
            className="icon"
            aria-label="Next day"
            disabled={
              date >= maxDate() ||
              Boolean(shareTrip && trip && date >= trip.endDate)
            }
            onClick={() => {
              const d = new Date(`${date}T12:00:00`);
              d.setDate(d.getDate() + 1);
              switchDate(d.toLocaleDateString("en-CA"));
            }}
          >
            <ChevronLeft size={17} />
          </button>
          <button
            className="date-button"
            onClick={() => {setMonth(date.slice(0,7));setCalendar(!calendar);}}
          >
            <CalendarDays size={17} />
            <span>
              {new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </button>
          <button
            className="icon"
            aria-label="Previous day"
            disabled={Boolean(shareTrip && trip && date <= trip.startDate)}
            onClick={() => {
              const d = new Date(`${date}T12:00:00`);
              d.setDate(d.getDate() - 1);
              switchDate(d.toLocaleDateString("en-CA"));
            }}
          >
            <ChevronRight size={17} />
          </button>
        </div>
        <div className="top-actions">
          <div className="save-control">
          <span className={`save-indicator${status.startsWith("All") ? " saved" : " pending"}`} role="status" title={status} aria-label={status} />
          <button className="icon" aria-label="Save planning" title="Save planning" disabled={!user || manualSaving || saving} onClick={saveManually}>
            <Save size={18} />
          </button>
          </div>
          {trip && (
            <button
              className="button subtle"
              aria-label="Share trip"
              onClick={() => setModal("trip")}
            >
              <Share2 size={16} />
              <span>Share trip</span>
            </button>
          )}
          <div className="profile-control" ref={profileAnchor}>
            <button className="profile-trigger" aria-label="Account menu" aria-expanded={profileOpen} onClick={()=>setProfileOpen(!profileOpen)}><span className="avatar">{settings.photoURL?<img src={settings.photoURL} alt=""/>:(settings.displayName??user?.displayName??'A').slice(0,1)}</span><span>{settings.displayName||user?.displayName||'Account'}</span><ChevronDown size={14}/></button>
            {profileOpen&&<Popover anchor={profileAnchor} width={180} height={100} className="profile-menu" role="menu" onClose={()=>setProfileOpen(false)}><button role="menuitem" onClick={()=>{setProfileOpen(false);setModal('settings');}}><SettingsIcon size={16}/>Settings</button>{user&&<button role="menuitem" onClick={logout}><LogOut size={16}/>Sign out</button>}</Popover>}
          </div>
        </div>
      </header>
      {user &&
        !user.emailVerified &&
        user.providerData.some((p) => p.providerId === "password") && (
          <div className="verification">
            Verify your email to start saving trips.{" "}
            <span className="verification-actions">
            <button
              onClick={() =>
                sendEmailVerification(user)
                  .then(() => setMessage("Verification email sent."))
                  .catch((e) => setMessage(e.message))
              }
            >
              Resend email
            </button>
            <button
              onClick={() =>
                user
                  .reload()
                  .then(() => user.getIdToken(true))
                  .then(() => location.reload())
              }
            >
              I have verified
            </button>
            </span>
          </div>
        )}
      {trips.length >= 80 && (
        <div className="verification">
          {trips.length >= 100
            ? "Your saved-trip limit is reached. Remove an old trip before creating or joining another."
            : "You are approaching your saved-trip limit. Remove old trips to make room."}
        </div>
      )}
      <div className="workspace-toolbar">
        <div className="places-toolbar-heading">
          <Map size={17} /><h1>Places & routes</h1>
          {shareTrip && <span className="shared-label">View only</span>}

        </div>
        <div className="view-controls">
          {[
            ["map", Map, "Map"],
            ["timeline", Clock3, "Schedule"],
            ["todo", CheckSquare, "Tasks"],
          ].map(([key, Icon, label]: any) => (
            <button
              key={key}
              aria-label={label}
              className={layout[key as keyof Layout] ? "active" : ""}
              onClick={() => {
                if (
                  layout[key as keyof Layout] &&
                  [layout.map, layout.timeline, layout.todo].filter(Boolean)
                    .length === 1
                )
                  return;
                changeLayout({ [key]: !layout[key as keyof Layout] });
              }}
            >
              <Icon size={15} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>
      {!trip && <div className="planning-required" role="note">Select a trip above, or use + to create one, before adding places, schedule blocks or tasks.</div>}
      <div
        className="workspace"
        style={{
          gridTemplateColumns:
            layout.map && layout.timeline
              ? `${layout.split}% 6px minmax(0,1fr)`
              : "1fr",
        }}
      >
        {layout.map && (
          <section className="panel map-panel">
            <Suspense
              fallback={<div className="loading">Loading your map…</div>}
            >
              <MapPanel
                pins={day.pins}
                connections={day.connections}
                layout={layout}
                readonly={readonly}
                onConnect={async(from,to,arrow)=>{if(await mutate("connections",{id:crypto.randomUUID(),versions:{},from,to,arrow}))setMessage("Connection created.");}}
                movingPinId={movingPinId}
                onCancelMove={()=>setMovingPinId(null)}
                onMovePin={async(pin,lng,lat)=>{if(await mutate("pins",{...pin,lng,lat})){setMovingPinId(null);setMessage("Pin location saved.");}}}
                onView={(center, zoom) => {if(!layoutLoading.current)changeLayout({ center, zoom });}}
                onPin={(pin) => setEdit({ kind: "pins", item: pin })}
                onAdd={(lng, lat) => newItem("pins", { lng, lat })}
              />
            </Suspense>
          </section>
        )}
        {layout.map && layout.timeline && (
          <div
            className="splitter"
            role="separator"
            aria-label="Resize map and schedule"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft" || e.key === "ArrowRight")
                changeLayout({
                  split: Math.max(
                    25,
                    Math.min(
                      75,
                      layout.split + (e.key === "ArrowLeft" ? -2 : 2),
                    ),
                  ),
                });
            }}
            onPointerDown={(e) => {
              const el = e.currentTarget;
              el.setPointerCapture(e.pointerId);
              const rect = el.parentElement!.getBoundingClientRect();
              const move = (ev: PointerEvent) =>
                changeLayout({
                  split: Math.max(
                    25,
                    Math.min(75, ((ev.clientX - rect.left) / rect.width) * 100),
                  ),
                });
              el.addEventListener("pointermove", move);
              el.addEventListener(
                "lostpointercapture",
                () => el.removeEventListener("pointermove", move),
                { once: true },
              );
            }}
          />
        )}
        {layout.timeline && (
          <section className="panel schedule-panel">
            <div className="panel-heading">
              <div>
                <Clock3 size={17} />
                <h2>Daily itinerary</h2>
              </div>
              {!readonly && (
                <button
                  className="icon"
                  aria-label="Add time block"
                  onClick={() => newItem("blocks")}
                >
                  <Plus size={19} />
                </button>
              )}
            </div>
            <div className="schedule-subhead">
              <span>
                {new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
              </span>
              <span title="Active time zone">{timezone}</span>
            </div>
            <div
              className="timeline-scroll"
              ref={scroller}
              onScroll={(e) =>
                changeLayout({ scroll: e.currentTarget.scrollTop })
              }
            >
              <div className="timeline-grid">
                {Array.from({ length: 24 }, (_, i) => (
                  <div className="hour" key={i} style={{ top: i * hourHeight }}>
                    <span>{String(i).padStart(2, "0")}:00</span>
                    <i />
                  </div>
                ))}
                {day.blocks.map((b) => {
                  const pin = day.pins.find((p) => p.id === b.pinId);
                  const field = (key: string) =>
                    pin && !b.overrides.includes(key)
                      ? key === "title"
                        ? pin.title
                        : key === "detail"
                          ? pin.note
                          : (pin as any)[key]
                      : (b as any)[key];
                  const minutes = (value: string) => {
                    const [h, m] = value.split(":").map(Number);
                    return h * 60 + m;
                  };
                  const overlaps = day.blocks
                    .filter((o) => o.start < b.end && o.end > b.start)
                    .sort(
                      (a, c) =>
                        a.start.localeCompare(c.start) ||
                        a.id.localeCompare(c.id),
                    );
                  const lane = overlaps.findIndex((o) => o.id === b.id),
                    lanes = Math.max(1, overlaps.length);
                  return (
                    <button
                      className="time-block"
                      aria-label={`${field("title")}, ${displayTime(b.startEpoch,b.start)} to ${displayTime(b.endEpoch,b.end)}`}
                      key={b.id}
                      style={{
                        left: `calc(64px + (100% - 64px) * ${lane / lanes})`,
                        right: `calc((100% - 64px) * ${1 - (lane + 1) / lanes})`,
                        top:
                          (minutes(displayTime(b.startEpoch, b.start)) / 60) *
                          hourHeight,
                        height: Math.max(
                          24,
                          ((minutes(displayTime(b.endEpoch, b.end)) -
                            minutes(displayTime(b.startEpoch, b.start)) || 60) /
                            60) *
                            hourHeight,
                        ),
                        borderLeftColor: field("color"),
                        background: `color-mix(in srgb, ${field("color")} 13%, var(--surface))`,
                      }}
                      onClick={() =>
                        setEdit({
                          kind: "blocks",
                          item: {
                            ...b,
                            title: field("title"),
                            detail: field("detail"),
                            color: field("color"),
                            symbol: field("symbol"),
                          },
                        })
                      }
                    >
                      <strong>
                        <span style={{ color: field("color") }}>
                          <SymbolIcon value={field("symbol")}/>
                        </span>{" "}
                        {field("title")}
                      </strong>
                      <small>{field("detail")}</small>
                    </button>
                  );
                })}
                {date === displayedToday && (
                  <div
                    className="now-line"
                    aria-label="Current time"
                    style={{ top: (nowMinutes / 60) * hourHeight }}
                  />
                )}
              </div>
            </div>
          </section>
        )}
        {layout.todo && (
          <FloatingChecklist layout={layout} onChange={changeLayout}>{({x,y,topbar}:any)=><>
            <div
              className="panel-heading todo-drag"
              onPointerDown={(e) => {
                if ((e.target as HTMLElement).closest("button")) return;
                const el = e.currentTarget;
                el.setPointerCapture(e.pointerId);
                e.preventDefault();
                document.body.classList.add("dragging-ui");
                const bounds = {left:0,top:topbar,right:innerWidth,bottom:innerHeight,width:innerWidth,height:innerHeight-topbar};
                const panelBounds = el.parentElement!.getBoundingClientRect();
                const start = {
                  x: e.clientX,
                  y: e.clientY,
                  left: panelBounds.left - bounds.left,
                  top: panelBounds.top - bounds.top,
                };
                const move = (ev: PointerEvent) =>
                  changeLayout({
                    todoX: Math.max(
                      0,
                      Math.min(
                        Math.max(0, bounds.width - panelBounds.width),
                        start.left + ev.clientX - start.x,
                      ),
                    ),
                    todoY: Math.max(
                      0,
                      Math.min(
                        Math.max(0, bounds.height - panelBounds.height),
                        start.top + ev.clientY - start.y,
                      ),
                    ),
                  });
                el.addEventListener("pointermove", move);
                el.addEventListener(
                  "lostpointercapture",
                  () => {el.removeEventListener("pointermove", move);document.body.classList.remove("dragging-ui");},
                  { once: true },
                );
              }}
            >
              <div>
                <CheckSquare size={17} />
                <h2>Travel checklist</h2>
                <span className="count task-progress" title="Completed tasks / total tasks">
                  {day.tasks.filter((t) => optimisticTasks[t.id]?.checked??t.checked).length}/{day.tasks.length}
                </span>
              </div>
              <button
                className="icon"
                aria-label="Close tasks"
                onClick={() =>
                  changeLayout({
                    todo: false,
                    ...(!layout.map && !layout.timeline ? { map: true } : {}),
                  })
                }
              >
                <X size={17} />
              </button>
            </div>
            <div className="task-list">
              {visibleTasks.map((t) => (
                <div className={`task-row${taskIsCurrent(t)?" due-now":""}`} key={t.id}>
                  <input
                    type="checkbox"
                    aria-label={`Complete ${t.title}`}
                    checked={optimisticTasks[t.id]?.checked??t.checked}
                    disabled={readonly||optimisticTasks[t.id]?.saving}
                    onChange={() => toggleTask(t)}
                  />
                  <button onClick={() => setEdit({ kind: "tasks", item: t })}>
                    <span className={(optimisticTasks[t.id]?.checked??t.checked) ? "completed" : ""}>
                      {t.title}
                    </span>
                    {taskIsCurrent(t)&&<span className="task-now">Now</span>}
                    <small>
                      {[
                        day.pins.find((p) => p.id === t.pinId)?.title,
                        day.blocks.find((b) => b.id === t.blockId)?.title,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </small>
                  </button>
                </div>
              ))}
              {!day.tasks.length && (
                <div className="empty-tasks">
                  <CheckSquare size={28} />
                  <strong>No tasks yet</strong>
                </div>
              )}
            </div>
            {taskPages>1&&<div className="picker-pages task-pages"><button className="icon" aria-label="Previous tasks page" disabled={!currentTaskPage} onClick={()=>setTaskPage(currentTaskPage-1)}><ChevronLeft size={16}/></button><span>{currentTaskPage+1} / {taskPages}</span><button className="icon" aria-label="Next tasks page" disabled={currentTaskPage===taskPages-1} onClick={()=>setTaskPage(currentTaskPage+1)}><ChevronRight size={16}/></button></div>}
            {!readonly && (
              <button className="todo-add" onClick={() => newItem("tasks")}>
                <Plus size={17} /> Add a task
              </button>
            )}
            <div
              className="resize-grip"
              aria-label="Resize checklist"
              onPointerDown={(e) => {
                const el = e.currentTarget;
                el.setPointerCapture(e.pointerId);
                e.preventDefault();
                document.body.classList.add("dragging-ui");
                const bounds = {left:0,top:topbar,right:innerWidth,bottom:innerHeight,width:innerWidth,height:innerHeight-topbar};
                const panelBounds = el.parentElement!.getBoundingClientRect();
                const start = {
                  x: e.clientX,
                  y: e.clientY,
                  w: panelBounds.width,
                  h: panelBounds.height,
                };
                const move = (ev: PointerEvent) =>
                  changeLayout({
                    todoX: x,
                    todoY: y-topbar,
                    todoWidth: Math.max(
                      260,
                      Math.min(
                        bounds.right - panelBounds.left,
                        start.w + ev.clientX - start.x,
                      ),
                    ),
                    todoHeight: Math.max(
                      220,
                      Math.min(
                        bounds.bottom - panelBounds.top,
                        start.h + ev.clientY - start.y,
                      ),
                    ),
                  });
                el.addEventListener("pointermove", move);
                el.addEventListener(
                  "lostpointercapture",
                  () => {el.removeEventListener("pointermove", move);document.body.classList.remove("dragging-ui");},
                  { once: true },
                );
              }}
            />
          </>}</FloatingChecklist>
        )}

      </div>
      {calendar && (
        <div className="calendar-popover" ref={calendarBox}>
          <header>
            <button
              className="icon"
              aria-label="Previous month"
              onClick={() => {
                const d = new Date(`${month}-15`);
                d.setMonth(d.getMonth() - 1);
                setMonth(d.toLocaleDateString("en-CA").slice(0, 7));
              }}
            >
              <ChevronLeft size={18} />
            </button>
            <strong>
              {new Date(`${month}-15`).toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </strong>
            <button
              className="icon"
              aria-label="Next month"
              onClick={() => {
                const d = new Date(`${month}-15`);
                d.setMonth(d.getMonth() + 1);
                setMonth(d.toLocaleDateString("en-CA").slice(0, 7));
              }}
            >
              <ChevronRight size={18} />
            </button>
          </header>
          <div className="calendar-grid">
            {["S", "M", "T", "W", "T", "F", "S"].map((x, i) => (
              <small key={i}>{x}</small>
            ))}
            {Array.from(
              { length: new Date(`${month}-01`).getDay() },
              (_, i) => (
                <span key={`blank${i}`} />
              ),
            )}
            {Array.from(
              {
                length: new Date(
                  Number(month.slice(0, 4)),
                  Number(month.slice(5)),
                  0,
                ).getDate(),
              },
              (_, i) => {
                const d = `${month}-${String(i + 1).padStart(2, "0")}`,
                  matching = trips.filter(
                    (t) => t.startDate <= d && t.endDate >= d,
                  );
                return (
                  <button
                    key={d}
                    disabled={
                      d > maxDate() ||
                      Boolean(
                        shareTrip &&
                        trip &&
                        (d < trip.startDate || d > trip.endDate),
                      )
                    }
                    className={date === d ? "selected" : ""}
                    title={matching.map((t) => t.name).join(", ")}
                    onClick={() => switchDate(d)}
                  >
                    {i + 1}
                    <div>
                      {matching.slice(0, 3).map((t) => (
                        <i key={t.id} />
                      ))}
                    </div>
                  </button>
                );
              },
            )}
          </div>
          <div className="calendar-trips">
            {trips
              .filter(
                (t) =>
                  t.startDate <= `${month}-31` && t.endDate >= `${month}-01`,
              )
              .map((t) => (
                <button
                  key={t.id}
                  onClick={async () => {
                    await saveLayout();
                    setTrip(t);
                    setShareTrip(false);
                    switchDate(t.startDate);
                  }}
                >
                  <i />
                  {t.name}
                </button>
              ))}
          </div>
        </div>
      )}
      {(modal === "new-trip" || modal === "edit-trip") && (
        <Modal title={modal === "edit-trip" ? "Edit trip" : "Create trip"} onClose={() => setModal(null)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              try {
                const r = await api<{ trip: Trip }>(modal === "edit-trip" ? "trip.update" : "trip.create", {
                  tripId: modal === "edit-trip" ? trip?.id : undefined,
                  lodging: lodgingDraft,
                  clientTimezone:
                    Intl.DateTimeFormat().resolvedOptions().timeZone,
                  name: f.get("name"),
                  startDate: f.get("start"),
                  endDate: f.get("end"),
                });
                await saveLayout();
                setTrip(r.trip);
                setDate(r.trip.startDate);
                setShareTrip(false);
                history.replaceState({}, "", location.pathname);
                refresh();
                setModal(null);
              } catch (e: any) {
                setMessage(e.message);
              }
            }}
          >
            <Input
              label="Trip name"
              name="name"
              defaultValue={modal === "edit-trip" ? trip?.name : ""}
              maxLength={120}
              required
            />
            <div className="form-row">
              <Input
                label="First day"
                name="start"
                type="date"
                defaultValue={modal === "edit-trip" ? trip?.startDate : date}
                min={modal === "edit-trip" ? undefined : today()}
                max={maxDate()}
                required
              />
              <Input
                label="Last day"
                name="end"
                type="date"
                defaultValue={modal === "edit-trip" ? trip?.endDate : date}
                min={modal === "edit-trip" ? undefined : today()}
                max={maxDate()}
                required
              />
            </div>
            <span className="lodging-label">Lodging location</span>
            <div className="lodging-map"><Suspense fallback={<div>Loading map…</div>}><MapPanel pins={lodgingDraft?.lng!==undefined?[{id:"lodging",title:"Lodging",note:"",color:settings.accent,symbol:"icon:stay",lng:lodgingDraft.lng,lat:lodgingDraft.lat,versions:{}}]:[]} connections={[]} readonly={false} placementMode layout={lodgingView} onView={(center,zoom)=>setLodgingView(previous=>({...previous,center,zoom}))} onPin={()=>{}} onAdd={(lng,lat)=>setLodgingDraft({name:'Lodging',lng,lat,timezone:tzlookup(lat,lng)})}/></Suspense></div>
            {!lodgingDraft&&<small>Select your lodging on the map.</small>}
            {modal==='new-trip'&&<small>{trips.length}/100 saved trips</small>}
            <button
              className="button primary full"
              disabled={(modal === "new-trip" && trips.length >= 100)||lodgingDraft?.lng===undefined}
            >
              {modal === "edit-trip" ? "Save changes" : "Create trip"} <ArrowUpRight size={17} />
            </button>
          </form>
        </Modal>
      )}
      {edit && (
        <Modal
          title={`${readonly ? "View" : Object.keys(edit.item.versions ?? {}).length ? "Edit" : "Add"} ${edit.kind === "pins" ? "place" : edit.kind === "blocks" ? "time block" : edit.kind === "tasks" ? "task" : "connection"}`}
          onClose={() => setEdit(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              mutate(edit.kind, edit.item);
            }}
          >
            <fieldset disabled={readonly || saving}>
              {edit.kind !== "connections" && (
                <Input
                  label={
                    edit.kind === "pins"
                      ? "Place name"
                      : edit.kind === "tasks"
                        ? "Task"
                        : "Title"
                  }
                  required
                  value={edit.item.title}
                  maxLength={200}
                  onChange={(e: any) =>
                    setEdit({
                      ...edit,
                      item: {
                        ...edit.item,
                        title: e.target.value,
                        ...(edit.kind === "blocks"
                          ? {
                              overrides: [
                                ...new Set([...edit.item.overrides, "title"]),
                              ],
                            }
                          : {}),
                      },
                    })
                  }
                />
              )}
              {edit.kind === "pins" && Object.keys(edit.item.versions??{}).length>0 && <button type="button" className="button" onClick={()=>{setMovingPinId(edit.item.id);changeLayout({map:true});setEdit(null);}}>Edit location on map</button>}
              {edit.kind === "blocks" && (
                <>
                  <div className="form-row">
                    <Input
                      label="Starts at"
                      type="time"
                      required
                      value={edit.item.start}
                      onInput={(e: any) =>
                        setEdit({
                          ...edit,
                          item: { ...edit.item, start: e.currentTarget.value, disambiguation:null },
                        })
                      }
                      onChange={(e: any) =>
                        setEdit({
                          ...edit,
                          item: { ...edit.item, start: e.target.value, disambiguation:null },
                        })
                      }
                    />
                    <Input
                      label="Ends at"
                      type="time"
                      min={edit.item.start}
                      required
                      value={edit.item.end}
                      onInput={(e: any) =>
                        setEdit({
                          ...edit,
                          item: { ...edit.item, end: e.currentTarget.value, disambiguation:null },
                        })
                      }
                      onChange={(e: any) =>
                        setEdit({
                          ...edit,
                          item: { ...edit.item, end: e.target.value, disambiguation:null },
                        })
                      }
                    />
                  </div>
                  {(ambiguousTime||edit.item.disambiguation)&&<Select
                    label="Repeated hour (daylight saving)"
                    value={edit.item.disambiguation ?? ""}
                    onChange={(e: any) =>
                      setEdit({
                        ...edit,
                        item: {
                          ...edit.item,
                          disambiguation: e.target.value || null,
                        },
                      })
                    }
                  >
                    <option value="">Choose occurrence</option>
                    <option value="earlier">Earlier occurrence</option>
                    <option value="later">Later occurrence</option>
                  </Select>}
                  <Select
                    label="Linked place"
                    value={edit.item.pinId ?? ""}
                    onChange={(e: any) => {
                      const p = day.pins.find((p) => p.id === e.target.value);
                      setEdit({
                        ...edit,
                        item: {
                          ...edit.item,
                          pinId: p?.id ?? null,
                          ...(p
                            ? {
                                title: p.title,
                                detail: p.note,
                                color: p.color,
                                symbol: p.symbol,
                                overrides: [],
                              }
                            : {title:"",detail:"",color:settings.accent,symbol:"icon:stay",overrides:[]}),
                        },
                      });
                    }}
                  >
                    <option value="">Independent time block</option>
                    {day.pins.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </Select>
                </>
              )}
              {(edit.kind === "pins" || edit.kind === "blocks") && (
                <>
                  <label className="field">
                    <span>
                      {edit.kind === "pins" ? "Place note" : "Details"}
                    </span>
                    <textarea
                      rows={3}
                      maxLength={4000}
                      value={
                        edit.item[edit.kind === "pins" ? "note" : "detail"]
                      }
                      onChange={(e) => {
                        const key = edit.kind === "pins" ? "note" : "detail";
                        setEdit({
                          ...edit,
                          item: {
                            ...edit.item,
                            [key]: e.target.value,
                            ...(edit.kind === "blocks"
                              ? {
                                  overrides: [
                                    ...new Set([...edit.item.overrides, key]),
                                  ],
                                }
                              : {}),
                          },
                        });
                      }}
                    />
                  </label>
                  <div className="form-row">
                    <Input
                      label="Color"
                      type="color"
                      value={edit.item.color}
                      onInput={(e: any) =>
                        setEdit({
                          ...edit,
                          item: {
                            ...edit.item,
                            color: e.currentTarget.value,
                            ...(edit.kind === "blocks"
                              ? {
                                  overrides: [
                                    ...new Set([
                                      ...edit.item.overrides,
                                      "color",
                                    ]),
                                  ],
                                }
                              : {}),
                          },
                        })
                      }
                      onChange={(e: any) =>
                        setEdit({
                          ...edit,
                          item: {
                            ...edit.item,
                            color: e.target.value,
                            ...(edit.kind === "blocks"
                              ? {
                                  overrides: [
                                    ...new Set([
                                      ...edit.item.overrides,
                                      "color",
                                    ]),
                                  ],
                                }
                              : {}),
                          },
                        })
                      }
                    />
                    <SymbolPicker
                      value={edit.item.symbol}
                      onChange={(e: any) =>
                        setEdit({
                          ...edit,
                          item: {
                            ...edit.item,
                            symbol: e.target.value,
                            ...(edit.kind === "blocks"
                              ? {
                                  overrides: [
                                    ...new Set([
                                      ...edit.item.overrides,
                                      "symbol",
                                    ]),
                                  ],
                                }
                              : {}),
                          },
                        })
                      }
                    >
                    </SymbolPicker>
                  </div>
                </>
              )}
              {edit.kind === "tasks" && (
                <>
                  <Select
                    label="Linked place"
                    value={edit.item.pinId ?? ""}
                    onChange={(e: any) =>
                      setEdit({
                        ...edit,
                        item: { ...edit.item, pinId: e.target.value || null },
                      })
                    }
                  >
                    <option value="">No place</option>
                    {day.pins.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </Select>
                  <Select
                    label="Linked time"
                    value={edit.item.blockId ?? ""}
                    onChange={(e: any) =>
                      setEdit({
                        ...edit,
                        item: { ...edit.item, blockId: e.target.value || null },
                      })
                    }
                  >
                    <option value="">No time block</option>
                    {day.blocks.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.start} · {b.title}
                      </option>
                    ))}
                  </Select>
                </>
              )}
              {edit.kind === "connections" && (
                <>
                  <Select
                    label="From"
                    value={edit.item.from}
                    onChange={(e: any) =>
                      setEdit({
                        ...edit,
                        item: { ...edit.item, from: e.target.value },
                      })
                    }
                  >
                    {day.pins.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </Select>
                  <Select
                    label="To"
                    value={edit.item.to}
                    onChange={(e: any) =>
                      setEdit({
                        ...edit,
                        item: { ...edit.item, to: e.target.value },
                      })
                    }
                  >
                    {day.pins.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </Select>
                  <label className="checkbox-field">
                    <input
                      type="checkbox"
                      checked={edit.item.arrow}
                      onChange={(e) =>
                        setEdit({
                          ...edit,
                          item: { ...edit.item, arrow: e.target.checked },
                        })
                      }
                    />{" "}
                    Show direction arrow
                  </label>
                </>
              )}
            </fieldset>
            {!readonly && (
              <div className="modal-actions">
                {Object.keys(edit.item.versions ?? {}).length > 0 && (
                  <button
                    type="button"
                    className="button danger"
                    onClick={() => remove(edit.kind, edit.item)}
                  >
                    <Trash2 size={15} /> Delete
                  </button>
                )}
                <button className="button primary" disabled={saving}>
                  {saving ? "Saving…" : Object.keys(edit.item.versions??{}).length ? "Save changes" : edit.kind==="pins" ? "Create pin" : edit.kind==="blocks" ? "Create time block" : edit.kind==="tasks" ? "Create task" : "Create connection"}
                  <Check size={16} />
                </button>
              </div>
            )}
          </form>
          {edit.kind === "pins" &&
            day.connections
              .filter((c) => c.from === edit.item.id || c.to === edit.item.id).slice(connectionPage*3,connectionPage*3+3)
              .map((c) => (
                <div className="connection-row" key={c.id}>
                  {day.pins.find((p) => p.id === c.from)?.title}{" "}
                  {c.arrow ? "→" : "—"}{" "}
                  {day.pins.find((p) => p.id === c.to)?.title}
                  {!readonly && (
                    <button
                      className="icon"
                      onClick={() => setEdit({ kind: "connections", item: c })}
                    >
                      Edit
                    </button>
                  )}
                </div>
              ))}
          {edit.kind==='pins'&&day.connections.filter(c=>c.from===edit.item.id||c.to===edit.item.id).length>3&&<div className="picker-pages"><button type="button" className="icon" aria-label="Previous connections page" disabled={!connectionPage} onClick={()=>setConnectionPage(connectionPage-1)}><ChevronLeft size={15}/></button><span>{connectionPage+1} / {Math.ceil(day.connections.filter(c=>c.from===edit.item.id||c.to===edit.item.id).length/3)}</span><button type="button" className="icon" aria-label="Next connections page" disabled={(connectionPage+1)*3>=day.connections.filter(c=>c.from===edit.item.id||c.to===edit.item.id).length} onClick={()=>setConnectionPage(connectionPage+1)}><ChevronRight size={15}/></button></div>}
        </Modal>
      )}
      {modal === "trip" && trip && (
        <Modal title="Share trip" onClose={() => setModal(null)}>
          <h3>{trip.name}</h3>
          <h3>Travelers</h3>
          <div className="member-row"><span>{trip.ownerId===user?.uid?"Owner · You":"Trip owner"}</span></div>
          {!shareTrip&&<button className="button" onClick={()=>{setLodgingDraft(trip.lodging);setLodgingView({...layout,center:trip.lodging?[trip.lodging.lng,trip.lodging.lat]:layout.center,zoom:trip.lodging?14:layout.zoom});setModal("edit-trip");}}>Edit trip dates and lodging</button>}
          {shareTrip ? (
            <>
              <p>
                {publicMode === "editor"
                  ? "This itinerary is shared for viewing. Join the trip to collaborate with the group."
                  : "This link allows viewing only. Ask the trip owner for an invitation to collaborate."}
              </p>
              {publicMode === "editor" &&
                (!user ? (
                  <button
                    className="button primary"
                    disabled={!configured}
                    onClick={() => setModal("share-auth")}
                  >
                    Sign in to participate
                  </button>
                ) : (
                  <button
                    className="button primary"
                    onClick={async () => {
                      try {
                        const r = await api<{ trip: Trip }>("share.join", {
                          token,
                        });
                        setJoinedToken(token);
                        setTrip(r.trip);
                        setShareTrip(false);
                        setShareReady(false);
                        refresh();
                        history.replaceState({}, "", location.pathname);
                        setModal(null);
                      } catch (e: any) {
                        setMessage(e.message);
                      }
                    }}
                  >
                    Join this trip
                  </button>
                ))}
            </>
          ) : (
            <>
              {trip.ownerId === user?.uid && (
                <>
                  <Select
                    label="Share permissions"
                    value={shareMode}
                    onChange={(e: any) => setShareMode(e.target.value)}
                  >
                    <option value="viewer">View only</option>
                    <option value="editor">View and join as an editor</option>
                  </Select>
                  <button
                    className="button primary full"
                    onClick={async () => {
                      try {
                        const r = await api<{ token: string }>("share.create", {
                          tripId: trip.id,
                          mode: shareMode,
                        });
                        setShareLink(
                          `${location.origin}/?share=${encodeURIComponent(r.token)}`,
                        );
                      } catch (e: any) {
                        setMessage(e.message);
                      }
                    }}
                  >
                    <Share2 size={16} /> Create share link
                  </button>
                  {shareLink && (
                    <div className="share-result">
                      <input
                        readOnly
                        aria-label="Share link"
                        value={shareLink}
                      />
                      <button
                        className="button"
                        onClick={() =>
                          navigator.clipboard
                            .writeText(shareLink)
                            .then(() => setMessage("Link copied."))
                            .catch(() =>
                              setMessage("Select and copy the link manually."),
                            )
                        }
                      >
                        Copy
                      </button>
                    </div>
                  )}
                  <button
                    className="text-button"
                    onClick={async () => {
                      try {
                        await api("share.revoke", { tripId: trip.id });
                        setShareLink("");
                        setMessage("All sharing links revoked.");
                      } catch (e: any) {
                        setMessage(e.message);
                      }
                    }}
                  >
                    Revoke sharing links
                  </button>
                  {trip.memberIds.filter(id=>id!==trip.ownerId).slice(memberPage*4,memberPage*4+4)
                    .map((id) => (
                      <div className="member-row" key={id}>
                        <span>{id===trip.ownerId?"Owner":"Traveler"}{id===user.uid?" · You":` · ${id.slice(0,8)}`}</span>
                        {id!==trip.ownerId&&<button
                          className="text-button danger"
                          onClick={async () => {
                            if (!await confirmAction("Remove this traveler’s access?"))
                              return;
                            try {
                              await api("member.remove", {
                                tripId: trip.id,
                                userId: id,
                              });
                              setTrip({
                                ...trip,
                                memberIds: trip.memberIds.filter(
                                  (x) => x !== id,
                                ),
                              });
                            } catch (e: any) {
                              setMessage(e.message);
                            }
                          }}
                        >
                          Remove
                        </button>}
                      </div>
                    ))}
                  {trip.memberIds.length>5&&<div className="picker-pages"><button type="button" className="icon" aria-label="Previous travelers page" disabled={!memberPage} onClick={()=>setMemberPage(memberPage-1)}><ChevronLeft size={15}/></button><span>{memberPage+1} / {Math.ceil((trip.memberIds.length-1)/4)}</span><button type="button" className="icon" aria-label="Next travelers page" disabled={(memberPage+1)*4>=trip.memberIds.length-1} onClick={()=>setMemberPage(memberPage+1)}><ChevronRight size={15}/></button></div>}
                </>
              )}
              <div className="delete-trip">
                <button
                  className="button danger"
                  onClick={async () => {
                    if (
                      !await confirmAction(
                        trip.ownerId === user?.uid
                          ? "Permanently delete this trip for EVERYONE? This cannot be undone."
                          : "Remove this trip from your account? Other travelers keep it.",
                      )
                    )
                      return;
                    try {
                      await api("trip.remove", { tripId: trip.id });
                      setTrip(null);
                      setDay(emptyDay());
                      refresh();
                      setModal(null);
                    } catch (e: any) {
                      setMessage(e.message);
                    }
                  }}
                >
                  <Trash2 size={15} />
                  {trip.ownerId === user?.uid
                    ? "Delete trip for everyone"
                    : "Remove trip"}
                </button>
              </div>
            </>
          )}
        </Modal>
      )}
      {modal === "share-auth" && !user && (
        <Modal title="Sign in to participate" onClose={() => setModal("trip")}>
          <AuthScreen onError={setMessage} />
        </Modal>
      )}
      {modal === "settings" && (
        <Modal title="Your preferences" onClose={() => setModal(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveSettings(settings);
            }}
          >
            <Input
              label="Display name"
              value={settings.displayName ?? user?.displayName ?? ""}
              maxLength={80}
              onChange={(e: any) =>
                setSettings({ ...settings, displayName: e.target.value })
              }
            />
            <div className="field photo-field">
              <span>Profile photo</span>
              <input
                aria-label="Choose profile photo"
                ref={profilePhoto}
                hidden
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 10_000_000) {
                    setMessage("Choose an image smaller than 10 MB.");
                    return;
                  }
                  try {
                    const bitmap = await createImageBitmap(file);
                    const canvas = document.createElement("canvas");
                    canvas.width = canvas.height = 128;
                    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, 128, 128);
                    bitmap.close();
                    setSettings({
                      ...settings,
                      photoURL: canvas.toDataURL("image/jpeg", 0.75),
                    });
                  } catch {
                    setMessage("This image could not be read.");
                  }
                }}
              />
              <button type="button" className="button photo-picker-button" onClick={() => profilePhoto.current?.click()}>{settings.photoURL ? "Change photo" : "Choose image"}</button>
              <span className="photo-file-note">JPG, PNG or WebP · up to 10 MB</span>
            </div>
            <div className="form-row">
              <Select
                label="Appearance"
                value={settings.theme}
                onChange={(e: any) =>
                  setSettings({ ...settings, theme: e.target.value })
                }
              >
                <option value="system">Automatic</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </Select>
              <Input
                label="Accent color"
                type="color"
                value={settings.accent}
                onInput={(e: any) =>
                  setSettings({ ...settings, accent: e.currentTarget.value })
                }
                onChange={(e: any) =>
                  setSettings({ ...settings, accent: e.target.value })
                }
              />
            </div>
            <Select
              label="Starting map view"
              value={settings.mapStart}
              onChange={(e: any) => setSettings({ ...settings, mapStart: e.target.value })}
            >
              <option value="trip">Trip lodging · world map without a trip</option>
              <option value="current">My current location</option>
              <option value="custom">A place I choose</option>
              <option value="world">World map</option>
            </Select>
            {settings.mapStart==='custom'&&<button type="button" className="button" onClick={()=>{setSettingsMapView({...layout,center:settings.mapCenter,zoom:settings.mapZoom});setModal('map-preference');}}>Choose starting location on map</button>}
            <Select
              label="Clock"
              value={settings.clock}
              onChange={(e: any) =>
                setSettings({ ...settings, clock: e.target.value })
              }
            >
              <option value="local">My local time</option>
              <option value="destination">Destination time</option>
              <option value="lodging">Lodging local time</option>
              <option value="utc">UTC</option>
            </Select>
            {settings.clock==='destination'&&<TimezonePicker value={settings.timezone} onChange={(e:any)=>setSettings({...settings,timezone:e.target.value})}/>}
            <small className="active-clock">Active clock: {timezone}</small>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={settings.autoDelete}
                onChange={(e) =>
                  setSettings({ ...settings, autoDelete: e.target.checked })
                }
              />{" "}
              Automatically remove old trips from my account
            </label>
            <Select
              label="Remove from my account after the trip ends"
              value={settings.retentionDays}
              disabled={!settings.autoDelete}
              onChange={(e: any) =>
                setSettings({
                  ...settings,
                  retentionDays: Number(e.target.value),
                })
              }
            >
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
              <option value={365}>One year</option>
            </Select>
            <p className="form-note">
              Automatic removal affects your account only. Other travelers keep
              their copy of the shared trip.
            </p>
            <button className="button primary full" disabled={!user}>
              Save preferences
            </button>
            <div className="settings-footer">
              <small>
                Journas · Version 1.0.0
              </small>
            </div>
          </form>
        </Modal>
      )}
      {conflict && (
        <Modal
          title="Someone updated this item"
          onClose={() => setConflict(null)}
        >
          <p>
            Your changes overlap with another traveler’s edit. Your draft is
            preserved.
          </p>
          <table className="conflict-table">
            <thead>
              <tr>
                <th>Detail</th>
                <th>Your draft</th>
                <th>Latest version</th>
              </tr>
            </thead>
            <tbody>
              {conflict.fields.map((field: string) => {
                const labels: Record<string, string> = {
                  title: "Name",
                  note: "Place note",
                  detail: "Description",
                  start: "Starts at",
                  end: "Ends at",
                  lng: "Longitude",
                  lat: "Latitude",
                  pinId: "Linked place",
                  blockId: "Linked time",
                  overrides: "Custom properties",
                  timezone: "Time zone",
                  disambiguation: "Repeated hour",
                };
                const display = (value: any) =>
                  value === null || value === undefined
                    ? "None"
                    : field === "pinId"
                      ? (day.pins.find((pin) => pin.id === value)?.title ??
                        "Removed place")
                      : field === "blockId"
                        ? (day.blocks.find((block) => block.id === value)
                            ?.title ?? "Removed time")
                        : Array.isArray(value)
                          ? value.join(", ")
                          : typeof value === "boolean"
                            ? value
                              ? "Yes"
                              : "No"
                            : String(value);
                return (
                  <tr key={field}>
                    <th>
                      {labels[field] ??
                        field.charAt(0).toUpperCase() + field.slice(1)}
                    </th>
                    <td>{display(conflict.draft.item[field])}</td>
                    <td>{display(conflict.current[field])}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="modal-actions">
            <button
              className="button"
              onClick={() => {
                const draftKey = `journas-drafts:${user?.uid}:${trip?.id}:${date}`;
                const pending = JSON.parse(
                  localStorage.getItem(draftKey) ?? "{}",
                );
                delete pending[conflict.draft.item.id];
                if (Object.keys(pending).length)
                  localStorage.setItem(draftKey, JSON.stringify(pending));
                else localStorage.removeItem(draftKey);
                setEdit({
                  ...conflict.draft,
                  item: conflict.current,
                  base: structuredClone(conflict.current),
                });
                setConflict(null);
              }}
            >
              Use latest version
            </button>
            <button
              className="button primary"
              onClick={() =>
                mutate(conflict.draft.kind, conflict.draft.item, true)
              }
            >
              Keep my changes
            </button>
          </div>
        </Modal>
      )}
      {modal==='map-preference'&&<Modal title="Starting map location" onClose={()=>setModal('settings')}><div className="settings-location-map"><Suspense fallback={<div>Loading map…</div>}><MapPanel pins={[]} connections={[]} readonly layout={settingsMapView} onPin={()=>{}} onAdd={()=>{}} onView={(center,zoom)=>setSettingsMapView(previous=>({...previous,center,zoom}))}/></Suspense></div><button className="button primary full" onClick={()=>{setSettings({...settings,mapCenter:settingsMapView.center,mapZoom:settingsMapView.zoom});setModal('settings');}}>Use this map view</button></Modal>}
      {confirmation&&<Modal title="Confirm deletion" onClose={()=>{confirmation.resolve(false);setConfirmation(null);}}><p>{confirmation.message}</p><div className="modal-actions"><button className="button" onClick={()=>{confirmation.resolve(false);setConfirmation(null);}}>Cancel</button><button className="button danger" onClick={()=>{confirmation.resolve(true);setConfirmation(null);}}>Confirm</button></div></Modal>}
      <Toast message={message} onDismiss={() => setMessage("")} />
    </div>
  );
}
