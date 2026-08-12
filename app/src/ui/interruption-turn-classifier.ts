/**
 * Classify a user turn that barged in on tutor TTS (issue #46).
 * Classification uses only `spoken_text` (what the learner actually heard),
 * never the unspoken remainder of the tutor line.
 */

import {
  isEarlyCutoffSpokenProgress,
  type SpokenProgress,
} from './spoken-progress'

export type InterruptionTurnKind =
  | 'digression'
  | 'in_task_response'
  | 'early_cutoff'
  | 'unclear'

export interface ClassifyInterruptionTurnInput {
  readonly spokenProgress: SpokenProgress
  readonly userUtteranceEn: string
}

/**
 * Case A: digression / meta question about the fragment heard.
 * Case B: in-task answer to the fragment (order, yes/no, concrete choice).
 * Case C: early cutoff with almost no spoken content → treat user as noise/unclear unless strong task signal.
 */
export function classifyInterruptionTurn(
  input: ClassifyInterruptionTurnInput,
): InterruptionTurnKind {
  const user = normalizeUtterance(input.userUtteranceEn)
  if (!user) {
    return isEarlyCutoffSpokenProgress(input.spokenProgress) ? 'early_cutoff' : 'unclear'
  }

  if (isEarlyCutoffSpokenProgress(input.spokenProgress)) {
    // Bare noise on an early cut → Case C; a clear task answer still counts as in-task.
    if (isStrongInTaskResponse(user, input.spokenProgress.spokenText)) {
      return 'in_task_response'
    }
    if (isDigressionUtterance(user)) {
      return 'digression'
    }
    return 'early_cutoff'
  }

  if (isDigressionUtterance(user)) {
    return 'digression'
  }

  if (isStrongInTaskResponse(user, input.spokenProgress.spokenText)) {
    return 'in_task_response'
  }

  // Weak / short ASR after a partial tutor line → unclear, not a scene advance.
  if (user.split(' ').filter(Boolean).length <= 2 && !looksLikeChoice(user)) {
    return 'unclear'
  }

  // Default: treat as task-related reply to the fragment (learner often answers early).
  if (looksLikeChoice(user) || isAffirmationOrOrder(user)) {
    return 'in_task_response'
  }

  return 'unclear'
}

function isDigressionUtterance(normalized: string): boolean {
  return (
    /\b(what does|what do you mean|what is|what's|mean by|means|explain|sorry|wait|hold on|hang on|how do you say|how to say|can you repeat|repeat that|say that again|i don't understand|i do not understand|no entiendo)\b/.test(
      normalized,
    ) ||
    /\b(wait)\b/.test(normalized) &&
      /\b(mean|what|sorry)\b/.test(normalized)
  )
}

function isStrongInTaskResponse(userNormalized: string, spokenText: string): boolean {
  if (isAffirmationOrOrder(userNormalized) || looksLikeChoice(userNormalized)) {
    return true
  }
  // Echo of a concrete noun from the fragment the user heard (e.g. "coffee" after "...coffee or—").
  const heard = normalizeUtterance(spokenText)
  if (!heard) {
    return isAffirmationOrOrder(userNormalized)
  }
  const heardContentWords = contentWords(heard)
  const userContentWords = contentWords(userNormalized)
  for (const word of userContentWords) {
    if (heardContentWords.has(word)) {
      return true
    }
  }
  return hasPracticeVocabulary(userNormalized)
}

function isAffirmationOrOrder(normalized: string): boolean {
  return /\b(yes|yeah|yep|sure|please|i('|)d like|i would like|i want|i('|)ll have|can i have|coffee|tea|water|pasta|chicken|fish|salmon|salad|window|aisle|card|cash)\b/.test(
    normalized,
  )
}

function looksLikeChoice(normalized: string): boolean {
  return /\b(the first|the second|option|this one|that one|left|right)\b/.test(normalized)
}

function hasPracticeVocabulary(normalized: string): boolean {
  return /\b(bill|gate|boarding|passport|bag|luggage|interview|team|project|menu|order|drink|main course|dessert)\b/.test(
    normalized,
  )
}

function contentWords(normalized: string): Set<string> {
  const stop = new Set([
    'a',
    'an',
    'the',
    'to',
    'for',
    'your',
    'you',
    'would',
    'like',
    'something',
    'maybe',
    'or',
    'and',
    'of',
    'in',
    'on',
    'is',
    'are',
    'do',
    'does',
    'with',
    'that',
    'this',
    'so',
    'great',
  ])
  const words = normalized.split(' ').filter((word) => word.length > 2 && !stop.has(word))
  return new Set(words)
}

function normalizeUtterance(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9'\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
