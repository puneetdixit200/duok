export type ExerciseType =
  | 'translate'
  | 'arrange'
  | 'fillBlank'
  | 'listening'
  | 'speaking'
  | 'matchPairs'

export interface Phrase {
  id: string
  kannada: string
  transliteration: string
  english: string
  context: string
  skillTag: string
}

export interface LessonExercise {
  id: string
  type: ExerciseType
  prompt: string
  kannada: string
  transliteration?: string
  english?: string
  answer: string
  options: string[]
  explanation: string
  skillTag: string
  xp: number
  vocabularyIds: string[]
}

export interface Curriculum {
  level: number
  title: string
  description: string
  phrases: Phrase[]
  exercises: LessonExercise[]
}

export interface Scenario {
  id: string
  title: string
  icon: string
  difficulty: 'Beginner' | 'Intermediate'
  situation: string
  openingLine: {
    kannada: string
    transliteration: string
    english: string
  }
  checklist: string[]
  usefulPhrases: Phrase[]
}

export interface GeneratedExercise {
  type: ExerciseType
  prompt: string
  kannada: string
  answer: string
  options: string[]
  explanation?: string
}
