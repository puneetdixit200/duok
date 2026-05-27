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
  getPhraseByVocabularyId,
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
    expect(exercises.some((exercise) => exercise.type === 'translate' && exercise.direction === 'enToKn')).toBe(true)
    expect(new Set(exercises.map((exercise) => exercise.id)).size).toBe(exercises.length)
  })

  it('includes English-to-Kannada reverse translate drills from the frontend spec', () => {
    const reverseExercise = coreCurriculumUnits[0].lessons[1].exercises[0]

    expect(reverseExercise).toEqual(expect.objectContaining({
      type: 'translate',
      direction: 'enToKn',
      prompt: 'Translate to Kannada:',
      english: 'How are you?',
      answer: 'ಹೇಗಿದ್ದೀರಾ?',
      options: expect.arrayContaining(['ಹೇಗಿದ್ದೀರಾ?', 'ಚೆನ್ನಾಗಿದ್ದೇನೆ', 'ನೀವು ಹೇಗಿದ್ದೀರಾ?']),
    }))
  })

  it('mixes review lessons from earlier unit vocabulary instead of only review rows', () => {
    const unitOneReview = coreCurriculumUnits[0].lessons[4]
    const reviewVocabularyIds = new Set(unitOneReview.exercises.flatMap((exercise) => exercise.vocabularyIds))
    const reviewMatchPairs = unitOneReview.exercises.find((exercise) => exercise.type === 'matchPairs')

    expect(unitOneReview.exercises.map((exercise) => exercise.type)).toEqual([
      'translate',
      'arrange',
      'fillBlank',
      'listening',
      'speaking',
      'matchPairs',
      'typeKannada',
      'dialogue',
    ])
    expect(Array.from(reviewVocabularyIds)).toEqual(expect.arrayContaining([
      'namaskara-saar',
      'ticket-eshtu',
      'unit-1-greetings-lesson-2-phrase-1',
      'unit-1-greetings-lesson-3-phrase-2',
      'unit-1-greetings-lesson-4-phrase-1',
      'unit-1-greetings-lesson-5-phrase-1',
    ]))
    expect(reviewMatchPairs?.answer.split(';')).toHaveLength(4)
    expect(getPhraseByVocabularyId('unit-1-greetings-lesson-2-phrase-1')).toMatchObject({
      kannada: 'ಹೇಗಿದ್ದೀರಾ?',
      transliteration: 'hegiddira',
      english: 'How are you?',
      context: 'ಹೇಗಿದ್ದೀರಾ? means "How are you?" in How Are You.',
    })
  })

  it('adds one or two distractor chips to generated arrange-word drills', () => {
    const generatedArrange = coreCurriculumUnits[0].lessons[1].exercises.find((exercise) => exercise.type === 'arrange')
    expect(generatedArrange).toBeDefined()

    if (!generatedArrange) {
      throw new Error('Expected a generated arrange exercise')
    }

    const answerWords = generatedArrange.answer.split(/\s+/).filter(Boolean)
    expect(generatedArrange.options.length).toBeGreaterThan(answerWords.length)
    expect(generatedArrange.options.length).toBeLessThanOrEqual(answerWords.length + 2)
    expect(generatedArrange.options.some((option) => !answerWords.includes(option))).toBe(true)
  })

  it('covers every number word promised by the Unit 2 number lessons', () => {
    const numbersOneToFive = coreCurriculumUnits[1].lessons.find((lesson) => lesson.title === 'Numbers 1-5')!
    const numbersSixToTen = coreCurriculumUnits[1].lessons.find((lesson) => lesson.title === 'Numbers 6-10')!
    const getMatchedKannada = (lesson: typeof numbersOneToFive) =>
      lesson.exercises
        .find((exercise) => exercise.type === 'matchPairs')!
        .answer.split(';')
        .map((pair) => pair.split('=')[0])

    expect(getMatchedKannada(numbersOneToFive)).toEqual(['ಒಂದು', 'ಎರಡು', 'ಮೂರು', 'ನಾಲ್ಕು', 'ಐದು'])
    expect(getMatchedKannada(numbersSixToTen)).toEqual(['ಆರು', 'ಏಳು', 'ಎಂಟು', 'ಒಂಬತ್ತು', 'ಹತ್ತು'])
  })

  it('teaches the Unit 2 price and bargaining phrases named in the frontend spec', () => {
    const unitTwo = coreCurriculumUnits[1]
    const askingPrices = unitTwo.lessons.find((lesson) => lesson.title === 'Asking Prices')!
    const bargaining = unitTwo.lessons.find((lesson) => lesson.title === 'Bargaining')!
    const bargainingPairs = bargaining.exercises.find((exercise) => exercise.type === 'matchPairs')!

    expect(unitTwo.tips.map((tip) => tip.title)).toEqual([
      'Kannada numbers',
      'Price questions',
      'Bargaining language',
    ])
    expect(unitTwo.tips.flatMap((tip) => tip.examples)).toEqual(expect.arrayContaining([
      'ಎಷ್ಟು ರೂಪಾಯಿ?',
      'ಜಾಸ್ತಿ',
      'ಕಡಿಮೆ ಮಾಡಿ',
    ]))
    expect(askingPrices.exercises[0]).toEqual(expect.objectContaining({
      type: 'translate',
      kannada: 'ಎಷ್ಟು ರೂಪಾಯಿ?',
      answer: 'How many rupees?',
    }))
    expect(bargaining.exercises[0]).toEqual(expect.objectContaining({
      type: 'translate',
      direction: 'enToKn',
      english: 'too much',
      answer: 'ಜಾಸ್ತಿ',
    }))
    expect(bargainingPairs.answer).toContain('ಜಾಸ್ತಿ=too much')
    expect(bargainingPairs.answer).toContain('ಕಡಿಮೆ ಮಾಡಿ=Please reduce it')
  })

  it('teaches the Unit 3 from-place suffix and direction words named in the frontend spec', () => {
    const unitThree = coreCurriculumUnits[2]
    const busPhrases = unitThree.lessons.find((lesson) => lesson.title === 'Bus Phrases')!
    const directions = unitThree.lessons.find((lesson) => lesson.title === 'Directions')!
    const busPairs = busPhrases.exercises.find((exercise) => exercise.type === 'matchPairs')!
    const directionPairs = directions.exercises.find((exercise) => exercise.type === 'matchPairs')!

    expect(unitThree.tips.map((tip) => tip.title)).toEqual([
      '-ge means to',
      '-inda means from',
      'Direction words',
    ])
    expect(unitThree.tips.flatMap((tip) => tip.examples)).toEqual(expect.arrayContaining([
      'ಇಂದಿರಾನಗರದಿಂದ',
      'ಎಡಕ್ಕೆ ಹೋಗಿ',
      'ಬಲಕ್ಕೆ ಹೋಗಿ',
      'ನೇರವಾಗಿ ಹೋಗಿ',
    ]))
    expect(busPairs.answer).toContain('ಇಂದಿರಾನಗರದಿಂದ=from Indiranagar')
    expect(directionPairs.answer).toContain('ಎಡಕ್ಕೆ ಹೋಗಿ=Go left')
    expect(directionPairs.answer).toContain('ಬಲಕ್ಕೆ ಹೋಗಿ=Go right')
    expect(directionPairs.answer).toContain('ನೇರವಾಗಿ ಹೋಗಿ=Go straight')
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
    expect(scriptUnit.scriptSymbols.filter((symbol) => symbol.kind === 'vowel').map((symbol) => symbol.kannada)).toEqual([
      'ಅ', 'ಆ', 'ಇ', 'ಈ', 'ಉ', 'ಊ',
      'ಎ', 'ಏ', 'ಐ', 'ಒ', 'ಓ', 'ಔ',
    ])
    expect(scriptUnit.scriptSymbols.filter((symbol) => symbol.kind === 'consonant').length).toBeGreaterThanOrEqual(34)
    expect(scriptUnit.scriptSymbols.filter((symbol) => symbol.kind === 'combination').map((symbol) => symbol.kannada)).toEqual([
      'ಕಾ', 'ಕಿ', 'ಕೀ', 'ಕು', 'ಕೂ', 'ಕೆ', 'ಕೇ', 'ಕೈ', 'ಕೊ', 'ಕೋ', 'ಕೌ',
    ])
    expect([...coreCurriculumUnits, scriptUnit].reduce((total, unit) => total + unit.lessons.length, 0)).toBe(49)
    expect(getAllLessonExercises([...coreCurriculumUnits, scriptUnit])).toHaveLength(332)
  })

  it('builds Kannada Script Academy lessons from script-specific drill types', () => {
    const scriptUnit = getScriptCurriculumUnit()
    const vowelsPartOne = scriptUnit.lessons.find((lesson) => lesson.title === 'Vowels Part 1')!
    const vowelsPartTwo = scriptUnit.lessons.find((lesson) => lesson.title === 'Vowels Part 2')!
    const labialsAndOthers = scriptUnit.lessons.find((lesson) => lesson.title === 'Consonants: Labials + Others')!
    const vowelSigns = scriptUnit.lessons.find((lesson) => lesson.title === 'Vowel Signs')!
    const readingPractice = scriptUnit.lessons.find((lesson) => lesson.title === 'Reading Practice')!

    expect(vowelsPartOne.exercises).toHaveLength(8)
    expect(vowelsPartTwo.exercises.map((exercise) => exercise.kannada)).not.toEqual(expect.arrayContaining(['ಋ', 'ಅಂ']))
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
    expect(stories.map(({ title, subtitle, difficulty, newWordCount, imagePath }) => ({
      title,
      subtitle,
      difficulty,
      newWordCount,
      imagePath,
    }))).toEqual([
      {
        title: 'First Day in Bangalore',
        subtitle: 'Scene: Bus stop',
        difficulty: 'Beginner',
        newWordCount: 12,
        imagePath: 'story-bus-stop.svg',
      },
      {
        title: 'Office Lunch',
        subtitle: 'Scene: Tech park cafeteria',
        difficulty: 'Beginner',
        newWordCount: 16,
        imagePath: 'story-office-lunch.svg',
      },
      {
        title: 'The Auto Ride',
        subtitle: 'Scene: Indiranagar to Majestic',
        difficulty: 'Intermediate',
        newWordCount: 14,
        imagePath: 'story-auto-ride.svg',
      },
      {
        title: 'Darshini Breakfast',
        subtitle: 'Scene: Standing hotel',
        difficulty: 'Intermediate',
        newWordCount: 18,
        imagePath: 'story-darshini-breakfast.svg',
      },
      {
        title: 'The Kirana Run',
        subtitle: 'Scene: Neighborhood store',
        difficulty: 'Intermediate',
        newWordCount: 15,
        imagePath: 'story-kirana-run.svg',
      },
      {
        title: 'PG Problems',
        subtitle: 'Scene: PG owner conversation',
        difficulty: 'Advanced',
        newWordCount: 20,
        imagePath: 'story-pg-problems.svg',
      },
    ])
    expect(new Set(stories.map((story) => story.imagePath)).size).toBe(stories.length)
    expect(stories.every((story) => story.sentences.length >= 3)).toBe(true)
    expect(stories.every((story) => story.quiz.options.length >= 4)).toBe(true)
    expect(stories.every((story) =>
      story.sentences.every((sentence) =>
        sentence.words.length === sentence.kannada.replace(/[?.:,]/g, '').split(/\s+/).filter(Boolean).length,
      ),
    )).toBe(true)
    expect(stories.every((story) =>
      story.sentences.every((sentence) =>
        sentence.words.every((word) => word.english.length > 0 && word.note !== 'Story word in context.' && word.vocabularyId.length > 0),
      ),
    )).toBe(true)
    const firstStoryWord = stories[0].sentences[0].words.find((word) => word.text === 'ಬಂದ')
    expect(getPhraseByVocabularyId(firstStoryWord?.vocabularyId ?? '')).toMatchObject({
      kannada: 'ಬಂದ',
      transliteration: 'banda',
      english: 'came',
      context: 'First Day in Bangalore: Rahul came to Bangalore.',
      skillTag: 'story',
    })
    expect(stories.find((story) => story.id === 'auto-ride-story')?.sentences[1].words).toContainEqual(
      expect.objectContaining({
        text: 'ಮೆಜೆಸ್ಟಿಕ್‌ಗೆ',
        transliteration: 'majestic-ge',
        english: 'to Majestic',
        note: '-ಗೆ marks the destination.',
      }),
    )
    expect(stories.find((story) => story.id === 'pg-problems')?.sentences[2].words).toContainEqual(
      expect.objectContaining({
        text: 'ಗಂಟೆಯಲ್ಲಿ',
        english: 'in one hour',
        note: '-ದಲ್ಲಿ marks time here.',
      }),
    )

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
    expect(transliterateLatinToKannada('ticket eshtu?')).toBe('ಟಿಕೆಟ್ ಎಷ್ಟು?')
    expect(transliterateLatinToKannada('nanage neeru beku')).toBe('ನನಗೆ ನೀರು ಬೇಕು')
    expect(transliterateLatinToKannada('Majestic-ge hogbeku')).toBe('ಮೆಜೆಸ್ಟಿಕ್‌ಗೆ ಹೋಗಬೇಕು')
    expect(transliterateLatinToKannada('swalpa kammi maadi')).toBe('ಸ್ವಲ್ಪ ಕಡಿಮೆ ಮಾಡಿ')
    expect(transliterateLatinToKannada('doctor elli')).toBe('ಡಾಕ್ಟರ್ ಎಲ್ಲಿ')
  })

  it('falls back to ITRANS-like Kannada letter rules for unlisted typing input', () => {
    expect(transliterateLatinToKannada('a aa i ii u uu e ee ai o oo au')).toBe('ಅ ಆ ಇ ಈ ಉ ಊ ಎ ಏ ಐ ಒ ಓ ಔ')
    expect(transliterateLatinToKannada('ka kaa ki kii ku kuu ke kee kai ko koo kau')).toBe('ಕ ಕಾ ಕಿ ಕೀ ಕು ಕೂ ಕೆ ಕೇ ಕೈ ಕೊ ಕೋ ಕೌ')
    expect(transliterateLatinToKannada('kha ga gha cha ja Ta Da Na ta da na pa ba bha ma ya ra la va sha Sha sa ha La')).toBe(
      'ಖ ಗ ಘ ಚ ಜ ಟ ಡ ಣ ತ ದ ನ ಪ ಬ ಭ ಮ ಯ ರ ಲ ವ ಶ ಷ ಸ ಹ ಳ',
    )
  })
})
