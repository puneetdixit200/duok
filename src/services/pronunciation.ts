export type PronunciationLevel = 'clear' | 'steady' | 'needs-practice' | 'try-again'

export interface PronunciationScoreInput {
  expectedText: string
  expectedTransliteration: string
  transcript: string
  targetParts: string[]
}

export interface PronunciationScoreResult {
  score: number
  level: PronunciationLevel
  expectedText: string
  expectedTransliteration: string
  transcript: string
  similarity: number
  problemParts: string[]
  feedback: string
  tip: string
}

export function scorePronunciation(input: PronunciationScoreInput): PronunciationScoreResult {
  const expected = normalizeForScoring(input.expectedText)
  const transcript = normalizeForScoring(input.transcript)
  const similarity = expected && transcript ? calculateSimilarity(expected, transcript) : 0
  const score = Math.max(0, Math.min(100, Math.round(20 + similarity * 80)))
  const problemParts = input.targetParts.filter((part) => {
    const normalizedPart = normalizeForScoring(part)
    return normalizedPart && !transcript.includes(normalizedPart)
  })
  const level = getPronunciationLevel(score)

  return {
    score,
    level,
    expectedText: input.expectedText,
    expectedTransliteration: input.expectedTransliteration,
    transcript: input.transcript,
    similarity,
    problemParts,
    feedback: buildPronunciationFeedback(level, problemParts),
    tip: buildPronunciationTip(level, problemParts),
  }
}

function normalizeForScoring(value: string): string {
  return value
    .normalize('NFC')
    .toLocaleLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, '')
}

function calculateSimilarity(expected: string, transcript: string): number {
  if (expected === transcript) {
    return 1
  }

  const distance = levenshteinDistance(expected, transcript)
  return 1 - distance / Math.max(expected.length, transcript.length)
}

function levenshteinDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index)

  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    const current = [leftIndex + 1]

    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      const insertion = current[rightIndex] + 1
      const deletion = previous[rightIndex + 1] + 1
      const substitution = previous[rightIndex] + (left[leftIndex] === right[rightIndex] ? 0 : 1)
      current.push(Math.min(insertion, deletion, substitution))
    }

    previous.splice(0, previous.length, ...current)
  }

  return previous[right.length]
}

function getPronunciationLevel(score: number): PronunciationLevel {
  if (score >= 90) {
    return 'clear'
  }

  if (score >= 70) {
    return 'steady'
  }

  if (score >= 40) {
    return 'needs-practice'
  }

  return 'try-again'
}

function buildPronunciationFeedback(level: PronunciationLevel, problemParts: string[]): string {
  if (level === 'clear') {
    return 'Clear pronunciation with strong Kannada rhythm.'
  }

  if (level === 'steady') {
    return problemParts.length
      ? `Almost there. Recheck ${problemParts.join(', ')}.`
      : 'Almost there. The phrase is understandable.'
  }

  if (level === 'try-again') {
    return "Let's try again. Play the reference and repeat slowly."
  }

  return problemParts.length
    ? `Practice slowly and bring back ${problemParts.join(', ')}.`
    : 'Practice slowly and match each sound to the reference.'
}

function buildPronunciationTip(level: PronunciationLevel, problemParts: string[]): string {
  if (problemParts.length) {
    return `Hold the ending: ${problemParts.at(-1)}.`
  }

  if (level === 'clear') {
    return 'Keep the same rhythm and vowel length.'
  }

  if (level === 'try-again') {
    return 'Replay the reference, then repeat one word at a time.'
  }

  return 'Say it slowly once, then at normal speed.'
}
