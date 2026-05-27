import { describe, expect, it } from 'vitest'
import {
  bangaloreScenarios,
  coreCurriculumUnits,
  getAllLessonExercises,
  getExerciseCoverage,
  getLevelOneCurriculum,
  getLessonById,
  getNextAvailableLesson,
  getScriptCurriculumUnit,
  getStoryLockState,
  getUnlockedCurriculumUnits,
  stories,
  transliterateLatinToKannada,
} from './curriculum'
import { completeLessonProgress, createInitialProgress } from './progress'

describe('KannadaOS level 1 curriculum', () => {
  it('ships at least 20 survival phrases with Kannada, transliteration, English, and Bangalore context', () => {
    const curriculum = getLevelOneCurriculum()

    expect(curriculum.level).toBe(1)
    expect(curriculum.title).toMatch(/survival/i)
    expect(curriculum.phrases).toHaveLength(20)
    expect(
      curriculum.phrases.every(
        (phrase) =>
          phrase.kannada.length > 0 &&
          phrase.transliteration.length > 0 &&
          phrase.english.length > 0 &&
          phrase.context.length > 0,
      ),
    ).toBe(true)
    expect(curriculum.phrases.some((phrase) => phrase.kannada === 'ನಮಸ್ಕಾರ ಸಾರ್')).toBe(true)
    expect(curriculum.phrases.some((phrase) => /Majestic|BMTC|auto/i.test(phrase.context))).toBe(
      true,
    )
  })

  it('covers every MVP exercise type from the architecture spec', () => {
    expect(getExerciseCoverage()).toEqual([
      'translate',
      'arrange',
      'fillBlank',
      'listening',
      'speaking',
      'matchPairs',
      'typeKannada',
      'dialogue',
    ])
  })

  it('includes real-world Bangalore scenarios for conversation practice', () => {
    expect(bangaloreScenarios.map((scenario) => scenario.id)).toEqual([
      'bmtc-bus',
      'auto-ride',
      'darshini',
      'kirana',
      'office',
      'pg-owner',
    ])
    expect(bangaloreScenarios[0].checklist).toContain('Ask the fare')
    expect(bangaloreScenarios[1].openingLine.kannada).toContain('ಎಲ್ಲಿಗೆ')
  })

  it('ships a Duolingo-grade beginner path with 8 core units, 5 lessons each, grammar tips, and 150+ exercises', () => {
    expect(coreCurriculumUnits).toHaveLength(8)
    expect(coreCurriculumUnits.map((unit) => unit.title)).toEqual([
      'Greetings & Introductions',
      'Numbers & Prices',
      'Transport & Directions',
      'Food & Ordering',
      'Shopping & Bargaining',
      'Home & PG Life',
      'Office & Workplace',
      'Emergencies & Health',
    ])

    for (const unit of coreCurriculumUnits) {
      expect(unit.optional).toBe(false)
      expect(unit.lessons).toHaveLength(5)
      expect(unit.tips.length).toBeGreaterThanOrEqual(2)
      expect(unit.lessons.every((lesson) => lesson.exercises.length >= 6)).toBe(true)
      expect(unit.lessons.every((lesson) => new Set(lesson.exercises.map((exercise) => exercise.type)).size >= 6)).toBe(true)
    }

    const exercises = getAllLessonExercises(coreCurriculumUnits)
    expect(exercises.length).toBeGreaterThanOrEqual(150)
    expect(exercises.some((exercise) => exercise.type === 'typeKannada')).toBe(true)
    expect(exercises.some((exercise) => exercise.type === 'dialogue')).toBe(true)
    expect(new Set(exercises.map((exercise) => exercise.id)).size).toBe(exercises.length)
  })

  it('includes the optional nine-lesson Kannada Script Academy from the frontend spec', () => {
    const scriptUnit = getScriptCurriculumUnit()

    expect(scriptUnit.optional).toBe(true)
    expect(scriptUnit.title).toBe('Kannada Script')
    expect(scriptUnit.lessons.map((lesson) => lesson.title)).toEqual([
      'Vowels Part 1',
      'Vowels Part 2',
      'Consonants: Velars',
      'Consonants: Palatals',
      'Consonants: Retroflexes',
      'Consonants: Dentals',
      'Consonants: Labials + Others',
      'Vowel Signs',
      'Reading Practice',
    ])
    expect(scriptUnit.scriptSymbols.filter((symbol) => symbol.kind === 'vowel')).toHaveLength(14)
    expect(scriptUnit.scriptSymbols.filter((symbol) => symbol.kind === 'consonant').length).toBeGreaterThanOrEqual(34)
    expect(scriptUnit.scriptSymbols.some((symbol) => symbol.kannada === 'ಕಿ' && symbol.transliteration === 'ki')).toBe(true)
    expect([...coreCurriculumUnits, scriptUnit].reduce((total, unit) => total + unit.lessons.length, 0)).toBe(49)
  })

  it('unlocks lessons sequentially while keeping the optional script path available', () => {
    const progress = createInitialProgress()
    const firstLesson = coreCurriculumUnits[0].lessons[0]
    const secondLesson = coreCurriculumUnits[0].lessons[1]

    expect(getNextAvailableLesson(coreCurriculumUnits, progress)?.id).toBe(firstLesson.id)
    expect(getLessonById(firstLesson.id)?.title).toBe(firstLesson.title)
    expect(getUnlockedCurriculumUnits([...coreCurriculumUnits, getScriptCurriculumUnit()], progress).map((unit) => unit.id)).toEqual([
      'unit-1-greetings',
      'unit-script',
    ])

    const afterFirstLesson = completeLessonProgress(progress, firstLesson.id, '2026-05-27T10:00:00.000Z')

    expect(getNextAvailableLesson(coreCurriculumUnits, afterFirstLesson)?.id).toBe(secondLesson.id)
  })

  it('ships six complete progressively harder stories and unlocks them from story progress', () => {
    expect(stories).toHaveLength(6)
    expect(stories.map(({ title, subtitle, difficulty, newWordCount }) => ({
      title,
      subtitle,
      difficulty,
      newWordCount,
    }))).toEqual([
      {
        title: 'First Day in Bangalore',
        subtitle: 'Scene: Bus stop',
        difficulty: 'Beginner',
        newWordCount: 12,
      },
      {
        title: 'Office Lunch',
        subtitle: 'Scene: Tech park cafeteria',
        difficulty: 'Beginner',
        newWordCount: 16,
      },
      {
        title: 'The Auto Ride',
        subtitle: 'Scene: Indiranagar to Majestic',
        difficulty: 'Intermediate',
        newWordCount: 14,
      },
      {
        title: 'Darshini Breakfast',
        subtitle: 'Scene: Standing hotel',
        difficulty: 'Intermediate',
        newWordCount: 18,
      },
      {
        title: 'The Kirana Run',
        subtitle: 'Scene: Neighborhood store',
        difficulty: 'Intermediate',
        newWordCount: 15,
      },
      {
        title: 'PG Problems',
        subtitle: 'Scene: PG owner conversation',
        difficulty: 'Advanced',
        newWordCount: 20,
      },
    ])
    expect(stories.every((story) => story.sentences.length >= 3)).toBe(true)
    expect(stories.every((story) => story.quiz.options.length >= 4)).toBe(true)

    const progress = createInitialProgress()
    expect(getStoryLockState(stories[0], progress).locked).toBe(false)
    expect(getStoryLockState(stories[1], progress).locked).toBe(true)

    const withFirstStory = {
      ...progress,
      completedExerciseIds: ['story-first-day-bangalore'],
    }
    expect(getStoryLockState(stories[1], withFirstStory).locked).toBe(false)
  })

  it('converts common romanized Kannada input into Kannada script for typing exercises', () => {
    expect(transliterateLatinToKannada('namaskara saar')).toBe('ನಮಸ್ಕಾರ ಸಾರ್')
    expect(transliterateLatinToKannada('ticket eshtu')).toBe('ಟಿಕೆಟ್ ಎಷ್ಟು')
    expect(transliterateLatinToKannada('nanage neeru beku')).toBe('ನನಗೆ ನೀರು ಬೇಕು')
  })
})
