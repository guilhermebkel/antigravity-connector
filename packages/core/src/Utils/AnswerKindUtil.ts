export type AnswerKind = "empty" | "quota" | "refusal" | "promise" | "other";

type AnswerKindRule = {
  kind: Exclude<AnswerKind, "empty" | "other">;
  pattern: RegExp;
};

export class AnswerKindUtil {
  // Why: the order is the priority; a quota answer that also says "I will notify you" is a quota answer.
  static readonly RULES: readonly AnswerKindRule[] = [
    { kind: "quota", pattern: /\b429\b|RESOURCE_EXHAUSTED|quota|rate[ -]?limit|exhausted|too many requests/i },
    { kind: "refusal", pattern: /safety|polic(?:y|ies)|can(?:'|no)t (?:generate|create|help)|unable to (?:generate|create)|not able to|refus/i },
    { kind: "promise", pattern: /will (?:notify|let you know|report|update)|notify you|when (?:it is|it's) (?:ready|done)|in progress|still (?:generating|running|working)|background/i },
  ];

  static classify(answer: string): AnswerKind {
    if (answer.trim() === "") {
      return "empty";
    }
    // Why: the log may name what kind of answer agy gave, never the answer itself, which can echo the prompt.
    return AnswerKindUtil.RULES.find((rule) => rule.pattern.test(answer))?.kind ?? "other";
  }
}
