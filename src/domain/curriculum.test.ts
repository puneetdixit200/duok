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
      for (const [lessonIndex, lesson] of unit.lessons.entries()) {
        const uniqueExerciseTypes = new Set(lesson.exercises.map((exercise) => exercise.type)).size
        if (unit.title === 'Greetings & Basics' && lessonIndex <= 1) {
          expect(uniqueExerciseTypes).toBe(5)
        } else {
          expect(uniqueExerciseTypes).toBeGreaterThanOrEqual(6)
        }
      }
    }

    const exercises = getAllLessonExercises(coreCurriculumUnits)
    expect(exercises).toHaveLength(256)
    expect(exercises.some((exercise) => exercise.type === 'typeKannada')).toBe(true)
    expect(exercises.some((exercise) => exercise.type === 'dialogue')).toBe(true)
    expect(exercises.some((exercise) => exercise.type === 'translate' && exercise.direction === 'enToKn')).toBe(true)
    expect(new Set(exercises.map((exercise) => exercise.id)).size).toBe(exercises.length)

    const expectedMinimumVocabularyByUnit = new Map([
      ['Greetings & Basics', 16],
      ['Numbers & Prices', 18],
      ['Transport & Directions', 22],
      ['Food & Ordering', 20],
      ['Shopping & Bargaining', 18],
      ['Home & PG Life', 16],
      ['Office & Workplace', 18],
      ['Emergencies & Help', 16],
    ])
    for (const unit of coreCurriculumUnits) {
      const vocabularyIds = new Set(unit.lessons.flatMap((lesson) =>
        lesson.exercises.flatMap((exercise) => exercise.vocabularyIds),
      ))
      expect(vocabularyIds.size).toBeGreaterThanOrEqual(expectedMinimumVocabularyByUnit.get(unit.title) ?? 0)
    }
    expect(new Set(exercises.flatMap((exercise) => exercise.vocabularyIds)).size).toBeGreaterThanOrEqual(148)
  })

  it('includes English-to-Kannada reverse translate drills from the frontend spec', () => {
    const reverseExercise = getAllLessonExercises(coreCurriculumUnits)
      .find((exercise) => exercise.type === 'translate' && exercise.direction === 'enToKn')

    expect(reverseExercise).toEqual(expect.objectContaining({
      type: 'translate',
      direction: 'enToKn',
      prompt: 'Translate to Kannada:',
    }))
    expect(reverseExercise?.options.some((option) => /[\u0C80-\u0CFF]/.test(option))).toBe(true)
  })

  it('matches the frontend spec exercise plan for Unit 1 Lesson 1', () => {
    const helloAndThanks = coreCurriculumUnits[0].lessons[0]

    expect(helloAndThanks.title).toBe('Hello & Thanks')
    expect(helloAndThanks.exercises.map((exercise) => exercise.type)).toEqual([
      'translate',
      'translate',
      'listening',
      'matchPairs',
      'speaking',
      'arrange',
    ])
    expect(helloAndThanks.exercises.map((exercise) => exercise.xp)).toEqual([2, 2, 3, 4, 4, 3])
    expect(helloAndThanks.exercises[1]).toEqual(expect.objectContaining({
      id: 'survival-translate-2',
      kannada: 'ಧನ್ಯವಾದ',
      answer: 'Thank you',
      options: ['Thank you', 'Hello', 'Sorry', 'Goodbye'],
      vocabularyIds: ['dhanyavada'],
    }))
    expect(helloAndThanks.exercises[2]).toEqual(expect.objectContaining({
      id: 'survival-listening-1',
      kannada: 'ನಮಸ್ಕಾರ ಸಾರ್',
      answer: 'ನಮಸ್ಕಾರ ಸಾರ್',
      options: ['ನಮಸ್ಕಾರ', 'ಧನ್ಯವಾದ', 'ನಮಸ್ಕಾರ ಸಾರ್', 'ಹೋಗಿ ಬನ್ನಿ'],
      vocabularyIds: ['namaskara-saar'],
    }))
    expect(helloAndThanks.exercises[3]).toEqual(expect.objectContaining({
      id: 'survival-match-1',
      kannada: 'ನಮಸ್ಕಾರ, ಧನ್ಯವಾದ, ಹೋಗಿ ಬನ್ನಿ, ಬಾ',
      answer: 'ನಮಸ್ಕಾರ=Hello;ಧನ್ಯವಾದ=Thank you;ಹೋಗಿ ಬನ್ನಿ=Goodbye;ಬಾ=Come',
      vocabularyIds: ['namaskara-saar', 'dhanyavada'],
    }))
    expect(helloAndThanks.exercises[5]).toEqual(expect.objectContaining({
      id: 'survival-arrange-1',
      english: 'Hello sir, thank you',
      answer: 'ನಮಸ್ಕಾರ ಸಾರ್ ಧನ್ಯವಾದ',
      options: ['ಧನ್ಯವಾದ', 'ಸಾರ್', 'ನಮಸ್ಕಾರ', 'ಬೇಕು'],
      vocabularyIds: ['namaskara-saar', 'dhanyavada'],
    }))
  })

  it('matches the frontend spec exercise plan for Unit 1 Lesson 2', () => {
    const howAreYou = coreCurriculumUnits[0].lessons[1]
    const dialogueExercise = howAreYou.exercises[3]

    expect(howAreYou.title).toBe('How Are You')
    expect(howAreYou.exercises.map((exercise) => exercise.type)).toEqual([
      'translate',
      'translate',
      'fillBlank',
      'dialogue',
      'speaking',
      'matchPairs',
    ])
    expect(howAreYou.exercises.map((exercise) => exercise.xp)).toEqual([2, 2, 2, 3, 4, 4])
    expect(howAreYou.exercises[0]).toEqual(expect.objectContaining({
      type: 'translate',
      prompt: 'Translate this phrase:',
      kannada: 'ಹೇಗಿದ್ದೀರಾ?',
      answer: 'How are you?',
    }))
    expect(howAreYou.exercises[1]).toEqual(expect.objectContaining({
      type: 'translate',
      prompt: 'Translate this phrase:',
      kannada: 'ಚೆನ್ನಾಗಿದ್ದೇನೆ',
      answer: 'I am fine',
    }))
    expect(howAreYou.exercises[2]).toEqual(expect.objectContaining({
      type: 'fillBlank',
      prompt: 'Complete: ___? ಚೆನ್ನಾಗಿದ್ದೇನೆ',
      kannada: '___? ಚೆನ್ನಾಗಿದ್ದೇನೆ',
      answer: 'ಹೇಗಿದ್ದೀರಾ',
      vocabularyIds: [
        'unit-1-greetings-lesson-2-phrase-1',
        'unit-1-greetings-lesson-2-phrase-2',
      ],
    }))
    expect(dialogueExercise).toEqual(expect.objectContaining({
      type: 'dialogue',
      prompt: 'Reply to: ಹೇಗಿದ್ದೀರಾ?',
      kannada: 'ಹೇಗಿದ್ದೀರಾ?',
      english: 'How are you?',
      answer: 'ಚೆನ್ನಾಗಿದ್ದೇನೆ',
      xp: 3,
      skillTag: 'conversation',
      vocabularyIds: [
        'unit-1-greetings-lesson-2-phrase-1',
        'unit-1-greetings-lesson-2-phrase-2',
      ],
    }))
    expect(dialogueExercise.options).toEqual(expect.arrayContaining([
      'ಚೆನ್ನಾಗಿದ್ದೇನೆ',
      'ಹೇಗಿದ್ದೀರಾ?',
      'ನೀವು ಹೇಗಿದ್ದೀರಾ?',
    ]))
    expect(howAreYou.exercises[4]).toEqual(expect.objectContaining({
      type: 'speaking',
      prompt: 'Say: ಹೇಗಿದ್ದೀರಾ',
      answer: 'hegiddira',
      skillTag: 'pronunciation',
    }))
    expect(howAreYou.exercises[5]).toEqual(expect.objectContaining({
      type: 'matchPairs',
      prompt: 'Match',
      answer: 'ಹೇಗಿದ್ದೀರಾ=How are you;ಚೆನ್ನಾಗಿದ್ದೇನೆ=I am fine;ನಮಸ್ಕಾರ=Hello;ಧನ್ಯವಾದ=Thank you',
      vocabularyIds: [
        'unit-1-greetings-lesson-2-phrase-1',
        'unit-1-greetings-lesson-2-phrase-2',
        'namaskara-saar',
        'dhanyavada',
      ],
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
      'dhanyavada',
      'unit-1-greetings-lesson-2-phrase-1',
      'unit-1-greetings-lesson-2-phrase-2',
      'unit-1-greetings-lesson-3-phrase-1',
      'unit-1-greetings-lesson-4-phrase-1',
      'unit-1-greetings-lesson-5-phrase-1',
    ]))
    expect(reviewMatchPairs?.answer.split(';')).toHaveLength(4)
    expect(getPhraseByVocabularyId('unit-1-greetings-lesson-2-phrase-1')).toMatchObject({
      kannada: 'ಹೇಗಿದ್ದೀರಾ?',
      transliteration: 'hegiddira',
      english: 'How are you?',
      context: 'Respectful daily greeting.',
    })
  })

  it('awards match-pair drills one XP per matched pair', () => {
    const matchPairExercises = getAllLessonExercises([...coreCurriculumUnits, getScriptCurriculumUnit()])
      .filter((exercise) => exercise.type === 'matchPairs')

    expect(matchPairExercises.length).toBeGreaterThan(0)
    for (const exercise of matchPairExercises) {
      expect(exercise.xp).toBe(exercise.answer.split(';').filter(Boolean).length)
    }
  })

  it('adds one or two distractor chips to generated arrange-word drills', () => {
    const generatedArrange = coreCurriculumUnits[0].lessons[2].exercises.find((exercise) => exercise.type === 'arrange')
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

  it('teaches the Unit 4 food-ordering grammar and menu items named in the frontend spec', () => {
    const unitFour = coreCurriculumUnits[3]
    const darshiniBasics = unitFour.lessons.find((lesson) => lesson.title === 'Darshini Basics')!
    const orderingFood = unitFour.lessons.find((lesson) => lesson.title === 'Ordering Food')!
    const darshiniPairs = darshiniBasics.exercises.find((exercise) => exercise.type === 'matchPairs')!
    const orderingPairs = orderingFood.exercises.find((exercise) => exercise.type === 'matchPairs')!

    expect(unitFour.tips.map((tip) => tip.title)).toEqual([
      'Kodi for polite requests',
      'One item formula',
      'Menu items',
    ])
    expect(unitFour.tips.flatMap((tip) => tip.examples)).toEqual(expect.arrayContaining([
      'ಕಾಫಿ ಕೊಡಿ',
      'ಒಂದು ದೋಸೆ ಕೊಡಿ',
      'ಇಡ್ಲಿ',
      'ದೋಸೆ',
      'ಕಾಫಿ',
      'ಚಹಾ',
      'ಅನ್ನ',
    ]))
    expect(darshiniPairs.answer).toContain('ಒಂದು ದೋಸೆ ಕೊಡಿ=Please give one dosa')
    expect(darshiniPairs.answer).toContain('ಚಹಾ ಕೊಡಿ=Please give tea')
    expect(orderingPairs.answer).toContain('ಅನ್ನ ಕೊಡಿ=Please give rice')
  })

  it('teaches the Unit 5 shopping grammar named in the frontend spec', () => {
    const unitFive = coreCurriculumUnits[4]
    const kiranaStore = unitFive.lessons.find((lesson) => lesson.title === 'At the Kirana Store')!
    const askingAboutItems = unitFive.lessons.find((lesson) => lesson.title === 'Asking About Items')!
    const kiranaPairs = kiranaStore.exercises.find((exercise) => exercise.type === 'matchPairs')!
    const itemPairs = askingAboutItems.exercises.find((exercise) => exercise.type === 'matchPairs')!

    expect(unitFive.tips.map((tip) => tip.title)).toEqual([
      'Beku and beda',
      'Idu and adu',
      'Kodi and torisi',
    ])
    expect(unitFive.tips.flatMap((tip) => tip.examples)).toEqual(expect.arrayContaining([
      'ಹಾಲು ಬೇಕು',
      'ಬ್ಯಾಗ್ ಬೇಡ',
      'ಇದು ಎಷ್ಟು?',
      'ಅದು ಬೇಡ',
      'ಅದು ಕೊಡಿ',
      'ಇದನ್ನು ತೋರಿಸಿ',
    ]))
    expect(kiranaPairs.answer).toContain('ಹಾಲು ಬೇಕು=I want milk')
    expect(kiranaPairs.answer).toContain('ಬ್ಯಾಗ್ ಬೇಡ=No bag needed')
    expect(kiranaPairs.answer).toContain('ಇದು ಎಷ್ಟು?=How much is this?')
    expect(itemPairs.answer).toContain('ಇದನ್ನು ತೋರಿಸಿ=Please show me this')
    expect(itemPairs.answer).toContain('ಅದು ಕೊಡಿ=Give that one')
  })

  it('teaches the Unit 6 PG-life problem and water phrases named in the frontend spec', () => {
    const unitSix = coreCurriculumUnits[5]
    const householdItems = unitSix.lessons.find((lesson) => lesson.title === 'Household Items')!
    const complaints = unitSix.lessons.find((lesson) => lesson.title === 'Complaints & Requests')!
    const householdPairs = householdItems.exercises.find((exercise) => exercise.type === 'matchPairs')!
    const complaintPairs = complaints.exercises.find((exercise) => exercise.type === 'matchPairs')!

    expect(unitSix.tips.map((tip) => tip.title)).toEqual([
      'Samasye means problem',
      'Neeru illa',
      'Yaavaaga baruttade',
    ])
    expect(unitSix.tips.flatMap((tip) => tip.examples)).toEqual(expect.arrayContaining([
      'ಸಮಸ್ಯೆ ಇದೆ',
      'ನೀರಿನ ಸಮಸ್ಯೆ ಇದೆ',
      'ನೀರು ಇಲ್ಲ',
      'ನೀರು ಬರಲ್ಲ',
      'ಯಾವಾಗ ಬರುತ್ತದೆ?',
      'ಯಾವಾಗ ಬರುತ್ತೆ?',
    ]))
    expect(householdPairs.answer).toContain('ನೀರು ಇಲ್ಲ=There is no water')
    expect(householdPairs.answer).toContain('ನೀರು ಬರಲ್ಲ=Water is not coming')
    expect(householdPairs.answer).toContain('ಯಾವಾಗ ಬರುತ್ತದೆ?=When will it come?')
    expect(complaintPairs.answer).toContain('ಸಮಸ್ಯೆ ಇದೆ=There is a problem')
    expect(complaintPairs.answer).toContain('ನೀರಿನ ಸಮಸ್ಯೆ ಇದೆ=There is a water problem')
  })

  it('teaches the Unit 7 office grammar named in the frontend spec', () => {
    const unitSeven = coreCurriculumUnits[6]
    const officeGreetings = unitSeven.lessons.find((lesson) => lesson.title === 'Office Greetings')!
    const lunchTea = unitSeven.lessons.find((lesson) => lesson.title === 'Lunch & Tea Talk')!
    const workRequests = unitSeven.lessons.find((lesson) => lesson.title === 'Simple Work Requests')!
    const officePairs = officeGreetings.exercises.find((exercise) => exercise.type === 'matchPairs')!
    const lunchPairs = lunchTea.exercises.find((exercise) => exercise.type === 'matchPairs')!
    const requestPairs = workRequests.exercises.find((exercise) => exercise.type === 'matchPairs')!

    expect(unitSeven.tips.map((tip) => tip.title)).toEqual([
      'Meeting loanwords',
      'Today and tomorrow',
      'Maadi for polite requests',
    ])
    expect(unitSeven.tips.flatMap((tip) => tip.examples)).toEqual(expect.arrayContaining([
      'ಮೀಟಿಂಗ್ ಇದೆ',
      'ಸ್ಕ್ರೀನ್ ಶೇರ್ ಮಾಡಿ',
      'ಇವತ್ತು ಮುಗಿಸ್ತೀನಿ',
      'ನಾಳೆ ಕಳುಸ್ತೀನಿ',
      'ಮತ್ತೆ ಎಕ್ಸ್‌ಪ್ಲೇನ್ ಮಾಡಿ',
    ]))
    expect(officePairs.answer).toContain('ಮೀಟಿಂಗ್ ಇದೆ=There is a meeting')
    expect(lunchPairs.answer).toContain('ಸ್ಕ್ರೀನ್ ಶೇರ್ ಮಾಡಿ=Please share the screen')
    expect(lunchPairs.answer).toContain('ಮತ್ತೆ ಎಕ್ಸ್‌ಪ್ಲೇನ್ ಮಾಡಿ=Please explain again')
    expect(requestPairs.answer).toContain('ಇವತ್ತು ಮುಗಿಸ್ತೀನಿ=I will finish today')
    expect(requestPairs.answer).toContain('ನಾಳೆ ಕಳುಸ್ತೀನಿ=I will send tomorrow')
  })

  it('teaches the Unit 8 emergency phrases named in the frontend spec', () => {
    const unitEight = coreCurriculumUnits[7]
    const askingForHelp = unitEight.lessons.find((lesson) => lesson.title === 'Asking for Help')!
    const healthDoctor = unitEight.lessons.find((lesson) => lesson.title === 'Health & Doctor')!
    const helpPairs = askingForHelp.exercises.find((exercise) => exercise.type === 'matchPairs')!
    const healthPairs = healthDoctor.exercises.find((exercise) => exercise.type === 'matchPairs')!

    expect(unitEight.tips.map((tip) => tip.title)).toEqual([
      'Sahaaya maadi',
      'Hospital location',
      'Police',
    ])
    expect(unitEight.tips.flatMap((tip) => tip.examples)).toEqual(expect.arrayContaining([
      'ಸಹಾಯ ಮಾಡಿ',
      'ತಕ್ಷಣ ಸಹಾಯ ಮಾಡಿ',
      'ಆಸ್ಪತ್ರೆ ಎಲ್ಲಿ?',
      'ಡಾಕ್ಟರ್ ಎಲ್ಲಿ?',
      'ಪೋಲೀಸ್',
      'ಪೋಲೀಸ್‌ಗೆ ಕಾಲ್ ಮಾಡಿ',
    ]))
    expect(helpPairs.answer).toContain('ಸಹಾಯ ಮಾಡಿ=Please help')
    expect(helpPairs.answer).toContain('ಪೋಲೀಸ್=Police')
    expect(helpPairs.answer).toContain('ಪೋಲೀಸ್‌ಗೆ ಕಾಲ್ ಮಾಡಿ=Please call the police')
    expect(healthPairs.answer).toContain('ಆಸ್ಪತ್ರೆ ಎಲ್ಲಿ?=Where is the hospital?')
  })

  it('resolves match-pair-only authored phrases as exact review vocabulary', () => {
    expect(getPhraseByVocabularyId('unit-2-prices-lesson-4-phrase-4')).toMatchObject({
      kannada: 'ಯುಪಿಐ ಇದೆಯಾ?',
      transliteration: 'upi ideya',
      english: 'Do you have UPI?',
      context: 'Common payment question.',
      skillTag: 'prices',
    })
    expect(getPhraseByVocabularyId('unit-4-food-lesson-1-phrase-4')).toMatchObject({
      kannada: 'ಚಹಾ ಕೊಡಿ',
      transliteration: 'chahaa kodi',
      english: 'Please give tea',
      context: 'Counter request.',
      skillTag: 'food',
    })
    expect(getPhraseByVocabularyId('unit-8-emergency-lesson-1-phrase-5')).toMatchObject({
      kannada: 'ಆಂಬುಲೆನ್ಸ್ ಬೇಕು',
      transliteration: 'ambulance beku',
      english: 'Need an ambulance',
      context: 'Medical emergency.',
      skillTag: 'emergency',
    })
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
      'ಾ', 'ಿ', 'ೀ', 'ು', 'ೂ', 'ೆ', 'ೇ', 'ೈ', 'ೊ', 'ೋ', 'ೌ',
    ])
    expect([...coreCurriculumUnits, scriptUnit].reduce((total, unit) => total + unit.lessons.length, 0)).toBe(49)
    expect(getAllLessonExercises([...coreCurriculumUnits, scriptUnit])).toHaveLength(332)
    expect(new Set(getAllLessonExercises([scriptUnit]).flatMap((exercise) => exercise.vocabularyIds)).size).toBeGreaterThanOrEqual(49)
  })

  it('keeps exercise XP aligned with the frontend spec reward table', () => {
    const expectedXpByType = {
      translate: 2,
      arrange: 3,
      fillBlank: 2,
      listening: 3,
      speaking: 4,
      typeKannada: 4,
      dialogue: 3,
    } as const

    for (const exercise of getAllLessonExercises([...coreCurriculumUnits, getScriptCurriculumUnit()])) {
      if (exercise.type === 'matchPairs') {
        expect(exercise.xp, exercise.id).toBe(exercise.answer.split(';').filter(Boolean).length)
      } else {
        expect(exercise.xp, exercise.id).toBe(expectedXpByType[exercise.type])
      }
    }
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
    expect(new Set(vowelsPartOne.exercises.flatMap((exercise) => exercise.vocabularyIds)).size).toBe(6)
    expect(new Set(vowelsPartTwo.exercises.flatMap((exercise) => exercise.vocabularyIds)).size).toBe(6)
    expect(new Set(labialsAndOthers.exercises.flatMap((exercise) => exercise.vocabularyIds)).size).toBe(10)
    expect(new Set(vowelSigns.exercises.flatMap((exercise) => exercise.vocabularyIds)).size).toBe(10)
    expect(vowelSigns.exercises).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'translate',
        prompt: 'Which vowel sign makes the "aa" sound?',
        answer: 'ಾ',
        options: expect.arrayContaining(['ಾ', 'ಿ', 'ೀ', 'ು']),
      }),
      expect.objectContaining({
        type: 'listening',
        prompt: 'Which vowel sign did you hear?',
        answer: 'ಿ',
        transliteration: 'i',
      }),
      expect.objectContaining({
        type: 'matchPairs',
        prompt: 'Match script to sound:',
        answer: expect.stringContaining('ಾ=aa'),
      }),
    ]))
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

  it('uses explicit placement unlocks without completing lessons inside those units', () => {
    const [firstUnit, secondUnit, thirdUnit, fourthUnit] = coreCurriculumUnits
    const placementProgress = {
      ...createInitialProgress(),
      unlockedUnitIds: [firstUnit.id, secondUnit.id, thirdUnit.id],
    }

    expect(getUnlockedCurriculumUnits([...coreCurriculumUnits, getScriptCurriculumUnit()], placementProgress).map((unit) => unit.id)).toEqual([
      firstUnit.id,
      secondUnit.id,
      thirdUnit.id,
      'unit-script',
    ])
    expect(isLessonUnlocked(secondUnit.lessons[0].id, placementProgress)).toBe(true)
    expect(isLessonUnlocked(secondUnit.lessons[1].id, placementProgress)).toBe(false)
    expect(isLessonUnlocked(thirdUnit.lessons[0].id, placementProgress)).toBe(true)
    expect(isLessonUnlocked(thirdUnit.lessons[1].id, placementProgress)).toBe(false)
    expect(isLessonUnlocked(fourthUnit.lessons[0].id, placementProgress)).toBe(false)
    expect(getNextAvailableLesson(coreCurriculumUnits, placementProgress)?.id).toBe(firstUnit.lessons[0].id)
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
      'ಧನ್ಯವಾದ',
      'ಸಾರ್',
      'ನಮಸ್ಕಾರ',
      'ಬೇಕು',
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
