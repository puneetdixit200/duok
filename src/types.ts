export type ExerciseType =
  | 'translate'
  | 'arrange'
  | 'fillBlank'
  | 'listening'
  | 'speaking'
  | 'matchPairs'
  | 'typeKannada'
  | 'dialogue'

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
  timeLimitSeconds?: number
}

export interface Curriculum {
  level: number
  title: string
  description: string
  phrases: Phrase[]
  exercises: LessonExercise[]
}

export interface GrammarTip {
  title: string
  body: string
  examples: string[]
}

export interface ScriptSymbol {
  id: string
  kind: 'vowel' | 'consonant' | 'combination'
  kannada: string
  transliteration: string
  soundHint: string
}

export interface CurriculumLesson {
  id: string
  unitId: string
  title: string
  subtitle: string
  objective: string
  exercises: LessonExercise[]
}

export interface CurriculumUnit {
  id: string
  title: string
  description: string
  optional: boolean
  tips: GrammarTip[]
  lessons: CurriculumLesson[]
  scriptSymbols: ScriptSymbol[]
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

export interface TutorPersona {
  id: string
  name: string
  style: string
  correctionStyle: string
}

export interface StoryWord {
  text: string
  transliteration: string
  english: string
  note: string
}

export interface StorySentence {
  id: string
  kannada: string
  transliteration: string
  english: string
  words: StoryWord[]
}

export interface StoryQuizQuestion {
  prompt: string
  answer: string
  options: string[]
  explanation: string
}

export interface Story {
  id: string
  title: string
  subtitle: string
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced'
  readTimeMinutes: number
  newWordCount: number
  locked: boolean
  imagePath: string
  sentences: StorySentence[]
  quiz: StoryQuizQuestion
}

export interface GeneratedExercise {
  type: ExerciseType
  prompt: string
  kannada: string
  answer: string
  options: string[]
  explanation?: string
}
