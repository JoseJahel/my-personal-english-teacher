/**
 * Builds a native English rewrite from the learner's own words.
 * Never returns a canned coffee/gate line when the student said something else.
 */

import type { PracticeScenarioId } from '../ui/practice-scenarios'
import type { PracticeUtteranceAnalysis } from './communication-suggestion-analysis'
import { stripUtteranceDecoration } from './communication-suggestion-analysis'

const MASS_OR_UNCOUNTABLE = /^(water|bread|rice|luggage|information|help|advice)\b/i

export function formatSpokenEnglish(text: string, asQuestion = false): string {
  const trimmed = stripUtteranceDecoration(text)
  if (!trimmed) {
    return ''
  }
  const capped = `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`
  if (asQuestion || /^(where|what|when|which|who|how|why|could|would|can|may)\b/i.test(capped)) {
    return `${capped}?`
  }
  return `${capped}.`
}

export function nounPhraseForOrder(item: string): string {
  const cleaned = item.replace(/^(um+|uh+|er+|like)\s+/i, '').trim()
  if (!cleaned) {
    return 'that'
  }
  if (/^(a|an|the|some|my|your|this|that)\b/i.test(cleaned)) {
    return cleaned
  }
  if (MASS_OR_UNCOUNTABLE.test(cleaned)) {
    return `some ${cleaned}`
  }
  if (/^[aeiou]/i.test(cleaned)) {
    return `an ${cleaned}`
  }
  return `a ${cleaned}`
}

function requestWithComplement(complement: string): string {
  return `Could I have ${nounPhraseForOrder(complement)}, please?`
}

const LEADING_GREETING = /^(hello|hi|hey|good morning|good afternoon|good evening)\s*[,.]?\s*/i

function questionCore(stripped: string): string {
  const withoutGreeting = stripped.replace(LEADING_GREETING, '').trim()
  return withoutGreeting || stripped
}

