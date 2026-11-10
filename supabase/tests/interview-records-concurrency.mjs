// Optional real PostgreSQL check; requires pg on Node's module path.
// Use a NEW disposable local DB with bootstrap and all migrations applied.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
const { Client } = createRequire(import.meta.url)("pg");
const connectionString = process.env.INTERVIEW_TEST_DB_URL;
if (!connectionString || !["127.0.0.1", "localhost", "[::1]"].includes(new URL(connectionString).hostname)) {
  throw new Error("INTERVIEW_TEST_DB_URL must point to a disposable local PostgreSQL DB");
}
const ownerId = randomUUID(), coverId = randomUUID();
const admin = new Client({ connectionString });
const first = new Client({ connectionString });
const second = new Client({ connectionString });
const finish = (client, id, status = "aborted", answers = []) => client.query(
  "select public.finish_interview($1,$2,$3,$4) as result", [id, ownerId, status, JSON.stringify(answers)],
);
const answer = (client, id, questionId, text) => client.query(
  "select public.save_interview_answer($1,$2,$3,$4)", [id, questionId, ownerId, text],
);
async function create() {
  const { rows } = await first.query("select public.create_interview($1,$2,'[\"a\",\"b\",\"c\",\"d\"]') as id", [coverId, ownerId]);
  const id = rows[0].id;
  const questions = await first.query("select id from public.interview_questions where interview_id=$1 order by order_index", [id]);
  return { id, questionId: questions.rows[0].id };
}
async function lockWait() {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const { rows } = await admin.query("select wait_event_type from pg_stat_activity where pid=$1", [second.processID]);
    if (rows[0]?.wait_event_type === "Lock") return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("Second connection did not wait on the session lock");
}
async function contend(winner, loser) {
  await first.query("begin");
  const won = await winner();
  const pending = loser().then((result) => ({ result }), (error) => ({ error }));
  await lockWait();
  await first.query("commit");
  return { won, lost: await pending };
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
  const a = await create();
  let race = await contend(() => finish(first, a.id), () => finish(second, a.id));
  assert.ifError(race.lost.error);
  assert.deepEqual(race.won.rows[0].result, race.lost.result.rows[0].result);
  await assert.rejects(finish(second, a.id, "completed"), { code: "P0011" });
  const b = await create();
  race = await contend(() => answer(first, b.id, b.questionId, "확정 답변"),
    () => finish(second, b.id, "aborted", [{ questionId: b.questionId, answerTranscript: "확정 답변" }]));
  assert.ifError(race.lost.error);
  assert.equal((await admin.query("select answer_transcript from public.interview_questions where id=$1", [b.questionId])).rows[0].answer_transcript, "확정 답변");
  const c = await create();
  race = await contend(() => finish(first, c.id), () => answer(second, c.id, c.questionId, "늦은 답변"));
  assert.equal(race.lost.error?.code, "P0010");
  const d = await create();
  race = await contend(() => finish(first, d.id), () => second.query(
    "select public.save_interview_follow_up($1,$2,$3,'늦은 답변','늦은 질문')", [d.id, d.questionId, ownerId],
  ));
  assert.equal(race.lost.error?.code, "P0010");
  assert.equal((await admin.query("select count(*)::int as n from public.interview_questions where interview_id=$1 and type='follow_up'", [d.id])).rows[0].n, 0);
  const e = await create();
  race = await contend(() => first.query("select public.save_interview_follow_up($1,$2,$3,'답변','생성된 꼬리')", [e.id, e.questionId, ownerId]),
    () => finish(second, e.id, "aborted", [{ questionId: e.questionId, answerTranscript: "답변" }]));
  assert.ifError(race.lost.error);
  assert.equal((await admin.query("select status from public.interviews where id=$1", [e.id])).rows[0].status, "aborted");
  console.log("PASS: concurrent finish replay, status conflict, answer-before/after-finish, decision-before/after-finish");
} finally {
  await Promise.all([first.query("rollback").catch(() => {}), second.query("rollback").catch(() => {})]);
  await admin.query("delete from auth.users where id=$1", [ownerId]);
  await Promise.all([first.end(), second.end(), admin.end()]);
}
