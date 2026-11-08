# 수동 작업 체크리스트 (사용자가 직접 해야 하는 것)

코드 작업과 별개로 **사람이 직접** 해야 하는 일들. API 키 발급·외부 서비스 가입 포함.
완료하면 체크박스를 채우고, 발급받은 값은 `.env.local`에 넣는다(이 파일에 키 자체는 적지 말 것).

> ⚠️ **모든 비밀 키는 `.env.local`에만.** 커밋 금지(`.gitignore`에 이미 포함). 공개 저장소/채팅/스크린샷에 노출 금지.

---

## A. 저장소 / 배포 계정

- [x] GitHub 저장소 생성 및 연동 완료 — `kangwook-kim02/AI-interview`
- [ ] (배포 시점) **Vercel** 계정 생성 → GitHub 저장소 연결
  - https://vercel.com → GitHub로 로그인 → Import Project
  - 환경변수는 Vercel 프로젝트 Settings → Environment Variables 에 동일하게 등록
- [ ] (선택) 커스텀 도메인 준비
- [ ] **GitHub CLI(`gh`) 설치** — 이슈/PR 자동 생성(issue-create·issue-work 스킬)에 필요
  - Windows: `winget install --id GitHub.cli` 또는 https://cli.github.com
  - 설치 후 `gh auth login` 으로 로그인 (GitHub 계정 연결)
  - 미설치 시에도 스킬은 이슈/PR 본문을 출력해 수동 복붙 가능(폴백)

---

## B. Supabase (Auth · DB · Storage)

- [ ] **Supabase 계정 생성** → https://supabase.com (GitHub 로그인 가능)
- [ ] **새 프로젝트 생성** (Organization → New project)
  - Region: 사용자 위치 가까운 곳(예: `Northeast Asia (Seoul)`) 권장
  - Database Password 설정 → **안전하게 보관**(복구용)