function namePhraseForSubject(subject: string): string {
  const normalized = subject.toLowerCase().replace(/[^\p{L}\p{N}\s']/gu, '').trim()
  if (normalized === 'you') {
    return 'your name'
  }
  if (normalized === 'he') {
    return 'his name'
  }
  if (normalized === 'she') {
    return 'her name'
  }
  if (normalized === 'they') {
    return 'their name'
  }
  if (normalized === 'we') {
    return 'our names'
  }
  if (/\bname\b/i.test(subject)) {
    return subject
  }
  if (/'s\b/.test(subject)) {
    return `${subject} name`
  }
  return `${subject}'s name`
}

/** Grammar-class rewrite, not a phrase table: who + BE + NP. */
function rewriteWhoBeQuestion(core: string): string | null {
  const match = core.match(/^who\s+(?:are|is|'s)\s+(.+)$/i)
  if (!match?.[1]) {
    return null
  }
  return `Sorry, I didn't catch ${namePhraseForSubject(match[1].trim())}.`
}

function rewriteKnownQuestion(core: string): string | null {
  const whoBe = rewriteWhoBeQuestion(core)
  if (whoBe) {
    return whoBe
  }
  const whereMatch = core.match(/^where\s+(?:is|are)\s+(.+)$/i)
  if (whereMatch?.[1]) {
    return `Could you tell me where ${whereMatch[1].trim()} is?`
  }
  const whatTime = core.match(/^what time\s+(.+)$/i)
  if (whatTime?.[1]) {
    return `Could you tell me what time ${whatTime[1].trim()}?`
  }
  const whatIs = core.match(/^what(?:'s| is)\s+(.+)$/i)
  if (whatIs?.[1]) {
    return `Could you tell me what ${whatIs[1].trim()} is?`
  }
  return null
}

function polishQuestion(analysis: PracticeUtteranceAnalysis): string {
  const stripped = stripUtteranceDecoration(analysis.display)
  const core = questionCore(stripped)
  const known = rewriteKnownQuestion(core)
  if (known) {
    return known
  }
  if (/\bgate\b/i.test(core) && analysis.wordCount < 6) {
    return 'Could you tell me which gate my flight leaves from?'
  }
  if (/\bflight\b/i.test(core) && analysis.wordCount < 6) {
    return 'Could you tell me about my flight?'
  }
  if (/\b(bag|bags|luggage)\b/i.test(core) && analysis.wordCount < 8) {
    return 'Could you tell me where I collect my luggage?'
  }
  if (/^(could you|would you|can you|who|what|where|when|why|how|which)\b/i.test(core)) {
    return formatSpokenEnglish(core, true)
  }
  if (analysis.complement && analysis.wordCount < 5) {
    return `Could you tell me about ${analysis.complement}?`
  }
  if (analysis.wordCount < 3 && !LEADING_GREETING.test(stripped)) {
    return `Could you tell me more about ${core}?`
  }
  return formatSpokenEnglish(core, analysis.isQuestion)
}

function expandExperience(analysis: PracticeUtteranceAnalysis): string {
  const topic = analysis.complement ?? stripUtteranceDecoration(analysis.display)
  if (/\bexperience\b/i.test(topic)) {
    return formatSpokenEnglish(topic)
  }
  return `I have experience working with ${topic}.`
}

function expandIntroduction(analysis: PracticeUtteranceAnalysis): string {
  const name = analysis.complement
  if (name && /^[A-Za-z][A-Za-z'-]*$/.test(name.split(/\s+/)[0] ?? '')) {
    return `My name is ${name}, and I would like to tell you about my background.`
  }
  return formatSpokenEnglish(analysis.display)
}

function expandAgreement(analysis: PracticeUtteranceAnalysis, tutorLine: string): string {
  if (/\bdrink\b/i.test(tutorLine)) {
    return 'Yes, please. I would like a drink.'
  }
  if (/\b(side|sauce)/i.test(tutorLine)) {
    return 'Yes, please. I would like a side salad.'
  }
  if (/\bboarding pass\b/i.test(tutorLine)) {
    return 'Yes. Here is my boarding pass.'
  }
  if (/\bteam\b/i.test(tutorLine)) {
    return 'Yes. I usually work closely with the team and share progress often.'
  }
  if (analysis.scenarioId === 'restaurant') {
    return 'Yes, please.'
  }
  return 'Yes, thank you.'
}

function expandShort(
  scenarioId: PracticeScenarioId,
  analysis: PracticeUtteranceAnalysis,
): string {
  const core = stripUtteranceDecoration(analysis.display)
  if (scenarioId === 'restaurant') {
    return requestWithComplement(analysis.complement ?? core)
  }
  if (scenarioId === 'airport') {
    return `Could you help me with ${core}?`
  }
  return `Could I add a bit more: ${core}?`
}

export function rewriteAsNative(analysis: PracticeUtteranceAnalysis): string {
  const tutorLine = analysis.lastTutorLineEn
  if (analysis.intent === 'agreement') {
    return expandAgreement(analysis, tutorLine)
  }
  if (analysis.intent === 'thanks') {
    return analysis.scenarioId === 'restaurant'
      ? 'That would be great, thank you.'
      : 'Thank you so much.'
  }
  if (analysis.intent === 'order' || analysis.intent === 'request') {
    const item = analysis.complement ?? stripUtteranceDecoration(analysis.display)
    return requestWithComplement(item)
  }
  if (analysis.intent === 'question') {
    return polishQuestion(analysis)
  }
  if (analysis.intent === 'experience') {
    return expandExperience(analysis)
  }
  if (analysis.intent === 'introduction') {
    return expandIntroduction(analysis)
  }
  if (analysis.isShort) {
    return expandShort(analysis.scenarioId, analysis)
  }
  return formatSpokenEnglish(analysis.display, analysis.isQuestion)
}

export function expandForFluency(analysis: PracticeUtteranceAnalysis): string | null {
  if (analysis.intent === 'experience' && analysis.complement) {
    return `I have experience with ${analysis.complement} — for example, coordinating a recent project.`
  }
  if (analysis.isShort && analysis.intent !== 'thanks' && analysis.intent !== 'question') {
    return rewriteAsNative(analysis)
  }
  return null
}
