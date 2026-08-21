/**
 * Pure text normalization for tutor TTS input (no model / browser APIs).
 * Expands simple integers, dollar prices, single-letter + digits codes
 * (e.g. gate/table numbers), and simple clock times into words the TTS
 * pronounces reliably. Wired into `prepareTextForSpeechSynthesis` so it only
 * ever touches the string that goes into speech synthesis — never the text
 * shown in the chat.
 *
 * Documented subset (see tests for exact coverage):
 * - Integers 0-999 (e.g. "12" -> "twelve").
 * - Dollar prices "$0" to "$999", optional cents (e.g. "$5" -> "five dollars",
 *   "$5.50" -> "five dollars and fifty cents").
 * - Single letter + 1-3 digit codes (e.g. "B12" -> "B twelve").
 * - Simple clock times "H:MM am/pm" (e.g. "3:30 p.m." -> "three thirty p m").
 * Anything outside this subset (numbers over 999, other formats) is left as-is.
 */

const ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
]
const TEENS = [
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen',
]
const TENS = [
  '', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety',
]

function convertBelowHundredToWords(value: number): string {
  if (value < 10) {
    return ONES[value]
  }
  if (value < 20) {
    return TEENS[value - 10]
  }
  const tensDigit = Math.floor(value / 10)
  const onesDigit = value % 10
  return onesDigit === 0 ? TENS[tensDigit] : `${TENS[tensDigit]}-${ONES[onesDigit]}`
}

/** Converts an integer 0-999 to English words; null outside that documented range. */
export function convertIntegerToEnglishWords(value: number): string | null {
  if (!Number.isInteger(value) || value < 0 || value > 999) {
    return null
  }
  if (value === 0) {
    return 'zero'
  }
  if (value < 100) {
    return convertBelowHundredToWords(value)
  }
  const hundredsDigit = Math.floor(value / 100)
  const remainder = value % 100
  const hundredsWords = `${ONES[hundredsDigit]} hundred`
  return remainder === 0 ? hundredsWords : `${hundredsWords} ${convertBelowHundredToWords(remainder)}`
}

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural
}

/** "3:30 p.m." / "9:00am" -> "three thirty p m" / "nine o'clock a m". */
function normalizeClockTimes(text: string): string {
  return text.replace(
    /\b(1[0-2]|[1-9]):([0-5][0-9])\s*([AaPp])\.?[Mm]\.?(?=[^a-zA-Z0-9]|$)/g,
    (match, hour: string, minute: string, period: string) => {
      const hourWords = convertIntegerToEnglishWords(Number(hour))
      const minuteValue = Number(minute)
      const minuteWords = minuteValue === 0 ? "o'clock" : convertIntegerToEnglishWords(minuteValue)
      if (!hourWords || !minuteWords) {
        return match
      }
      const periodWords = period.toLowerCase() === 'a' ? 'a m' : 'p m'
      return `${hourWords} ${minuteWords} ${periodWords}`
    },
  )
}

/** "$5" -> "five dollars"; "$5.50" -> "five dollars and fifty cents". */
function normalizeDollarPrices(text: string): string {
  return text.replace(
    /\$(\d{1,3})(?:\.(\d{2}))?\b/g,
    (match, dollarsDigits: string, centsDigits?: string) => {
      const dollarsValue = Number(dollarsDigits)
      const dollarsWords = convertIntegerToEnglishWords(dollarsValue)
      if (!dollarsWords) {
        return match
      }
      const dollarsLabel = pluralize(dollarsValue, 'dollar', 'dollars')
      if (!centsDigits || centsDigits === '00') {
        return `${dollarsWords} ${dollarsLabel}`
      }
      const centsValue = Number(centsDigits)
      const centsWords = convertIntegerToEnglishWords(centsValue)
      if (!centsWords) {
        return `${dollarsWords} ${dollarsLabel}`
      }
      const centsLabel = pluralize(centsValue, 'cent', 'cents')
      return `${dollarsWords} ${dollarsLabel} and ${centsWords} ${centsLabel}`
    },
  )
}

/** "B12" -> "B twelve"; "gate B12" -> "gate B twelve". */
function normalizeAlphanumericCodes(text: string): string {
  return text.replace(/\b([A-Za-z])(\d{1,3})\b/g, (match, letter: string, digits: string) => {
    const digitsWords = convertIntegerToEnglishWords(Number(digits))
    return digitsWords ? `${letter} ${digitsWords}` : match
  })
}

/** Any remaining standalone integer (0-999) not already handled above. */
function normalizeStandaloneIntegers(text: string): string {
  return text.replace(/\b\d{1,3}\b/g, (match) => {
    const words = convertIntegerToEnglishWords(Number(match))
    return words ?? match
  })
}

/**
 * Normalizes English text before it enters TTS synthesis. Order matters:
 * times and prices consume their digits (and surrounding symbols) first, then
 * letter+digit codes, then any remaining standalone integers — so later passes
 * never re-touch text already expanded by an earlier one.
 */
export function normalizeEnglishTextForSpeech(text: string): string {
  let normalized = text
  normalized = normalizeClockTimes(normalized)
  normalized = normalizeDollarPrices(normalized)
  normalized = normalizeAlphanumericCodes(normalized)
  normalized = normalizeStandaloneIntegers(normalized)
  return normalized
}
