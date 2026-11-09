"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AUTH_REDIRECT_PATH } from "@/config/auth";
import { getInterviewPath } from "@/config/interview";
import { useDeviceCheck } from "../hooks/useDeviceCheck";

export function DeviceCheck({ id, companyName, jobTitle }: { id: string; companyName: string; jobTitle: string }) {
  const router = useRouter();
  const check = useDeviceCheck();
  const video = useRef<HTMLVideoElement>(null);
  const { stream, status, microphoneDetected, microphoneLevel, error } = check.snapshot;

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    element.srcObject = stream;
    return () => { element.srcObject = null; };
  }, [stream]);

  const supported = check.support?.media && check.support.tts && check.support.stt;

  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-sm font-semibold text-accent">{companyName} · {jobTitle}</p>
      <h1 className="mt-4 text-3xl font-bold sm:text-4xl">편안하게, 장비부터 확인해요</h1>
      <p className="mt-4 text-muted">화면이 잘 보이고 목소리가 잘 들리는지 함께 확인할게요.</p>

      {check.completed ? (
        <Card className="mt-8" role="status">
          <h2 className="text-2xl font-bold">장비 점검을 마쳤어요</h2>
          <p className="mt-4 text-muted">질문을 준비하는 화면으로 이동하고 있어요.</p>
          <Link href={AUTH_REDIRECT_PATH} className="mt-6 inline-block font-semibold text-accent hover:underline">
            대시보드로 돌아가기
          </Link>
          <div className="mt-6"><Button variant="secondary" onClick={check.start}>다시 점검하기</Button></div>
        </Card>
      ) : (
        <>
          <Card className="mt-8">
            <h2 className="text-lg font-bold">장비는 이렇게 사용해요</h2>
            <p id="device-purpose" className="mt-3 text-sm text-muted">
              카메라는 내 모습을 확인하는 용도, 마이크는 면접 음성 답변을 위한 장비예요.
              이 점검에서는 화면 미리보기와 소리 크기만 확인하고, 영상·음성 파일을 저장하거나 전송하지 않아요.
              취소하거나 이 화면을 떠나면 장비 사용을 종료해요.
            </p>
            <p className="mt-3 text-sm text-muted">면접을 시작하면 카메라로 내 모습을 보여 주고, 브라우저 음성 인식으로 답변을 받아써요. 음성은 브라우저의 인식 서비스에서 처리될 수 있으며, 확정된 답변은 서버로 보내 AI가 꼬리질문을 판단해요.</p>
            <label className="mt-6 flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={check.consented}
                onChange={(event) => check.setConsent(event.target.checked)}
                aria-describedby="device-purpose"
                className="mt-1 h-5 w-5 shrink-0 accent-accent"
              />
              <span>사용 목적을 확인했고, 카메라·마이크 사용에 동의해요.</span>
            </label>
          </Card>

          <div className="mt-8 grid items-stretch gap-6 md:grid-cols-2">
            <section aria-labelledby="camera-title" className="min-w-0 rounded-md border border-line bg-surface p-6">
              <h2 id="camera-title" className="text-lg font-bold">카메라 미리보기</h2>
              <div className="relative mt-4 aspect-video overflow-hidden rounded-md border border-line bg-surface">
                <video
                  ref={video}
                  autoPlay muted playsInline
                  aria-label="내 카메라 미리보기"
                  onLoadedData={check.markCameraReady}
                  onError={check.failPreview}
                  className="h-full w-full -scale-x-100 object-cover"
                />
                {!stream && <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-muted">동의 후 점검을 시작하면 내 모습이 보여요.</p>}
              </div>
              <p className="mt-3 text-sm text-muted" role="status">{check.cameraReady ? "카메라 영상이 확인되었어요." : "카메라 확인 대기 중"}</p>
            </section>
            <section aria-labelledby="microphone-title" className="min-w-0 rounded-md border border-line bg-surface p-6">
              <h2 id="microphone-title" className="text-lg font-bold">마이크 입력</h2>
              <p className="mt-4 text-sm text-muted">점검을 시작한 뒤 “안녕하세요”라고 말해 보세요. 입력 막대가 움직이면 목소리가 들어오고 있어요.</p>
              <meter className="mt-6 h-6 w-full accent-accent" min={0} max={1} value={microphoneLevel} aria-label="마이크 입력 크기" />
              <p className="mt-4 text-sm font-semibold" role="status">{microphoneDetected ? "목소리가 확인되었어요." : "아직 소리가 감지되지 않았어요."}</p>
              <p className="mt-3 text-sm text-muted">입력이 없으면 마이크 음소거와 운영체제의 입력 장치 설정을 확인해 주세요.</p>
            </section>
          </div>

          <div className="mt-8 border-y border-line py-6">
            <h2 className="text-lg font-bold">브라우저 음성 기능</h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li>질문 읽기(TTS): {check.support ? (check.support.tts ? "지원됨" : "미지원") : "확인 중"}</li>
              <li>답변 받아쓰기(STT): {check.support ? (check.support.stt ? "지원됨" : "미지원") : "확인 중"}</li>
            </ul>
            <p className="mt-3 text-sm text-muted">브라우저의 기능 지원 여부를 확인해요. 실제 음성 인식에는 네트워크 연결 등이 필요할 수 있어요.</p>
            {check.support && !supported && (
              <p role="alert" className="mt-4 text-sm font-semibold text-warning">
                {!check.support.media ? "카메라·마이크 점검을 지원하지 않는 환경이에요. " : "필수 음성 기능을 지원하지 않는 브라우저예요. "}
                HTTPS 주소에서 데스크톱 Chrome 최신 버전으로 열어 주세요. 지원되는 환경에서 다시 점검해야 해요.
              </p>
            )}
          </div>

          {(error || check.previewError) && <p role="alert" className="mt-6 text-sm font-semibold text-warning">{error ?? "카메라 영상을 표시하지 못했어요. 브라우저 설정과 장비 연결을 확인한 뒤 다시 점검해 주세요."}</p>}
          {status === "requesting" && (
            <p role="status" className="mt-6 text-sm text-muted">브라우저 권한 창에서 카메라와 마이크를 허용해 주세요. 창이 보이지 않으면 주소창의 권한 아이콘을 확인해 주세요. 기다리지 않고 아래에서 취소할 수도 있어요.</p>
          )}

          <div className="mt-8 flex flex-wrap items-center gap-4">
            {check.ready ? (
              <Button onClick={() => {
                check.complete();
                router.push(`${getInterviewPath(id)}?start=1`);
              }}>면접 시작하기</Button>
            ) : (
              <Button onClick={check.start} disabled={!check.consented || !supported || status === "requesting"}>
                {status === "requesting" ? "권한 응답 기다리는 중" : status === "active" || status === "error" || check.previewError ? "다시 점검하기" : "동의하고 장비 점검하기"}
              </Button>
            )}
            {!check.ready && <Button variant="secondary" disabled>면접 시작하기</Button>}
            <Link href={AUTH_REDIRECT_PATH} onClick={check.stop} className="px-2 py-3 font-semibold text-accent hover:underline">취소하고 돌아가기</Link>
          </div>
          <p className="mt-4 text-sm text-muted">카메라 영상·마이크 입력·음성 기능이 모두 확인되면 면접을 시작할 수 있어요.</p>
        </>
      )}
    </div>
  );
}
