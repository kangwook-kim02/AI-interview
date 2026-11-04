import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";

// Explicit integration command: creates two disposable Auth users, then removes them.
// Secret key is used only for fixture administration and cleanup, never RLS checks.
const required = (name) => {
  const value = process.env[name]?.trim();
  assert.ok(value, `${name} is required`);
  return value;
};
const base = new URL(required("NEXT_PUBLIC_SUPABASE_URL"));
const publishableKey = required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
const secretKey = required("SUPABASE_SECRET_KEY");
assert.ok(base.protocol === "https:" || ["localhost", "127.0.0.1"].includes(base.hostname), "HTTPS required");
const tables = ["cover_letters", "essay_items", "experiences", "interviews", "interview_questions"];
const admin = Symbol("fixture administration");
const runId = randomUUID();
const owners = ["A", "B"].map((label) => ({
  label, id: randomUUID(), email: `issue3-${runId}-${label.toLowerCase()}@example.com`,
  password: `${randomBytes(32).toString("base64url")}Aa1!`,
  ids: Object.fromEntries([...tables, "other_cover", "other_interview", "other_question", "follow_up"].map((name) => [name, randomUUID()])),
}));
let requests = 0;
let checks = 0;

function check(condition, label) {
  checks += 1;
  assert.ok(condition, label);
}

