# 면접 세션 제어 (#16)

`features/interview/machine.ts`의 순수 `transition`이 진행 규칙의 단일 출처다.
세션마다 독립적인 Zustand store를 만들며 `createInterviewSession`이 IO·음성을 실행한다.
화면은 `useInterviewSession(io)`에 안정적인 IO 인스턴스를 전달하고 반환된
`snapshot`, `ready`, `start(coverLetterId)`, `answerDone()`, `retry()`, `abort()`를 사용한다.
ready가 true인 뒤 사용자 시작 동작으로 start를 호출한다. 자동 시작하지 않는다.

## 상태와 허용 이벤트

| 상태 | 허용 이벤트 | 다음 상태 |
| --- | --- | --- |
| idle | START | generating_questions |
| generating_questions | QUESTIONS_READY / FAILED | asking / error |
| asking | TTS_END / FAILED | recording / error |
| recording | DRAFT / ANSWER_DONE / FAILED | recording / transcribing / error |
| transcribing | TRANSCRIPT_FINAL / FAILED | evaluating / error |
| evaluating | FOLLOW_UP_RESULT / FAILED | asking 또는 finishing / error |
| error | RETRY | 실패한 생성·재생·판단 단계, 음성 인식 오류는 asking |
| finishing | FINISHED | done |
| done | 없음 | 변화 없음 |

done·finishing 이외의 모든 상태에서 ABORT는 finishing으로 전이한다.
finishing에서 음성을 취소하고 로컬 정리를 마치면 즉시 done으로 이동한다.
endReason은 completed 또는 aborted다. finishing/done은 DB 종료 저장·녹화·업로드 완료를 뜻하지 않는다.

메인 질문은 정확히 MAIN_QUESTION_COUNT개여야 한다. followUpIndex는 메인에서 0,
그 메인의 꼬리에서 1..MAX_FOLLOW_UPS다. 상한에서 IO가 추가 질문을 반환해도
다음 메인으로 이동한다. 메인별 카운터를 초기화하고 마지막 메인을 마치면 자동 종료한다.
상한에서도 마지막 확정 답변을 판단 IO에 전달하므로 IO 구현이 답변을 저장할 수 있다.

## 비동기와 오류

단계 진입마다 operationId를 증가시킨다. 비동기 결과는 자신이 시작된 작업 ID를
돌려보내야 하며, 현재 상태와 ID가 모두 맞을 때만 수락한다. 초안 갱신은 ID를 바꾸지 않는다.
controller를 직접 사용할 때 answerDone/retry에는 화면에 표시된 snapshot.operationId를
전달한다. hook은 렌더 시점의 ID를 캡처해 오래된 클릭 처리도 차단한다.

TTS speak 완료(기존 어댑터의 안전 타임아웃 포함) 뒤에만 STT를 시작한다.
대답 완료를 처음 수락하면 바로 transcribing으로 이동하고 stop Promise를 한 번 기다린다.
onFinal 콜백은 별도 전이 입력으로 쓰지 않는다. onInterim은 전체 초안을 교체하며,
stop 결과만 trim해 answers에 추가하고 판단한다. 빈 최종 전사도 판단 IO에 그대로 보낸다.

오류는 error.stage/message와 음성 오류의 code/partialTranscript를 보존한다.
생성 오류는 생성 재시도, TTS 오류는 같은 질문 재생, STT 시작·인식·확정 오류는
같은 질문을 재생한 뒤 답변 다시 받기다. 부분 전사를 최종 답변으로 자동 제출하지 않는다.
판단 오류 재시도는 확정 전사와 위치를 유지하고 답변 기록을 중복 추가하지 않는다.

종료·오류에서 음성을 취소하고 진행 단계 변경 시 이전 IO의 AbortSignal을 취소한다.
취소를 무시하는 구현도 늦은 결과로 세션을 진행할 수 없다. hook은 pagehide에서 abort,
언마운트/IO 교체에서 dispose한다. Strict Mode의 effect 재설정은 새 idle 세션을 만든다.
완료된 인스턴스는 다시 시작하지 않는다. 새 면접에는 새 인스턴스를 만든다.

## IO 연결 경계

`lib/interview-session/types.ts`의 InterviewSessionIO를 구현해 주입한다.
start는 기존 StartInterviewResponse, followUp은 FollowUpResponse를 반환한다.
controller는 응답을 기존 Zod 스키마로 검증한다. 브라우저가 LLM을 직접 호출하지 않는다.

followUp 입력은 interviewId, mainQuestionIndex, followUpIndex, answerTranscript다.
위치는 DB UUID가 아니다. 기존 REST API는 시작 시 질문 텍스트만, 판단 시 꼬리 텍스트만
반환하므로 포트 구현에서 저장된 질문 UUID를 조회한 뒤 REST questionId에 연결해야 한다.
같은 질문·전사 재시도는 같은 UUID를 사용해야 한다. UUID를 임의 생성하거나 질문 텍스트로
식별하지 않는다. 실제 HTTP/UUID 조회 포트와 화면 조립은 #17에서 연결한다.
이번 변경에는 실제 네트워크 포트 구현이 포함되지 않는다.

기존 시작 API는 멱등하지 않아 응답 유실 뒤 재시도가 새 서버 세션을 만들 수 있다.
로컬 abort/dispose는 이미 생성된 서버 세션을 삭제하거나 종료 처리하지 않는다.
종료 기록 저장·영상 녹화·업로드는 후속 이슈 범위다. 실제 브라우저 음성 및 HTTP의
수동 통합 검증도 화면 연결 시 수행한다. #16 테스트는 지연/실패 가능한 IO·음성 포트를 사용한다.

Zustand 구성은 공식 [createStore](https://zustand.docs.pmnd.rs/reference/apis/create-store.html)와
[useStore](https://zustand.docs.pmnd.rs/reference/hooks/use-store) API를 따른다.
