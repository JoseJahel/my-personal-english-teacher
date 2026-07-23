/**
 * Pure helpers for post-processing ASR text (no model / browser APIs).
 */

/**
 * True when Whisper (or similar) returned a non-speech tag instead of words.
 * Examples: "[Music]", "(dramatic music)", "blank audio", empty string.
 */
export function isNonSpeechTranscript(transcribedText: string): boolean {
  const normalized = transcribedText.trim().toLowerCase()
  if (normalized.length === 0) {
    return true
  }

  // Whole string is a bracket/paren tag: [Music], (dramatic music), etc.
  if (/^[[(][^\]\n]{0,80}[\])]$/.test(normalized)) {
    return true
  }

  // Common free-text non-speech labels without brackets.
  if (
    /^(music|dramatic music|background music|blank_?audio|silence|applause|laughter|cheering|inaudible|phone ringing|telephone ringing|ringing|doorbell|siren|beep|static|white noise)[\s.!?…]*$/i.test(
      normalized,
    )
  ) {
    return true
  }

  // Parenthetical event tags anywhere as the whole string: (phone ringing), etc.
  if (/^\([^)]{1,60}\)$/.test(normalized) || /^\[[^\]]{1,60}\]$/.test(normalized)) {
    return true
  }

  // Only music notes / symbols.
  if (/^[♪♫\s]+$/.test(normalized)) {
    return true
  }

  return false
}

/**
 * True when the model emitted pathological garbage (token loops, absurd length).
 * Seen with broken WebGPU/quantization runs: "biasesVIDEO" × N, etc.
 */
export function isDegenerateTranscript(
  transcribedText: string,
  audioDurationSeconds?: number,
): boolean {
  const trimmed = transcribedText.trim()
  if (trimmed.length === 0) {
    return false
  }

  // Far too long for a short practice utterance (characters vs seconds).
  if (audioDurationSeconds !== undefined && audioDurationSeconds > 0) {
    const generousMaxCharacters = Math.max(120, Math.ceil(audioDurationSeconds * 40))
    if (trimmed.length > generousMaxCharacters) {
      return true
    }
  } else if (trimmed.length > 800) {
    // Hard cap when duration is unknown (UI safety).
    return true
  }

  // Same whitespace-delimited token repeated many times in a row.
  if (/(\S{1,48})(?:\s+\1){6,}/u.test(trimmed)) {
    return true
  }

  // Compact substring loop without spaces: "biasesVIDEO" × N, "bidmie" × N.
  const compact = trimmed.replace(/\s+/g, '')
  if (compact.length >= 24 && /(.{3,40})\1{5,}/u.test(compact)) {
    return true
  }

  // Many words but almost no vocabulary diversity.
  const words = trimmed.toLowerCase().match(/[a-z0-9']+/g) ?? []
  if (words.length >= 24) {
    const uniqueCount = new Set(words).size
    if (uniqueCount / words.length < 0.12) {
      return true
    }
  }

  return false
}

/** Non-speech tags or degenerate generation — do not show or send to grammar. */
export function isUnusableTranscript(
  transcribedText: string,
  audioDurationSeconds?: number,
): boolean {
  return (
    isNonSpeechTranscript(transcribedText) ||
    isDegenerateTranscript(transcribedText, audioDurationSeconds)
  )
}
