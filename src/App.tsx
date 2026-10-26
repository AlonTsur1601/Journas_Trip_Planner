import KeyboardShortcuts from './KeyboardShortcuts';
import {timelineZoom,outsideTimelineHeight,outsideTimelineKey} from './timeline-zoom';
import {dayLayout,screenLayout,restoredDayMatches,fallbackDayLayout} from './view-restore';
import {visibleConnections,type PendingConnection} from './connection-preview';
import {SearchInput} from './SearchInput';
import {taskLinkLabels} from './plan-labels';
import {SearchableList} from './SearchableList';
import {AsyncButton} from './AsyncButton';
import type {MapPanelHandle} from './MapPanel';
import {optimisticTaskList} from './optimistic-tasks';
import {LoadingSpinner} from './LoadingScreen';
import {useLiveLocation} from './live-location';
import {nearbyActivities,nearbyTasks} from './nearby-activity';
import {canPasteCopiedPin,type CopiedPin} from './pin-clipboard';
import {userErrorMessage} from "./user-error";
import type {Connection} from "./types";
import type {CSSProperties} from "react";
import {ConnectionDetails} from "./ConnectionDetails";
import {PlanLinkField} from "./PlanLinkField";
import {connectionTitle,connectionTitleSource} from "./connection-label";
import {AccountNameField} from "./AccountNameField";
import {readAppearance,cacheAppearance,applyAccent,isBlackAccent} from "./appearance-cache";
import WorkspaceMotion from "./WorkspaceMotion";
import {MotionSurface} from "./MotionSurface";
import { Undo2, Redo2 } from "lucide-react";
import { Activity, memo, lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {

  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,

  signOut,
  type User,
} from "firebase/auth";
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
  Info,
  Trash2,
  ArrowUpRight,
  Compass,
  LogOut,
  Check,
  Save,
} from "lucide-react";
import tzlookup from "tz-lookup";
import LocationPicker from "./LocationPicker";
import {useSessionVerification} from "./session-verification";
import {practiceActive,getPracticeSession,setPractice,practiceLocal,practiceSession} from "./practice";
import GuidedTour from './GuidedTour';
import HomePage, {TripBadge} from "./HomePage";
import LoadingScreen,{BackgroundStatus,hasOpenedWorkspace,finishStartup} from './LoadingScreen';
import {initialProfile,releaseInitialProfile} from './startup';
import {beginActivity} from './activity';
import {emptyHome,availableHome,recordVisit,randomTripAppearance,tripAppearance} from "./home-state";
import type {HomeState,HomeTarget,TripAppearance} from "./types";
import {PasswordField} from "./PasswordField";
import {AccountCredentials} from "./AccountCredentials";
import {AccountName} from "./AccountName";
import {lodgingName,isManualLodgingName} from "./lodging-name";
import {accountPhoto,accountName} from "./account-profile";
import { api as profileApi, auth, configured, observeAuthSession } from "./firebase";
import {verificationReturnClient,listenForVerificationSession} from './email-verification-return';
import {changeBlockPlace,changeBlockConnection} from './block-link';
import {blockRange} from './block-range';
import { observeClock, followCalendarDay } from "./day-clock";
import { startingLayout, lodgingForDate, tripForDate } from "./map-start";
import {Popover} from "./Popover";
import { Dropdown, ColorPicker, Toast } from "./Controls";
import {calendarTripColors} from "./calendar-colors";
import { MonthCalendar, DateField, DateRangeFields, TimeField, SymbolPicker, SymbolIcon, FloatingChecklist, TimezonePicker } from "./PlannerControls";
const ProfilePhotoCropper = lazy(() => import("./ProfilePhotoCropper"));
let mapPanelLoad:ReturnType<typeof importMapPanel>|undefined;
const importMapPanel=()=>import("./MapPanel");
const loadMapPanel=()=>mapPanelLoad??=importMapPanel();
const MapPanel = lazy(loadMapPanel);
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
  locationSelected?: boolean;
};
function ProfileAvatar({src, fallback, name, id, accent="var(--accent)"}: {src?:string;fallback?:string;name:string;id:string;accent?:string}) {
  const [failed, setFailed] = useState<string[]>([]);
  const photo = [src, fallback].find(url => url && !failed.includes(url));
  return <span className="avatar profile-avatar" style={photo?undefined:{background:isBlackAccent(accent)?"var(--neutral-accent)":accent,color:isBlackAccent(accent)?"var(--neutral-accent-ink)":"#fff"}}>{photo ? <img key={photo} src={photo} referrerPolicy="no-referrer" alt="" onError={()=>setFailed(previous=>[...previous,photo])}/> : Array.from(name.trim())[0]?.toLocaleUpperCase()}</span>;
}
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
function Modal({ title, children, onClose, inactive=false, locked=false }: any) {
  const box = useRef<HTMLElement>(null);
  useEffect(() => {
    if(inactive)return;
    const previous = document.activeElement as HTMLElement;
    box.current
      ?.querySelector<HTMLElement>("input,button,select,textarea")
      ?.focus();
    const handler = (event: KeyboardEvent) => {
      if (!box.current?.contains(document.activeElement)) return;
      if (event.key === "Escape") {
        event.stopPropagation();
        if (!locked) onClose();
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
  }, [inactive, locked]);
  return (
    <MotionSurface><div
      inert={inactive}
      aria-hidden={inactive||undefined}
      className={`modal-shade${inactive?" inactive-modal":""}`}
      onMouseDown={(e) => {
        if (!locked && e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={box}
        className={`modal${title === "Your preferences" ? " settings-modal" : title === "Places" ? " places-modal" : /pin|place|time block/i.test(title) ? " item-modal" : /^(Create|Edit) trip$/.test(title) ? " trip-modal" : /task/i.test(title) ? " task-modal" : title === "Trip details" ? " share-modal" : title === "Confirm deletion" ? " confirm-modal" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <h2>{title}</h2>
          {!locked && <AsyncButton className="icon" onClick={onClose} aria-label="Close">
            <X size={20} />
          </AsyncButton>}
        </header>
        {children}
      </section>
    </div></MotionSurface>
  );
}
const api=profileApi;
function EmailVerification({user,onVerified,onLogout}:{user:User;onVerified:()=>void;onLogout:()=>Promise<void>}) {
  const [notice,setNotice]=useState("Preparing your verification email…");
  const [busy,setBusy]=useState(false);
  const checking=useRef(false);
  const sending=useRef(false);
  const [resendWait,setResendWait]=useState(0);
  useEffect(()=>{const update=()=>setResendWait(Math.max(0,Math.ceil((Number(sessionStorage.getItem(`journas-verification-sent:${user.uid}`))+30000-Date.now())/1000)));update();const timer=setInterval(update,1000);return()=>clearInterval(timer);},[user.uid]);
  async function send(){
    const sent=Number(sessionStorage.getItem(`journas-verification-sent:${user.uid}`));
    if(sent&&Date.now()-sent<30000){setResendWait(Math.ceil((sent+30000-Date.now())/1000));return;}
    if(sending.current)return;sending.current=true;setBusy(true);setNotice("Sending verification email…");
    sessionStorage.setItem(`journas-verification-sent:${user.uid}`,String(Date.now()));setResendWait(30);
    try{const plainText=new URLSearchParams(window.location.search).get("email-format")==="text";await api("auth.email-verification",{returnClientId:await verificationReturnClient(),...(plainText?{format:"text"}:{})});setNotice(plainText?"Plain-text verification email sent. Check your inbox and spam folder.":"Verification email sent. Check your inbox and spam folder.");}
    catch(e:any){if(e.code==='EMAIL_RATE_LIMIT'){const wait=Math.min(3600,Math.max(1,Number(e.details?.retryAfter)||30));sessionStorage.setItem(`journas-verification-sent:${user.uid}`,String(Date.now()-(30-wait)*1000));setResendWait(wait);}else{sessionStorage.removeItem(`journas-verification-sent:${user.uid}`);setResendWait(0);}setNotice(e.code==='EMAIL_RATE_LIMIT'?'Please wait before sending another verification email.':e.code==='auth/too-many-requests'?"Too many email requests. Please wait a few minutes and try again.":e.code==='auth/network-request-failed'?"We couldn’t send the email. Check your connection and try again.":userErrorMessage(e,"We couldn’t send the verification email. Please try again."));}
    finally{sending.current=false;setBusy(false);}
  }
  useEffect(()=>{const sent=Number(sessionStorage.getItem(`journas-verification-sent:${user.uid}`));if(sent&&Date.now()-sent<30000)setNotice("A verification email was recently sent. Check your inbox and spam folder.");else void send();},[user.uid]);
  async function check(){
    if(checking.current)return;checking.current=true;
    try{await user.reload();if((await api<{verified:boolean}>('auth.verification-status')).verified){await user.getIdToken(true);onVerified();}}
    catch{/* Retry automatically on the next check or when the window regains focus. */}
    finally{checking.current=false;}
  }
  useEffect(()=>{const focus=()=>{void check();};const message=(event:MessageEvent)=>{if(event.data?.type==='journas-email-verified')void check();};const storage=(event:StorageEvent)=>{if(event.key==='journas-email-verified')void check();};const timer=setInterval(focus,5000);window.addEventListener('focus',focus);window.addEventListener('storage',storage);navigator.serviceWorker?.addEventListener('message',message);void check();return()=>{clearInterval(timer);window.removeEventListener('focus',focus);window.removeEventListener('storage',storage);navigator.serviceWorker?.removeEventListener('message',message);};},[user.uid]);
  return <main className="home-page email-verification-screen"><div className="auth-map-background" aria-hidden="true"/><Modal title="Verify your email" locked>
    <p>Verify <strong>{user.email}</strong> before continuing to Journas.</p>
    <p>We are asking everyone to confirm their email once more. After confirmation, you will not be asked again for this check.</p><p>Open your inbox and click the verification link. Check your spam folder if the email is missing.</p>
    <p role="status" aria-live="polite">{notice}</p>
    <div className="email-verification-actions"><AsyncButton className="button primary" disabled={busy||resendWait>0} onClick={send}>{resendWait>0?`Resend email (${resendWait}s)`:"Resend email"}</AsyncButton>
    <AsyncButton className="button" disabled={busy} onClick={onLogout}>Back</AsyncButton></div>
  </Modal></main>;
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

const AuthScreen = memo(function AuthScreen({ onError }: { onError: (s: string) => void }) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [confirmPassword, setConfirmPassword] = useState(""),
    [register, setRegister] = useState(false),
    [busy, setBusy] = useState(false);
  async function run(fn: () => Promise<unknown>,description=register?'Creating your account…':'Signing you in…') {
    setBusy(true);
    const finish=beginActivity(description);
    try {
      await fn();
    } catch (e: any) {
      onError(userErrorMessage(e));
    } finally {
      finish();
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
            <AsyncButton
              className="google button"
              disabled={busy}
              onClick={() =>
                run(() => signInWithPopup(auth!, new GoogleAuthProvider()))
              }
            >
              <img className="google-logo" src="/google-logo.svg" alt="" width="20" height="20" /> Continue with Google
            </AsyncButton>
            <div className="divider">or continue with email</div>
            <form name="journas-auth" autoComplete="on"
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  if (register) {
                    if(password.length<6) throw new Error("Use at least 6 characters for your password.");
                    if(password !== confirmPassword) throw new Error("Passwords do not match.");
                    await createUserWithEmailAndPassword(
                      auth!,
                      email,
                      password,
                    );

                  } else
                    await signInWithEmailAndPassword(auth!, email, password);
                });
              }}
            >
              <Input
                label="Email address"
                type="email"
                required
                name="email"
                autoComplete={register?"email":"username"}
                value={email}
                onChange={(e: any) => setEmail(e.target.value)}
              />
              <PasswordField
                label="Password" name="password"
                required
                minLength={6}
                autoComplete={register ? "new-password" : "current-password"}
                value={password}
                onChange={(e: any) => setPassword(e.target.value)}
              />
              {register && <PasswordField label="Confirm password" required minLength={6} autoComplete="new-password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} />}
              <AsyncButton pending={busy} className="button primary full" disabled={busy}>
                {busy
                  ? "Please wait…"
                  : register
                    ? "Create account"
                    : "Sign in"}
                <ArrowUpRight size={17} />
              </AsyncButton>
            </form>
            <AsyncButton
              className="text-button"
              onClick={() => {
                if (!email) {
                  onError("Enter your email address first.");
                  return;
                }
                return run(async () => {
                  await api('auth.password-reset',{email});
                  onError("Password reset email sent.");
                },'Sending your password reset email…');
              }}
            >
              Forgot password?
            </AsyncButton>
            <p className="auth-switch auth-signup-prompt">
              {register ? "Already have an account?" : "New to Journas?"}{" "}
              <AsyncButton
                className="button primary"
                onClick={() => setRegister(!register)}
              >
                {register ? "Sign in" : "Create an account"}
              </AsyncButton>
            </p>
          </>
        )}
        <footer>Your trips and preferences are saved to your account. <a href="/privacy.html">Privacy policy</a></footer>
      </section>
    </main>
  );
});
export default function App(){
 const [practice,setPracticeMode]=useState(practiceActive());
 const verification=useSessionVerification();
 const cachedIdentity=useRef(verification.accountId);
 useEffect(()=>{if(cachedIdentity.current!==verification.accountId){cachedIdentity.current=verification.accountId;if(practice){setPractice(false);setPracticeMode(false);}}},[verification.accountId,practice]);
 useEffect(()=>{const change=(event:Event)=>{const detail=(event as CustomEvent).detail;const value=typeof detail==="boolean"?detail:Boolean(detail?.active);setPractice(value,auth?.currentUser?.uid,detail?.profile?.accent??readAppearance(auth?.currentUser?.uid??"" ).accent,{...detail?.profile});setPracticeMode(value);};window.addEventListener('journas-practice',change);return()=>window.removeEventListener('journas-practice',change);},[]);
 return <><Activity mode={practice?'hidden':'visible'}><PlannerApp key={verification.accountId??"signed-out"} practice={false} verified={verification.verified} onVerified={verification.confirm}/></Activity>{practice&&<PlannerApp practice verified={verification.verified} onVerified={verification.confirm}/>}</>;
}
function PlannerApp({practice,verified,onVerified}:{practice:boolean;verified:boolean|null;onVerified:()=>void}) {
 const [practiceData]=useState(()=>practice?getPracticeSession():null);
 const api:typeof profileApi=(action,data,signal,background)=>profileApi(action,data,signal,background,practiceData);
 const localStorage=practice?practiceLocal:window.localStorage,sessionStorage=practice?practiceSession:window.sessionStorage;
 const loadedAccount=useRef('');
 const observedAccount=useRef<string|null|undefined>(undefined);
 const loadedDay=useRef('');
 const navigationVersion=useRef(0);
 const dayCache=useRef(new globalThis.Map<string,{day:Day;layout:Layout|null}>());
 const layoutWrites=useRef(new globalThis.Map<string,Promise<unknown>>());
  const [user, setUser] = useState<User | null>(()=>practice?auth?.currentUser??null:null),
    [ready, setReady] = useState(practice||!configured),
    [trips, setTrips] = useState<Trip[]>([]),
    [trip, setTrip] = useState<Trip | null>(null),
    [date, setDate] = useState(today()),
    [day, setDay] = useState<Day>(emptyDay),
    [layout, setLayout] = useState<Layout>(defaultLayout),
    [settings, setSettings] = useState<Settings>(()=>({...defaultSettings,...readAppearance(document.documentElement.dataset.appearanceUser??""),...(practiceData?.profile??{})})),
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
    [pendingItems,setPendingItems] = useState<string[]>([]),
    [manualSaving, setManualSaving] = useState(false);
  const pendingItemWrites=useRef(new Set<string>());
  const saving=Boolean(edit&&pendingItems.includes(`${trip?.id}:${date}:${edit.kind}:${edit.item.id}`));
  const [tourSeen,setTourSeen]=useState<boolean|undefined>(undefined);
  const [chooseName,setChooseName]=useState(false);
  const [home,setHome]=useState(!new URLSearchParams(location.search).has('share'));
  const [homeState,setHomeState]=useState<HomeState>(emptyHome);
  const homeRef=useRef(homeState);homeRef.current=homeState;
  const homeWrites=useRef<Promise<unknown>>(Promise.resolve());
  const homeLastQueued=useRef('');
  const homeBusy=false;
  const [lastTarget,setLastTarget]=useState<HomeTarget|null>(null);
  const pendingTripForms=useRef(new WeakSet<HTMLFormElement>());
  const [tripSaving,setTripSaving]=useState(false);
  const [tripLook,setTripLook]=useState<TripAppearance>(randomTripAppearance);
  const [tripCrop,setTripCrop]=useState<File|null>(null);
  const tripPhoto=useRef<HTMLInputElement>(null);
  const [googleSession,setGoogleSession]=useState(false);
  const [savedProfile,setSavedProfile]=useState(()=>({displayName:settings.displayName,photoURL:settings.photoURL}));
  const activePhoto=accountPhoto(user,googleSession,savedProfile.photoURL);
  const draftPhoto=accountPhoto(user,googleSession,settings.photoURL);

  const [movingPinId,setMovingPinId]=useState<string|null>(null);
  const calendarDark=settings.theme==='dark'||settings.theme==='system'&&matchMedia('(prefers-color-scheme: dark)').matches;
  const tripDotColors=useMemo(()=>calendarTripColors(trips,settings.accent,calendarDark),[trips,settings.accent,calendarDark]);
  const [pendingConnections,setPendingConnections]=useState<PendingConnection[]>([]);
  const visibleDayConnections=useMemo(()=>visibleConnections(day.connections,pendingConnections,trip?.id,date),[day.connections,pendingConnections,trip?.id,date]);
  const mapPins=useMemo(()=>trip?.lodging?[{id:"trip-lodging",title:trip.lodging.name,nameSource:trip.lodging.nameSource,note:trip.lodging.note??"",color:trip.lodging.color??settings.accent,symbol:trip.lodging.symbol??"icon:stay",lng:trip.lodging.lng,lat:trip.lodging.lat,versions:{}},...day.pins]:day.pins,[trip?.lodging,day.pins,settings.accent]);
  const placementSaves=useRef(Promise.resolve());
  const lodgingNameEdited=useRef(false);
  const [lodgingDraft,setLodgingDraft]=useState<Trip["lodging"]>(undefined);
  const [lodgingView,setLodgingView]=useState(defaultLayout());
  const [profileOpen,setProfileOpen]=useState(false);const profileAnchor=useRef<HTMLDivElement>(null);
  const [ambiguousTime,setAmbiguousTime]=useState(false);
  const [copiedPin,setCopiedPin]=useState<CopiedPin|null>(null);
  const [pastingPin,setPastingPin]=useState(false);
  const pinPasteBusy=useRef(false);
  const liveLocation=useLiveLocation(ready&&(!home||shareTrip)&&!practice);
  const [optimisticTasks,setOptimisticTasks]=useState<Record<string,{checked:boolean;saving:boolean}>>({});
  const taskToggleQueue=useRef(new globalThis.Map<string,{checked:boolean;item:Day['tasks'][number]}>());
  const [pendingDayNavigation,setPendingDayNavigation]=useState<{tripId:string;date:string;direction:'next'|'previous'}|null>(null);
  const finishDayNavigation=(tripId:string,loadedDate:string)=>setPendingDayNavigation(previous=>previous?.tripId===tripId&&previous.date===loadedDate?null:previous);
  useEffect(()=>{if(home||!trip||(!user&&!shareTrip)||date<trip.startDate||date>trip.endDate)setPendingDayNavigation(null);},[home,trip?.id,trip?.startDate,trip?.endDate,date,user?.uid,shareTrip]);
  const [defaultHourHeight,setDefaultHourHeight]=useState(innerWidth<=700?48:57);
  const hourHeight=layout.hourHeight??(!trip?outsideTimelineHeight(localStorage,user?.uid??'guest',date):undefined)??defaultHourHeight;
  const [historyState,setHistoryState]=useState<{undo:string|null;redo:string|null}>({undo:null,redo:null});
  const [historyBusy,setHistoryBusy]=useState(false);
  const [travelers,setTravelers]=useState<any[]>([]);
  const [shareLinks,setShareLinks]=useState<any[]>([]);
  const [,refreshAccount]=useState(0);
  const [verificationRevision,setVerificationRevision]=useState(0);
  useEffect(()=>user?listenForVerificationSession(user):undefined,[user?.uid]);
  useEffect(()=>{if(user&&ready&&loadedAccount.current===user.uid&&verified===true&&!practice)finishStartup();},[user?.uid,ready,verified]);
  const reloadVisit=useRef((performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming|undefined)?.type==="reload");
  const screenReady=useRef(false);
  useEffect(()=>{if(ready&&user&&!practice)cacheAppearance(settings,user.uid);},[ready,user?.uid,practice,settings.theme,settings.accent]);
  const settingsRef=useRef(settings);settingsRef.current=settings;
  const savedSettings=useRef(settings);
  const discardSettings=()=>{settingsRef.current=savedSettings.current;setSettings(savedSettings.current);setModal(null);};
  const savedAccountName=useRef<string|undefined>(undefined);
  const [confirmation,setConfirmation]=useState<{message:string;resolve:(answer:boolean)=>void}|null>(null);
  const confirmAction=(message:string)=>new Promise<boolean>(resolve=>setConfirmation({message,resolve}));

  const token = new URLSearchParams(location.search).get("share");
  const mapFocus=useRef<MapPanelHandle|null>(null);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const tripRef = useRef(trip);
  tripRef.current = trip;
  const dateRef = useRef(date);
  dateRef.current = date;
  const dirty = useRef(false);
  const layoutLoading = useRef(false);
  const scroller = useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{if(layout.timeline&&scroller.current)scroller.current.scrollTop=layoutRef.current.scroll;},[layout.timeline,hourHeight]);
  const calendarBox = useRef<HTMLDivElement>(null);
  const initialTripRequest=useRef<{tripId:string;date:string;promise:Promise<{trip:Trip;day:Day;layout:Layout|null}|null>}|null>(null);
  useEffect(()=>{if(trip&&loadedDay.current===`${trip.id}:${date}`){const key=loadedDay.current;dayCache.current.delete(key);dayCache.current.set(key,{day,layout});if(dayCache.current.size>24)dayCache.current.delete(dayCache.current.keys().next().value!);}},[trip?.id,date,day,layout]);
  const profilePhoto = useRef<HTMLInputElement>(null);
  const [photoCrop,setPhotoCrop]=useState<File|null>(null);
  const [shortcutsOpen,setShortcutsOpen]=useState(false);
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
  useEffect(()=>{if(modal==='new-trip')setTripLook(randomTripAppearance());else if(modal==='edit-trip'&&trip)setTripLook(tripAppearance(trip));},[modal]);
  const [time, setTime] = useState(new Date());
  useEffect(()=>{const resize=()=>setDefaultHourHeight(innerWidth<=700?48:57);window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize);},[]);
  useEffect(()=>{
    const viewport=scroller.current,panel=viewport?.closest('.schedule-panel');
    if(home||!ready||!viewport||!panel)return;
    const zoom=(factor:number,anchor:number)=>{
      if(layoutLoading.current)return;
      const height=layoutRef.current.hourHeight??(!tripRef.current?outsideTimelineHeight(localStorage,user?.uid??'guest',dateRef.current):undefined)??(innerWidth<=700?48:57);
      changeLayout(timelineZoom(height,viewport.scrollTop,anchor,factor,viewport.clientHeight));
    };
    const wheel=(event:Event)=>{
      const e=event as WheelEvent;if(!e.ctrlKey)return;
      e.preventDefault();
      const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?viewport.clientHeight:1);
      const anchor=Math.max(0,Math.min(viewport.clientHeight,e.clientY-viewport.getBoundingClientRect().top));
      zoom(Math.exp(-delta*.002),anchor);
    };
    const key=(e:KeyboardEvent)=>{
      if(!e.ctrlKey||e.altKey||!(panel.matches(':hover')||panel.contains(document.activeElement))||(e.target as Element)?.closest('input,textarea,[contenteditable="true"]'))return;
      if(!['+','=','-','_'].includes(e.key))return;
      e.preventDefault();zoom(['+','='].includes(e.key)?1.15:1/1.15,viewport.clientHeight/2);
    };
    panel.addEventListener('wheel',wheel,{passive:false});document.addEventListener('keydown',key);
    return()=>{panel.removeEventListener('wheel',wheel);document.removeEventListener('keydown',key);};
  },[home,ready,layout.timeline]);
  useEffect(()=>{setAmbiguousTime(false);},[edit?.item.start,edit?.item.end,edit?.item.timezone,date]);

  useEffect(() => {
    if (!message) return;
    const timeout = setTimeout(() => setMessage(""), 5000);
    return () => clearTimeout(timeout);
  }, [message]);
  const [blockLinkSources,setBlockLinkSources]=useState<{date:string;pins:Pin[];connections:Connection[]}|null>(null);
  const linkDay=date;
  useEffect(()=>{setBlockLinkSources(null);if(edit?.kind!=='blocks'||linkDay===date||!trip?.id||!/^\d{4}-\d{2}-\d{2}$/.test(linkDay))return;const controller=new AbortController();void api<{day:Day}>('trip.get',{tripId:trip.id,date:linkDay},controller.signal,true).then(result=>{if(!controller.signal.aborted)setBlockLinkSources({date:linkDay,pins:result.day.pins,connections:result.day.connections});}).catch(error=>{if(!controller.signal.aborted)setMessage(error.message);});return()=>controller.abort();},[edit?.kind,linkDay,date,trip?.id]);
  const blockLinkPins=linkDay===date?mapPins:blockLinkSources&&blockLinkSources.date===linkDay?blockLinkSources.pins:[];
  const blockLinkConnections=linkDay===date?visibleDayConnections:blockLinkSources&&blockLinkSources.date===linkDay?blockLinkSources.connections:[];
  function setEdit(value: Edit | null) {
    if(value?.kind==="connections")value={...value,item:{...value.item,title:connectionTitle(value.item as any,mapPins),titleSource:connectionTitleSource(value.item as any,mapPins),detail:value.item.detail??"",symbol:value.item.symbol??""}};
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
    return observeAuthSession((u) => {
      if(observedAccount.current===(u?.uid??null)){setUser(u);return;}
      observedAccount.current=u?.uid??null;
      loadedAccount.current="";
      screenReady.current=false;
      setChooseName(false);setTourSeen(undefined);
      if(u&&!token&&reloadVisit.current){try{const saved=JSON.parse(sessionStorage.getItem('journas-current-screen')??'null');if(saved?.uid===u.uid&&saved.layout){layoutLoading.current=true;setLayout({...defaultLayout(),...saved.layout});}}catch{}}
      setSettings({...defaultSettings,...(u?readAppearance(u.uid):{}),...(practiceData?.profile??{})});
      setUser(u);
      setReady(practice||!u);
    });
  }, []);
  useEffect(() => {
    return observeClock(() => setTime(new Date()));
  }, []);
  useLayoutEffect(() => {
    const dark =
      settings.theme === "dark" ||
      (settings.theme === "system" &&
        matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    applyAccent(settings.accent,dark);
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const fn = () => {
      if (settings.theme === "system") {document.documentElement.dataset.theme = mq.matches ? "dark" : "light";applyAccent(settings.accent,mq.matches);}
    };
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, [settings.theme, settings.accent]);
  useEffect(()=>{if(user&&screenReady.current){const saved=JSON.stringify({uid:user.uid,home,tripId:trip?.id??null,date,layout,modal:["settings","account-settings","trip"].includes(modal??"")?modal:null});sessionStorage.setItem('journas-current-screen',saved);}},[user?.uid,trip?.id,date,layout,home,modal]);
  useEffect(()=>{setHistoryState({undo:null,redo:null});if(!user||!trip||shareTrip)return;let live=true;const update=()=>api<{undo:string|null;redo:string|null}>('history.status',{tripId:trip.id}).then(r=>{if(live)setHistoryState(r);}).catch(()=>{if(live)setHistoryState({undo:null,redo:null});});void update();window.addEventListener('journas-action-saved',update);const timer=setInterval(update,15000);return()=>{live=false;clearInterval(timer);window.removeEventListener('journas-action-saved',update);};},[user?.uid,trip?.id,shareTrip]);
  useEffect(()=>{const key=(e:KeyboardEvent)=>{if(!(e.ctrlKey||e.metaKey)||e.key.toLowerCase()!=='z'||(e.target as HTMLElement)?.closest('input,textarea,[contenteditable]'))return;e.preventDefault();void restoreHistory(e.shiftKey?'redo':'undo');};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[historyState,user?.uid,historyBusy,saving]);
  // Fetch travelers as soon as a trip opens, rather than making the share menu
  // wait for profile lookups. The signed-in traveler is already known locally.
  useEffect(()=>{
    if(!trip||shareTrip||!user){setTravelers([]);return;}
    let live=true;
    const participating=trip.ownerId===user.uid||trip.memberIds.includes(user.uid);
    setTravelers(participating?[{id:user.uid,displayName:accountName(savedProfile.displayName,'Traveler'),photoURL:activePhoto,owner:trip.ownerId===user.uid,permission:trip.ownerId===user.uid?'Owner':'Editor'}]:[]);
    api<{members:any[]}>('trip.members',{tripId:trip.id}).then(r=>{
      if(live)setTravelers([...new globalThis.Map<string,any>(r.members.map((member:any):[string,any]=>[member.id,member])).values()] as any[]);
    }).catch(e=>{if(live)setMessage(e.message);});
    return()=>{live=false;};
  },[trip?.id,trip?.ownerId,trip?.memberIds.join(','),user?.uid,shareTrip]);

  useEffect(()=>{if(modal!=='trip'||!trip||shareTrip)return;let live=true;setShareLinks([]);if(trip.ownerId===user?.uid)api<{links:any[]}>('share.list',{tripId:trip.id}).then(r=>{if(live)setShareLinks(r.links);}).catch(e=>{if(live)setMessage(e.message);});return()=>{live=false;};},[modal,trip?.id,trip?.memberIds.join(',')]);
  async function restoreHistory(direction:'undo'|'redo'){
   if(!trip||readonly||historyBusy||saving||!historyState[direction])return;setHistoryBusy(true);
   const version=navigationVersion.current;
   try{const r=await api<{screen:any}>(`history.${direction}`,{tripId:trip.id});const list=await refresh();if(version!==navigationVersion.current)return;const screen=r.screen;if(screen){const selected=list.find(t=>t.id===screen.tripId)??null;if(selected)localStorage.setItem(`journas-layout:${user?.uid}:${selected.id}:${screen.date}`,JSON.stringify(screen.layout));setTrip(selected);setDate(screen.date??today());setLayout(screen.layout??defaultLayout());if(selected&&screen.date>=selected.startDate&&screen.date<=selected.endDate){const restored=await api<{day:Day}>("trip.get",{tripId:selected.id,date:screen.date});if(version!==navigationVersion.current)return;setDay(restored.day);}else setDay(emptyDay());setEdit(null);setModal(null);setCalendar(false);requestAnimationFrame(()=>{if(scroller.current)scroller.current.scrollTop=screen.layout?.scroll??0;});}setHistoryState(await api('history.status',{tripId:trip.id}));}catch(e:any){setMessage(e.message);}finally{setHistoryBusy(false);}
  }
  function persistHome(next:HomeState,availableTrips=trips){
    const clean=availableHome(next,availableTrips),signature=JSON.stringify(clean);if(signature===homeLastQueued.current)return;setHomeState(clean);homeRef.current=clean;homeLastQueued.current=signature;
    if(!user)return;const uid=user.uid;
    homeWrites.current=homeWrites.current.catch(()=>{}).then(async()=>{if(auth?.currentUser?.uid===uid)await api('home.save',{home:clean});}).catch((e:any)=>{if(homeLastQueued.current===signature)homeLastQueued.current='';setMessage(e.message);});
    return homeWrites.current;
  }
  useEffect(()=>{if(!ready||home||!user||shareTrip||!trip||date<trip.startDate||date>trip.endDate)return;const target={tripId:trip.id,date};setLastTarget(target);persistHome(recordVisit(homeRef.current,target));},[home,ready,user?.uid,trip?.id,date,trips.map(t=>t.id).join(',')]);
  function rememberDay(){
    if(tripRef.current&&loadedDay.current===`${tripRef.current.id}:${dateRef.current}`){
      const key=loadedDay.current;dayCache.current.delete(key);dayCache.current.set(key,{day,layout:layoutRef.current});
      if(dayCache.current.size>24)dayCache.current.delete(dayCache.current.keys().next().value!);
    }
  }
  function showPlanner(selected:Trip|null,nextDate:string){
    ++navigationVersion.current;
    rememberDay();void saveLayout();
    const key=selected?`${selected.id}:${nextDate}`:'',cached=dayCache.current.get(key);
    const local=dayLayout(localStorage,user?.uid??'',selected?.id,nextDate);
    const lodging=lodgingForDate(selected,nextDate);
    const view=local??cached?.layout??fallbackDayLayout(selected,nextDate);
    initialTripRequest.current=cached&&selected?{tripId:selected.id,date:nextDate,promise:Promise.resolve({trip:selected,day:cached.day,layout:local??cached.layout})}:null;
    layoutLoading.current=true;setTrip(selected);setDate(nextDate);setLayout(view);setDay(cached?.day??emptyDay());setShareTrip(false);setHome(false);setCalendar(false);
    if(!selected||nextDate<selected.startDate||nextDate>selected.endDate){layoutLoading.current=false;if(!local&&!cached?.layout)void startingLayout(settings,lodging).then(view=>{if(tripRef.current?.id===selected?.id&&dateRef.current===nextDate&&!dirty.current)setLayout(view);});}
  }
  async function openPlanner(target:HomeTarget){
    const selected=target.tripId?trips.find(t=>t.id===target.tripId)??null:target.date?null:trips.find(t=>t.id===lastTarget?.tripId)??trips[0]??null;
    const nextDate=target.date??(selected?.id===lastTarget?.tripId?lastTarget?.date:null)??selected?.startDate??today();
    if(!selected&&!trips.length){setHome(true);createTrip();return;}
    if(selected&&nextDate>=selected.startDate&&nextDate<=selected.endDate&&!dayCache.current.has(`${selected.id}:${nextDate}`)){
      const version=++navigationVersion.current;
      try{
        const prepared=initialTripRequest.current;
        const restored=prepared?.tripId===selected.id&&prepared.date===nextDate?await prepared.promise:await api<{trip:Trip;day:Day;layout:Layout|null}>("trip.get",{tripId:selected.id,date:nextDate},undefined,true);
        if(version!==navigationVersion.current)return;
        if(restored)dayCache.current.set(`${selected.id}:${nextDate}`,{day:restored.day,layout:dayLayout(localStorage,user?.uid??'',selected.id,nextDate)??restored.layout});
      }catch(error:any){setMessage(error.message);return;}
    }
    showPlanner(selected,nextDate);
  }
  function createTrip(){lodgingNameEdited.current=false;setLodgingDraft(undefined);setLodgingView({...layout});setModal('new-trip');}
  function editTrip(selected:Trip){lodgingNameEdited.current=isManualLodgingName(selected.lodging);setTrip(selected);setLodgingDraft(selected.lodging);setLodgingView({...layout,center:selected.lodging?[selected.lodging.lng,selected.lodging.lat]:layout.center,zoom:selected.lodging?14:layout.zoom});setModal('edit-trip');}
  async function removeTrip(selected:Trip){
    if(!await confirmAction(selected.ownerId===user?.uid?'Delete this trip for everyone? This permanently deletes the plan and sharing links. This action is irreversible.':'Remove this trip from your account? Other travelers keep it. This action cannot be undone.'))return;
    try{await api('trip.remove',{tripId:selected.id});const remaining=await refresh();if(!remaining.length)setHome(true);const next=availableHome(homeRef.current,remaining);setHomeState(next);homeRef.current=next;await api('home.save',{home:next});setHistoryState({undo:null,redo:null});if(trip?.id===selected.id){setTrip(remaining[0]??null);setDate(remaining[0]?.startDate??today());setDay(emptyDay());}if(lastTarget?.tripId===selected.id)setLastTarget(remaining[0]?{tripId:remaining[0].id,date:remaining[0].startDate}:null);setModal(null);}catch(e:any){setMessage(e.message);}
  }
  async function refresh() {
    const result = await api<{ trips: Trip[] }>("trip.list");
    setTrips(result.trips);
    return result.trips;
  }
  useEffect(() => {
    if (!user || verified!==true || loadedAccount.current===user.uid) return;
    let cancelled=false;
    let saved:any=null;
    initialTripRequest.current=null;
    try{if(reloadVisit.current)saved=JSON.parse(sessionStorage.getItem("journas-current-screen")??"null");}catch{}
    // Start the map download alongside the single authorized screen restore.
    // Neither cached screen data nor preloading grants permission to a trip.
    const plannerModules=Promise.all([loadMapPanel(),...(!practice&&!token?[import('./live-database')]:[])]);
    const hasSaved=saved?.uid===user.uid&&!token;
    const bootstrap=!practice&&initialProfile(user.uid)?Promise.resolve(initialProfile(user.uid)!):api<{tourSeen?:boolean;trips:Trip[];settings:Settings;home:HomeState;restore:{trip:Trip;date:string;day:Day;layout:Layout|null}|null}>("planner.restore",{
      date:hasSaved?saved.date:today(),
      ...(hasSaved&&saved.tripId?{tripId:saved.tripId}:token?{tripId:null}:{})
    });
    Promise.all([bootstrap,user.getIdTokenResult(),plannerModules])
      .then(async ([result, identity]) => {
        if(cancelled)return;
        loadedAccount.current=user.uid;
        if(!practice)releaseInitialProfile(user.uid);
        const list=result.trips,r={settings:result.settings};
        setTourSeen(result.tourSeen);
        savedAccountName.current=(result.settings.displayName??"").trim();
        setSavedProfile({displayName:result.settings.displayName,photoURL:result.settings.photoURL});
        setChooseName(!practice&&!result.settings.displayName?.trim());
        setTrips(list);
        const restoredHome=availableHome(result.home??emptyHome(),list);
        const fallback=list.find(t=>t.id===(restoredHome.recentDays[0]?.tripId??restoredHome.recentTrips[0]))??list.find(t=>t.startDate<=today()&&t.endDate>=today())??list[0]??null;
        const selected=hasSaved&&saved.tripId===null?null:list.find(t=>t.id===saved?.tripId)??fallback;
        const selectedDate=hasSaved&&(saved.tripId===(selected?.id??null))&&/^\d{4}-\d{2}-\d{2}$/.test(saved.date)?saved.date:selected&&restoredHome.recentDays[0]?.tripId===selected.id?restoredHome.recentDays[0].date!:selected?(today()>=selected.startDate&&today()<=selected.endDate?today():selected.startDate):today();
        setHomeState(restoredHome);
        homeLastQueued.current=JSON.stringify(restoredHome);
        setLastTarget(selected?{tripId:selected.id,date:selectedDate}:null);
        if(result.restore){dayCache.current.set(`${result.restore.trip.id}:${result.restore.date}`,{day:result.restore.day,layout:result.restore.layout});initialTripRequest.current={tripId:result.restore.trip.id,date:result.restore.date,promise:Promise.resolve(result.restore)};}
        setGoogleSession(identity.signInProvider==='google.com');
        const preferences = { ...defaultSettings, ...r.settings,mapStart:(r.settings.mapStart==="custom"||r.settings.mapStart==="current"&&!r.settings.mapStartConfigured)?"trip" as const:r.settings.mapStart??defaultSettings.mapStart,clock:r.settings.clock==="destination"||r.settings.clock==="local"&&!r.settings.clockConfigured?"lodging" as const:r.settings.clock??defaultSettings.clock };
        savedSettings.current=preferences;settingsRef.current=preferences;
        if(!token){
          const local=dayLayout(localStorage,user.uid,selected?.id,selectedDate);
          const session=screenLayout(saved,user.uid,selected?.id,selectedDate);
          const matches=restoredDayMatches(result.restore,selected?.id,selectedDate);
          const initial=local??session??(matches?result.restore?.layout:null)??await startingLayout(preferences,lodgingForDate(selected,selectedDate));
          if(cancelled)return;
          settingsRef.current=preferences;layoutLoading.current=true;
          setDate(selectedDate);setSettings(preferences);setLayout(initial);setTrip(selected);
          if(matches&&result.restore)setDay(result.restore.day);
          setHome(!(hasSaved&&saved.home===false));
          if(hasSaved&&["settings","account-settings","trip"].includes(saved.modal))setModal(saved.modal);
          // Only a real planner screen can supply a per-day view; home has no camera.
          if(!local&&session&&selected)localStorage.setItem(`journas-layout:${user.uid}:${selected.id}:${selectedDate}`,JSON.stringify(session));
          screenReady.current=true;
          if(!selected||selectedDate<selected.startDate||selectedDate>selected.endDate)requestAnimationFrame(()=>{layoutLoading.current=false;});
          return;
        }
        screenReady.current=true;
        setSettings(preferences);
        if (!token && !list.some((t) => t.startDate <= today() && t.endDate >= today()))
          void startingLayout(preferences).then(initial=>{if(!cancelled&&!tripRef.current&&layoutRef.current.center[0]===0&&layoutRef.current.center[1]===0)setLayout(initial);});
        if (!token)
          setTrip(
            list.find((t) => t.startDate <= today() && t.endDate >= today()) ??
              null,
          );
      })
      .catch((e) => {if(!cancelled)setMessage(e.message);})
      .finally(()=>{if(!cancelled)setReady(true);});
    return ()=>{cancelled=true;};
  }, [user?.uid,verificationRevision,verified]);
  useEffect(() => {
    if (!token || joinedToken === token) return;
    let cancelled = false;
    setShareTrip(true);
    layoutLoading.current=true;
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
    if (!token || !shareTrip || !shareReady || !ready || joinedToken === token) return;
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
        const nextLayout = local ? JSON.parse(local) : await startingLayout(settingsRef.current, lodgingForDate(r.trip,date));
        if (cancelled) return;
        setLayout({ ...defaultLayout(), ...nextLayout });
        dirty.current=false;
        requestAnimationFrame(()=>requestAnimationFrame(()=>{if(!cancelled)layoutLoading.current=false;}));
        finishDayNavigation(r.trip.id,date);
      })
      .catch((e) => {
        if (!cancelled) {
          if(trip)finishDayNavigation(trip.id,date);
          setDay(emptyDay());
          setMessage(e.message);
        }
      });
    return () => {
      cancelled = true;
      if(trip)finishDayNavigation(trip.id,date);
    };
  }, [token, date, shareTrip, shareReady, ready, joinedToken, user?.uid]);
  useEffect(() => {
    if (
      home ||
      !trip ||
      !user ||
      shareTrip ||
      date < trip.startDate ||
      date > trip.endDate
    )
      return;
    let cancelled = false;
    layoutLoading.current=true;
    const layoutAtRequest=layoutRef.current;
    let liveDay=false;
    const prepared=initialTripRequest.current;
    const readDay=()=>api<{trip:Trip;day:Day;layout:Layout|null}>("trip.get",{tripId:trip.id,date});
    (prepared?.tripId===trip.id&&prepared.date===date ? prepared.promise.then(result=>result??readDay()) : readDay())
      .then(async (r) => {
        if (cancelled) return;
        loadedDay.current=`${trip.id}:${date}`;
        if(initialTripRequest.current===prepared)initialTripRequest.current=null;
        if(!liveDay)setDay(r.day);
        const local = localStorage.getItem(
          `journas-layout:${user.uid}:${trip.id}:${date}`,
        );
        const restored = local ? JSON.parse(local) : r.layout;
        const nextLayout = restored ?? await startingLayout(settingsRef.current, lodgingForDate(r.trip,date));
        if (cancelled) return;
        const layoutChanged=layoutRef.current!==layoutAtRequest;
        if(!layoutChanged)setLayout({ ...defaultLayout(), ...nextLayout });
        dirty.current = Boolean(local)||layoutChanged;
        finishDayNavigation(trip.id,date);
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
          if (!cancelled && !layoutChanged && scroller.current)
            scroller.current.scrollTop = nextLayout.scroll ?? 400;
        }, 0);
      })
      .catch((e) => {if(cancelled)return;layoutLoading.current=false;finishDayNavigation(trip.id,date);setMessage(e.message);});
    let stop=()=>{},stopTrip=()=>{};
    if(practice){const update=()=>{void api<{day:Day}>('trip.get',{tripId:trip.id,date}).then(result=>{if(!cancelled)setDay(result.day);});};window.addEventListener('journas-practice-updated',update);return()=>{cancelled=true;finishDayNavigation(trip.id,date);window.removeEventListener('journas-practice-updated',update);};}
    void import('./live-database').then(({db,collection,doc,onSnapshot})=>{
      if(cancelled)return;
    stop = onSnapshot(
      collection(db, "trips", trip.id, "days", date, "items"),
      (snap) => {
        const next = emptyDay();
        snap.forEach((d) => {
          const item: any = { ...d.data(), id: d.id };
          if (["pins", "blocks", "tasks", "connections"].includes(item.kind))
            (next as any)[item.kind].push(item);
        });
        if(!snap.metadata.fromCache)liveDay=true;
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
      finishDayNavigation(trip.id,date);
      setHome(true);
      setTrip(null);
      setDay(emptyDay());
      setEdit(null);
      setConflict(null);
      setModal(null);
      void refresh().catch(() => {});
      setMessage("This trip was deleted or you no longer have access.");
    };
    stopTrip = onSnapshot(
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
    }).catch(()=>{if(!cancelled)setMessage('Live updates could not load. Please reconnect.');});
    return () => {
      cancelled = true;
      finishDayNavigation(trip.id,date);
      stop();
      stopTrip();
    };
  }, [trip?.id,trip?.startDate,trip?.endDate, date, user?.uid, shareTrip,home]);
  useEffect(() => {
    if (!token || !shareTrip || !shareReady || !ready || joinedToken === token) return;
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
  }, [token, date, shareTrip, shareReady, joinedToken, ready]);
  useEffect(()=>{
    if(!token||!shareTrip||!shareReady||joinedToken===token||practice)return;
    let cancelled=false,stop=()=>{};
    const revoked=()=>{
      if(cancelled)return;
      const owned=trips.find(value=>value.id===tripRef.current?.id&&value.ownerId===user?.uid);
      setShareReady(false);setShareTrip(false);setJoinedToken(token);setEdit(null);setModal(null);
      if(owned){setTrip(owned);setHome(false);}
      else{setTrip(null);setDay(emptyDay());setHome(true);setMessage('This sharing link has been revoked.');}
    };
    void crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)).then(async digest=>{
      const key=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
      const {db,doc,onSnapshot}=await import('./live-database');if(cancelled)return;
      stop=onSnapshot(doc(db,'shareStatus',key),snapshot=>{if(!snapshot.metadata.fromCache&&snapshot.exists()&&snapshot.data().active===false)revoked();},()=>{});
    });
    return()=>{cancelled=true;stop();};
  },[token,shareTrip,shareReady,joinedToken,practice,user?.uid,trips]);
  useEffect(()=>{
    if(!token||!shareTrip||!shareReady||!ready||joinedToken===token||practice)return;
    if(!user){setModal('share-auth');return;}
    if(!verified)return;
    let cancelled=false;
    void api<{trip:Trip}>('share.join',{token},undefined,true).then(result=>{
      if(cancelled)return;
      setJoinedToken(token);setTrip(result.trip);setShareTrip(false);setShareReady(false);setHome(false);setModal(null);
      setTrips(previous=>[...previous.filter(value=>value.id!==result.trip.id),result.trip]);
      history.replaceState({},'',location.pathname);
    }).catch(error=>{if(!cancelled)setMessage(error.message);});
    return()=>{cancelled=true;};
  },[token,shareTrip,shareReady,ready,publicMode,joinedToken,practice,user?.uid,verified]);
  async function saveLayout(force=false) {
    setTime(new Date());
    if (layoutLoading.current || (!force&&!dirty.current) || !tripRef.current) return;
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
      const savedTrip=tripRef.current;
      const savedDate=dateRef.current;
      const savedLayout=layoutRef.current;
      setStatus("Saving workspace…");
      localStorage.setItem(`journas-layout:${user.uid}:${savedTrip.id}:${savedDate}`,JSON.stringify(savedLayout));
      const writeKey=JSON.stringify([savedTrip.id,savedDate,savedLayout]);
      let write=layoutWrites.current.get(writeKey);
      if(!write){write=api("layout.save", {
        tripId: savedTrip.id,
        date: savedDate,
        layout: savedLayout,
      });layoutWrites.current.set(writeKey,write);const clear=()=>layoutWrites.current.delete(writeKey);void write.then(clear,clear);}
      await write;
      const unchanged=tripRef.current?.id===savedTrip.id && dateRef.current===savedDate && layoutRef.current===savedLayout;
      if(unchanged)dirty.current = false;
      if(unchanged)localStorage.setItem(
        `journas-layout:${user.uid}:${savedTrip.id}:${savedDate}`,JSON.stringify(savedLayout),
      );
      setStatus(unchanged?"All changes saved":"Save pending");
    } catch (e: any) {
      setStatus("Save pending");
      setMessage(e.message);
    }
  }
  const autosave = useRef<(background?:boolean) => Promise<void>>(async () => {});
  autosave.current = async (background=false) => {
    await saveLayout();
    if (user && trip && !readonly) {
      const pending = localStorage.getItem(
        `journas-drafts:${user.uid}:${trip.id}:${date}`,
      );
      if (pending) {
        for (const draft of Object.values(JSON.parse(pending)) as Edit[])
          await mutate(draft.kind, draft.item, false, draft.base, background);
      }
    }
  };
  const manualSaveBusy=useRef(false);
  async function saveManually() {
    if (!user || saving || manualSaveBusy.current) return;
    manualSaveBusy.current=true;
    setManualSaving(true);
    try {
      await autosave.current(true);
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setTime(new Date());
      setManualSaving(false);
      manualSaveBusy.current=false;
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
  useEffect(()=>{
    const key=(event:KeyboardEvent)=>{
      if(!(event.ctrlKey||event.metaKey)||event.altKey||event.key.toLowerCase()!=="s")return;
      event.preventDefault();
      if(!event.repeat)void saveManually();
    };
    window.addEventListener("keydown",key);
    return()=>window.removeEventListener("keydown",key);
  },[user,saving]);
  function changeLayout(patch: Partial<Layout>) {
    if(!screenReady.current)return;
    if(layoutLoading.current&&["center","zoom","bearing"].some(key=>key in patch))return;
    if (
      Object.entries(patch).every(
        ([key, value]) =>
          JSON.stringify(layoutRef.current[key as keyof Layout]) ===
          JSON.stringify(value),
      )
    )
      return;
    if(!tripRef.current&&patch.hourHeight!==undefined)localStorage.setItem(outsideTimelineKey(user?.uid??'guest',dateRef.current),String(patch.hourHeight));
    dirty.current = true;
    const next={...layoutRef.current,...patch};
    layoutRef.current=next;
    setLayout(next);
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
  async function plannedInitialLayout(prefs:Settings,selected:Trip|null,nextDate:string){
    if(selected&&user){const local=localStorage.getItem(`journas-layout:${user.uid}:${selected.id}:${nextDate}`);if(local)return JSON.parse(local);if(nextDate>=selected.startDate&&nextDate<=selected.endDate){const result=await api<{layout:Layout|null}>("trip.get",{tripId:selected.id,date:nextDate});if(result.layout)return result.layout;}}return startingLayout(prefs,lodgingForDate(selected,nextDate));
  }
  function navigateDay(direction:'next'|'previous'){
    const next=new Date(`${date}T12:00:00`);next.setDate(next.getDate()+(direction==='next'?1:-1));const value=next.toLocaleDateString('en-CA');
    if(practice&&trip&&(value<trip.startDate||value>trip.endDate))return;
    const selected=shareTrip?trip:tripForDate(trips,trip??trips.find(t=>t.id===lastTarget?.tripId),value);
    const within=Boolean(selected&&value>=selected.startDate&&value<=selected.endDate);
    const cached=selected&&!shareTrip&&dayCache.current.has(`${selected.id}:${value}`);
    setPendingDayNavigation(within&&(user||shareTrip)&&!cached?{tripId:selected!.id,date:value,direction}:null);
    void switchDate(value);
  }
  async function switchDate(value:string){
    if(practice&&trip&&(value<trip.startDate||value>trip.endDate))return;
    if(shareTrip&&trip){value=value<trip.startDate?trip.startDate:value>trip.endDate?trip.endDate:value;if(value===date)return;void saveLayout();setDate(value);setDay(emptyDay());setCalendar(false);return;}
    if(value===date)return;
    showPlanner(tripForDate(trips,trip??trips.find(t=>t.id===lastTarget?.tripId),value),value);
  }
  const readonly =
    shareTrip || !user || !trip || (trip.ownerId!==user.uid&&Boolean(trip.viewerIds?.includes(user.uid))) || date < trip.startDate || date > trip.endDate;
  let timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if(settings.clock==='utc')timezone='UTC';
  else if(settings.clock==='lodging'||settings.clock==='destination'||settings.clock==='local'&&!settings.clockConfigured){const lodging=lodgingForDate(trip,date);if(lodging)timezone=tzlookup(lodging.lat,lodging.lng);}
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
  const previousToday=useRef({day:displayedToday,timezone});
  useEffect(()=>{
    const previous=previousToday.current;
    previousToday.current={day:displayedToday,timezone};
    if(previous.timezone!==timezone)return;
    const nextDate=followCalendarDay(dateRef.current,previous.day,displayedToday);
    if(nextDate)void switchDate(nextDate);
  },[displayedToday,timezone]);
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
  async function createMapConnection(from:string,to:string,arrow:boolean){
    if(!trip)return;
    const connection={id:crypto.randomUUID(),versions:{},from,to,arrow};
    setPendingConnections(previous=>[...previous,{tripId:trip.id,date,connection}]);
    try{await mutate('connections',connection,false,undefined,true);}
    finally{setPendingConnections(previous=>previous.filter(item=>item.connection.id!==connection.id));}
  }
  async function mutate(
    kind: string,
    item: Record<string, any>,
    force = false,
    baseline?: Record<string, any>,
    background=false,
  ) {
    if (!trip) return false;
    const saveKey=`${trip.id}:${date}:${kind}:${item.id}`;
    if(pendingItemWrites.current.has(saveKey))return false;
    pendingItemWrites.current.add(saveKey);setPendingItems([...pendingItemWrites.current]);
    const finishSave=()=>{pendingItemWrites.current.delete(saveKey);setPendingItems([...pendingItemWrites.current]);};

    if (kind === "pins" && item.id === "trip-lodging") {

      setStatus("Saving…");
      try {
        const r = await api<{trip:Trip}>("trip.update", {
          tripId:trip.id, name:trip.name, startDate:trip.startDate, endDate:trip.endDate,
          lodging:{...trip.lodging,name:item.title,nameSource:item.nameSource??trip.lodging?.nameSource,lng:item.lng,lat:item.lat,note:item.note,color:item.color,symbol:item.symbol},
        },undefined,background);
        if(tripRef.current?.id===r.trip.id)setTrip(r.trip);
        void refresh().catch(e=>setMessage(e.message));
        if(!background)rawSetEdit(current=>current===edit&&current?.kind===kind&&current.item.id===item.id&&tripRef.current?.id===trip.id&&dateRef.current===date?null:current);
        setStatus("All changes saved");
        return true;
      } catch (e:any) {
        setMessage(e.message);
        setStatus("Changes could not be saved");
        return false;
      } finally { finishSave(); }
    }

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
          ].includes(key) && (kind!=="blocks"||!["startDate","endDate"].includes(key)) &&
          JSON.stringify(original?.[key]) !== JSON.stringify(value),
      ),
    );
    const base = force ? (conflict?.current?.versions ?? {}) : (versions ?? {});
    if (!Object.keys(patch).length) {
      if(!background)rawSetEdit(current=>current===edit&&current?.kind===kind&&current.item.id===item.id&&tripRef.current?.id===trip.id&&dateRef.current===date?null:current);
      finishSave();
      return true;
    }
    const draft: Edit = { kind: kind as Edit["kind"], item, base: original };
    const draftKey = `journas-drafts:${user?.uid}:${trip.id}:${date}`;
    const drafts = JSON.parse(localStorage.getItem(draftKey) ?? "{}");
    localStorage.setItem(draftKey, JSON.stringify({ ...drafts, [id]: draft }));
    try {
      const result=await api<{item?:Day['connections'][number]}>("item.patch", {
        tripId: trip.id,
        date,
        kind,
        id,
        patch,
        baseVersions: base,
      },undefined,background);
      if(kind==='connections'&&result.item&&tripRef.current?.id===trip.id&&dateRef.current===date){const saved=result.item;setDay(current=>({...current,connections:[...current.connections.filter(connection=>connection.id!==saved.id),saved]}));}
      const pending = JSON.parse(localStorage.getItem(draftKey) ?? "{}");
      if(JSON.stringify(pending[id])===JSON.stringify(draft))delete pending[id];
      if (Object.keys(pending).length)
        localStorage.setItem(draftKey, JSON.stringify(pending));
      else localStorage.removeItem(draftKey);
      if(!background)rawSetEdit(current=>current===edit&&current?.kind===kind&&current.item.id===item.id&&tripRef.current?.id===trip.id&&dateRef.current===date?null:current);
      if(!background)setConflict(null);
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
      finishSave();
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
      rawSetEdit(current=>current===edit&&current?.kind===kind&&current.item.id===item.id&&tripRef.current?.id===trip.id&&dateRef.current===date?null:current);
    } catch (e: any) {
      setMessage(e.message);
    }
  }
  async function toggleTask(task:Day['tasks'][number]) {
    if(!trip||readonly)return;
    const tripId=trip.id,dayDate=date,saveKey=`${tripId}:${dayDate}:${task.id}`;
    const pendingSave=taskToggleQueue.current.get(saveKey);
    const checked=!(pendingSave?.checked??task.checked);
    setOptimisticTasks(previous=>({...previous,[task.id]:{checked,saving:true}}));
    const queued=pendingSave??{checked,item:task};queued.checked=checked;
    const key=`journas-drafts:${user?.uid}:${tripId}:${dayDate}`;
    const keepDraft=()=>{const drafts=JSON.parse(localStorage.getItem(key)??'{}');localStorage.setItem(key,JSON.stringify({...drafts,[task.id]:{kind:'tasks',item:{...queued.item,checked:queued.checked},base:queued.item}}));};
    keepDraft();
    if(pendingSave)return;
    taskToggleQueue.current.set(saveKey,queued);
    try{
      while(true){
        const savingChecked=queued.checked;
        const result=await api<{item:Day['tasks'][number]}>('item.patch',{tripId,date:dayDate,kind:'tasks',id:task.id,patch:{checked:savingChecked},baseVersions:queued.item.versions},undefined,true);
        queued.item=result.item;
        if(tripRef.current?.id===tripId&&dateRef.current===dayDate)setDay(previous=>({...previous,tasks:previous.tasks.map(t=>t.id===task.id?result.item:t)}));
        if(queued.checked===savingChecked)break;
        keepDraft();
      }
      const pending=JSON.parse(localStorage.getItem(key)??'{}');delete pending[task.id];if(Object.keys(pending).length)localStorage.setItem(key,JSON.stringify(pending));else localStorage.removeItem(key);
      setTime(new Date());
    }catch(e:any){
      keepDraft();setMessage(e.message);setStatus('Save pending — draft kept on this device');
      if(e.code==='CONFLICT')setConflict({draft:{kind:'tasks',item:{...queued.item,checked:queued.checked},base:queued.item},current:e.current,fields:e.details?.fields??[]});
    }finally{taskToggleQueue.current.delete(saveKey);setOptimisticTasks(previous=>{const next={...previous};delete next[task.id];return next;});}
  }
  async function logout(){if(practice){window.dispatchEvent(new CustomEvent('journas-practice',{detail:false}));return;}const finish=beginActivity('Saving your plan and signing out…');try{sessionStorage.removeItem("journas-current-screen");screenReady.current=false;await saveLayout();await signOut(auth!);setTrip(null);setTrips([]);setHome(true);setHomeState(emptyHome());setLastTarget(null);setSettings(defaultSettings);setShareLink('');setProfileOpen(false);setModal(null);}finally{finish();}}
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
                from: mapPins[0]?.id ?? "",
                to: mapPins[1]?.id ?? "",
                arrow: true,
              };
    setEdit({
      kind,
      item: { id: crypto.randomUUID(), versions: {}, ...base, ...extras },
      locationSelected:kind!=="pins"||extras.lng!==undefined,
    });
  }
  async function savePlacementPreference(key:'pinPlacementOnMap'|'connectionArrow',value:boolean){
    const previous=settings[key]??true;
    setSettings(current=>({...current,[key]:value}));
    try{const pending=placementSaves.current.then(()=>api('settings.save',{settings:{[key]:value}}));placementSaves.current=pending.then(()=>{},()=>{});await pending;savedSettings.current={...savedSettings.current,[key]:value};}catch(e:any){setSettings(current=>({...current,[key]:previous}));setMessage(e.message);}
  }
  const [accountNameValid,setAccountNameValid]=useState(true);
  const [settingsSaving,setSettingsSaving]=useState(false);
  async function saveSettings(next: Settings) {
    if(!practice&&(next.displayName??"").trim()!==savedAccountName.current&&!accountNameValid){setMessage("Choose an available account name before saving.");return false;}
    setSettingsSaving(true);
    try {
      await api("settings.save", { settings: next });
      savedSettings.current={...next};
      savedAccountName.current=(next.displayName??"").trim();
      setSavedProfile({displayName:next.displayName,photoURL:next.photoURL});

      return true;
    } catch (e: any) {
      setMessage(e.message);return false;
    }finally{setSettingsSaving(false);}
  }
  const displayTasks=optimisticTaskList(day.tasks,optimisticTasks);
  const taskIsCurrent=(task:Day['tasks'][number])=>{
    if(task.checked)return false;const block=day.blocks.find(b=>b.id===task.blockId);if(!block)return false;

    const range=blockRange(block,date);const minute=(value:string)=>{const [h,m]=value.split(':').map(Number);return h*60+m;};return date===displayedToday&&nowMinutes>=minute(range.start)&&nowMinutes<minute(range.end);
  };
  const nearby=nearbyActivities(day.blocks,mapPins,date,liveLocation.position,time,trip?.lodging?.timezone||timezone);
  const nearbyTodo=nearbyTasks(displayTasks,day.blocks,mapPins,date,liveLocation.position,time,trip?.lodging?.timezone||timezone);
  const activePinIds=useMemo(()=>[...new Set([...nearby.pinIds,...nearbyTodo.pinIds])],[nearby.pinIds.join(','),nearbyTodo.pinIds.join(',')]);
  const canPastePin=!readonly&&!practice&&!pastingPin&&canPasteCopiedPin(copiedPin,trip?.id,date,day.pins);
  function copyPin(pin:Pin){
    if(!trip||practice||pin.id==='trip-lodging')return;
    setCopiedPin({sourceTripId:trip.id,sourceDate:date,sourceId:pin.id,origin:pin.copyOrigin??{tripId:trip.id,date,id:pin.id}});
    setMessage('Place copied. Open another trip day and right-click the map to paste it.');
  }
  async function pastePin(){
    if(!canPastePin||!copiedPin||!trip||pinPasteBusy.current)return;
    const tripId=trip.id,targetDate=date;pinPasteBusy.current=true;setPastingPin(true);
    const finish=beginActivity('Pasting your place…');
    try{const result=await api<{item:Pin}>('item.copy-pin',{tripId,date:targetDate,sourceTripId:copiedPin.sourceTripId,sourceDate:copiedPin.sourceDate,sourceId:copiedPin.sourceId});
      if(tripRef.current?.id===tripId&&dateRef.current===targetDate)setDay(current=>({...current,pins:[...current.pins.filter(pin=>pin.id!==result.item.id),result.item]}));
      setMessage('Place pasted into this day.');
    }catch(error:any){setMessage(error.message);}finally{pinPasteBusy.current=false;setPastingPin(false);finish();}
  }
  const [taskSearch,setTaskSearch]=useState("");
  const visibleTasks=[...displayTasks].filter(task=>[task.title,...taskLinkLabels(task,day.blocks,mapPins,visibleDayConnections)].join(" ").toLocaleLowerCase().includes(taskSearch.toLocaleLowerCase())).sort((a,b)=>a.title.localeCompare(b.title));
  if (configured&&!practice&&observedAccount.current===undefined || !ready && !user && !hasOpenedWorkspace())
    return (
      <LoadingScreen startup text="Getting Journas ready…"/>
    );
  if (!user && !token)
    return (
      <>
        <AuthScreen onError={setMessage} />
        <Toast message={message} onDismiss={() => setMessage("")} />
      </>
    );
  if(user&&(verified===null||verified===true&&(!ready||loadedAccount.current!==user.uid)))return <LoadingScreen startup text="Getting Journas ready…"/>;
  if(user&&verified===false)return <EmailVerification user={user} onVerified={()=>{onVerified();setVerificationRevision(n=>n+1);}} onLogout={logout}/>;
  if(user&&chooseName)return <AccountName initialName={settings.displayName??""} onBack={logout} onSave={async displayName=>{await api("settings.save",{settings:{displayName}});savedAccountName.current=displayName.trim();savedSettings.current={...savedSettings.current,displayName};setSavedProfile(current=>({...current,displayName}));setSettings(current=>({...current,displayName}));setChooseName(false);}}/>;
  return (
    <>
    <div className={`app${home&&!shareTrip?" home-app":""}`} inert={!ready&&!hasOpenedWorkspace()} aria-busy={!ready} style={!ready&&!hasOpenedWorkspace()?{visibility:"hidden"}:undefined}>
      {home&&!shareTrip&&user&&<HomePage navigationLocked={practice} trips={trips} state={availableHome(homeState,trips)} preferences={settings} name={accountName(savedProfile.displayName)} avatar={<ProfileAvatar accent={settings.accent} id={user.uid} src={activePhoto} name={accountName(savedProfile.displayName)}/>} resume={lastTarget} busy={homeBusy} onOpen={openPlanner} onUpdate={persistHome} onCreate={createTrip} onEdit={editTrip} onDelete={removeTrip} onSettings={()=>setModal('settings')} onLogout={logout} onMessage={setMessage}/>}
      {!home||shareTrip?<>
      <header className="topbar">
        <a className="brand" href="/" onClick={async e=>{if(user){e.preventDefault();++navigationVersion.current;rememberDay();void saveLayout();history.replaceState({},"",location.pathname);setShareTrip(false);setHome(true);setCalendar(false);}}}>
          <Compass />
          <strong>Journas</strong>
        </a>
        <div className="trip-selector">
          {trips.length || (shareTrip && trip) ? <Dropdown
            searchable aria-label="Choose trip"
            placeholder="Choose a trip"
            value={trip?.id ?? ""}
            onChange={(e:any)=>{const chosen=trips.find(t=>t.id===e.target.value)??null;const chosenDate=chosen&&(date<chosen.startDate||date>chosen.endDate)?chosen.startDate:date;history.replaceState({},"",location.pathname);showPlanner(chosen,chosenDate);}}
          >
            {shareTrip && trip && (
              <option value={trip.id}>{trip.name}</option>
            )}
            {[...trips].sort((a,b)=>a.name.localeCompare(b.name)).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Dropdown> : <span className="no-trips">No trips created yet</span>}
          <AsyncButton
            className="icon"
            title="Create trip"
            aria-label="Create trip"
            onClick={createTrip}
            disabled={practice || !user || trips.length >= 100}
          >
            <Plus size={18} />
          </AsyncButton>
        </div>
        <div className="date-picker">
          <AsyncButton
            className="icon"
            aria-label="Next day" pending={pendingDayNavigation?.direction==='next'&&pendingDayNavigation.tripId===trip?.id&&pendingDayNavigation.date===date}
            disabled={
              date >= maxDate() ||
              Boolean((shareTrip || practice) && trip && date >= trip.endDate)
            }
            onClick={()=>navigateDay('next')}
          >
            <ChevronLeft size={17} />
          </AsyncButton>
          <AsyncButton
            className="date-button" aria-expanded={calendar}
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
          </AsyncButton>
          <AsyncButton
            className="icon"
            aria-label="Previous day" pending={pendingDayNavigation?.direction==='previous'&&pendingDayNavigation.tripId===trip?.id&&pendingDayNavigation.date===date}
            disabled={Boolean((shareTrip || practice) && trip && date <= trip.startDate)}
            onClick={()=>navigateDay('previous')}
          >
            <ChevronRight size={17} />
          </AsyncButton>
        </div>
        <div className="top-actions">
          <div className="planning-history-actions">
          <AsyncButton className="icon" aria-label="Undo" title="Undo (Ctrl+Z)" disabled={readonly||!historyState.undo||historyBusy||saving} onClick={()=>restoreHistory("undo")}><Undo2 size={18}/></AsyncButton>
          <AsyncButton className="icon" aria-label="Redo" title="Redo (Ctrl+Shift+Z)" disabled={readonly||!historyState.redo||historyBusy||saving} onClick={()=>restoreHistory("redo")}><Redo2 size={18}/></AsyncButton>
          <div className="save-control">
          <span className={`save-indicator${manualSaving?" saving":" saved"}`} role="status" title={manualSaving?"Saving…":status} aria-label={manualSaving?"Saving…":status} />
          <AsyncButton className="icon" aria-label="Save planning" title="Save planning (Ctrl+S)" disabled={!user || manualSaving || saving} onClick={saveManually}>
            <Save size={18} />
          </AsyncButton>
          </div>
          </div>
          {trip && (
            <AsyncButton
              className="button subtle"
              aria-label="Trip details"
              onClick={() => setModal("trip")}
            >
              <Info size={16} />
              <span>Trip details</span>
            </AsyncButton>
          )}
          <div className="profile-control" ref={profileAnchor}>
            <AsyncButton className="profile-trigger" aria-label="Account menu" aria-expanded={profileOpen} onClick={()=>setProfileOpen(!profileOpen)}><ProfileAvatar accent={settings.accent} id={user?.uid??"guest"} src={activePhoto} name={accountName(savedProfile.displayName)}/><span>{accountName(savedProfile.displayName)}</span><ChevronDown size={14}/></AsyncButton>
            {profileOpen&&<Popover anchor={profileAnchor} width={180} height={112} className="profile-menu" role="menu" onClose={()=>setProfileOpen(false)}><AsyncButton role="menuitem" onClick={()=>{setProfileOpen(false);setModal('settings');}}><SettingsIcon size={16}/>Settings</AsyncButton>{user&&<AsyncButton role="menuitem" onClick={logout}><LogOut size={16}/>Sign out</AsyncButton>}</Popover>}
          </div>
        </div>
      </header>
      {trips.length >= 80 && (
        <div className="verification">
          {trips.length >= 100
            ? "Your saved-trip limit is reached. Remove an old trip before creating or joining another."
            : "You are approaching your saved-trip limit. Remove old trips to make room."}
        </div>
      )}
      {(trip||shareTrip||trips.length>0)&&<>
      <div className="workspace-toolbar">
        <div className="places-toolbar-heading">
          <Map size={17} /><h1>Places & routes</h1>
          {(shareTrip||Boolean(user&&trip?.viewerIds?.includes(user.uid))) && <span className="shared-label">View only</span>}

        </div>
        <div className="view-controls">
          {[
            ["map", Map, "Map"],
            ["timeline", Clock3, "Schedule"],
            ["todo", CheckSquare, "Tasks"],
          ].map(([key, Icon, label]: any) => (
            <AsyncButton
              key={key}
              aria-label={label}
              aria-pressed={Boolean(layout[key as keyof Layout])}
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
            </AsyncButton>
          ))}
        </div>
      </div>
      <WorkspaceMotion map={layout.map} timeline={layout.timeline}><div
        className="workspace"
        data-map={layout.map}
        data-timeline={layout.timeline}
        style={{"--workspace-split":`${layout.split}%`} as CSSProperties}
      >
        {(
          <MotionSurface><section className="panel map-panel" aria-hidden={!layout.map} inert={!layout.map}>
            <Suspense
              fallback={<div className="loading">Loading your map…</div>}
            >
              <MapPanel ref={mapFocus} onFocusComplete={()=>void saveLayout(true)}
                onFocusError={setMessage}
                pins={mapPins}
                connections={visibleDayConnections}
                layout={layout}
                readonly={readonly}
                onConnect={createMapConnection}
                arrowPreference={settings.connectionArrow??true}
                onArrowPreferenceChange={value=>void savePlacementPreference("connectionArrow",value)}
                onStartPinSearch={settings.pinPlacementOnMap===false?()=>newItem("pins"):undefined}
                movingPinId={movingPinId}
                onConnection={connection=>{if(!practice)setEdit({kind:"connections",item:connection});}}
                onConnections={trip?()=>setModal("connections"):undefined}
                onPlaces={trip?()=>setModal("places"):undefined}
                liveLocation={liveLocation.position??undefined}
                locationStatus={liveLocation.status} onLocate={practice?undefined:liveLocation.request}
                lodging={lodgingForDate(trip,date)} activePinIds={activePinIds}
                contextKey={`${trip?.id}:${date}`} contextMenuDisabled={practice}
                onCopyPin={!readonly&&!practice?copyPin:undefined}
                onPastePin={!readonly&&!practice?pastePin:undefined} canPastePin={canPastePin}
                onCancelMove={()=>setMovingPinId(null)}
                onMovePin={async(pin,lng,lat)=>{if(await mutate("pins",{...pin,lng,lat})){setMovingPinId(null);}}}
                onView={(center, zoom, bearing) => changeLayout({ center, zoom, bearing })}
                onPin={(pin) => {if(!practice)setEdit({kind:"pins",item:pin});}}
                onAdd={(lng, lat) => newItem("pins", { lng, lat })}
              />
            </Suspense>
          </section></MotionSurface>
        )}
        {layout.map && layout.timeline && (
          <div
            className="splitter"
            role="separator"
            aria-label="Resize map and schedule"
            tabIndex={0}
            onKeyDown={(e) => {
              if (["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.key))
                changeLayout({
                  split: Math.max(
                    25,
                    Math.min(
                      75,
                      layout.split + (["ArrowLeft","ArrowUp"].includes(e.key) ? -2 : 2),
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
                    Math.min(75, (innerWidth<=700?(ev.clientY-rect.top)/rect.height:(ev.clientX-rect.left)/rect.width) * 100),
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
          <MotionSurface><section className="panel schedule-panel">
            <div className="panel-heading">
              <div>
                <Clock3 size={17} />
                <h2>Daily itinerary</h2>
              </div>
              {!readonly && (
                <AsyncButton
                  className="icon"
                  aria-label="Add time block"
                  onClick={() => newItem("blocks")}
                >
                  <Plus size={19} />
                </AsyncButton>
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
              className="timeline-scroll" tabIndex={0} aria-label="Daily timeline"
              ref={scroller}
              onScroll={(e) =>
                !layoutLoading.current && changeLayout({ scroll: e.currentTarget.scrollTop })
              }
            >
              <div className="timeline-grid" style={{height:hourHeight*24}}>
                {Array.from({ length: 25 }, (_, i) => (
                  <div className="hour" key={i} style={{ top: i * hourHeight }}>
                    <span>{String(i % 24).padStart(2, "0")}:00</span>
                    <i />
                  </div>
                ))}
                {day.blocks.map((b) => {
                  const segment=blockRange(b,date);
                  const pin = mapPins.find((p) => p.id === b.pinId);
                  const connection=visibleDayConnections.find(connection=>connection.id===b.connectionId);
                  const inherited=pin?{title:pin.title,detail:pin.note,color:pin.color,symbol:pin.symbol}:connection?{title:connectionTitle(connection,mapPins),detail:connection.detail??'',symbol:connection.symbol??''}:null;
                  const field=(key:string)=>inherited&&key in inherited&&!b.overrides.includes(key)?(inherited as any)[key]:(b as any)[key];
                  const minutes = (value: string) => {
                    const [h, m] = value.split(":").map(Number);
                    return h * 60 + m;
                  };
                  const overlaps = day.blocks
                    .filter((o) => {const other=blockRange(o,date);return other.start<segment.end&&other.end>segment.start;})
                    .sort(
                      (a, c) =>
                        blockRange(a,date).start.localeCompare(blockRange(c,date).start) ||
                        a.id.localeCompare(c.id),
                    );
                  const lane = overlaps.findIndex((o) => o.id === b.id),
                    lanes = Math.max(1, overlaps.length);
                  return (
                    <AsyncButton
                      className={`time-block${nearby.blockIds.includes(b.id)?" nearby-now":""}`}
                      aria-label={`${field("title")}, ${segment.start} to ${segment.end}`}
                      key={b.id}
                      style={{
                        left: `calc(64px + (100% - 64px) * ${lane / lanes})`,
                        right: `calc((100% - 64px) * ${1 - (lane + 1) / lanes})`,
                        top:
                          (minutes(segment.start) / 60) *
                          hourHeight,
                        height: Math.min((1440-minutes(segment.start))/60*hourHeight,Math.max(24,(minutes(segment.end)-minutes(segment.start))/60*hourHeight)),
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
                      {nearby.blockIds.includes(b.id)&&<span className="nearby-activity-label">You’re here</span>}
                      <small>{field("detail")}</small>
                    </AsyncButton>
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
          </section></MotionSurface>
        )}
        {layout.todo && (
          <FloatingChecklist layout={layout} onChange={changeLayout}>{({x,y,topbar}:any)=><>
            <div
              className="panel-heading todo-drag"
              onPointerDown={(e) => {
                if (innerWidth<=700 || (e.target as HTMLElement).closest("button")) return;
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
                  {displayTasks.filter(t=>t.checked).length}/{day.tasks.length}
                </span>
              </div>
              <AsyncButton
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
              </AsyncButton>
            </div>
            <div className="task-list">
              <SearchInput aria-label="Search tasks" placeholder="Search tasks…" value={taskSearch} onValueChange={setTaskSearch}/>
              {visibleTasks.map((t) => (
                <div className={`task-row${taskIsCurrent(t)?" due-now":""}${nearbyTodo.taskIds.includes(t.id)?" nearby-now":""}`} key={t.id}>
                  <input
                    type="checkbox"
                    aria-label={`Complete ${t.title}`}
                    checked={t.checked}
                    disabled={readonly}
                    onChange={() => toggleTask(t)}
                  />
                  <AsyncButton onClick={() => setEdit({ kind: "tasks", item: t })}>
                    <span className={t.checked ? "completed" : ""}>
                      {t.title}
                    </span>
                    {nearbyTodo.taskIds.includes(t.id)?<span className="nearby-activity-label">You’re here</span>:taskIsCurrent(t)&&<span className="task-now">Now</span>}
                    <small>
                      {taskLinkLabels(t,day.blocks,mapPins,visibleDayConnections).join(" · ")}
                    </small>
                  </AsyncButton>
                </div>
              ))}
              {!day.tasks.length && (
                <div className="empty-tasks">
                  <CheckSquare size={28} />
                  <strong>No tasks yet</strong>
                </div>
              )}
            </div>
            {!readonly && (
              <AsyncButton className="todo-add" onClick={() => newItem("tasks")}>
                <Plus size={17} /> Add a task
              </AsyncButton>
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

      </div></WorkspaceMotion>
      {calendar && (
        <MotionSurface><div className="calendar-popover" ref={calendarBox}>
          <MonthCalendar value={date} month={month} onMonthChange={setMonth} onChange={switchDate} max={maxDate()}
            isDateDisabled={(d:string)=>Boolean((shareTrip||practice)&&trip&&(d<trip.startDate||d>trip.endDate))}
            dayTitle={(d:string)=>trips.filter(t=>t.startDate<=d&&t.endDate>=d).map(t=>t.name).join(', ')}
            dayContent={(d:string)=>trips.filter(t=>t.startDate<=d&&t.endDate>=d).slice(0,3).map(t=><i key={t.id} style={{background:tripDotColors[t.id]}}/>)}/>
          <div className="calendar-trips" role="group" aria-label="Trips in this month" tabIndex={0}>
            {trips
              .filter(
                (t) =>
                  t.startDate <= `${month}-31` && t.endDate >= `${month}-01`,
              )
              .map((t) => (
                <AsyncButton
                  key={t.id}
                  title={`Show ${t.name}'s starting month`}
                  onClick={() => setMonth(t.startDate.slice(0,7))}
                >
                  <i style={{background:tripDotColors[t.id]}}/>
                  <span>{t.name}</span>
                </AsyncButton>
              ))}
          </div>
        </div></MotionSurface>
      )}
      </>} </>:null}
      {(modal === "new-trip" || modal === "edit-trip") && (
        <Modal title={modal === "edit-trip" ? "Edit trip" : "Create trip"} inactive={Boolean(tripCrop)} onClose={() => setModal(null)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const form=e.currentTarget;if(pendingTripForms.current.has(form))return;pendingTripForms.current.add(form);setTripSaving(true);
              const originTrip=tripRef.current?.id,originDate=dateRef.current,editing=modal==='edit-trip';
              const f = new FormData(form);
              const finish=beginActivity(modal==='edit-trip'?'Saving your trip details…':'Creating your trip and opening your plan…');
              try {
                const r = await api<{ trip: Trip }>(modal === "edit-trip" ? "trip.update" : "trip.create", {
                  tripId: modal === "edit-trip" ? trip?.id : undefined,
                  appearance:tripLook,
                  lodging: lodgingDraft,
                  clientTimezone:
                    Intl.DateTimeFormat().resolvedOptions().timeZone,
                  name: f.get("name"),
                  startDate: f.get("start"),
                  endDate: f.get("end"),
                });
                void saveLayout();
                setTrips(current=>current.some(t=>t.id===r.trip.id)?current.map(t=>t.id===r.trip.id?r.trip:t):[...current,r.trip]);
                if(form.isConnected&&tripRef.current?.id===originTrip&&dateRef.current===originDate){
                  if(editing){setModal(null);if(dateRef.current<r.trip.startDate||dateRef.current>r.trip.endDate)showPlanner(r.trip,r.trip.startDate);else if(tripRef.current?.id===r.trip.id)setTrip(r.trip);}
                  else{setModal(null);showPlanner(r.trip,r.trip.startDate);}
                }
              } catch (e: any) {
                setMessage(e.message);
              }finally{pendingTripForms.current.delete(form);setTripSaving(false);finish();}
            }}
          >
            <div className="trip-details-column"><Input
              label="Trip name"
              name="name"
              defaultValue={modal === "edit-trip" ? trip?.name : ""}
              maxLength={120}
              required
            />
            <DateRangeFields startValue={modal==='edit-trip'?trip?.startDate:today()} endValue={modal==='edit-trip'?trip?.endDate:today()} min={modal==='edit-trip'?undefined:today()} max={maxDate()}/>
            <div className="trip-appearance-editor"><TripBadge trip={{...(trip??{}),appearance:tripLook} as Trip}/><div className="trip-appearance-options"><div className="trip-logo-mode" role="group" aria-label="Trip logo type"><AsyncButton type="button" className={tripLook.mode==='symbol'?'active':''} onClick={()=>setTripLook({...tripLook,mode:'symbol'})}>Symbol</AsyncButton><AsyncButton type="button" className={tripLook.mode==='image'?'active':''} onClick={()=>setTripLook({...tripLook,mode:'image'})}>Image</AsyncButton></div><div className="trip-logo-fields">{tripLook.mode==='symbol'?<><SymbolPicker value={tripLook.symbol} onChange={(e:any)=>setTripLook({...tripLook,symbol:e.target.value})}/><ColorPicker label="Trip color" value={tripLook.color} onChange={(e:any)=>setTripLook({...tripLook,color:e.target.value})}/></>:<div className="field"><span>Trip image</span><input hidden ref={tripPhoto} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choose trip image" onChange={e=>{const file=e.target.files?.[0];if(file){if(file.size>10000000)setMessage('Choose an image smaller than 10 MB.');else setTripCrop(file);}e.target.value='';}}/><AsyncButton type="button" className="button" onClick={()=>tripPhoto.current?.click()}>{tripLook.image?'Change image':'Choose image'}</AsyncButton></div>}</div></div></div>
            </div><div className="trip-location-column"><span className="lodging-label">Lodging location</span>
            <LocationPicker contextPins={modal==='edit-trip'?mapPins:undefined} contextConnections={modal==='edit-trip'?visibleDayConnections:undefined} editingPinId={modal==='edit-trip'?'trip-lodging':undefined} value={lodgingDraft} showHints={modal!=='new-trip'} initialView={lodgingView} color={lodgingDraft?.color??settings.accent} symbol={lodgingDraft?.symbol??"icon:stay"} onChange={(place,source)=>{
              setLodgingDraft(previous=>{if(source==='reverse'&&!previous?.nameSource&&previous?.lng===place.lng&&previous?.lat===place.lat&&previous?.name.trim().toLocaleLowerCase()===place.name.trim().toLocaleLowerCase())lodgingNameEdited.current=false;return {...previous,lng:place.lng,lat:place.lat,name:lodgingName(previous?.name,place.name,lodgingNameEdited.current),nameSource:lodgingNameEdited.current?'custom':'location',timezone:tzlookup(place.lat,place.lng)};});
            }}/>

            {<div className="lodging-pin-fields" style={{visibility:lodgingDraft?'visible':'hidden'}} inert={!lodgingDraft}><Input label="Lodging pin name" value={lodgingDraft?.name??''} onChange={(e:any)=>{lodgingNameEdited.current=Boolean(e.target.value.trim());setLodgingDraft({...lodgingDraft!,name:e.target.value,nameSource:e.target.value.trim()?'custom':'location'});}}/><Input label="Color" type="color" value={lodgingDraft?.color??settings.accent} onChange={(e:any)=>setLodgingDraft({...lodgingDraft!,color:e.target.value})}/><SymbolPicker value={lodgingDraft?.symbol??"icon:stay"} onChange={(e:any)=>setLodgingDraft({...lodgingDraft!,symbol:e.target.value})}/></div>}
            </div><AsyncButton
              className="button primary full"
              pending={tripSaving} disabled={tripSaving||(modal === "new-trip" && trips.length >= 100)||lodgingDraft?.lng===undefined||(tripLook.mode==='image'&&!tripLook.image)}
            >
              {modal === "edit-trip" ? "Save changes" : "Create trip"} <ArrowUpRight size={17} />
            </AsyncButton>
            {modal==='new-trip'&&<small className="saved-trips-count">{trips.length}/100 saved trips</small>}
          </form>
        </Modal>
      )}
      {edit && (
        <Modal
          title={`${readonly ? "View" : (edit.item.id === "trip-lodging" || Object.keys(edit.item.versions ?? {}).length) ? "Edit" : "Add"} ${edit.kind === "pins" ? "place" : edit.kind === "blocks" ? "time block" : edit.kind === "tasks" ? "task" : "connection"}`}
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
                        ...(edit.item.id==='trip-lodging'?{nameSource:e.target.value.trim()?'custom':'location'}:{}),
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
              {edit.kind === "pins" && <LocationPicker contextPins={mapPins} contextConnections={visibleDayConnections} editingPinId={edit.item.id} key={edit.item.id} value={edit.locationSelected===false?undefined:{lng:edit.item.lng,lat:edit.item.lat,name:edit.item.title}} initialView={layout} color={edit.item.color} symbol={edit.item.symbol} disabled={readonly} onChange={(place,source)=>rawSetEdit(current=>{if(current?.kind!=='pins'||current.item.id!==edit.item.id)return current;const lodging=current.item.id==='trip-lodging';let manual=isManualLodgingName({name:current.item.title,nameSource:current.item.nameSource});if(lodging&&source==='reverse'&&!current.item.nameSource&&current.item.lng===place.lng&&current.item.lat===place.lat&&current.item.title.trim().toLocaleLowerCase()===place.name.trim().toLocaleLowerCase())manual=false;return {...current,locationSelected:source==='reverse'?current.locationSelected:true,item:{...current.item,lng:place.lng,lat:place.lat,...(lodging?{title:lodgingName(current.item.title,place.name,manual),nameSource:manual?'custom':'location'}:{title:source==='search'||!current.item.title||current.item.title==='Unnamed location'?place.name:current.item.title})}};})}/>}

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
                  <PlanLinkField pinId={edit.item.pinId} connectionId={edit.item.connectionId} pins={blockLinkPins} connections={blockLinkConnections} disabled={linkDay!==date&&blockLinkSources?.date!==linkDay} emptyLabel="Independent time block" onChange={(kind,id)=>setEdit({...edit,item:kind==='connections'?changeBlockConnection(edit.item as any,blockLinkConnections.find(connection=>connection.id===id),blockLinkPins):changeBlockPlace(edit.item as any,blockLinkPins.find(pin=>pin.id===id))})}/>
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
                  <PlanLinkField groupTabs pinId={edit.item.pinId} connectionId={edit.item.connectionId} pins={mapPins} connections={visibleDayConnections} emptyLabel="No place or connection" onChange={(kind,id)=>setEdit({...edit,item:{...edit.item,pinId:kind==='pins'?id:null,connectionId:kind==='connections'?id:null}})}/>
                  <Select
                    label="Linked time" searchable
                    value={edit.item.blockId ?? ""}
                    onChange={(e: any) =>
                      setEdit({
                        ...edit,
                        item: { ...edit.item, blockId: e.target.value || null },
                      })
                    }
                  >
                    <option value="">No time block</option>
                    {[...day.blocks].sort((a,b)=>blockRange(a,date).start.localeCompare(blockRange(b,date).start)||a.id.localeCompare(b.id)).map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.start} · {b.title}
                      </option>
                    ))}
                  </Select>
                </>
              )}
              {edit.kind === "connections" && (
                <>
                  <ConnectionDetails value={edit.item} onChange={patch=>setEdit({...edit,item:{...edit.item,...patch,...(patch.title!==undefined?{titleSource:"custom"}:{})}})}/>
                  <Select
                    label="From" searchable
                    value={edit.item.from}
                    onChange={(e: any) =>
                      setEdit({
                        ...edit,
                        item: { ...edit.item, from: e.target.value },
                      })
                    }
                  >
                    {[...mapPins].sort((a,b)=>a.title.localeCompare(b.title)).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </Select>
                  <Select
                    label="To" searchable
                    value={edit.item.to}
                    onChange={(e: any) =>
                      setEdit({
                        ...edit,
                        item: { ...edit.item, to: e.target.value },
                      })
                    }
                  >
                    {[...mapPins].sort((a,b)=>a.title.localeCompare(b.title)).map((p) => (
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
                  <AsyncButton
                    type="button"
                    className="button danger"
                    onClick={() => remove(edit.kind, edit.item)}
                  >
                    <Trash2 size={15} /> Delete
                  </AsyncButton>
                )}
                <AsyncButton pending={saving} className="button primary" disabled={saving||(edit.kind==="pins"&&edit.locationSelected===false)}>
                  {saving ? "Saving…" : (edit.item.id === "trip-lodging" || Object.keys(edit.item.versions??{}).length) ? "Save changes" : edit.kind==="pins" ? "Create pin" : edit.kind==="blocks" ? "Create time block" : edit.kind==="tasks" ? "Create task" : "Create connection"}
                  <Check size={16} />
                </AsyncButton>
              </div>
            )}
          </form>

        </Modal>
      )}
      {modal === "places" && <Modal title="Places" onClose={()=>setModal(null)}>
        <SearchableList items={[...mapPins].sort((a,b)=>a.title.localeCompare(b.title))} label="Search places" searchText={pin=>[pin.title,pin.note,pin.id==='trip-lodging'?'Trip lodging':''].join(' ')} className="connections-list places-list" emptyText="No places for this day." renderItem={pin=><div className="connection-row" key={pin.id}>
          <span className="connection-list-title"><SymbolIcon value={pin.symbol}/><span>{pin.title}{pin.id==='trip-lodging'&&<small>Trip lodging</small>}{pin.note&&<small>{pin.note}</small>}</span></span>
          <span className="place-list-actions"><AsyncButton className="button subtle" aria-label={`Focus ${pin.title}`} onClick={()=>{mapFocus.current?.focus(pin);setModal(null);}}>Focus</AsyncButton>
          {!readonly&&<AsyncButton className="button subtle" aria-label={`Edit place ${pin.title}`} onClick={()=>{setModal(null);setEdit({kind:'pins',item:pin});}}>Edit</AsyncButton>}</span>
        </div>}/>
      </Modal>}
      {modal === "connections" && <Modal title="Connections" onClose={()=>setModal(null)}>
        <SearchableList items={[...visibleDayConnections].sort((a,b)=>connectionTitle(a,mapPins).localeCompare(connectionTitle(b,mapPins)))} label="Search connections" searchText={connection=>[connectionTitle(connection,mapPins),connection.detail,...mapPins.filter(pin=>pin.id===connection.from||pin.id===connection.to).map(pin=>pin.title)].join(' ')} className="connections-list" emptyText="No connections for this day." renderItem={connection=><div className="connection-row" key={connection.id}>
          <span className="connection-list-title">{connection.symbol&&<SymbolIcon value={connection.symbol}/>}<span>{connectionTitle(connection,mapPins)}{connection.detail&&<small>{connection.detail}</small>}</span></span>
          {!readonly&&<AsyncButton className="button subtle" aria-label={`Edit connection from ${mapPins.find(pin=>pin.id===connection.from)?.title??"place"} to ${mapPins.find(pin=>pin.id===connection.to)?.title??"place"}`} onClick={()=>{setModal(null);setEdit({kind:"connections",item:connection});}}>Edit</AsyncButton>}
        </div>}/>
      </Modal>}
      {modal === "trip" && trip && (
        <Modal title="Trip details" onClose={() => setModal(null)}>
          <h3>{trip.name}</h3>
          <h3>Travelers</h3>
          <div className="travelers-list" role="region" aria-label="Travelers list" tabIndex={0}>{[...travelers.filter(t=>t.owner),...travelers.filter(t=>!t.owner)].map(t=><div className={`member-row${t.owner?" trip-owner-row":""}`} key={t.id}><span className="traveler-profile"><ProfileAvatar accent={t.id===user?.uid?settings.accent:t.accent} id={t.id} src={t.id===user?.uid?activePhoto:t.photoURL} name={t.id===user?.uid?accountName(savedProfile.displayName):t.displayName}/><strong>{t.id===user?.uid?accountName(savedProfile.displayName):t.displayName}</strong></span>{!t.owner&&!readonly&&user&&trip.memberIds.includes(user.uid)&&<AsyncButton className="button danger" onClick={async()=>{if(!await confirmAction("Remove this traveler’s access?"))return;try{await api("member.remove",{tripId:trip.id,userId:t.id});setTrip({...trip,memberIds:trip.memberIds.filter(id=>id!==t.id)});}catch(e:any){setMessage(e.message);}}}>Remove</AsyncButton>}<span className="owner-badge">{t.permission??(t.owner?"Owner":"Editor")}</span></div>)}</div>
          {!readonly&&<AsyncButton className="button" onClick={()=>{lodgingNameEdited.current=isManualLodgingName(trip.lodging);setLodgingDraft(trip.lodging);setLodgingView({...layout,center:trip.lodging?[trip.lodging.lng,trip.lodging.lat]:layout.center,zoom:trip.lodging?14:layout.zoom});setModal("edit-trip");}}>Edit trip dates and lodging</AsyncButton>}
          {shareTrip ? (
            <>
              <p>
                {publicMode === "editor"
                  ? "This link grants editing access. Sign in to edit this trip with the group."
                  : "This link adds you as a traveler with viewing access. Sign in to join."}
              </p>
              {publicMode === "editor" &&
                (!user ? (
                  <AsyncButton
                    className="button primary"
                    disabled={!configured}
                    onClick={() => setModal("share-auth")}
                  >
                    Sign in to participate
                  </AsyncButton>
                ) : (
                  <AsyncButton
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
                  </AsyncButton>
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
                  <AsyncButton
                    className="button primary full"
                    onClick={async () => {
                      if(practice){setMessage('Sharing is unavailable during the guided tutorial.');return;}
                      try {
                        const r = await api<{ token: string }>("share.create", {
                          tripId: trip.id,
                          mode: shareMode,
                        });
                        setShareLinks((await api<{links:any[]}>('share.list',{tripId:trip.id})).links);
                      } catch (e: any) {
                        setMessage(e.message);
                      }
                    }}
                  >
                    <Share2 size={16} /> Create share link
                  </AsyncButton>
                  <div className="share-links" aria-label="Existing share links">{!shareLinks.length&&<small>No active sharing links</small>}{shareLinks.map(link=><div className="share-link-row" key={link.id}><span>{link.mode==='editor'?'View and join as an editor':'View only'}</span><div className="share-result">{link.token?<><input readOnly aria-label={`${link.mode==='editor'?'Editor':'Viewer'} share link`} value={`${location.origin}/?share=${encodeURIComponent(link.token)}`}/><AsyncButton className="button" onClick={()=>navigator.clipboard.writeText(`${location.origin}/?share=${encodeURIComponent(link.token)}`).then(()=>setMessage('Link copied.')).catch(()=>setMessage('Select and copy the link manually.'))}>Copy</AsyncButton></>:<small>Older link: URL unavailable. Revoke and create a new link to copy it.</small>}<AsyncButton className="button danger" onClick={async()=>{try{await api('share.revoke',{tripId:trip.id,shareId:link.id});setShareLinks(previous=>previous.filter(value=>value.id!==link.id));if(shareLink.includes(link.token))setShareLink('');}catch(e:any){setMessage(e.message);}}}>Revoke link</AsyncButton></div></div>)}</div>
                  <AsyncButton
                    className="button danger"
                    onClick={async () => {
                      try {
                        await api("share.revoke", { tripId: trip.id });
                        setShareLink("");setShareLinks([]);

                      } catch (e: any) {
                        setMessage(e.message);
                      }
                    }}
                  >
                    Revoke all sharing links
                  </AsyncButton>

                </>
              )}
              <div className="delete-trip">
                <AsyncButton
                  className="button danger"
                  onClick={() => removeTrip(trip)}
                >
                  <Trash2 size={15} />
                  {trip.ownerId === user?.uid
                    ? "Delete trip for everyone"
                    : "Remove trip"}
                </AsyncButton>
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
      {(modal === "settings" || modal === "account-settings") && (
        <Modal title="Your preferences" inactive={modal === "account-settings" || Boolean(photoCrop) || shortcutsOpen} locked={settingsSaving} onClose={discardSettings}>
          <form
            onSubmit={async(e) => {
              e.preventDefault();
              if(await saveSettings(settings))setModal(current=>current==='settings'?null:current);
            }}
          >
            <div className="settings-account">
            <div className="settings-identity">
            <AccountNameField value={settings.displayName??""} onChange={displayName=>setSettings({...settings,displayName})} onValidity={setAccountNameValid} check={!practice&&(settings.displayName??"").trim()!==savedAccountName.current} disabled={practice}/>

            <AsyncButton type="button" className="button account-methods-button" disabled={practice} title={practice?"Account changes are unavailable during the guided tutorial.":undefined} onClick={()=>setModal("account-settings")}>Manage sign-in methods <ChevronRight size={16}/></AsyncButton>
            </div>
            <div className="field photo-field">
              <div className="settings-photo-preview"><ProfileAvatar accent={settings.accent} id={user?.uid??"guest"} src={draftPhoto} name={accountName(settings.displayName)}/></div>
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
                  setPhotoCrop(file);
                  e.target.value="";
                }}
              />
              <AsyncButton type="button" className="button photo-picker-button" onClick={() => profilePhoto.current?.click()}>{settings.photoURL ? "Change photo" : "Choose image"}</AsyncButton>
              <span className="photo-file-note">JPG, PNG or WebP, up to 10 MB</span>{settings.photoURL&&<button type="button" className="text-button photo-remove" onClick={()=>setSettings(previous=>({...previous,photoURL:""}))}>Remove photo</button>}
            </div>
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
              onChange={(e: any) => setSettings({ ...settings, mapStart: e.target.value,mapStartConfigured:true })}
            >
              <option value="trip">Trip lodging</option>
              <option value="current">My current location</option>
              <option value="world">World map</option>
            </Select>
            <Select
              label="Clock"
              value={settings.clock}
              onChange={(e: any) =>
                setSettings({ ...settings, clock: e.target.value,clockConfigured:true })
              }
            >
              <option value="local">My local time</option>
              <option value="lodging">Lodging local time</option>
              <option value="utc">UTC</option>
            </Select>
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
            <Select disabled={!settings.autoDelete}
              label="Remove from my account after the trip ends"
              value={settings.retentionDays}
              onChange={(e: any) =>
                setSettings({
                  ...settings,
                  autoDelete: true,
                  retentionDays: Number(e.target.value)||settings.retentionDays,
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
            <AsyncButton pending={settingsSaving} className="button primary full" disabled={!user||(!practice&&(settings.displayName??"").trim()!==savedAccountName.current&&!accountNameValid)}>
              Save preferences
            </AsyncButton>
            <div className="settings-footer">
              <div className="settings-help-buttons"><AsyncButton type="button" className="button settings-tour-button" onClick={()=>{discardSettings();window.dispatchEvent(new Event('journas-start-tour'));}}>Guided tour</AsyncButton><button type="button" className="button settings-shortcuts-button" onClick={()=>setShortcutsOpen(true)}>Keyboard shortcuts</button></div>
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
                  connectionId: "Linked connection",
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
            <AsyncButton
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
            </AsyncButton>
            <AsyncButton
              className="button primary"
              onClick={() =>
                mutate(conflict.draft.kind, conflict.draft.item, true)
              }
            >
              Keep my changes
            </AsyncButton>
          </div>
        </Modal>
      )}
      {tripCrop&&<Modal title="Crop trip image" onClose={()=>setTripCrop(null)}><Suspense fallback={<Compass/>}><ProfilePhotoCropper file={tripCrop} onCancel={()=>setTripCrop(null)} onError={setMessage} onApply={image=>{setTripLook(previous=>({...previous,image,mode:'image'}));setTripCrop(null);}}/></Suspense></Modal>}
      {shortcutsOpen&&<Modal title="Keyboard shortcuts" onClose={()=>setShortcutsOpen(false)}><KeyboardShortcuts/></Modal>}
      {photoCrop&&<Modal title="Crop profile photo" onClose={()=>setPhotoCrop(null)}><Suspense fallback={<div>Loading photo editor...</div>}><ProfilePhotoCropper file={photoCrop} onCancel={()=>setPhotoCrop(null)} onError={setMessage} onApply={photo=>{setSettings(previous=>({...previous,photoURL:photo}));setPhotoCrop(null);}}/></Suspense></Modal>}
      {modal === "account-settings" && user && <Modal title="Account sign-in" onClose={()=>setModal("settings")}><AccountCredentials user={user} onMessage={setMessage} onChanged={()=>{refreshAccount(n=>n+1);}}/></Modal>}
      {confirmation&&<Modal title="Confirm deletion" onClose={()=>{confirmation.resolve(false);setConfirmation(null);}}><p>{confirmation.message}</p><div className="modal-actions"><AsyncButton className="button" onClick={()=>{confirmation.resolve(false);setConfirmation(null);}}>Cancel</AsyncButton><AsyncButton className="button danger" onClick={()=>{confirmation.resolve(true);setConfirmation(null);}}>Confirm</AsyncButton></div></Modal>}
      <Toast message={message} onDismiss={() => setMessage("")} />
      {user&&ready&&!shareTrip&&<GuidedTour profileSettings={{...settings,photoURL:activePhoto??""}} practice={practice} seenBefore={tourSeen} userId={user.uid} ready={ready} context={{mapStart:settings.mapStart,draft:edit?.item??null,lodgingChosen:Boolean(lodgingDraft),home,modal,editKind:edit?.kind??null,editId:edit?.item.id??null,tripId:trip?.id??null,trips:trips.length,pins:day.pins.length,blocks:day.blocks.length,tasks:day.tasks.length,checkedTasks:displayTasks.filter(task=>task.checked).length,connections:visibleDayConnections.length,homePins:homeState.pins.length,checklist:layout.todo,date}} onHome={()=>{++navigationVersion.current;rememberDay();void saveLayout();setModal(null);setEdit(null);setHome(true);}}/>}
    </div>
    {!ready&&<LoadingScreen text="Getting your trips and preferences ready…"/>}
    {ready&&historyBusy&&<BackgroundStatus text="Loading your schedule…"/>}
    </>
  );
}