- [ ] 프로젝트의 **Connect**에서 `Project URL` 확인 → `.env.local`의 `NEXT_PUBLIC_SUPABASE_URL`
- [ ] **Settings → API Keys → Publishable and secret API keys**에서 키 확인:
  - [ ] `Publishable key` (`sb_publishable_...`) → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  - [ ] (관리자 작업이 필요할 때만) `Secret key` (`sb_secret_...`) → `SUPABASE_SECRET_KEY` **(서버 전용! 절대 클라 노출 금지)**
  - 일반 로그인·사용자 데이터 접근에는 Publishable key와 사용자 세션을 사용한다. Secret key는 RLS를 우회한다.
  - 예전 가이드의 `anon public`·`service_role`은 레거시 키다. 새 키를 사용한다.
  - 참고: [Supabase API 키 안내](https://supabase.com/docs/guides/getting-started/api-keys)
- [ ] **Authentication → Providers → Email** 활성화 (이메일+비밀번호 로그인)
  - [ ] (개발 편의) Email 확인 메일 요구를 끄거나, 테스트 메일 설정
  - [ ] (후순위) Google 소셜 로그인 쓸 경우 Google OAuth 클라이언트 발급 후 등록
- [ ] **DB 마이그레이션·RLS 적용 및 검증** — 아래 B.2 참고. 클라이언트 연결에는 URL과 Publishable key만 필요하다.

> Supabase 무료 티어로 MVP 충분. 규모 커져도 표준 Postgres라 이전 용이.

### B.1 Supabase 연결과 세션 조회 확인

1. `.env.local`에 `NEXT_PUBLIC_SUPABASE_URL`과 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`를 입력하고
   개발 서버를 다시 시작한다. Publishable key는 `sb_publishable_...` 형식이다.
   예제 파일은 빈 값으로 유지하며 실제 설정 파일을 Git에 추가하지 않는다.
2. 클라이언트 생성 시 공개 설정을 검증한다. 누락·빈 값·HTTP(S)가 아닌 URL·Secret key 오입력은
   변수명과 이 문서 위치로 안내하고 실제 값은 오류 메시지에 포함하지 않는다.
   Secret key는 이번 클라이언트에서 읽지 않으므로 비워둬도 된다.
3. feature의 Client Component에서는 `@/lib/supabase/client`의 `createBrowserSupabaseClient()`를,
   서버 처리에서는 `@/lib/supabase/server`의 `await createServerSupabaseClient()`를 사용한다.
   SDK를 상위 코드에서 직접 생성하거나 서버 클라이언트를 전역 공유하지 않는다.
4. 서버에서 현재 사용자를 확인하려면 다음 진입점을 사용한다.

   ```ts
   import { getCurrentUser } from "@/lib/supabase/session";

   const user = await getCurrentUser();
   // 검증된 User 또는 null. 토큰·쿠키·키 전체를 로그에 남기지 않는다.
   ```

   로그인 쿠키가 없거나 인증이 거부되면 `null`이다. 정상 로그인 쿠키가 있으면 Auth 서버에서
   확인한 사용자를 반환한다. 네트워크·서비스 장애·요청 제한은 오류로 전달하므로 비로그인과 구분한다.
   서버 인증 판단에 검증하지 않은 `getSession()`의 사용자 객체를 사용하지 않는다.
5. 세션 갱신은 Next.js 15의 `src/middleware.ts`에서 처리한다. `/login`, `/signup`,
   `/dashboard/**`, `/interview/**`, `/api/interview/**`에 적용하며 로그인 가드·리다이렉트는 아직 없다.
   새 인증 경로를 추가하면 matcher도 확장한다. `/`와 정적 자원은 제외하므로 기본 화면은 키 없이 실행된다.
   갱신 쿠키를 요청과 응답에 반영하고 SDK의 캐시 방지 헤더를 유지한다.
   이 응답을 교체할 때 쿠키와 캐시 헤더를 복사해야 하며 사용자별 응답을 공유 캐시에 저장하지 않는다.
6. `npm run test`로 설정·요청 쿠키 격리·사용자 검증·갱신 헤더를 외부 요청 없이 확인한다.
   `npm run lint`, `npm run typecheck`, `npm run build`도 실행한다.
   실제 로그인 전후·세션 만료 후 재접속 검증은 로그인 기능을 구현하는 #5에서 수행한다.

이 단계에는 로그인 화면이나 공개 진단 API를 추가하지 않는다. 클라이언트 생성만으로 원격 접속 성공을
확인한 것은 아니다. 실제 연결은 Auth 서버의 읽기 전용 응답으로, 로그인은 검증된 사용자 조회로 각각 확인한다.

원격 연결만 별도로 확인하려면 프로젝트 루트에서 아래 명령을 실행한다(PowerShell·bash 공통).
`.env.local`의 공개 설정만 사용하며 키나 응답 본문 대신 HTTP 상태만 출력한다. HTTP 200이면 연결 성공이다.
이 확인은 로그인·DB·RLS 검증을 대신하지 않는다.

```bash
node --env-file=.env.local --input-type=module -e "const r = await fetch(new URL('/auth/v1/settings', process.env.NEXT_PUBLIC_SUPABASE_URL), { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY }, signal: AbortSignal.timeout(10000) }); console.log('Supabase Auth HTTP ' + r.status); if (!r.ok) process.exitCode = 1;"
```

참고: [Supabase SSR 설정](https://supabase.com/docs/guides/auth/server-side/creating-a-client).

### B.2 DB 마이그레이션·RLS·생성 타입

`supabase/migrations/20261104000000_create_interview_schema.sql`에 자소서·문항·경험·면접·질문
테이블, 인덱스, RLS와 `updated_at` 트리거가 있다.
`recording_path`와 `answer_audio_path`는 선택값이므로 영상/오디오 없이 기록을 저장할 수 있다.

`20261106000000_create_cover_letter_rpc.sql`은 자소서·문항·경험을 함께 저장하는
`create_cover_letter` 함수를 추가한다. `/dashboard/cover-letters/new` 작성 화면을 사용하기 전에
이 migration도 적용해야 한다. 사용자 세션과 Publishable key를 사용하며 관리자 Secret key는 필요 없다.
함수는 호출자 권한(`SECURITY INVOKER`)과 기존 RLS를 유지하고, 검증된 사용자와 JWT 주체가
일치할 때만 생성한다. 자식 저장이 실패하면 전체 호출이 롤백된다.
공식 안내: [Database functions](https://supabase.com/docs/guides/database/functions).

`20261108000000_create_interview_rpc.sql`은 면접 시작 API의 `create_interview` 함수를 추가한다.
`POST /api/interview/questions`를 사용하기 전에 이 migration까지 적용해야 한다.
함수는 검증된 사용자와 JWT 주체를 대조하고 본인 카드를 재확인·잠근 뒤 세션과 메인 질문 4개를
원자적으로 생성한다. 질문 저장 실패 시 세션도 롤백하며 기존 면접은 갱신하지 않는다.
`SECURITY INVOKER`, 빈 search_path와 기존 RLS를 유지하고 authenticated에만 실행을 허용한다.
Secret key는 필요 없다. API 요청·응답과 실패 계약은 [API.md](./API.md#면접-시작)를 참고한다.

폼·서버의 공유 입력 상한은 `src/config/cover-letter.ts`에서 관리한다. 회사명·직무 각 100자,
문항 최대 20개(질문 1,000자·답변 5,000자), 경험 최대 20개(각 3,000자)를 허용한다.

#### Supabase 프로젝트에 적용

테스트용 프로젝트를 먼저 사용한다. 아래 명령은 Supabase CLI **3.0.0** 기준이며, v2와 대상 선택
플래그가 다르다. CLI 로그인은 Publishable/Secret key가 아닌 개인 액세스 토큰을 사용한다.
DB 비밀번호는 CLI 프롬프트에 입력하며 저장소·명령 인수·로그에 남기지 않는다.

```bash
npx supabase@3.0.0 login
npx supabase@3.0.0 link --project-ref <프로젝트-ref>
npx supabase@3.0.0 db push --remote --dry-run --skip-vault
# 대상과 pending migration을 확인하고 원격 DB 변경을 승인한 다음 실행
npx supabase@3.0.0 db push --remote --skip-vault
```

`--skip-vault`는 이번 작업과 무관한 Vault 설정 갱신을 제외한다. CLI가 migration history를
관리하므로 호스팅 DB에는 SQL Editor에서 같은 migration을 따로 실행하지 않는다.
공식 안내: [CLI db push](https://supabase.com/docs/reference/cli/supabase-db-push).

#### 두 계정과 비로그인 역할 검증

`supabase/tests/ownership.sql`은 실제 SQL/RLS를 실행한다. pgTAP은 필요 없다.
마이그레이션을 적용한 **테스트 DB**에 관리자 연결을 설정하고 아래 명령을 실행한다.
`psql`은 PostgreSQL 클라이언트이며 PATH에 없으면 설치 경로로 실행한다.
연결에는 `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER` 및 비밀번호 프롬프트/개인 pgpass를 사용한다.

```bash
psql -X -v ON_ERROR_STOP=1 -f supabase/tests/ownership.sql
psql -X -v ON_ERROR_STOP=1 -f supabase/tests/cover-letter-create.sql
psql -X -v ON_ERROR_STOP=1 -f supabase/tests/cover-letter-edit-delete.sql
psql -X -v ON_ERROR_STOP=1 -f supabase/tests/interview-create.sql
```

테스트는 트랜잭션 안에서 별도 `auth.users` 두 행을 만든다. 각 계정의 JWT `sub`를 설정하고
`SET LOCAL ROLE authenticated`로 SQL을 실행한다. 비로그인은 `anon` 역할과 빈 JWT로 실행한다.
검사 함수는 모두 호출자 권한으로 실행하며, 데이터 접근 검사에 관리자/RLS 우회 권한을 사용하지 않는다.
성공하면 `PASS` 알림 뒤 `ROLLBACK`하고, assertion 실패 시 명령은 0이 아닌 종료 코드를 반환한다.
테스트 fixture와 임시 함수는 연결 종료 후 남지 않는다.

`cover-letter-create.sql`은 생성 RPC의 필수 입력·익명 요청·소유자 위조 거부, 저장 후 문항/경험 순서,
경험 0개, 계정 격리와 자식 INSERT 실패 시 회사·문항·경험 전체 롤백을 검사한다.

`cover-letter-edit-delete.sql`은 수정 RPC의 인증·소유권·입력 검증, 순서/추가/삭제 저장,
자식 INSERT 실패 시 원본 전체 유지, 카드 삭제 cascade 및 타 계정 데이터 유지를 검사한다.

`interview-create.sql`은 생성 RPC의 인증·소유권·질문 개수/형식 검증, 세션/질문의 소유자·유형·순서,
같은 카드의 재면접 기록 보존과 질문 INSERT 실패 시 세션/질문 전체 롤백을 검사한다.
두 계정 격리와 익명 접근 차단도 확인하며 실제 AI API는 호출하지 않는다.

확인 범위:

- 두 계정 각각의 5개 테이블 CRUD 성공, 상대 계정 조회/수정/삭제의 영향 행 0
- 타 계정 소유자/부모 자소서/면접으로의 INSERT·UPDATE 거부
- 타 계정 및 본인 다른 면접의 부모 질문 연결과 기존 부모 질문의 면접 이동 거부
- 비로그인 CRUD 및 RLS를 우회하는 TRUNCATE 차단
- JWT 주체 없는 authenticated 접근 차단, 정렬·상태·시간·질문 관계 제약
- 영상 없이 완료 메타데이터·답변 전사 저장, updated_at 갱신 및 삭제 cascade

일반 PostgreSQL에서도 검증할 수 있다. **새로운 일회용 로컬 PostgreSQL 인스턴스**에만
`supabase/tests/bootstrap.sql`을 먼저 적용한다. 이 파일은 Supabase가 관리하는 Auth 객체/역할의
최소 테스트 대역이다. 과거 Supabase의 넓은 기본 테이블 권한도 재현하여 migration의 권한 회수를
검사한다. 기존 Supabase 프로젝트나 업무 DB에는 실행하지 않는다.

```bash
psql -X -v ON_ERROR_STOP=1 -f supabase/tests/bootstrap.sql
psql -X -v ON_ERROR_STOP=1 -1 -f supabase/migrations/20261104000000_create_interview_schema.sql
psql -X -v ON_ERROR_STOP=1 -1 -f supabase/migrations/20261106000000_create_cover_letter_rpc.sql
psql -X -v ON_ERROR_STOP=1 -1 -f supabase/migrations/20261106010000_update_cover_letter_rpc.sql
psql -X -v ON_ERROR_STOP=1 -1 -f supabase/migrations/20261108000000_create_interview_rpc.sql
psql -X -v ON_ERROR_STOP=1 -f supabase/tests/ownership.sql
psql -X -v ON_ERROR_STOP=1 -f supabase/tests/cover-letter-create.sql
psql -X -v ON_ERROR_STOP=1 -f supabase/tests/cover-letter-edit-delete.sql
psql -X -v ON_ERROR_STOP=1 -f supabase/tests/interview-create.sql
```

CLI 로그인 상태에서는 같은 SQL 검사를 원격 프로젝트에서 실행할 수 있다.

```bash
npx supabase@3.0.0 db query --remote=<프로젝트-ref> --file supabase/tests/ownership.sql --yes
```

#### 실제 로그인·PostgREST HTTP 검증

위 SQL 검증과 별도로 `scripts/verify-supabase-http.mjs`가 실제 Auth와 PostgREST에 요청한다.
`.env.local`의 URL·Publishable key·Secret key를 사용하며, 스키마 적용 후 명시적으로 실행한다.
일반 `npm run test`에는 외부 요청을 포함하지 않는다.

```bash
npm run test:db:http
```

이 명령은 대상 프로젝트에 고유한 테스트 계정 두 개와 fixture를 만들고 삭제한다.
Secret key는 테스트 계정 생성·정리와 schema/정리 결과 확인에만 사용한다.
격리 검사는 각 계정의 이메일·비밀번호 로그인에서 받은 실제 사용자 토큰과 Publishable key로,
비로그인 검사는 Publishable key만 사용한다. 비밀번호·키·토큰·Auth 응답 본문은 출력하지 않는다.

- 두 계정의 비밀번호 로그인 및 `/auth/v1/user` 사용자/역할 확인
- 5개 테이블의 본인 CRUD, 타 계정 조회/수정/삭제의 빈 결과, 소유자/FK 위조 INSERT·UPDATE 차단
- 본인 다른 면접·타 계정 부모 질문 연결 및 기존 부모/자식 질문의 면접 이동 차단
- 비로그인 조회·생성·수정·삭제의 권한 오류, 영상 없이 완료/Q&A 저장, 삭제 cascade
- `finally`에서 해당 실행의 ID·이메일·metadata가 일치하는 테스트 사용자만 삭제하고,
  해당 ID의 계정과 fixture 행이 남지 않았는지 확인

실패하면 정리를 시도한 뒤 0이 아닌 종료 코드를 반환한다. 강제 프로세스 종료나 네트워크 장애로
정리가 완료되지 않으면 해당 실행의 테스트 계정을 관리자 화면에서 확인한다.
후속 서버 CRUD에서도 검증된 사용자 및 소유권을 확인해야 한다.
공식 안내: [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

#### DB 타입 재생성

DB row 타입의 단일 출처는 `src/types/database.ts`다. 스키마 변경 뒤 적용된 DB에서 다시 생성하며
직접 편집하지 않는다. 브라우저·서버·middleware 클라이언트 모두 `Database` 제네릭을 사용한다.

PowerShell에서는 먼저 결과를 변수에 받아 **성공했을 때만** 기존 타입 파일을 교체한다.
공백이 없는 테스트 DB의 URL은 예시이며 비밀번호가 들어가는 원격 URL은 명령 인수로 쓰지 않는다.

```powershell
# 링크한 Supabase에서 생성 (CLI 로그인 필요)
$dbTypes = npx.cmd --yes supabase@3.0.0 gen types --lang typescript --remote --schema public
if ($LASTEXITCODE -ne 0) { throw 'DB 타입 생성 실패' }
$dbTypes | Set-Content -Encoding utf8 src/types/database.ts
npx.cmd --yes oxfmt@0.66.0 src/types/database.ts
if ($LASTEXITCODE -ne 0) { throw 'DB 타입 포맷 실패' }
```

일회용 로컬 PostgreSQL에서는 생성 명령의 `--remote`를 다음 인수로 바꿀 수 있다.
`'--remote=postgresql://postgres@127.0.0.1:55433/postgres?sslmode=disable'`
로컬 예시의 TLS 비활성화는 해당 일회용 loopback 연결에만 사용한다.

현재 타입은 전체 migration을 적용한 **일회용 로컬 PostgreSQL 18.6**에서
공식 `@supabase/postgres-meta@0.100.0`으로 생성하고 `oxfmt@0.66.0`으로 포맷했다.
PostgREST 버전은 기존 프로젝트의 `14.18`로 지정했다.
이전 타입은 원격 Supabase PostgreSQL 17.11에서 Supabase CLI 3.0.0으로 생성했다.
CLI/서버 생성기 버전에 따라 포맷이나 보조 타입이
달라질 수 있으므로 재생성 diff와 `npm run typecheck`를 함께 확인한다.
공식 안내: [생성 타입](https://supabase.com/docs/guides/api/rest/generating-types).

---

## C. LLM API 키 및 질문 생성 어댑터

공개 계약은 provider 중립이며 현재 구현한 provider는 **OpenAI 하나**다.
`.env.local`에 `LLM_PROVIDER=openai`와 `OPENAI_API_KEY`를 설정한다.
기존 설정이 있으면 그대로 사용하고 키를 저장소나 로그에 남기지 않는다.

- [ ] https://platform.openai.com 에서 API 키 발급 및 Billing 설정
- [ ] `.env.local`에 `LLM_PROVIDER=openai`, `OPENAI_API_KEY` 입력
- [ ] 선택적으로 `LLM_MODEL` 지정. 비워 두면 `src/config/ai.ts`의 `gpt-5.6-terra` 사용

모델은 Responses API와 Structured Outputs를 지원해야 한다.
기본 모델의 기능은 [공식 모델 문서](https://developers.openai.com/api/docs/models/gpt-5.6-terra)를 참고한다.
다른 provider를 쓰려면 `src/lib/ai/providers/`에 같은 계약의 구현을 추가하고 팩토리에 연결한다.
현재 `claude` 등은 `UNSUPPORTED_PROVIDER` 오류를 반환하며 `ANTHROPIC_API_KEY`는 사용하지 않는다.

서버 코드에서는 팩토리와 타입만 사용한다. `ctx`는 회사명·직무·자소서 문항/답변·경험을,
꼬리질문 입력은 추가로 직전 질문·답변 전사·기존 꼬리질문 목록을 받는다.

```ts
import { getQuestionGenerator } from "@/lib/ai";
import { MAIN_QUESTION_COUNT } from "@/config/interview";

const generator = getQuestionGenerator();
const questions = await generator.generateMainQuestions(ctx, MAIN_QUESTION_COUNT);
const followUp = await generator.generateFollowUp({
  ctx, question, answerTranscript, previousFollowUps,
}); // string | null
```

설정·팩토리·provider 구현은 `server-only`로 보호한다. import 시점에는 키를 요구하지 않고
팩토리 호출 시 설정을 검증한다. API 키는 브라우저나 `NEXT_PUBLIC_*`에 넣지 않는다.
상위 코드에서 provider 구현을 직접 import하지 않는다.

OpenAI Responses API에 strict JSON Schema를 전달하고 응답을 다시 Zod로 검증한다.
요청한 개수와 정확히 일치하는 비공백 메인 질문 배열, 비공백 꼬리질문 또는 실제 null만 반환한다.
한국어·중립 면접관 톤을 지시하며 사용자 입력은 지시문과 분리된 JSON 데이터로 전달한다.
꼬리질문 강제 상한은 후속 면접 상태머신에서 처리한다.
호출에는 `store:false`, `cache:no-store`, 60초 제한, 최대 출력 4,096토큰을 적용하며
자동 재시도는 하지 않는다. [공식 구조화 응답 안내](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses) 참고.

`QuestionGenerationError.code`로 오류를 구분하며 키·지원자 내용·provider 원문은 오류에 포함하지 않는다.

| 코드 | 의미 |
| --- | --- |
| `NOT_CONFIGURED` | provider 또는 해당 키 누락/공백 |
| `UNSUPPORTED_PROVIDER` | 구현하지 않은 provider 선택 |
| `INVALID_INPUT` | 지원 맥락, 질문 개수, 꼬리질문 입력 오류 |
| `EMPTY_RESPONSE` | HTTP 본문 또는 결과 텍스트가 비어 있음 |
| `INVALID_RESPONSE` | JSON/개수/문자열/타입 오류, 거절 또는 불완전 응답 |
| `PROVIDER_FAILURE` | HTTP·네트워크·본문 수신 실패 또는 provider 실패 상태 |
| `TIMEOUT` | 제한 시간 초과 |

`npm run test`는 fetch 대역으로 실행하므로 실제 키나 외부 호출이 필요 없다.
실제 모델 호출 및 한국어 질문 품질은 별도 확인 대상이며, 이 이슈에는 면접 API·DB 연결이 포함되지 않는다.

---

## D. 음성 (TTS/STT) — MVP는 발급 불필요

- [x] MVP는 **브라우저 Web Speech API** 사용 → 별도 키/계정 **불필요, 무료**
- [ ] (후순위) 고품질 음성으로 교체 시(OpenAI TTS/Whisper 등) 해당 키 발급
- [ ] 테스트는 **Chrome 데스크톱** 권장(Web Speech 지원 안정적). 마이크/카메라 권한 허용 필요

TTS 호출부는 클라이언트에서 `createTTS()`와 `TTSPort`를 사용한다.
구현체를 직접 import하지 않는다. 생성/지원 확인만으로 음성은 재생되지 않는다.

```ts
import { createTTS } from "@/lib/speech";

const tts = createTTS();
if (tts.isSupported()) {
  try {
    await tts.speak("지원한 직무에 관심을 갖게 된 계기를 알려 주세요.");
    // 정상 종료 또는 안전 타임아웃: 다음 단계로 진행 가능
  } catch (error) {
    // AbortError: 취소/이탈, 그 외: 미지원 또는 재생 실패
    // 오류를 처리한 뒤 재시도 여부를 결정한다.
  }
}
// SPA 화면 이탈/React effect cleanup 시 반드시 호출한다.
tts.cancel();
```

기본 언어는 `SPEECH_LANG`(ko-KR)이며 선택적으로 `speak(text, { lang })`를 지정할 수 있다.
`TTS_SAFETY_TIMEOUT_MS`(30초)는 재생 요청부터 적용하는 상한이다. 시작/종료 이벤트가
누락되어도 타임아웃에 음성을 취소한 뒤 Promise가 완료되며 긴 질문은 잘릴 수 있다.
정상 end와 timeout이 겹치거나 지연 이벤트가 도착해도 완료 처리는 한 번뿐이다.
명시적 취소·pagehide·새 질문에 의한 교체는 `AbortError`로 거부되며 다음 단계로
진행하는 성공 경로와 구별된다. 모든 호출부는 rejection을 처리해야 한다.

Web Speech 큐는 전역이므로 새 `speak`는 다른 인스턴스의 이전 재생도 취소한다.
`cancel`은 자기 인스턴스의 활성 요청만 정리한다. 이전 인스턴스의 늦은 cleanup으로
새 인스턴스의 질문이 중단되지 않는다. pagehide는 자동 처리하며, SPA 화면 이탈은
pagehide가 발생하지 않으므로 호출부에서 cancel해야 한다.
타이머·이벤트·활성 utterance 참조는 완료/오류/취소 경로에서 해제한다.
API 지원이 실제 한국어 음성 제공을 보장하지는 않으며 재생 실패는 호출부에 전달한다.
음성 선택·큐·취소 동작은 [Web Speech 명세](https://webaudio.github.io/web-speech-api/#tts-section)를 따른다.

`npm run test -- src/lib/speech/web-speech-tts.test.ts`로 음성 서비스 호출 없이
종료 경합·timeout·취소·오류·이탈 정리를 검증할 수 있다. 실제 청취 확인은 Chrome에서
사용자 클릭으로 위 가상 질문을 재생하고 한국어 발음·완료·취소를 확인한다.
이번 이슈는 어댑터만 제공하며 실제 면접 화면/상태머신 연결은 후속 작업이다.

---

### 한국어 답변 전사 어댑터 (STT)

클라이언트 호출부는 `@/lib/speech`의 `createSTT()`와 `STTPort`를 사용한다.
생성과 `isSupported()`는 마이크를 켜지 않는다. 표준 `SpeechRecognition`과 Chrome의
`webkitSpeechRecognition`을 지원하며 시작 시 `ko-KR`, 연속 인식, 중간 결과를 설정한다.
API 지원 여부는 실제 권한 허용·네트워크·한국어 인식 성공을 보장하지 않는다.

```ts
import { createSTT, STTError } from "@/lib/speech";

const stt = createSTT();

// 로컬 클라이언트 테스트 호출부의 시작 버튼에서 호출한다.
function beginAnswer() {
  try {
    stt.start({
      onInterim: (draft) => console.log("전체 초안 교체", draft),
      onFinal: (transcript) => console.log("최종 전사", transcript),
      onError: (error) => console.log("오류/취소", error.code, error.partialTranscript),
    });
  } catch (error) {
    // 미지원·중복 시작·브라우저의 동기 시작 실패
    console.error(error);
  }
}

// 대답 완료 버튼에서 호출한다. stop 직후의 초안을 제출하지 않는다.
async function completeAnswer() {
  try {
    const { transcript, empty } = await stt.stop();
    console.log(empty ? "확정된 답변 없음" : "확정 완료", transcript);
  } catch (error) {
    if (error instanceof STTError) console.log(error.code, error.partialTranscript);
    else console.error(error);
  }
}

// 중도 종료·SPA 화면 이탈·effect cleanup
function cleanup() { stt.cancel(); }
```

결과 계약:

- `onInterim`: 확정 조각과 현재 중간 조각을 합친 전체 초안이다. 이전 표시를 **교체**한다.
  중간 조각은 수정·삭제될 수 있으며 확정 조각만 남아도 최신 초안을 전달한다.
- `onFinal`: 정상 `stop()` 이후 `end`에서 전체 확정 전사를 한 번 전달한다. 빈 문자열도 전달한다.
- `stop()`: 인식을 멈추고 늦게 오는 결과를 수집한다. 같은 세션의 반복 호출은 같은 Promise다.
  `end`에서 `{ transcript, empty }`로 완료하며, 미확정 interim은 포함하지 않는다.
  시작 전 호출은 `InvalidStateError`로 거부하고, 완료 뒤에는 마지막 세션 결과를 반환한다.
- 오류: 브라우저의 `not-allowed`, `service-not-allowed`, `network`, `audio-capture`,
  `no-speech`, `aborted`, `language-not-supported` 등의 코드를 유지한다. `no-match`도 오류다.
  `STTError.partialTranscript`는 오류 이전에 확정된 조각만 포함한다.
- 사용자 중지 없이 `end`가 오면 `interrupted` 오류다. 자동 재시작·자동 제출하지 않는다.
  정상 중지했으나 확정 조각이 없으면 `empty=true`, 무응답 오류가 오면 `no-speech`다.
- 중지 후 5초(`STT_FINAL_TIMEOUT_MS`) 안에 종료되지 않으면 `timeout` 오류와 abort로 정리한다.
  이를 성공으로 처리하지 않는다. 시작·중지·abort 동기 실패도 각각 전달한다.
- `cancel()`·`pagehide`는 `canceled` 오류로 대기를 취소하고 abort한다.
  SPA 이탈에는 pagehide가 없으므로 호출부가 cancel해야 한다. 종료 경로에서
  타이머·이벤트·pagehide 리스너를 해제하며 지연 이벤트는 다음 답변에 영향을 주지 않는다.

STT는 자체 마이크를 사용한다. 장비 점검의 카메라·마이크 스트림을 전달받거나 종료하지 않는다.
카메라 스트림과 STT는 별도 운용하며 카메라 스트림 정리는 그 소유 호출부가 담당한다.
stop과 abort의 차이 및 전체 결과 목록은 [Web Speech 명세](https://webaudio.github.io/web-speech-api/#speechreco-section)를 따른다.

`npm run test -- src/lib/speech/web-speech-stt.test.ts`는 실제 음성 서비스 호출 없이
결과 누적·종료 경합·권한/네트워크 오류·timeout·취소·정리를 검증한다.

실제 데스크톱 Chrome 확인 절차:

1. localhost 또는 HTTPS에서 로컬 임시 클라이언트 호출부에 위 예시를 연결한다.
   기존 준비 화면의 장비 점검처럼 `getUserMedia({ video: true, audio: true })`를 유지하고
   `video.srcObject`에 연결하여 카메라 미리보기를 재생한다.
2. 카메라·마이크 권한을 허용하고 시작 동작에서 `beginAnswer()`를 호출한다.
   가상 답변 “팀에서 의견을 조율해 문제를 해결했습니다”를 여러 문장으로 말한다.
   한국어 초안이 갱신되고 카메라가 계속 재생되는지 확인한다.
3. 문장을 마치는 즉시 `completeAnswer()`를 호출한다. 마지막 문장이 최종 전사에
   포함되고 최종 콜백이 한 번만 오는지, 카메라 트랙이 live인지 확인한다.
4. 무응답은 `no-speech` 또는 정상 중지의 `empty=true`로 구별되는지 확인한다.
   권한 거부/허용 후 재시도, 네트워크 중단, 취소와 페이지 이동도 확인한다.
5. STT를 취소한 뒤 카메라가 계속 재생되는지 확인한다. 카메라 스트림의 모든 트랙도
   stop한 후 브라우저의 카메라·마이크 사용 표시가 꺼지는지 확인한다.
   카메라 스트림에 audio 트랙이 있으면 STT만 중지해도 마이크 표시가 남는 것이 정상이다.

이슈 #14 작업 환경에는 연결된 브라우저가 없어 실제 Chrome의 발화·카메라 동시 사용은
미검증이다. 사용자와 합의하여 실제 화면이 연결되는 [#17](https://github.com/kangwook-kim02/AI-interview/issues/17)에서
확인하고, [#20](https://github.com/kangwook-kim02/AI-interview/issues/20)의 Chrome 통합 검증에서 재확인한다.
자동 테스트 결과는 실장비/음성 서비스 검증을 대체하지 않는다.

---

## E. 로컬 개발 환경

- [ ] **Node.js 22.x는 22.12 이상, 또는 24 이상** 설치 (24 LTS 권장) — https://nodejs.org
- [ ] 저장소 클론 후 `.env.local.example` 복사 → `.env.local` 작성 (위 A~C 값 입력, 기존 파일이 있으면 유지)
  - PowerShell: `Copy-Item .env.local.example .env.local` (처음 설정할 때만)
- [ ] `npm install` → `npm run dev`
  - PowerShell 실행 정책으로 `npm`이 차단되면 `npm.cmd`를 사용한다.
  - http://localhost:3000 에서 기본 화면을 확인한다. 스캐폴딩 단계는 API 키 없이 실행할 수 있다.
- [ ] `npm run lint` / `npm run typecheck` / `npm run build`로 개발 설정 확인
- [ ] (면접 기능 구현 이후) 브라우저에서 카메라/마이크 권한 허용하고 면접 플로우 확인

---

## F. Codex에서도 작업할 경우 (선택)

이 저장소는 Claude Code와 Codex **둘 다** 지원하도록 스킬/에이전트가 준비돼 있다.

- [ ] Codex CLI 설치 + 로그인
- [ ] **프로젝트를 "trusted"로 설정** — 그래야 `.codex/` 프로젝트 레이어(서브에이전트)가 로드됨
  - `~/.codex/config.toml`에 `projects.<repo-경로>.trust_level = "trusted"` 추가, 또는 최초 신뢰 프롬프트 승인
  - 스킬(`.agents/skills/`)은 trust 없이도 자동 로드됨
- 구조: 스킬 `.agents/skills/<name>/SKILL.md`, 서브에이전트 `.codex/agents/<name>.toml`, 지침 `AGENTS.md`(자동 로드). 상세는 `AGENTS.md` §10.

---

## 요약: 지금 당장 준비하면 좋은 것

1. **Supabase 프로젝트 만들고 URL·Publishable key 확보** (B, Secret key는 관리자 작업 시에만)
2. **LLM 하나 골라 키 발급 + 비용 상한 설정** (C)
3. Node.js 설치 (E)

→ 기본 앱은 API 키 없이 실행할 수 있다. 인증·DB·질문 생성은 각 후속 이슈 구현 후 위 설정으로 확인한다.
