"use client";

import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { useActionState, useId, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AUTH_REDIRECT_PATH } from "@/config/auth";
import {
  COMPANY_NAME_MAX_LENGTH,
  JOB_TITLE_MAX_LENGTH,
  ESSAY_QUESTION_MAX_LENGTH,
  ESSAY_ANSWER_MAX_LENGTH,
  EXPERIENCE_MAX_LENGTH,
  MIN_ESSAY_ITEMS,
  MAX_ESSAY_ITEMS,
  MAX_EXPERIENCES,
} from "@/config/cover-letter";
import {
  coverLetterSchema,
  coverLetterValidationState,
  type CoverLetterInput,
  type CoverLetterActionState,
} from "@/types/cover-letter";
import { createCoverLetter } from "../actions";

type Essay = CoverLetterInput["essays"][number] & { key: string };
type Experience = CoverLetterInput["experiences"][number] & { key: string };

function Field({
  id,
  label,
  error,
  headerAction,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  headerAction?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-semibold">
          {label}
        </label>
        {headerAction}
      </div>
      {children}
      {error && (
        <p id={`${id}-error`} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function CoverLetterForm() {
  const prefix = useId();
  const [companyName, setCompanyName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [essays, setEssays] = useState<Essay[]>([{ key: "first", question: "", answer: "" }]);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [edited, setEdited] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [state, formAction, pending] = useActionState<CoverLetterActionState, FormData>(
    async (previous, formData) => {
      setEdited(false);
      const parsed = coverLetterSchema.safeParse(JSON.parse(String(formData.get("payload"))));
      if (!parsed.success) return coverLetterValidationState(parsed.error);
      try {
        return await createCoverLetter(previous, formData);
      } catch (error) {
        // 성공 리다이렉트는 Next에 맡기고, 전송 오류만 폼 안에서 안내한다.
        unstable_rethrow(error);
        return {
          error: "서버 응답을 받지 못했어요. 작성한 내용은 그대로예요. 연결을 확인해 주세요.",
        };
      }
    },
    {},
  );
  const feedback = edited ? {} : state;
  const inputProps = (path: string, id: string) => ({
    id,
    "aria-invalid": Boolean(feedback.fieldErrors?.[path]),
    "aria-describedby": feedback.fieldErrors?.[path] ? `${id}-error` : undefined,
  });
  const edit = () => setEdited(true);

  function moveEssay(index: number, delta: number) {
    const next = [...essays];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    setEssays(next);
    setAnnouncement(`문항 ${index + 1}을 ${index + delta + 1}번째로 옮겼어요.`);
    edit();
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link href={AUTH_REDIRECT_PATH} className="text-sm font-semibold text-accent hover:underline">
        ← 대시보드
      </Link>
      <h1 className="mt-6 text-2xl font-bold sm:text-3xl">어떤 이야기를 준비하셨나요?</h1>
      <p className="mt-3 text-muted">
        지원할 회사와 자소서를 알려 주세요. 면접 연습의 바탕이 돼요.
      </p>

      <form action={formAction} noValidate className="mt-10" onChange={edit} aria-busy={pending}>
        <input
          type="hidden"
          name="payload"
          value={JSON.stringify({ companyName, jobTitle, essays, experiences })}
        />
        <fieldset disabled={pending} className="min-w-0 space-y-10">
          <section aria-labelledby={`${prefix}-company`}>
            <h2 id={`${prefix}-company`} className="text-lg font-bold">
              지원 정보
            </h2>
            <p className="mt-2 text-sm text-muted">
              회사명, 직무, 문항의 질문과 답변은 모두 필수예요.
            </p>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <Field
                id={`${prefix}-companyName`}
                label="회사명"
                error={feedback.fieldErrors?.companyName}
              >
                <Input
                  {...inputProps("companyName", `${prefix}-companyName`)}
                  name="companyName"
                  value={companyName}
                  onChange={(event) => setCompanyName(event.target.value)}
                  maxLength={COMPANY_NAME_MAX_LENGTH}
                  placeholder="예: OO전자"
                  required
                />
              </Field>
              <Field
                id={`${prefix}-jobTitle`}
                label="지원 직무"
                error={feedback.fieldErrors?.jobTitle}
              >
                <Input
                  {...inputProps("jobTitle", `${prefix}-jobTitle`)}
                  name="jobTitle"
                  value={jobTitle}
                  onChange={(event) => setJobTitle(event.target.value)}
                  maxLength={JOB_TITLE_MAX_LENGTH}
                  placeholder="예: SW 개발"
                  required
                />
              </Field>
            </div>
          </section>

          <section aria-labelledby={`${prefix}-essays`} className="border-t border-line pt-8">
            <h2 id={`${prefix}-essays`} className="text-lg font-bold">
              자소서 문항
            </h2>
            <p className="mt-2 text-sm text-muted">
              최소 1개를 작성해 주세요. 위·아래 버튼으로 순서를 바꿀 수 있어요.
            </p>
            <div className="mt-6 space-y-6">
              {essays.map((essay, index) => {
                const questionId = `${prefix}-${essay.key}-question`;
                const answerId = `${prefix}-${essay.key}-answer`;
                return (
                  <fieldset
                    key={essay.key}
                    className="min-w-0 rounded-md border border-line bg-surface p-4 sm:p-6"
                  >
                    <legend className="sr-only">문항 {index + 1}</legend>
                    <div className="mb-5 flex items-center justify-between gap-2">
                      <p aria-hidden="true" className="shrink-0 font-semibold">
                        문항 {index + 1}
                      </p>
                      <div className="flex items-center gap-1 sm:gap-2">
                        <Button
                          variant="secondary"
                          className="min-h-10 w-10 px-2 py-2 text-sm sm:w-auto sm:px-3"
                          disabled={index === 0}
                          aria-label={`문항 ${index + 1} 위로 이동`}
                          onClick={() => moveEssay(index, -1)}
                        >
                          <span aria-hidden="true">↑</span>
                          <span className="hidden sm:inline">위로</span>
                        </Button>
                        <Button
                          variant="secondary"
                          className="min-h-10 w-10 px-2 py-2 text-sm sm:w-auto sm:px-3"
                          disabled={index === essays.length - 1}
                          aria-label={`문항 ${index + 1} 아래로 이동`}
                          onClick={() => moveEssay(index, 1)}
                        >
                          <span aria-hidden="true">↓</span>
                          <span className="hidden sm:inline">아래로</span>
                        </Button>
                        <Button
                          variant="secondary"
                          className="min-h-10 px-2 py-2 text-sm sm:px-3"
                          disabled={essays.length <= MIN_ESSAY_ITEMS}
                          aria-label={`문항 ${index + 1} 삭제`}
                          onClick={() => {
                            setEssays(essays.filter((item) => item.key !== essay.key));
                            setAnnouncement(`문항 ${index + 1}을 삭제했어요.`);
                            edit();
                          }}
                        >
                          삭제
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-5">
                      <Field
                        id={questionId}
                        label="질문"
                        error={feedback.fieldErrors?.[`essays.${index}.question`]}
                      >
                        <Input
                          {...inputProps(`essays.${index}.question`, questionId)}
                          value={essay.question}
                          required
                          maxLength={ESSAY_QUESTION_MAX_LENGTH}
                          placeholder="예: 지원 동기를 알려 주세요."
                          onChange={(event) =>
                            setEssays(
                              essays.map((item) =>
                                item.key === essay.key
                                  ? { ...item, question: event.target.value }
                                  : item,
                              ),
                            )
                          }
                        />
                      </Field>
                      <Field
                        id={answerId}
                        label="답변"
                        error={feedback.fieldErrors?.[`essays.${index}.answer`]}
                      >
                        <Textarea
                          {...inputProps(`essays.${index}.answer`, answerId)}
                          rows={6}
                          value={essay.answer}
                          required
                          maxLength={ESSAY_ANSWER_MAX_LENGTH}
                          placeholder="작성한 자기소개서 답변을 붙여 넣어 주세요."
                          onChange={(event) =>
                            setEssays(
                              essays.map((item) =>
                                item.key === essay.key
                                  ? { ...item, answer: event.target.value }
                                  : item,
                              ),
                            )
                          }
                        />
                        <p className="text-right text-xs tabular-nums text-muted">
                          {essay.answer.length.toLocaleString("ko-KR")} /{" "}
                          {ESSAY_ANSWER_MAX_LENGTH.toLocaleString("ko-KR")}자
                        </p>
                      </Field>
                    </div>
                  </fieldset>
                );
              })}
            </div>
            <Button
              variant="secondary"
              className="mt-5"
              disabled={essays.length >= MAX_ESSAY_ITEMS}
              onClick={() => {
                setEssays([...essays, { key: crypto.randomUUID(), question: "", answer: "" }]);
                edit();
              }}
            >
              + 문항 추가{essays.length >= MAX_ESSAY_ITEMS ? ` (${MAX_ESSAY_ITEMS}개까지)` : ""}
            </Button>
          </section>

          <section aria-labelledby={`${prefix}-experiences`} className="border-t border-line pt-8">
            <h2 id={`${prefix}-experiences`} className="text-lg font-bold">
              더 들려주고 싶은 경험{" "}
              <span className="font-sans text-sm font-normal text-muted">선택</span>
            </h2>
            <p className="mt-2 text-sm text-muted">
              프로젝트, 활동, 일하며 배운 점을 자유롭게 적어 주세요. 없어도 괜찮아요.
            </p>
            <div className="mt-6 space-y-5">
              {experiences.map((experience, index) => {
                const id = `${prefix}-${experience.key}-content`;
                return (
                  <div
                    key={experience.key}
                    className="rounded-md border border-line bg-surface p-4 sm:p-6"
                  >
                    <Field
                      id={id}
                      label={`경험 ${index + 1}`}
                      error={feedback.fieldErrors?.[`experiences.${index}.content`]}
                      headerAction={
                        <Button
                          variant="secondary"
                          className="min-h-10 px-2 py-2 text-sm sm:px-3"
                          aria-label={`경험 ${index + 1} 삭제`}
                          onClick={() => {
                            setExperiences(
                              experiences.filter((item) => item.key !== experience.key),
                            );
                            edit();
                          }}
                        >
                          삭제
                        </Button>
                      }
                    >
                      <Textarea
                        {...inputProps(`experiences.${index}.content`, id)}
                        rows={4}
                        required
                        value={experience.content}
                        maxLength={EXPERIENCE_MAX_LENGTH}
                        placeholder="어떤 상황에서 무엇을 했고, 무엇을 배웠나요?"
                        onChange={(event) =>
                          setExperiences(
                            experiences.map((item) =>
                              item.key === experience.key
                                ? { ...item, content: event.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </Field>
                  </div>
                );
              })}
            </div>
            <Button
              variant="secondary"
              className="mt-5"
              disabled={experiences.length >= MAX_EXPERIENCES}
              onClick={() => {
                setExperiences([...experiences, { key: crypto.randomUUID(), content: "" }]);
                edit();
              }}
            >
              + 경험 추가
              {experiences.length >= MAX_EXPERIENCES ? ` (${MAX_EXPERIENCES}개까지)` : ""}
            </Button>
          </section>

          <div className="border-t border-line pt-6">
            {feedback.error && (
              <p role="alert" className="mb-4 text-sm font-medium text-danger">
                {feedback.error}
              </p>
            )}
            <Button type="submit" className="w-full sm:w-auto" disabled={pending}>
              {pending ? "저장하고 있어요…" : "자소서 저장하기"}
            </Button>
          </div>
        </fieldset>
        <p role="status" className="sr-only">
          {pending ? "저장 중이에요." : announcement}
        </p>
      </form>
    </div>
  );
}