async function request(actor, path, method = "GET", body) {
  const headers = { apikey: actor === admin ? secretKey : publishableKey };
  if (actor?.token) headers.Authorization = `Bearer ${actor.token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (path.startsWith("/rest/")) headers.Prefer = "return=representation";
  requests += 1;
  const response = await fetch(new URL(path, base), {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  let data = null;
  try { data = JSON.parse(text); } catch { /* An empty logout response is expected. */ }
  return { status: response.status, data };
}

function expect(response, statuses, label, code) {
  // Never print Auth response bodies, passwords, API keys, or tokens on failure.
  check(statuses.includes(response.status), `${label}: HTTP ${response.status}, code ${response.data?.code ?? "none"}`);
  if (code) check(response.data?.code === code, `${label}: expected ${code}`);
  return response.data;
}

function rest(actor, method, table, body, id) {
  const query = new URLSearchParams({ select: "*" });
  if (id) query.set("id", `eq.${id}`);
  else if (method === "GET") query.set("limit", "0");
  return request(actor, `/rest/v1/${table}?${query}`, method, body);
}

async function rows(actor, method, table, body, id, count = 1) {
  const data = expect(await rest(actor, method, table, body, id), [method === "POST" ? 201 : 200], `${actor.label} ${method} ${table}`);
  check(Array.isArray(data) && data.length === count, `${actor.label} ${method} ${table}: expected ${count} rows`);
  return data;
}

async function denied(actor, method, table, body, id, code = "42501") {
  expect(await rest(actor, method, table, body, id), code === "23503" ? [409] : [401, 403],
    `${actor?.label ?? "anon"} forbidden ${method} ${table}`, code);
}

function fixtures(owner) {
  const ids = owner.ids;
  return {
    cover_letters: { id: ids.cover_letters, user_id: owner.id, company_name: `HTTP test ${runId}`, job_title: "개발자" },
    essay_items: { id: ids.essay_items, cover_letter_id: ids.cover_letters, question: "지원 동기", answer: "테스트 답변" },
    experiences: { id: ids.experiences, cover_letter_id: ids.cover_letters, content: "테스트 경험" },
    interviews: { id: ids.interviews, cover_letter_id: ids.cover_letters, user_id: owner.id },
    interview_questions: { id: ids.interview_questions, interview_id: ids.interviews, type: "main", order_index: 0, question_text: "자기소개" },
  };
}

async function seed(owner) {
  for (const table of tables) await rows(owner, "POST", table, fixtures(owner)[table]);
  await rows(owner, "POST", "cover_letters", { ...fixtures(owner).cover_letters, id: owner.ids.other_cover });
  await rows(owner, "POST", "interviews", {
    ...fixtures(owner).interviews, id: owner.ids.other_interview, cover_letter_id: owner.ids.other_cover,
  });
  await rows(owner, "POST", "interview_questions", {
    ...fixtures(owner).interview_questions, id: owner.ids.other_question, interview_id: owner.ids.other_interview,
  });
  await rows(owner, "POST", "interview_questions", {
    id: owner.ids.follow_up, interview_id: owner.ids.interviews, type: "follow_up",
    parent_question_id: owner.ids.interview_questions, order_index: 0, question_text: "구체적인 사례",
  });
}

async function verifyOwner(owner, peer) {
  const edits = {
    cover_letters: { company_name: `HTTP test edited ${runId}` },
    essay_items: { answer: "수정한 답변" }, experiences: { content: "수정한 경험" },
    interviews: { status: "completed", duration_seconds: 120, ended_at: new Date(Date.now() + 120_000).toISOString() },
    interview_questions: { answer_transcript: "HTTP 테스트 전사", asked_at: new Date().toISOString(), answered_at: new Date().toISOString() },
  };
  for (const table of tables) {
    await rows(owner, "GET", table, undefined, owner.ids[table]);
    await rows(owner, "PATCH", table, edits[table], owner.ids[table]);
    await rows(owner, "GET", table, undefined, peer.ids[table], 0);
    await rows(owner, "PATCH", table, edits[table], peer.ids[table], 0);
    await rows(owner, "DELETE", table, undefined, peer.ids[table], 0);
    const spoofed = { ...fixtures(owner)[table], id: randomUUID() };
    if (table === "cover_letters") spoofed.user_id = peer.id;
    else if (table === "interview_questions") spoofed.interview_id = peer.ids.interviews;
    else spoofed.cover_letter_id = peer.ids.cover_letters;
    await denied(owner, "POST", table, spoofed);
    const anonymousInsert = { ...fixtures(owner)[table], id: randomUUID() };
    await denied(null, "GET", table, undefined, owner.ids[table]);
    await denied(null, "POST", table, anonymousInsert);
    await denied(null, "PATCH", table, edits[table], owner.ids[table]);
    await denied(null, "DELETE", table, undefined, owner.ids[table]);
  }
  await denied(owner, "PATCH", "cover_letters", { user_id: peer.id }, owner.ids.cover_letters);
  await denied(owner, "PATCH", "interviews", { user_id: peer.id }, owner.ids.interviews);
  await rows(owner, "PATCH", "cover_letters", { user_id: owner.id }, peer.ids.cover_letters, 0);
  for (const table of ["essay_items", "experiences", "interviews"]) {
    await denied(owner, "PATCH", table, { cover_letter_id: peer.ids.cover_letters }, owner.ids[table]);
  }
  await denied(owner, "PATCH", "interview_questions", { interview_id: peer.ids.interviews }, owner.ids.interview_questions);
  for (const parentId of [peer.ids.interview_questions, owner.ids.other_question]) {
    await denied(owner, "POST", "interview_questions", {
      id: randomUUID(), interview_id: owner.ids.interviews, type: "follow_up",
      parent_question_id: parentId, order_index: 1, question_text: "금지된 부모 연결",
    }, undefined, "23503");
    await denied(owner, "PATCH", "interview_questions", { parent_question_id: parentId }, owner.ids.follow_up, "23503");
  }
  for (const questionId of [owner.ids.interview_questions, owner.ids.follow_up]) {
    await denied(owner, "PATCH", "interview_questions", { interview_id: owner.ids.other_interview }, questionId, "23503");
  }
  const [interview] = await rows(owner, "GET", "interviews", undefined, owner.ids.interviews);
  check(interview.recording_path === null && interview.duration_seconds === 120, "Recording-free completed interview");
  const [question] = await rows(owner, "GET", "interview_questions", undefined, owner.ids.interview_questions);
  check(question.answer_audio_path === null && question.answer_transcript === edits.interview_questions.answer_transcript, "Recording-free transcript");
  console.log(`PASS: account ${owner.label} own CRUD, peer/anon isolation, ownership/FK attacks, recording-free results`);
}

async function deleteOwner(owner) {
  await rows(owner, "DELETE", "interview_questions", undefined, owner.ids.interview_questions);
  await rows(owner, "GET", "interview_questions", undefined, owner.ids.follow_up, 0);
  for (const table of ["interviews", "essay_items", "experiences", "cover_letters"]) {
    await rows(owner, "DELETE", table, undefined, owner.ids[table]);
  }
  await rows(owner, "DELETE", "cover_letters", undefined, owner.ids.other_cover);
  await rows(owner, "GET", "interviews", undefined, owner.ids.other_interview, 0);
  await rows(owner, "GET", "interview_questions", undefined, owner.ids.other_question, 0);
  console.log(`PASS: account ${owner.label} own DELETE and cascades`);
}

async function cleanup() {
  const errors = [];
  for (const owner of owners.filter((entry) => entry.attempted)) {
    try {
      if (owner.token) expect(await request(owner, "/auth/v1/logout", "POST"), [200, 204, 401, 403], "Fixture logout");
    } catch { /* User deletion below still revokes its refresh sessions. */ }
    try {
      const response = await request(admin, `/auth/v1/admin/users/${owner.id}`);
      if (response.status !== 404) {
        const user = expect(response, [200], "Lookup disposable user");
        check(user.id === owner.id && user.email === owner.email && user.user_metadata?.test_run === runId,
          "Cleanup only deletes this run's disposable users");
        expect(await request(admin, `/auth/v1/admin/users/${owner.id}`, "DELETE"), [200], "Delete disposable user");
        expect(await request(admin, `/auth/v1/admin/users/${owner.id}`), [404], "Deleted user absent");
      }
    } catch (error) { errors.push(`Account ${owner.label}: ${error.message}`); }
  }
  // Check exact generated IDs only, even on a project containing real application data.
  if (owners.some((owner) => owner.attempted)) {
    for (const table of tables) {
      try {
        const ids = owners.flatMap((owner) => Object.values(owner.ids));
        const query = new URLSearchParams({ select: "id", id: `in.(${ids.join(",")})` });
        const data = expect(await request(admin, `/rest/v1/${table}?${query}`), [200], "Cleanup row lookup");
        check(Array.isArray(data) && data.length === 0, `No fixture rows left in ${table}`);
      } catch (error) { errors.push(error.message); }
    }
  }
  if (errors.length) throw new Error(`Cleanup incomplete (test_run=${runId}): ${errors.join("; ")}`);
  console.log("PASS: disposable Auth users, sessions, and domain rows removed");
}

let failure;
try {
  for (const table of tables) {
    expect(await request(admin, `/rest/v1/${table}?select=id&limit=0`), [200], `Schema preflight ${table}`);
  }
  for (const owner of owners) {
    owner.attempted = true;
    const user = expect(await request(admin, "/auth/v1/admin/users", "POST", {
      id: owner.id, email: owner.email, password: owner.password, email_confirm: true,
      user_metadata: { test_run: runId },
    }), [200, 201], "Create disposable Auth user");
    check(user.id === owner.id, "Admin API preserves generated fixture ID");
    const auth = expect(await request(null, "/auth/v1/token?grant_type=password", "POST", {
      email: owner.email, password: owner.password,
    }), [200], `Account ${owner.label} password login`);
    check(auth.user?.id === owner.id && typeof auth.access_token === "string", "Real Auth user access token");
    owner.token = auth.access_token;
    const identity = expect(await request(owner, "/auth/v1/user"), [200], "Verified user HTTP request");
    check(identity.id === owner.id && identity.role === "authenticated", "User session is authenticated, not an admin session");
    console.log(`PASS: account ${owner.label} password login and verified identity (HTTP 200)`);
    await seed(owner);
  }
  await verifyOwner(owners[0], owners[1]);
  await verifyOwner(owners[1], owners[0]);
  await deleteOwner(owners[0]);
  await deleteOwner(owners[1]);
} catch (error) { failure = error; }
finally {
  try { await cleanup(); } catch (error) { failure = new Error([failure?.message, error.message].filter(Boolean).join("; ")); }
}
if (failure) {
  console.error(`FAIL: ${failure.message}`);
  process.exitCode = 1;
} else {
  console.log(`PASS: ${requests} HTTP requests, ${checks} assertions against ${base.host}`);
}
