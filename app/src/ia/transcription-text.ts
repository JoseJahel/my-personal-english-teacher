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
