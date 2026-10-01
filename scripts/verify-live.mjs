import { readFile, writeFile } from "node:fs/promises";
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import assert from "node:assert/strict";
const credential = JSON.parse(await readFile(process.argv[2], "utf8"));
const auth = getAuth(initializeApp({ credential: cert(credential) }));
const base = "https://tevel-trip-planner.vercel.app";
const suffix = Date.now();
const accounts = [];
let previous = [];
try {
  previous = JSON.parse(await readFile("qa-session.local", "utf8"));
} catch {}
for (const role of ["owner", "member"]) {
  const saved = previous.find((account) => account.role === role);
  const email = `tevel-qa-${role}-${suffix}@example.test`;
  const password = "Tevel-QA-only-2026!";
  const user = saved
    ? await auth.getUser(saved.uid)
    : await auth.createUser({
        email,
        password,
        emailVerified: true,
        displayName: role === "owner" ? "Alex Morgan" : "Jamie Lee",
      });
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.VITE_FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: user.email,
        password,
        returnSecureToken: true,
      }),
    },
  );
  const result = await response.json();
  assert.ok(result.idToken, "Email/password provider must be enabled");
  accounts.push({
    role,
    email: user.email,
    password,
    uid: user.uid,
    token: result.idToken,
  });
}
await writeFile(
  "qa-session.local",
  JSON.stringify(accounts.map(({ token, ...account }) => account)),
);
async function call(payload, account = accounts[0], expected = 200) {
  const response = await fetch(base + "/api/tevel", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(account ? { Authorization: `Bearer ${account.token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  const result = await response.json();
  assert.equal(
    response.status,
    expected,
    `${payload.action}: ${result.error?.code ?? "unexpected HTTP status"}`,
  );
  return result;
}
await call({ action: "trip.list" }, null, 401);
const { trip } = await call({
  action: "trip.create",
  name: "Production verification",
  startDate: "2026-10-01",
  endDate: "2026-10-03",
  clientTimezone: "Asia/Jerusalem",
});
const { token } = await call({
  action: "share.create",
  tripId: trip.id,
  mode: "editor",
});
await call({ action: "share.read", token }, null);
await call({ action: "share.join", token }, accounts[1]);
const patch = {
  title: "Colosseum",
  note: "Meet at the entrance",
  color: "#8b5cf6",
  symbol: "♜",
  lat: 41.89,
  lng: 12.49,
};
const { item } = await call({
  action: "item.patch",
  tripId: trip.id,
  date: "2026-10-01",
  kind: "pins",
  id: "production-pin",
  patch,
  baseVersions: {},
});
await call(
  {
    action: "item.patch",
    tripId: trip.id,
    date: "2026-10-01",
    kind: "pins",
    id: item.id,
    patch: { title: "Shared edit" },
    baseVersions: item.versions,
  },
  accounts[1],
);
await call(
  {
    action: "item.patch",
    tripId: trip.id,
    date: "2026-10-01",
    kind: "pins",
    id: item.id,
    patch: { title: "Stale edit" },
    baseVersions: item.versions,
  },
  accounts[0],
  409,
);
await call({ action: "trip.remove", tripId: trip.id }, accounts[1]);
await call(
  { action: "trip.get", tripId: trip.id, date: "2026-10-01" },
  accounts[0],
);
await call(
  { action: "trip.get", tripId: trip.id, date: "2026-10-01" },
  accounts[1],
  403,
);
await call({ action: "share.join", token }, accounts[1]);
await call({ action: "trip.remove", tripId: trip.id }, accounts[0]);
await call({ action: "share.read", token }, null, 404);
assert.equal((await fetch(base + "/api/cleanup")).status, 401);
const cleanup = async () => {
  const response = await fetch(base + "/api/cleanup", {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  assert.equal(response.status, 200, "Authenticated production cleanup");
};
await cleanup();
assert.equal(
  (await getFirestore().doc(`trips/${trip.id}`).get()).exists,
  false,
);
await call(
  { action: "settings.save", settings: { autoDelete: false } },
  accounts[1],
);
const old = (
  await call({
    action: "trip.create",
    name: "Retention verification",
    startDate: "2025-09-01",
    endDate: "2025-09-01",
    clientTimezone: "UTC",
  })
).trip;
const invite = (
  await call({ action: "share.create", tripId: old.id, mode: "editor" })
).token;
await call({ action: "share.join", token: invite }, accounts[1]);
await cleanup();
await call(
  { action: "trip.get", tripId: old.id, date: "2025-09-01" },
  accounts[0],
  403,
);
const kept = await call(
  { action: "trip.get", tripId: old.id, date: "2025-09-01" },
  accounts[1],
);
assert.equal(
  kept.trip.ownerId,
  accounts[0].uid,
  "Automatic owner removal must not transfer ownership",
);
await call({ action: "trip.remove", tripId: old.id }, accounts[1]);
await cleanup();
assert.equal((await getFirestore().doc(`trips/${old.id}`).get()).exists, false);
await call(
  { action: "settings.save", settings: { autoDelete: true } },
  accounts[1],
);
await call(
  { action: "settings.save", settings: { autoDelete: false } },
  accounts[0],
);
await call(
  { action: "settings.save", settings: { retentionDays: 30 } },
  accounts[1],
);
const participantOld = (
  await call({
    action: "trip.create",
    name: "Participant retention verification",
    startDate: "2026-08-01",
    endDate: "2026-08-01",
    clientTimezone: "UTC",
  })
).trip;
const participantInvite = (
  await call({
    action: "share.create",
    tripId: participantOld.id,
    mode: "editor",
  })
).token;
await call({ action: "share.join", token: participantInvite }, accounts[1]);
await cleanup();
await call(
  { action: "trip.get", tripId: participantOld.id, date: "2026-08-01" },
  accounts[1],
  403,
);
await call(
  { action: "trip.get", tripId: participantOld.id, date: "2026-08-01" },
  accounts[0],
);
await call({ action: "share.read", token: participantInvite }, null);
await call({ action: "trip.remove", tripId: participantOld.id }, accounts[0]);
await cleanup();
await call(
  { action: "settings.save", settings: { autoDelete: true } },
  accounts[0],
);
await call(
  { action: "settings.save", settings: { retentionDays: 365 } },
  accounts[1],
);
console.log(
  JSON.stringify({
    deployedApi: true,
    verifiedAccounts: 2,
    authentication: true,
    sharing: true,
    conflicts: true,
    personalRemoval: true,
    ownerDeletion: true,
    automaticOwnerRemoval: true,
    automaticParticipantRemoval: true,
    orphanCleanup: true,
    cleanupAuthentication: true,
  }),
);
