"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { AUTH_REDIRECT_PATH } from "@/config/auth";
import { getInterviewPreparePath, getInterviewResultPath, MAIN_QUESTION_COUNT, MAX_FOLLOW_UPS } from "@/config/interview";
import { interviewSessionIO } from "@/lib/interview-session/http";
import { createSTT, createTTS } from "@/lib/speech";
import { useInterviewCamera } from "../hooks/useInterviewCamera";
import { useInterviewSession } from "../hooks/useInterviewSession";
import { useInterviewTimer } from "../hooks/useInterviewTimer";

const phaseLabels = {
  idle: "시작을 준비해요", generating_questions: "자소서를 바탕으로 질문을 준비하고 있어요",
  asking: "질문을 듣고 있어요", recording: "편안하게 답해 주세요. 듣고 있어요",
  transcribing: "마지막 말씀까지 정리하고 있어요", evaluating: "답변을 살펴보고 있어요",
  error: "잠시 멈췄어요", finishing: "면접 기록을 저장하고 있어요", done: "연습을 마쳤어요",
};

export function InterviewSessionView({ id, companyName, jobTitle, autoStart = false }: {
  id: string; companyName: string; jobTitle: string; autoStart?: boolean;
}) {
  const router = useRouter();
  const { snapshot, ready, start, answerDone, retry, abort, interrupt } = useInterviewSession(interviewSessionIO);
  const [cameraWanted, setCameraWanted] = useState(autoStart);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const terminal = snapshot.endReason !== null;
  const camera = useInterviewCamera(cameraWanted && supported === true && !terminal);
  const video = useRef<HTMLVideoElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const elapsed = useInterviewTimer(snapshot.coverLetterId !== null, terminal);
  const { stream, status: cameraStatus, error: cameraError, ready: cameraReady, stop: stopCamera } = camera;
  const currentNumber = snapshot.mainQuestions.length ? snapshot.mainQuestionIndex + 1 : 0;
  const progress = snapshot.endReason === "completed" ? MAIN_QUESTION_COUNT : currentNumber;

  useEffect(() => { setSupported(createTTS().isSupported() && createSTT().isSupported()); }, []);
  useEffect(() => {
    if (snapshot.phase === "done" && snapshot.interviewId) {
      router.replace(getInterviewResultPath(id, snapshot.interviewId));
    }
  }, [snapshot.phase, snapshot.interviewId, id, router]);
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    element.srcObject = stream;
    return () => { element.srcObject = null; };
  }, [stream]);
  useEffect(() => {
    if (cameraReady && supported && ready && snapshot.phase === "idle") start(id);
  }, [cameraReady, supported, ready, snapshot.phase, start, id]);
  useEffect(() => {
    if (cameraError) interrupt(cameraError);
  }, [cameraError, interrupt]);
  useEffect(() => {
    if (confirmEnd) dialog.current?.showModal();
    else dialog.current?.close();
  }, [confirmEnd]);
  useEffect(() => {
    if (terminal) setConfirmEnd(false);
  }, [terminal]);
  useEffect(() => {
    if (snapshot.phase === "idle" || snapshot.phase === "done") return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [snapshot.phase]);

  function end() {
    setConfirmEnd(false);
    abort();
    stopCamera();
  }

  return (
    <div>
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-6">
        <div className="min-w-0">
          <p className="break-words text-sm font-semibold text-accent">{companyName} · {jobTitle}</p>
          <h1 className="mt-3 text-2xl font-bold sm:text-3xl">한 질문씩, 내 이야기로</h1>
        </div>
        <div className="flex items-center gap-6">
          <p className="text-sm text-muted">경과 시간 <span role="timer" aria-label="면접 경과 시간" className="ml-2 text-lg font-semibold tabular-nums text-foreground">{elapsed}</span></p>
          {!terminal && <Button variant="secondary" onClick={() => setConfirmEnd(true)}>면접 종료</Button>}
        </div>
      </header>

      <div className="my-6 flex flex-wrap items-center gap-x-6 gap-y-3">
        <p className="font-semibold tabular-nums">메인 질문 {progress} / {MAIN_QUESTION_COUNT}</p>
        <div role="progressbar" aria-valuemin={0} aria-valuemax={MAIN_QUESTION_COUNT} aria-valuenow={progress}
          aria-label="메인 질문 진행률" className="h-2 w-32 overflow-hidden rounded-pill bg-line sm:w-48">
          <div className="h-full rounded-pill bg-accent transition-[width] duration-ui motion-reduce:transition-none" style={{ width: `${progress / MAIN_QUESTION_COUNT * 100}%` }} />
        </div>
        {!terminal && snapshot.followUpIndex > 0 && <p className="text-sm text-accent">꼬리질문 {snapshot.followUpIndex} / {MAX_FOLLOW_UPS}</p>}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section aria-labelledby="session-camera" className="min-w-0 rounded-lg border border-line bg-surface p-5 sm:p-6">
          <h2 id="session-camera" className="text-lg font-bold">내 모습</h2>
          <div className="relative mt-4 aspect-video overflow-hidden rounded-md bg-accent-soft">
            <video ref={video} autoPlay muted playsInline aria-label="면접 카메라 미리보기"
              onLoadedData={camera.markReady} onError={camera.fail} className="h-full w-full -scale-x-100 object-cover" />
            {!stream && <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-accent">
              {terminal ? "카메라 사용을 마쳤어요" : cameraStatus === "requesting" ? "브라우저에서 카메라를 허용해 주세요" : "카메라가 준비되면 내 모습이 보여요"}
            </p>}
          </div>
          <p className="mt-4 text-sm text-muted">영상은 내 모습을 확인하는 데만 사용해요. 영상 파일은 저장하지 않아요.</p>
          {cameraError && !terminal && <div className="mt-4" role="alert">
            <p className="text-sm text-warning">{cameraError}</p>
            <Button variant="secondary" className="mt-4" onClick={camera.retry}>카메라 다시 연결</Button>
          </div>}
        </section>

        <section aria-labelledby="session-question" className="min-w-0 rounded-lg border border-line bg-surface p-5 sm:p-8">
          <p role="status" className="text-sm font-semibold text-accent">{phaseLabels[snapshot.phase]}</p>
          <h2 id="session-question" className="mt-4 whitespace-pre-wrap break-words text-xl font-bold leading-relaxed sm:text-2xl">
            {terminal ? snapshot.phase === "done" ? snapshot.interviewId ? "연습 기록을 저장했어요" : "면접 시작을 취소했어요"
              : snapshot.error ? "기록 저장을 확인해 주세요" : "기록을 안전하게 남기고 있어요"
              : snapshot.question ?? "내 경험을 말하는 연습, 함께 시작해요"}
          </h2>

          {snapshot.phase === "idle" && <div className="mt-5">
            <p className="text-muted">카메라로 내 모습을 보고, 마이크로 답변을 받아써요. 브라우저 음성 인식 서비스가 음성을 처리할 수 있으며, 확정 답변은 서버로 보내 AI가 다음 질문을 판단해요.</p>
            {supported === false && <p role="alert" className="mt-4 text-warning">음성 기능을 지원하지 않는 환경이에요. 데스크톱 Chrome에서 장비를 다시 점검해 주세요.</p>}
            {!cameraWanted && <Button className="mt-6" disabled={!ready || !supported} onClick={() => setCameraWanted(true)}>동의하고 면접 시작하기</Button>}
            {cameraWanted && !cameraError && <p className="mt-4 text-sm text-muted">카메라가 준비되면 질문 생성을 시작해요. 권한 창이 보이지 않으면 주소창의 사이트 설정을 확인해 주세요.</p>}
            <Link className="mt-5 inline-block font-semibold text-accent hover:underline" href={getInterviewPreparePath(id)}>장비 다시 점검하기</Link>
          </div>}

          {snapshot.phase === "generating_questions" && <p className="mt-6 text-muted">잠시만 기다려 주세요. 준비한 경험에 맞는 질문 {MAIN_QUESTION_COUNT}개를 고르고 있어요.</p>}

          {snapshot.question && !terminal && <div className="mt-8 border-t border-line pt-6">
            <h3 className="text-sm font-semibold">{snapshot.answerTranscript !== null ? "확정된 내 답변" : "받아쓰는 중 · 아직 확정되지 않았어요"}</h3>
            <p className={`mt-3 whitespace-pre-wrap break-words ${snapshot.answerTranscript !== null ? "text-foreground" : "text-muted"}`}>
              {snapshot.answerTranscript !== null ? snapshot.answerTranscript || "인식된 답변이 없어요."
                : (snapshot.error?.partialTranscript ?? snapshot.draft) || (snapshot.phase === "asking" ? "질문이 끝나면 마이크가 자동으로 켜져요." : "말씀하신 내용이 여기에 나타나요.")}
            </p>
            <Button className="mt-6 w-full sm:w-auto" disabled={snapshot.phase !== "recording" || !cameraReady} onClick={answerDone}>대답 완료</Button>
          </div>}

          {snapshot.error && <div role="alert" className="mt-6 rounded-md bg-primary-soft p-5">
            <p>{snapshot.error.message}</p>
            {snapshot.error.code && <p className="mt-2 text-sm text-muted">마이크 권한과 네트워크 연결을 확인해 주세요. 다시 시도하면 같은 질문부터 이어가요.</p>}
            {(!terminal || snapshot.interviewId) && <Button className="mt-4" disabled={!terminal && !cameraReady} onClick={retry}>{terminal ? "기록 저장 다시 시도하기" : "다시 시도하기"}</Button>}
          </div>}

          {terminal && <div className="mt-5">
            <p className="text-muted">{snapshot.phase === "done" ? snapshot.interviewId ? "저장된 기록으로 이동해요." : "생성된 면접이 없어 저장할 기록은 없어요."
              : snapshot.error ? "아직 저장 완료를 확인하지 못했어요. 확정된 답변은 아래에 남아 있어요."
                : "확정된 답변과 소요시간을 저장하고 있어요. 잠시만 기다려 주세요."}</p>
            {(snapshot.phase === "done" || (snapshot.error && !snapshot.interviewId)) && <Link href={AUTH_REDIRECT_PATH} className="mt-6 inline-block rounded-pill bg-accent-soft px-6 py-3 font-semibold text-accent hover:underline">대시보드로 돌아가기</Link>}
          </div>}
        </section>
      </div>

      {snapshot.answers.length > 0 && <details className="mt-8 rounded-md border border-line bg-surface p-5 sm:p-6" open={terminal || undefined}>
        <summary className="cursor-pointer font-semibold">확정된 질문과 답변 · {snapshot.answers.length}개</summary>
        <ol className="mt-6 space-y-6">
          {snapshot.answers.map((answer) => <li key={`${answer.mainQuestionIndex}-${answer.followUpIndex}`} className="border-t border-line pt-5">
            <p className="text-sm font-semibold text-accent">메인 {answer.mainQuestionIndex + 1}{answer.followUpIndex > 0 ? ` · 꼬리 ${answer.followUpIndex}` : ""}</p>
            <p className="mt-2 whitespace-pre-wrap break-words font-semibold">{answer.question}</p>
            <p className="mt-3 whitespace-pre-wrap break-words">{answer.answerTranscript || "인식된 답변이 없어요."}</p>
          </li>)}
        </ol>
      </details>}

      <dialog ref={dialog} onCancel={() => setConfirmEnd(false)} onClose={() => setConfirmEnd(false)} aria-labelledby="end-interview-title"
        className="w-[calc(100%_-_2rem)] max-w-md rounded-lg border border-line bg-surface p-6 text-foreground shadow-md backdrop:bg-foreground/30 sm:p-8">
        <h2 id="end-interview-title" className="text-xl font-bold">여기서 면접을 마칠까요?</h2>
        <p className="mt-4 text-muted">카메라와 마이크를 끄고 확정된 답변까지 기록해요. 아직 받아쓰는 중인 답변은 저장하지 않아요.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => setConfirmEnd(false)}>계속 연습하기</Button>
          <Button onClick={end}>면접 마치기</Button>
        </div>
      </dialog>
    </div>
  );
}
