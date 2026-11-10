// Optional real PostgreSQL integration test. Requires pg on Node's module path.
// Run only against a disposable local DB with bootstrap and migrations applied.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
const { Client } = createRequire(import.meta.url)("pg");
const connectionString = process.env.INTERVIEW_TEST_DB_URL;
if (!connectionString || !["127.0.0.1", "localhost", "[::1]"].includes(new URL(connectionString).hostname)) {
  throw new Error("INTERVIEW_TEST_DB_URL must point to a disposable local PostgreSQL DB");
}
const ownerId = randomUUID();
const coverId = randomUUID();
const admin = new Client({ connectionString });
const first = new Client({ connectionString });
const second = new Client({ connectionString });
const save = (client, sessionId, questionId, answer, generated) => client.query(
  "select public.save_interview_follow_up($1,$2,$3,$4,$5) as result",
  [sessionId, questionId, ownerId, answer, generated],
);
async function waitForLock() {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const { rows } = await admin.query("select wait_event_type from pg_stat_activity where pid=$1", [second.processID]);
    if (rows[0]?.wait_event_type === "Lock") return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("Second connection did not block on the session lock");
}
async function race(sessionId, questionId, answer, generated, competingAnswer = answer) {
  await first.query("begin");
  const winner = await save(first, sessionId, questionId, answer, generated);
  const pending = save(second, sessionId, questionId, competingAnswer, "경합에서 생성한 다른 질문?")
    .then((value) => ({ value }), (error) => ({ error }));
  await waitForLock();
  await first.query("commit");
  const loser = await pending;
  if (competingAnswer !== answer) {
    assert.equal(loser.error?.code, "P0011");
  } else {
    if (loser.error) throw loser.error;
    assert.deepEqual(loser.value.rows[0].result, winner.rows[0].result);
  }
  return winner.rows[0].result;
}
try {
  await Promise.all([admin.connect(), first.connect(), second.connect()]);
  await admin.query("insert into auth.users(id) values($1)", [ownerId]);
  await admin.query("insert into public.cover_letters(id,user_id,company_name,job_title) values($1,$2,'test','test')", [coverId, ownerId]);
  for (const client of [first, second]) {
    await client.query("set statement_timeout='10s'");
    await client.query("set role authenticated");
    await client.query("select set_config('request.jwt.claim.sub',$1,false)", [ownerId]);
  }
  const created = await first.query("select public.create_interview($1,$2,'[\"a\",\"b\",\"c\",\"d\"]') as id", [coverId, ownerId]);
  const sessionId = created.rows[0].id;
  const mains = (await admin.query("select id from public.interview_questions where interview_id=$1 order by order_index", [sessionId])).rows;
  assert.deepEqual(await race(sessionId, mains[0].id, "답변1", "첫 꼬리?"), { followUp: "첫 꼬리?" });
  await assert.rejects(save(second, sessionId, mains[0].id, "다른 답변", "q"), { code: "P0011" });
  let children = (await admin.query("select * from public.interview_questions where parent_question_id=$1 order by order_index", [mains[0].id])).rows;
  assert.equal(children.length, 1);
  assert.deepEqual(await race(sessionId, children[0].id, "답변2", "둘째 꼬리?"), { followUp: "둘째 꼬리?" });
  children = (await admin.query("select * from public.interview_questions where parent_question_id=$1 order by order_index", [mains[0].id])).rows;
  assert.deepEqual(children.map((row) => row.order_index), [0, 1]);
  assert.deepEqual(await race(sessionId, children[1].id, "답변3", "초과?"), { followUp: null });
  assert.deepEqual(await race(sessionId, mains[1].id, "충분한 답변", null), { followUp: null });
  assert.deepEqual(await race(sessionId, mains[2].id, "먼저 확정한 답변", "확정 질문?", "충돌한 답변"), { followUp: "확정 질문?" });
  assert.equal((await admin.query("select count(*)::int as count from public.interview_questions where parent_question_id=$1", [mains[0].id])).rows[0].count, 2);
  // A concurrent close must win over a cached successful result as well.
  await admin.query("begin");
  await admin.query("update public.interviews set status='aborted' where id=$1", [sessionId]);
  const closing = save(second, sessionId, mains[0].id, "답변1", "q").then(() => null, (error) => error);
  await waitForLock();
  await admin.query("commit");
  assert.equal((await closing)?.code, "P0010");
  console.log("PASS: actual lock contention, duplicate replay, answer conflict, two slots, cap/null replay, concurrent close");
} finally {
  await admin.query("rollback").catch(() => {});
  await first.query("rollback").catch(() => {});
  await second.query("rollback").catch(() => {});
  await admin.query("delete from auth.users where id=$1", [ownerId]);
  const { rows } = await admin.query("select count(*)::int as count from public.cover_letters where id=$1", [coverId]);
  assert.equal(rows[0].count, 0);
  await Promise.all([first.end(), second.end(), admin.end()]);
}
