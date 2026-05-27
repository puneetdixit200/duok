import { describe, expect, it } from 'vitest'
import {
  bangaloreScenarios,
  coreCurriculumUnits,
  getAllLessonExercises,
  getExerciseCoverage,
  getExercisesForMastery,
  getLevelOneCurriculum,
  getLessonById,
  getNextAvailableLesson,
  getScriptCurriculumUnit,
  getStoryLockState,
  getUnlockedCurriculumUnits,
  isLessonUnlocked,
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

  it('ships the Section 18 curriculum map with 8 core units, 5 lessons each, and the spec exercise counts', () => {
    expect(coreCurriculumUnits).toHaveLength(8)
    expect(coreCurriculumUnits.map((unit) => ({
      title: unit.title,
      lessons: unit.lessons.map((lesson) => lesson.title),
    }))).toEqual([
      {
        title: 'Greetings & Basics',
        lessons: ['Hello & Thanks', 'How Are You', 'Introductions', 'Small Talk', 'Unit 1 Review'],
      },
      {
        title: 'Numbers & Prices',
        lessons: ['Numbers 1-5', 'Numbers 6-10', 'Asking Prices', 'Bargaining', 'Unit 2 Review'],
      },
      {
        title: 'Transport & Directions',
        lessons: ['Auto Ride Basics', 'Bus Phrases', 'Directions', 'At the Metro', 'Unit 3 Review'],
      },
      {
        title: 'Food & Ordering',
        lessons: ['Darshini Basics', 'Ordering Food', 'Restaurant Phrases', 'Likes & Dislikes', 'Unit 4 Review'],
      },
      {
        title: 'Shopping & Bargaining',
        lessons: ['At the Kirana Store', 'Asking About Items', 'Bargaining Practice', 'Declining & Accepting', 'Unit 5 Review'],
      },
      {
        title: 'Home & PG Life',
        lessons: ['PG Owner Conversations', 'Household Items', 'Complaints & Requests', 'Neighbors & Small Talk', 'Unit 6 Review'],
      },
      {
        title: 'Office & Workplace',
        lessons: ['Office Greetings', 'Lunch & Tea Talk', 'Simple Work Requests', 'Scheduling & Time', 'Unit 7 Review'],
      },
      {
        title: 'Emergencies & Help',
        lessons: ['Asking for Help', 'Health & Doctor', 'Finding Places', 'Emergency Phrases', 'Unit 8 Review'],
      },
    ])

    for (const unit of coreCurriculumUnits) {
      expect(unit.optional).toBe(false)
      expect(unit.lessons).toHaveLength(5)
      expect(unit.tips.length).toBeGreaterThanOrEqual(2)
      expect(unit.lessons.map((lesson) => lesson.exercises.length)).toEqual([6, 6, 6, 6, 8])
      expect(unit.lessons.every((lesson) => new Set(lesson.exercises.map((exercise) => exercise.type)).size >= 6)).toBe(true)
    }

    const exercises = getAllLessonExercises(coreCurriculumUnits)
    expect(exercises).toHaveLength(256)
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
    expect(getAllLessonExercises([...coreCurriculumUnits, scriptUnit])).toHaveLength(332)
  })

  it('builds Kannada Script Academy lessons from script-specific drill types', () => {
    const scriptUnit = getScriptCurriculumUnit()
    const vowelsPartOne = scriptUnit.lessons.find((lesson) => lesson.title === 'Vowels Part 1')!
    const labialsAndOthers = scriptUnit.lessons.find((lesson) => lesson.title === 'Consonants: Labials + Others')!
    const vowelSigns = scriptUnit.lessons.find((lesson) => lesson.title === 'Vowel Signs')!
    const readingPractice = scriptUnit.lessons.find((lesson) => lesson.title === 'Reading Practice')!

    expect(vowelsPartOne.exercises).toHaveLength(8)
    expect(labialsAndOthers.exercises).toHaveLength(10)
    expect(vowelSigns.exercises).toHaveLength(10)
    expect(vowelsPartOne.exercises).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'translate',
        prompt: 'Which letter makes the "a" sound?',
        answer: 'ಅ',
        options: expect.arrayContaining(['ಅ', 'ಆ', 'ಇ', 'ಈ']),
      }),
      expect.objectContaining({
        type: 'listening',
        prompt: 'Which letter did you hear?',
        answer: 'ಆ',
        transliteration: 'aa',
      }),
      expect.objectContaining({
        type: 'matchPairs',
        prompt: 'Match script to sound:',
        answer: expect.stringContaining('ಅ=a'),
      }),
      expect.objectContaining({
        type: 'typeKannada',
        prompt: 'Type the transliteration:',
        kannada: 'ಅ',
        answer: 'a',
        options: expect.arrayContaining(['a', 'aa', 'i', 'ii']),
      }),
    ]))
    expect(readingPractice.exercises).toHaveLength(8)
    expect(readingPractice.exercises).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'translate',
        prompt: 'Sound out this word:',
        kannada: 'ಕನ್ನಡ',
        answer: 'kannada',
        options: expect.arrayContaining(['kannada', 'namaskara']),
      }),
    ]))
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

  it('unlocks the next unit after three lessons and gates lessons inside that unit sequentially', () => {
    const [firstUnit, secondUnit, thirdUnit] = coreCurriculumUnits
    const afterThreeLessons = firstUnit.lessons.slice(0, 3).reduce(
      (state, lesson, index) =>
        completeLessonProgress(state, lesson.id, `2026-05-27T10:0${index}:00.000Z`),
      createInitialProgress(),
    )

    expect(getUnlockedCurriculumUnits([...coreCurriculumUnits, getScriptCurriculumUnit()], afterThreeLessons).map((unit) => unit.id)).toEqual([
      firstUnit.id,
      secondUnit.id,
      'unit-script',
    ])
    expect(isLessonUnlocked(secondUnit.lessons[0].id, afterThreeLessons)).toBe(true)
    expect(isLessonUnlocked(secondUnit.lessons[1].id, afterThreeLessons)).toBe(false)
    expect(getUnlockedCurriculumUnits([...coreCurriculumUnits, getScriptCurriculumUnit()], afterThreeLessons).map((unit) => unit.id)).not.toContain(thirdUnit.id)
  })

  it('recommends the lowest-mastery unlocked lesson after every core lesson has one crown', () => {
    const allCoreLessons = coreCurriculumUnits.flatMap((unit) => unit.lessons)
    const oneCrownProgress = allCoreLessons.reduce(
      (state, lesson, index) =>
        completeLessonProgress(state, lesson.id, `2026-05-27T11:${String(index).padStart(2, '0')}:00.000Z`),
      createInitialProgress(),
    )

    expect(getNextAvailableLesson(coreCurriculumUnits, oneCrownProgress)?.id).toBe(allCoreLessons[0].id)

    const firstLessonMastered = Array.from({ length: 4 }).reduce<ReturnType<typeof createInitialProgress>>(
      (state, _unused, index) =>
        completeLessonProgress(state, allCoreLessons[0].id, `2026-05-27T12:0${index}:00.000Z`),
      oneCrownProgress,
    )

    expect(getNextAvailableLesson(coreCurriculumUnits, firstLessonMastered)?.id).toBe(allCoreLessons[1].id)
  })

  it('builds crown replay exercise variants from current mastery level', () => {
    const lesson = coreCurriculumUnits[0].lessons[0]

    expect(getExercisesForMastery(lesson, 0)).toEqual(lesson.exercises)

    const crownTwoReplay = getExercisesForMastery(lesson, 1)
    expect(crownTwoReplay.find((exercise) => exercise.id === 'survival-translate-1')?.options).toEqual([
      'Hello sir',
      'Goodbye sir',
      'Thank you sir',
    ])
    expect(crownTwoReplay.find((exercise) => exercise.id === 'survival-arrange-1')?.options).toEqual([
      'ಸಾರ್',
      'ಹೇಗಿದ್ದೀರಾ',
      'ನಮಸ್ಕಾರ',
      'ಚೆನ್ನಾಗಿದ್ದೇನೆ',
    ])

    const crownThreeReplay = getExercisesForMastery(lesson, 2)
    expect(crownThreeReplay.some((exercise) => exercise.type === 'typeKannada' && exercise.id.endsWith('-mastery-type'))).toBe(true)
    expect(crownThreeReplay.find((exercise) => exercise.id === 'survival-translate-1-mastery-type')).toEqual(
      expect.objectContaining({
        type: 'typeKannada',
        prompt: 'Type this in Kannada script:',
        answer: 'ನಮಸ್ಕಾರ ಸಾರ್',
      }),
    )

    const crownFourReplay = getExercisesForMastery(lesson, 3)
    expect(crownFourReplay.every((exercise) => 'timeLimitSeconds' in exercise)).toBe(true)
    expect(crownFourReplay[0]).toHaveProperty('timeLimitSeconds', 15)

    const crownFiveReplay = getExercisesForMastery(lesson, 4)
    expect(crownFiveReplay.map((exercise) => exercise.id)).not.toEqual(lesson.exercises.map((exercise) => exercise.id))
    expect(crownFiveReplay[0]).toHaveProperty('timeLimitSeconds', 15)
    expect(crownFiveReplay.some((exercise) => exercise.type === 'typeKannada')).toBe(true)
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
