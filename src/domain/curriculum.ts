import type {
  Curriculum,
  CurriculumLesson,
  CurriculumUnit,
  ExerciseType,
  GrammarTip,
  LessonExercise,
  Phrase,
  Scenario,
  ScriptSymbol,
  Story,
  TutorPersona,
} from '../types'
import type { ProgressState } from './progress'

type PhraseSeed = Omit<Phrase, 'id' | 'skillTag'>

interface LessonSeed {
  title: string
  subtitle: string
  objective: string
  skillTag: string
  phrases: PhraseSeed[]
}

interface UnitSeed {
  id: string
  title: string
  description: string
  tips: GrammarTip[]
  lessons: LessonSeed[]
}

export const survivalPhrases: Phrase[] = [
  {
    id: 'namaskara-saar',
    kannada: 'ನಮಸ್ಕಾರ ಸಾರ್',
    transliteration: 'namaskara saar',
    english: 'Hello sir',
    context: 'A polite greeting for shops, autos, and apartment security.',
    skillTag: 'greetings',
  },
  {
    id: 'dhanyavada',
    kannada: 'ಧನ್ಯವಾದ',
    transliteration: 'dhanyavada',
    english: 'Thank you',
    context: 'Use after getting help at a darshini or kirana store.',
    skillTag: 'greetings',
  },
  {
    id: 'hegiddira',
    kannada: 'ಹೇಗಿದ್ದೀರಾ?',
    transliteration: 'hegiddira?',
    english: 'How are you?',
    context: 'Respectful small talk with neighbors or office staff.',
    skillTag: 'introductions',
  },
  {
    id: 'chennagiddene',
    kannada: 'ಚೆನ್ನಾಗಿದ್ದೇನೆ',
    transliteration: 'chennagiddene',
    english: 'I am fine',
    context: 'A safe answer when someone asks how you are.',
    skillTag: 'introductions',
  },
  {
    id: 'hesaru-enu',
    kannada: 'ನಿಮ್ಮ ಹೆಸರು ಏನು?',
    transliteration: 'nimma hesaru enu?',
    english: 'What is your name?',
    context: 'Useful in introductions with tutors, guards, or classmates.',
    skillTag: 'introductions',
  },
  {
    id: 'nanna-hesaru',
    kannada: 'ನನ್ನ ಹೆಸರು ರಾಹುಲ್',
    transliteration: 'nanna hesaru Rahul',
    english: 'My name is Rahul',
    context: 'Simple introduction with Kannada plus your own name.',
    skillTag: 'introductions',
  },
  {
    id: 'kannada-gothilla',
    kannada: 'ನನಗೆ ಕನ್ನಡ ಗೊತ್ತಿಲ್ಲ',
    transliteration: 'nanage kannada gothilla',
    english: 'I do not know Kannada',
    context: 'A survival phrase when a conversation gets too fast.',
    skillTag: 'survival',
  },
  {
    id: 'swalpa-kannada',
    kannada: 'ಸ್ವಲ್ಪ ಕನ್ನಡ ಬರುತ್ತದೆ',
    transliteration: 'swalpa kannada baruttade',
    english: 'I know a little Kannada',
    context: 'Encourages people to continue slowly in Kannada.',
    skillTag: 'survival',
  },
  {
    id: 'nidhanavagi-heli',
    kannada: 'ನಿಧಾನವಾಗಿ ಹೇಳಿ',
    transliteration: 'nidhanavagi heli',
    english: 'Please speak slowly',
    context: 'Helpful with BMTC conductors and busy shopkeepers.',
    skillTag: 'listening',
  },
  {
    id: 'matte-heli',
    kannada: 'ಮತ್ತೆ ಹೇಳಿ',
    transliteration: 'matte heli',
    english: 'Please say it again',
    context: 'Use when you miss a word in traffic or market noise.',
    skillTag: 'listening',
  },
  {
    id: 'hogbeku',
    kannada: 'ಹೋಗಬೇಕು',
    transliteration: 'hogbeku',
    english: 'need to go',
    context: 'Core travel word for autos, buses, and directions.',
    skillTag: 'verbs',
  },
  {
    id: 'majestic-ge-hogbeku',
    kannada: 'ಮೆಜೆಸ್ಟಿಕ್‌ಗೆ ಹೋಗಬೇಕು',
    transliteration: 'Majestic-ge hogbeku',
    english: 'I need to go to Majestic',
    context: 'A common Bangalore auto or BMTC destination sentence.',
    skillTag: 'transport',
  },
  {
    id: 'eshtu',
    kannada: 'ಎಷ್ಟು?',
    transliteration: 'eshtu?',
    english: 'How much?',
    context: 'Ask prices for autos, vegetables, tickets, and tea.',
    skillTag: 'shopping',
  },
  {
    id: 'ticket-eshtu',
    kannada: 'ಟಿಕೆಟ್ ಎಷ್ಟು?',
    transliteration: 'ticket eshtu?',
    english: 'How much is the ticket?',
    context: 'BMTC bus phrase when the conductor asks your destination.',
    skillTag: 'transport',
  },
  {
    id: 'illi-nillisi',
    kannada: 'ಇಲ್ಲಿ ನಿಲ್ಲಿಸಿ',
    transliteration: 'illi nillisi',
    english: 'Stop here',
    context: 'Use in an auto or cab when you reach the gate.',
    skillTag: 'transport',
  },
  {
    id: 'barutte',
    kannada: 'ಬರುತ್ತೆ',
    transliteration: 'barutte',
    english: 'It will come',
    context: 'Common response while waiting for buses, food, or people.',
    skillTag: 'verbs',
  },
  {
    id: 'oota-aayta',
    kannada: 'ಊಟ ಆಯ್ತಾ?',
    transliteration: 'oota aayta?',
    english: 'Did you eat?',
    context: 'Friendly Bangalore small talk at work or PG.',
    skillTag: 'culture',
  },
  {
    id: 'swalpa-adjust-maadi',
    kannada: 'ಸ್ವಲ್ಪ ಅಡ್ಜಸ್ಟ್ ಮಾಡಿ',
    transliteration: 'swalpa adjust maadi',
    english: 'Please adjust a little',
    context: 'Classic Bangalore code-switching phrase in crowds and traffic.',
    skillTag: 'bangalore',
  },
  {
    id: 'beku',
    kannada: 'ಬೇಕು',
    transliteration: 'beku',
    english: 'want or need',
    context: 'Essential when ordering coffee, dosa, tickets, or help.',
    skillTag: 'shopping',
  },
  {
    id: 'beda',
    kannada: 'ಬೇಡ',
    transliteration: 'beda',
    english: 'do not want',
    context: 'Use to decline bags, extra chutney, or a route.',
    skillTag: 'shopping',
  },
]

const baseSurvivalExercises: LessonExercise[] = [
  {
    id: 'survival-translate-1',
    type: 'translate',
    prompt: 'Translate this phrase:',
    kannada: 'ನಮಸ್ಕಾರ ಸಾರ್',
    transliteration: 'namaskara saar',
    answer: 'Hello sir',
    options: ['Hello sir', 'Goodbye sir', 'Thank you sir', 'How are you sir'],
    explanation: 'ನಮಸ್ಕಾರ ಸಾರ್ is a respectful hello used across Bangalore.',
    skillTag: 'greetings',
    xp: 2,
    vocabularyIds: ['namaskara-saar'],
  },
  {
    id: 'survival-arrange-1',
    type: 'arrange',
    prompt: 'Arrange the words:',
    english: 'Hello sir, how are you?',
    kannada: 'ನಮಸ್ಕಾರ ಸಾರ್ ಹೇಗಿದ್ದೀರಾ',
    answer: 'ನಮಸ್ಕಾರ ಸಾರ್ ಹೇಗಿದ್ದೀರಾ',
    options: ['ಸಾರ್', 'ಹೇಗಿದ್ದೀರಾ', 'ನಮಸ್ಕಾರ', 'ಚೆನ್ನಾಗಿದ್ದೇನೆ'],
    explanation: 'Kannada greetings usually keep the respectful ಸಾರ್ after the greeting.',
    skillTag: 'greetings',
    xp: 3,
    vocabularyIds: ['namaskara-saar', 'hegiddira'],
  },
  {
    id: 'survival-fill-1',
    type: 'fillBlank',
    prompt: 'Fill in the blank:',
    english: 'I need to go to school',
    kannada: 'ನಾನು ಶಾಲೆಗೆ ___',
    answer: 'ಹೋಗಬೇಕು',
    options: ['ಹೋಗಬೇಕು', 'ಬರುತ್ತೇನೆ', 'ತಿನ್ನುತ್ತೇನೆ', 'ಮಾಡುತ್ತೇನೆ'],
    explanation: 'ಹೋಗಬೇಕು means need to go.',
    skillTag: 'verbs',
    xp: 2,
    vocabularyIds: ['hogbeku'],
  },
  {
    id: 'survival-listening-1',
    type: 'listening',
    prompt: 'What did you hear?',
    kannada: 'ಟಿಕೆಟ್ ಎಷ್ಟು?',
    answer: 'ಟಿಕೆಟ್ ಎಷ್ಟು?',
    options: ['ನಮಸ್ಕಾರ', 'ಧನ್ಯವಾದ', 'ಟಿಕೆಟ್ ಎಷ್ಟು?', 'ಹೋಗಿ ಬನ್ನಿ'],
    explanation: 'ಟಿಕೆಟ್ ಎಷ್ಟು asks the fare on a bus.',
    skillTag: 'listening',
    xp: 3,
    vocabularyIds: ['ticket-eshtu'],
  },
  {
    id: 'survival-speaking-1',
    type: 'speaking',
    prompt: 'Say this phrase:',
    kannada: 'ನಮಸ್ಕಾರ ಸಾರ್',
    transliteration: 'namaskara saar',
    answer: 'namaskara saar',
    options: ['Record', 'Try Again'],
    explanation: 'Stretch the long aa sound in saar.',
    skillTag: 'pronunciation',
    xp: 4,
    vocabularyIds: ['namaskara-saar'],
  },
  {
    id: 'survival-match-1',
    type: 'matchPairs',
    prompt: 'Match the pairs:',
    kannada: 'ನಮಸ್ಕಾರ, ಧನ್ಯವಾದ, ಹೋಗು, ಬಾ',
    answer: 'ನಮಸ್ಕಾರ=Hello;ಧನ್ಯವಾದ=Thank you;ಹೋಗು=Go;ಬಾ=Come',
    options: ['ನಮಸ್ಕಾರ', 'ಧನ್ಯವಾದ', 'ಹೋಗು', 'ಬಾ', 'Hello', 'Thank you', 'Go', 'Come'],
    explanation: 'These are the first useful pairs for survival Kannada.',
    skillTag: 'vocabulary',
    xp: 4,
    vocabularyIds: ['namaskara-saar', 'dhanyavada', 'hogbeku'],
  },
]

export const lessonExercises = baseSurvivalExercises

const unitSeeds: UnitSeed[] = [
  {
    id: 'unit-1-greetings',
    title: 'Greetings & Basics',
    description: 'Polite hellos, names, small talk, and survival repair phrases.',
    tips: [
      {
        title: 'Kannada word order',
        body: 'Kannada commonly uses subject-object-verb order, so the action often comes at the end.',
        examples: ['ನಾನು ಶಾಲೆಗೆ ಹೋಗಬೇಕು', 'ನನ್ನ ಹೆಸರು ರಾಹುಲ್'],
      },
      {
        title: 'Universal polite greeting',
        body: 'ನಮಸ್ಕಾರ is the universal polite greeting for shops, offices, apartments, and transport.',
        examples: ['ನಮಸ್ಕಾರ ಸಾರ್', 'ನಮಸ್ಕಾರ ಮೇಡಂ'],
      },
      {
        title: 'Respect markers',
        body: 'Add ಸಾರ್ or ಮೇಡಂ for extra respect with strangers, shop staff, drivers, guards, and older people.',
        examples: ['ಧನ್ಯವಾದ ಸಾರ್', 'ಹೋಗಿ ಬನ್ನಿ ಮೇಡಂ'],
      },
    ],
    lessons: [
      {
        title: 'Hello & Thanks',
        subtitle: 'Start conversations safely',
        objective: 'Greet, thank, and close a simple conversation.',
        skillTag: 'greetings',
        phrases: survivalPhrases.slice(0, 4),
      },
      {
        title: 'How Are You',
        subtitle: 'Ask and answer daily greetings',
        objective: 'Ask how someone is and answer politely.',
        skillTag: 'greetings',
        phrases: [
          phrase('hegiddira', 'ಹೇಗಿದ್ದೀರಾ?', 'How are you?', 'Respectful daily greeting.'),
          phrase('chennagiddene', 'ಚೆನ್ನಾಗಿದ್ದೇನೆ', 'I am fine', 'A safe answer to daily greetings.'),
          phrase('neevu-hegiddira', 'ನೀವು ಹೇಗಿದ್ದೀರಾ?', 'How are you?', 'Respectful return question.'),
        ],
      },
      {
        title: 'Introductions',
        subtitle: 'Introduce yourself',
        objective: 'Ask and answer name questions.',
        skillTag: 'introductions',
        phrases: [
          phrase('nimma-hesaru-enu', 'ನಿಮ್ಮ ಹೆಸರು ಏನು?', 'What is your name?', 'Asking a new colleague or tutor.'),
          phrase('nanna-hesaru-rahul', 'ನನ್ನ ಹೆಸರು ರಾಹುಲ್', 'My name is Rahul', 'Replace Rahul with your own name.'),
          phrase('nimmanu-bheti-aagi-santosha', 'ನಿಮ್ಮನ್ನು ಭೇಟಿ ಆಗಿ ಸಂತೋಷ', 'Nice to meet you', 'Polite after an introduction.'),
        ],
      },
      {
        title: 'Small Talk',
        subtitle: 'Daily warmth',
        objective: 'Answer common friendly questions.',
        skillTag: 'culture',
        phrases: [
          phrase('oota-aayta', 'ಊಟ ಆಯ್ತಾ?', 'Did you eat?', 'Common office and neighbor small talk.'),
          phrase('banni', 'ಬನ್ನಿ', 'Please come', 'Friendly invitation.'),
          phrase('hogi-banni', 'ಹೋಗಿ ಬನ್ನಿ', 'Go and come back', 'Polite goodbye.'),
        ],
      },
      {
        title: 'Unit 1 Review',
        subtitle: 'Review greetings and basics',
        objective: 'Mix greetings, introductions, small talk, and repair phrases.',
        skillTag: 'survival',
        phrases: [
          phrase('kannada-gothilla', 'ನನಗೆ ಕನ್ನಡ ಗೊತ್ತಿಲ್ಲ', 'I do not know Kannada', 'Use when stuck.'),
          phrase('swalpa-kannada-baruttade', 'ಸ್ವಲ್ಪ ಕನ್ನಡ ಬರುತ್ತದೆ', 'I know a little Kannada', 'Encourages slower Kannada.'),
          phrase('english-barthaa', 'ಇಂಗ್ಲಿಷ್ ಬರುತ್ತಾ?', 'Do you know English?', 'A fallback question.'),
        ],
      },
    ],
  },
  {
    id: 'unit-2-prices',
    title: 'Numbers & Prices',
    description: 'Ask prices, understand small amounts, and pay for daily items.',
    tips: [
      {
        title: 'Question word position',
        body: 'ಎಷ್ಟು means how much or how many and can stand at the end of a short price question.',
        examples: ['ಟಿಕೆಟ್ ಎಷ್ಟು?', 'ಕಾಫಿ ಎಷ್ಟು?'],
      },
      {
        title: 'Beku for wants',
        body: 'ಬೇಕು covers both want and need. It is one of the highest-value words for beginners.',
        examples: ['ಎರಡು ಕಾಫಿ ಬೇಕು', 'ಬಿಲ್ ಬೇಕು'],
      },
    ],
    lessons: [
      priceLesson('Numbers 1-5', 'Count small orders', 'numbers', [
        ['ondu', 'ಒಂದು', 'one', 'One coffee or one ticket.'],
        ['eradu', 'ಎರಡು', 'two', 'Two idlis or two tickets.'],
        ['mooru', 'ಮೂರು', 'three', 'Three people or three plates.'],
      ]),
      priceLesson('Numbers 6-10', 'Count slightly larger groups', 'numbers', [
        ['aaru', 'ಆರು', 'six', 'Six rupees or six people.'],
        ['elu', 'ಏಳು', 'seven', 'Seven stops.'],
        ['hattu', 'ಹತ್ತು', 'ten', 'Ten rupees.'],
      ]),
      priceLesson('Asking Prices', 'Ask rates anywhere', 'prices', [
        ['idara-bele-eshtu', 'ಇದರ ಬೆಲೆ ಎಷ್ಟು?', 'What is its price?', 'Use at a store counter.'],
        ['ticket-eshtu', 'ಟಿಕೆಟ್ ಎಷ್ಟು?', 'How much is the ticket?', 'BMTC conductor phrase.'],
        ['coffee-eshtu', 'ಕಾಫಿ ಎಷ್ಟು?', 'How much is coffee?', 'Darshini phrase.'],
      ]),
      priceLesson('Bargaining', 'Reduce and settle prices', 'prices', [
        ['upi-ideya', 'ಯುಪಿಐ ಇದೆಯಾ?', 'Do you have UPI?', 'Common payment question.'],
        ['change-ideya', 'ಚಿಲ್ಲರೆ ಇದೆಯಾ?', 'Do you have change?', 'Cash payment phrase.'],
        ['bill-kodi', 'ಬಿಲ್ ಕೊಡಿ', 'Please give the bill', 'Restaurant or shop phrase.'],
      ]),
      priceLesson('Unit 2 Review', 'Review numbers and prices', 'shopping', [
        ['ardha-kg-beku', 'ಅರ್ಧ ಕಿಲೋ ಬೇಕು', 'I want half a kilo', 'Vegetable shop.'],
        ['ondu-liter-halu', 'ಒಂದು ಲೀಟರ್ ಹಾಲು', 'One liter of milk', 'Kirana store.'],
        ['eradu-plate-idli', 'ಎರಡು ಪ್ಲೇಟ್ ಇಡ್ಲಿ', 'Two plates of idli', 'Darshini order.'],
      ]),
    ],
  },
  {
    id: 'unit-3-transport',
    title: 'Transport & Directions',
    description: 'Autos, BMTC, metro, stops, and direction repair.',
    tips: [
      {
        title: '-ge means to',
        body: 'Add -ಗೆ to destinations when you mean "to" a place.',
        examples: ['ಮೆಜೆಸ್ಟಿಕ್‌ಗೆ ಹೋಗಬೇಕು', 'ಇಂದಿರಾನಗರಕ್ಕೆ ಹೋಗಬೇಕು'],
      },
      {
        title: 'Imperatives',
        body: 'Commands often end with polite forms like ಮಾಡಿ or ಕೊಡಿ.',
        examples: ['ಇಲ್ಲಿ ನಿಲ್ಲಿಸಿ', 'ಮೀಟರ್ ಹಾಕಿ'],
      },
    ],
    lessons: [
      transportLesson('Auto Ride Basics', 'Start an auto ride', [
        ['majestic-ge-hogbeku', 'ಮೆಜೆಸ್ಟಿಕ್‌ಗೆ ಹೋಗಬೇಕು', 'I need to go to Majestic', 'Auto destination.'],
        ['meter-haaki', 'ಮೀಟರ್ ಹಾಕಿ', 'Please use the meter', 'Negotiating politely.'],
        ['illi-nillisi', 'ಇಲ್ಲಿ ನಿಲ್ಲಿಸಿ', 'Stop here', 'End of ride.'],
      ]),
      transportLesson('Bus Phrases', 'Talk to a conductor', [
        ['koramangala-ticket', 'ಕೋರಮಂಗಲಕ್ಕೆ ಟಿಕೆಟ್', 'Ticket to Koramangala', 'BMTC phrase.'],
        ['ticket-eshtu', 'ಟಿಕೆಟ್ ಎಷ್ಟು?', 'How much is the ticket?', 'Fare question.'],
        ['change-beku', 'ಚಿಲ್ಲರೆ ಬೇಕು', 'I need change', 'Cash on bus.'],
      ]),
      transportLesson('Directions', 'Ask where to go', [
        ['ellige-hogbeku', 'ಎಲ್ಲಿಗೆ ಹೋಗಬೇಕು?', 'Where should I go?', 'When lost.'],
        ['edakke-hogi', 'ಎಡಕ್ಕೆ ಹೋಗಿ', 'Go left', 'Direction phrase.'],
        ['balakke-hogi', 'ಬಲಕ್ಕೆ ಹೋಗಿ', 'Go right', 'Direction phrase.'],
      ]),
      transportLesson('At the Metro', 'Use metro stations', [
        ['metro-station-elli', 'ಮೆಟ್ರೋ ಸ್ಟೇಷನ್ ಎಲ್ಲಿ?', 'Where is the metro station?', 'Ask for station.'],
        ['card-recharge-beku', 'ಕಾರ್ಡ್ ರೀಚಾರ್ಜ್ ಬೇಕು', 'I need to recharge the card', 'Metro counter.'],
        ['yaava-platform', 'ಯಾವ ಪ್ಲಾಟ್‌ಫಾರ್ಮ್?', 'Which platform?', 'Station navigation.'],
      ]),
      transportLesson('Unit 3 Review', 'Review transport and directions', [
        ['safe-route-yaavudu', 'ಸೇಫ್ ರೂಟ್ ಯಾವುದು?', 'Which route is safe?', 'Night travel.'],
        ['phone-madthini', 'ಫೋನ್ ಮಾಡ್ತೀನಿ', 'I will call', 'Safety phrase.'],
        ['gate-hatra-bidi', 'ಗೇಟ್ ಹತ್ತಿರ ಬಿಡಿ', 'Drop me near the gate', 'Cab or auto.'],
      ]),
    ],
  },
  {
    id: 'unit-4-food',
    title: 'Food & Ordering',
    description: 'Darshini ordering, spice level, water, and bill requests.',
    tips: [
      {
        title: 'Object before verb',
        body: 'Kannada usually places the object before the verb or request word.',
        examples: ['ಒಂದು ಕಾಫಿ ಬೇಕು', 'ನೀರು ಕೊಡಿ'],
      },
      {
        title: 'Polite requests',
        body: 'ಕೊಡಿ means give please and is useful in food, shopping, and offices.',
        examples: ['ಚಟ್ನಿ ಕೊಡಿ', 'ಬಿಲ್ ಕೊಡಿ'],
      },
    ],
    lessons: [
      foodLesson('Darshini Basics', [
        ['ondu-dosa-beku', 'ಒಂದು ದೋಸೆ ಬೇಕು', 'I want one dosa', 'Darshini breakfast.'],
        ['eradu-idli-beku', 'ಎರಡು ಇಡ್ಲಿ ಬೇಕು', 'I want two idlis', 'Common order.'],
        ['coffee-kodi', 'ಕಾಫಿ ಕೊಡಿ', 'Please give coffee', 'Counter request.'],
      ]),
      foodLesson('Ordering Food', [
        ['neeru-kodi', 'ನೀರು ಕೊಡಿ', 'Please give water', 'Universal request.'],
        ['chutney-swalpa', 'ಚಟ್ನಿ ಸ್ವಲ್ಪ', 'A little chutney', 'Food counter.'],
        ['sambar-beku', 'ಸಾಂಬಾರ್ ಬೇಕು', 'I want sambar', 'Extra serving.'],
      ]),
      foodLesson('Restaurant Phrases', [
        ['khara-kammi', 'ಖಾರ ಕಡಿಮೆ', 'Less spicy', 'Ask before ordering.'],
        ['khara-jaasti', 'ಖಾರ ಜಾಸ್ತಿ', 'More spicy', 'Food preference.'],
        ['sari-ide', 'ಸರಿ ಇದೆ', 'It is okay', 'Accept food or spice level.'],
      ]),
      foodLesson('Likes & Dislikes', [
        ['bill-kodi', 'ಬಿಲ್ ಕೊಡಿ', 'Please give the bill', 'At the end.'],
        ['parcel-beku', 'ಪಾರ್ಸೆಲ್ ಬೇಕು', 'I want parcel/takeaway', 'Takeaway order.'],
        ['illi-thinbeku', 'ಇಲ್ಲಿ ತಿನ್ನಬೇಕು', 'I want to eat here', 'Dine-in.'],
      ]),
      foodLesson('Unit 4 Review', [
        ['veg-ideya', 'ವೆಜ್ ಇದೆಯಾ?', 'Is there vegetarian food?', 'Food check.'],
        ['mosaru-beku', 'ಮೊಸರು ಬೇಕು', 'I want curd', 'Meal request.'],
        ['allergy-ide', 'ಅಲರ್ಜಿ ಇದೆ', 'I have an allergy', 'Health safety.'],
      ]),
    ],
  },
  {
    id: 'unit-5-shopping',
    title: 'Shopping & Bargaining',
    description: 'Kirana, vegetables, bags, returns, and polite bargaining.',
    tips: [
      {
        title: 'Beda means no need',
        body: 'ಬೇಡ is a compact way to decline extras without sounding harsh.',
        examples: ['ಬ್ಯಾಗ್ ಬೇಡ', 'ಇದು ಬೇಡ'],
      },
      {
        title: 'Comparisons',
        body: 'ಕಡಿಮೆ means less and ಜಾಸ್ತಿ means more. They work for price, spice, and quantity.',
        examples: ['ಬೆಲೆ ಜಾಸ್ತಿ', 'ಸ್ವಲ್ಪ ಕಡಿಮೆ ಮಾಡಿ'],
      },
    ],
    lessons: [
      shoppingLesson('At the Kirana Store', [
        ['halu-beku', 'ಹಾಲು ಬೇಕು', 'I want milk', 'Neighborhood store.'],
        ['bread-ideya', 'ಬ್ರೆಡ್ ಇದೆಯಾ?', 'Do you have bread?', 'Ask availability.'],
        ['bag-beda', 'ಬ್ಯಾಗ್ ಬೇಡ', 'No bag needed', 'Decline plastic.'],
      ]),
      shoppingLesson('Asking About Items', [
        ['tomato-eshtu', 'ಟೊಮೇಟೊ ಎಷ್ಟು?', 'How much are tomatoes?', 'Vegetable stall.'],
        ['ardha-kg-beku', 'ಅರ್ಧ ಕಿಲೋ ಬೇಕು', 'I want half a kilo', 'Quantity.'],
        ['fresh-ideya', 'ಫ್ರೆಶ್ ಇದೆಯಾ?', 'Is it fresh?', 'Quality check.'],
      ]),
      shoppingLesson('Bargaining Practice', [
        ['swalpa-kammi-maadi', 'ಸ್ವಲ್ಪ ಕಡಿಮೆ ಮಾಡಿ', 'Please reduce a little', 'Bargaining.'],
        ['bele-jaasti', 'ಬೆಲೆ ಜಾಸ್ತಿ', 'The price is high', 'Polite pushback.'],
        ['sari-kodi', 'ಸರಿ ಕೊಡಿ', 'Okay, give it', 'Close the deal.'],
      ]),
      shoppingLesson('Declining & Accepting', [
        ['change-madbeku', 'ಚೇಂಜ್ ಮಾಡಬೇಕು', 'I need to exchange it', 'Return counter.'],
        ['receipt-ide', 'ರಸೀದಿ ಇದೆ', 'I have the receipt', 'Proof.'],
        ['size-sari-illa', 'ಸೈಸ್ ಸರಿ ಇಲ್ಲ', 'The size is not right', 'Clothes.'],
      ]),
      shoppingLesson('Unit 5 Review', [
        ['charger-ideya', 'ಚಾರ್ಜರ್ ಇದೆಯಾ?', 'Do you have a charger?', 'Phone store.'],
        ['warranty-ideya', 'ವಾರಂಟಿ ಇದೆಯಾ?', 'Is there a warranty?', 'Electronics.'],
        ['online-price-eshtu', 'ಆನ್‌ಲೈನ್ ಬೆಲೆ ಎಷ್ಟು?', 'What is the online price?', 'Comparison.'],
      ]),
    ],
  },
  {
    id: 'unit-6-home-pg',
    title: 'Home & PG Life',
    description: 'PG owner, water, rent, maintenance, and neighbor conversations.',
    tips: [
      {
        title: '-alli means in or at',
        body: 'Use -ಲ್ಲಿ with rooms, buildings, neighborhoods, and offices.',
        examples: ['ರೂಮಿನಲ್ಲಿ', 'ಪಿಜಿಯಲ್ಲಿ'],
      },
      {
        title: 'Problems use ide',
        body: 'ಸಮಸ್ಯೆ ಇದೆ means there is a problem and is useful for repairs.',
        examples: ['ನೀರಿನ ಸಮಸ್ಯೆ ಇದೆ', 'ವೈಫೈ ಸಮಸ್ಯೆ ಇದೆ'],
      },
    ],
    lessons: [
      homeLesson('PG Owner Conversations', [
        ['room-elli', 'ರೂಮ್ ಎಲ್ಲಿ?', 'Where is the room?', 'PG arrival.'],
        ['key-kodi', 'ಕೀ ಕೊಡಿ', 'Please give the key', 'Move-in.'],
        ['rules-enu', 'ರೂಲ್ಸ್ ಏನು?', 'What are the rules?', 'PG rules.'],
      ]),
      homeLesson('Household Items', [
        ['neeru-baralla', 'ನೀರು ಬರಲ್ಲ', 'Water is not coming', 'Maintenance.'],
        ['yaavaga-barutte', 'ಯಾವಾಗ ಬರುತ್ತೆ?', 'When will it come?', 'Follow-up.'],
        ['tank-empty', 'ಟ್ಯಾಂಕ್ ಖಾಲಿ', 'The tank is empty', 'Report issue.'],
      ]),
      homeLesson('Complaints & Requests', [
        ['wifi-kelasa-madalla', 'ವೈಫೈ ಕೆಲಸ ಮಾಡಲ್ಲ', 'Wi-Fi is not working', 'PG issue.'],
        ['current-hogide', 'ಕರಂಟ್ ಹೋಗಿದೆ', 'Power is gone', 'Power cut.'],
        ['repair-madisi', 'ರಿಪೇರ್ ಮಾಡಿಸಿ', 'Please get it repaired', 'Request action.'],
      ]),
      homeLesson('Neighbors & Small Talk', [
        ['rent-eshtu', 'ರೆಂಟ್ ಎಷ್ಟು?', 'How much is the rent?', 'Housing question.'],
        ['deposit-eshtu', 'ಡಿಪಾಸಿಟ್ ಎಷ್ಟು?', 'How much is the deposit?', 'Before move-in.'],
        ['receipt-kodi', 'ರಸೀದಿ ಕೊಡಿ', 'Please give a receipt', 'Payment proof.'],
      ]),
      homeLesson('Unit 6 Review', [
        ['noise-kammi-maadi', 'ನಾಯ್ಸ್ ಕಡಿಮೆ ಮಾಡಿ', 'Please reduce the noise', 'Neighbor request.'],
        ['swalpa-adjust-maadi', 'ಸ್ವಲ್ಪ ಅಡ್ಜಸ್ಟ್ ಮಾಡಿ', 'Please adjust a little', 'Shared living.'],
        ['thanks-help', 'ಸಹಾಯಕ್ಕೆ ಧನ್ಯವಾದ', 'Thanks for the help', 'Neighbor courtesy.'],
      ]),
    ],
  },
  {
    id: 'unit-7-office',
    title: 'Office & Workplace',
    description: 'Meetings, deadlines, help requests, and cafeteria Kannada.',
    tips: [
      {
        title: 'Formal ನೀವ್/ನೀವು',
        body: 'Use ನೀವು with colleagues you do not know well or when you want a respectful tone.',
        examples: ['ನೀವು ಬರುತ್ತೀರಾ?', 'ನಿಮಗೆ ಸಮಯ ಇದೆಯಾ?'],
      },
      {
        title: 'Verb endings',
        body: 'Kannada verb endings change by tense and respect. Start with reusable chunks.',
        examples: ['ಬರುತ್ತೇನೆ', 'ಮಾಡುತ್ತೇನೆ', 'ಆಯ್ತು'],
      },
    ],
    lessons: [
      officeLesson('Office Greetings', [
        ['good-morning', 'ಗುಡ್ ಮಾರ್ನಿಂಗ್', 'Good morning', 'Office greeting.'],
        ['meeting-ide', 'ಮೀಟಿಂಗ್ ಇದೆ', 'There is a meeting', 'Calendar phrase.'],
        ['coffee-barthira', 'ಕಾಫಿಗೆ ಬರುತ್ತೀರಾ?', 'Will you come for coffee?', 'Friendly invite.'],
      ]),
      officeLesson('Lunch & Tea Talk', [
        ['time-ideya', 'ಸಮಯ ಇದೆಯಾ?', 'Do you have time?', 'Ask availability.'],
        ['screen-share-maadi', 'ಸ್ಕ್ರೀನ್ ಶೇರ್ ಮಾಡಿ', 'Please share the screen', 'Meeting request.'],
        ['matte-explain-maadi', 'ಮತ್ತೆ ಎಕ್ಸ್‌ಪ್ಲೇನ್ ಮಾಡಿ', 'Please explain again', 'Clarification.'],
      ]),
      officeLesson('Simple Work Requests', [
        ['ivattu-mugisthini', 'ಇವತ್ತು ಮುಗಿಸ್ತೀನಿ', 'I will finish today', 'Status update.'],
        ['naale-kalustini', 'ನಾಳೆ ಕಳುಸ್ತೀನಿ', 'I will send tomorrow', 'Deadline phrase.'],
        ['help-beku', 'ಹೆಲ್ಪ್ ಬೇಕು', 'I need help', 'Ask early.'],
      ]),
      officeLesson('Scheduling & Time', [
        ['oota-aayta', 'ಊಟ ಆಯ್ತಾ?', 'Did you eat?', 'Lunch small talk.'],
        ['table-ideya', 'ಟೇಬಲ್ ಇದೆಯಾ?', 'Is there a table?', 'Cafeteria.'],
        ['together-hogona', 'ಒಟ್ಟಿಗೆ ಹೋಗೋಣ', 'Let us go together', 'Invite.'],
      ]),
      officeLesson('Unit 7 Review', [
        ['leave-beku', 'ಲೀವ್ ಬೇಕು', 'I need leave', 'HR phrase.'],
        ['health-sari-illa', 'ಆರೋಗ್ಯ ಸರಿ ಇಲ್ಲ', 'Health is not okay', 'Sick leave.'],
        ['form-elli', 'ಫಾರ್ಮ್ ಎಲ್ಲಿ?', 'Where is the form?', 'Admin.'],
      ]),
    ],
  },
  {
    id: 'unit-8-emergency',
    title: 'Emergencies & Help',
    description: 'Ask for help, explain symptoms, and handle urgent travel or health needs.',
    tips: [
      {
        title: 'Urgency words',
        body: 'ತಕ್ಷಣ means immediately and ಸಹಾಯ means help. Learn them as safety anchors.',
        examples: ['ತಕ್ಷಣ ಸಹಾಯ ಬೇಕು', 'ಡಾಕ್ಟರ್ ಬೇಕು'],
      },
      {
        title: 'Body and health',
        body: 'Keep health sentences short. Clear phrases matter more than grammar in emergencies.',
        examples: ['ನನಗೆ ಜ್ವರ ಇದೆ', 'ನೋವು ಇದೆ'],
      },
    ],
    lessons: [
      emergencyLesson('Asking for Help', [
        ['sahaya-beku', 'ಸಹಾಯ ಬೇಕು', 'I need help', 'Emergency anchor.'],
        ['police-ge-call-maadi', 'ಪೊಲೀಸ್‌ಗೆ ಕಾಲ್ ಮಾಡಿ', 'Please call the police', 'Safety.'],
        ['ambulance-beku', 'ಆಂಬುಲೆನ್ಸ್ ಬೇಕು', 'Need an ambulance', 'Medical emergency.'],
      ]),
      emergencyLesson('Health & Doctor', [
        ['doctor-elli', 'ಡಾಕ್ಟರ್ ಎಲ್ಲಿ?', 'Where is the doctor?', 'Clinic.'],
        ['appointment-beku', 'ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್ ಬೇಕು', 'I need an appointment', 'Hospital desk.'],
        ['medicine-kodi', 'ಮೆಡಿಸಿನ್ ಕೊಡಿ', 'Please give medicine', 'Pharmacy.'],
      ]),
      emergencyLesson('Finding Places', [
        ['jwara-ide', 'ಜ್ವರ ಇದೆ', 'I have fever', 'Symptom.'],
        ['thale-novu', 'ತಲೆ ನೋವು', 'Headache', 'Symptom.'],
        ['hotte-novu', 'ಹೊಟ್ಟೆ ನೋವು', 'Stomach pain', 'Symptom.'],
      ]),
      emergencyLesson('Emergency Phrases', [
        ['phone-kaledu-hoytu', 'ಫೋನ್ ಕಳೆದು ಹೋಯ್ತು', 'I lost my phone', 'Lost item.'],
        ['bag-sigalla', 'ಬ್ಯಾಗ್ ಸಿಗಲ್ಲ', 'I cannot find my bag', 'Lost item.'],
        ['complaint-hakbeku', 'ಕಂಪ್ಲೇಂಟ್ ಹಾಕಬೇಕು', 'I need to file a complaint', 'Police station.'],
      ]),
      emergencyLesson('Unit 8 Review', [
        ['tumba-urgent', 'ತುಂಬಾ ಅರ್ಜೆಂಟ್', 'It is very urgent', 'Urgency.'],
        ['hospital-ge-hogbeku', 'ಹಾಸ್ಪಿಟಲ್‌ಗೆ ಹೋಗಬೇಕು', 'I need to go to the hospital', 'Travel emergency.'],
        ['begane-banni', 'ಬೇಗನೆ ಬನ್ನಿ', 'Please come quickly', 'Calling help.'],
      ]),
    ],
  },
]

export const coreCurriculumUnits: CurriculumUnit[] = unitSeeds.map(buildCoreUnit)

const scriptUnit: CurriculumUnit = buildScriptUnit()

const allUnits = [...coreCurriculumUnits, scriptUnit]

const allLessonPhraseMap = new Map<string, Phrase>(
  allUnits.flatMap((unit) => unit.lessons.flatMap((lesson) => lesson.exercises)).flatMap((exercise) =>
    exercise.vocabularyIds.map((id) => [
      id,
      {
        id,
        kannada: exercise.kannada || exercise.answer,
        transliteration: exercise.transliteration ?? exercise.answer,
        english: exercise.english ?? exercise.answer,
        context: exercise.explanation,
        skillTag: exercise.skillTag,
      } satisfies Phrase,
    ] as const),
  ),
)

export function getPhraseByVocabularyId(vocabularyId: string): Phrase | null {
  return survivalPhrases.find((phrase) => phrase.id === vocabularyId) ?? allLessonPhraseMap.get(vocabularyId) ?? null
}

const scenarioPhrase = (id: string) => survivalPhrases.find((phrase) => phrase.id === id) ?? allLessonPhraseMap.get(id)!

export const bangaloreScenarios: Scenario[] = [
  {
    id: 'bmtc-bus',
    title: 'BMTC Bus',
    icon: 'BUS',
    difficulty: 'Beginner',
    situation: 'You boarded 500D at Majestic and need a ticket to Koramangala.',
    openingLine: {
      kannada: 'ಟಿಕೆಟ್! ಟಿಕೆಟ್! ಎಲ್ಲಿಗೆ?',
      transliteration: 'ticket! ticket! ellige?',
      english: 'Ticket! Ticket! Where to?',
    },
    checklist: ['Greet conductor', 'Say destination', 'Ask the fare', 'Pay and get ticket'],
    usefulPhrases: [scenarioPhrase('ticket-eshtu'), scenarioPhrase('nidhanavagi-heli')],
  },
  {
    id: 'auto-ride',
    title: 'Auto Ride',
    icon: 'AUTO',
    difficulty: 'Beginner',
    situation: 'You are negotiating an auto from Indiranagar to Majestic.',
    openingLine: {
      kannada: 'ಸಾರ್, ಎಲ್ಲಿಗೆ ಹೋಗಬೇಕು?',
      transliteration: 'saar, ellige hogbeku?',
      english: 'Sir, where do you need to go?',
    },
    checklist: ['Say destination', 'Ask fare', 'Confirm meter', 'Ask to stop'],
    usefulPhrases: [scenarioPhrase('majestic-ge-hogbeku'), scenarioPhrase('illi-nillisi')],
  },
  {
    id: 'darshini',
    title: 'Darshini',
    icon: 'FOOD',
    difficulty: 'Beginner',
    situation: 'Order breakfast and filter coffee at a busy standing hotel.',
    openingLine: {
      kannada: 'ಏನು ಬೇಕು?',
      transliteration: 'enu beku?',
      english: 'What do you want?',
    },
    checklist: ['Order food', 'Ask price', 'Say thank you'],
    usefulPhrases: [scenarioPhrase('beku'), scenarioPhrase('dhanyavada')],
  },
  {
    id: 'kirana',
    title: 'Kirana',
    icon: 'SHOP',
    difficulty: 'Beginner',
    situation: 'Buy milk and decline a carry bag at the neighborhood store.',
    openingLine: {
      kannada: 'ಹೇಳಿ ಸಾರ್',
      transliteration: 'heli saar',
      english: 'Tell me, sir.',
    },
    checklist: ['Ask for item', 'Ask price', 'Decline bag'],
    usefulPhrases: [scenarioPhrase('eshtu'), scenarioPhrase('beda')],
  },
  {
    id: 'office',
    title: 'Office',
    icon: 'WORK',
    difficulty: 'Intermediate',
    situation: 'Greet coworkers and answer lunch small talk.',
    openingLine: {
      kannada: 'ಊಟ ಆಯ್ತಾ?',
      transliteration: 'oota aayta?',
      english: 'Did you eat?',
    },
    checklist: ['Greet coworker', 'Answer lunch question', 'Ask them back'],
    usefulPhrases: [scenarioPhrase('oota-aayta'), scenarioPhrase('chennagiddene')],
  },
  {
    id: 'pg-owner',
    title: 'PG Owner',
    icon: 'HOME',
    difficulty: 'Intermediate',
    situation: 'Ask your PG owner about water and maintenance.',
    openingLine: {
      kannada: 'ಏನ್ ಸಮಸ್ಯೆ?',
      transliteration: 'en samasye?',
      english: 'What is the problem?',
    },
    checklist: ['Explain issue', 'Ask when it will come', 'Say thanks'],
    usefulPhrases: [scenarioPhrase('barutte'), scenarioPhrase('matte-heli')],
  },
]

export const tutorPersonas: TutorPersona[] = [
  {
    id: 'friendly-anna',
    name: 'Friendly Anna',
    style: 'Casual, patient, and Bangalore-friendly.',
    correctionStyle: 'Gentle corrections with a usable phrase.',
  },
  {
    id: 'grammar-teacher',
    name: 'Grammar Teacher',
    style: 'Formal and precise with endings and cases.',
    correctionStyle: 'Direct correction with one grammar note.',
  },
  {
    id: 'conversation-coach',
    name: 'Conversation Coach',
    style: 'Fast roleplay with minimal English.',
    correctionStyle: 'Only fixes mistakes that block real conversation.',
  },
]

const storyWordGlosses: Record<string, string> = {
  ಬಂದ: 'came',
  ಬೆಂಗಳೂರಿಗೆ: 'to Bangalore',
  ಕನ್ನಡ: 'Kannada',
  ಟಿಕೆಟ್: 'ticket',
  ಎಷ್ಟು: 'how much',
  ಊಟಕ್ಕೆ: 'for lunch',
  ಕಿರಾಣಿಗೆ: 'to the kirana store',
  ಹಾಲು: 'milk',
  ಬ್ಯಾಗ್: 'bag',
  ಪಿಜಿಯಲ್ಲಿ: 'in the PG',
  ಸಮಸ್ಯೆ: 'problem',
  ಮಾಲೀಕರಿಗೆ: 'to the owner',
}

export const stories: Story[] = [
  makeStory(
    'first-day-bangalore',
    'First Day in Bangalore',
    'Scene: Bus stop',
    'Beginner',
    [
      ['ರಾಹುಲ್ ಬೆಂಗಳೂರಿಗೆ ಬಂದ.', 'raahul bengalurige banda', 'Rahul came to Bangalore.'],
      ['ಅವನಿಗೆ ಕನ್ನಡ ಬರುತ್ತಿರಲಿಲ್ಲ.', 'avanige kannada baruttirallilla', 'He did not know Kannada yet.'],
      ['ಬಸ್ ನಿಲ್ದಾಣದಲ್ಲಿ ಅವನು ಕೇಳಿದ: ಟಿಕೆಟ್ ಎಷ್ಟು?', 'bus nildaanadalli avanu kelida: ticket eshtu?', 'At the bus stop he asked, how much is the ticket?'],
    ],
    'Why is Rahul nervous at the bus stop?',
    'He does not know Kannada yet',
    { newWordCount: 12, readTimeMinutes: 5 },
  ),
  makeStory(
    'office-lunch',
    'Office Lunch',
    'Scene: Tech park cafeteria',
    'Beginner',
    [
      ['ಮೀರಾ ರಾಹುಲ್‌ನ್ನು ಊಟಕ್ಕೆ ಕರೆದಳು.', 'meera raahulannu ootakke karedalu', 'Meera called Rahul for lunch.'],
      ['ಅವಳು ಕೇಳಿದಳು: ಊಟ ಆಯ್ತಾ?', 'avalu kelidalu: oota aayta?', 'She asked, did you eat?'],
      ['ರಾಹುಲ್ ಹೇಳಿದ: ಇಲ್ಲ, ಒಟ್ಟಿಗೆ ಹೋಗೋಣ.', 'raahul helida: illa, ottige hogona', 'Rahul said, no, let us go together.'],
    ],
    'What does the coworker ask?',
    'Did you eat?',
    { newWordCount: 16, readTimeMinutes: 7, imagePath: 'story-office-lunch.svg' },
  ),
  makeStory(
    'auto-ride-story',
    'The Auto Ride',
    'Scene: Indiranagar to Majestic',
    'Intermediate',
    [
      ['ರಾಹುಲ್ ಇಂದಿರಾನಗರದಲ್ಲಿ ಆಟೋ ನಿಲ್ಲಿಸಿದ.', 'raahul indiranagaradalli auto nillisida', 'Rahul stopped an auto in Indiranagar.'],
      ['ಅವನು ಹೇಳಿದ: ಮೆಜೆಸ್ಟಿಕ್‌ಗೆ ಹೋಗಬೇಕು.', 'avanu helida: majestic-ge hogbeku', 'He said, I need to go to Majestic.'],
      ['ಡ್ರೈವರ್ ಕೇಳಿದ: ಮೀಟರ್ ಹಾಕಿ ಹೋಗೋಣ?', 'driver kelida: meter haaki hogona?', 'The driver asked, shall we go by meter?'],
    ],
    'Where does Rahul want to go?',
    'Majestic',
    { newWordCount: 14, readTimeMinutes: 7, imagePath: 'story-auto-ride.svg' },
  ),
  makeStory(
    'darshini-breakfast',
    'Darshini Breakfast',
    'Scene: Standing hotel',
    'Intermediate',
    [
      ['ಕೌಂಟರ್ ಬಳಿ ಜನ ತುಂಬಾ ಇದ್ದರು.', 'counter bali jana tumba iddaru', 'There were many people near the counter.'],
      ['ರಾಹುಲ್ ಹೇಳಿದ: ಎರಡು ಇಡ್ಲಿ ಮತ್ತು ಕಾಫಿ ಕೊಡಿ.', 'raahul helida: eradu idli mattu coffee kodi', 'Rahul said, please give two idlis and coffee.'],
      ['ಅವನು ಬಿಲ್ ಕೊಡಿ ಎಂದನು.', 'avanu bill kodi endanu', 'He asked for the bill.'],
    ],
    'What did Rahul order?',
    'Two idlis and coffee',
    { newWordCount: 18, readTimeMinutes: 7, imagePath: 'story-darshini-breakfast.svg' },
  ),
  makeStory(
    'kirana-run',
    'The Kirana Run',
    'Scene: Neighborhood store',
    'Intermediate',
    [
      ['ರಾಹುಲ್ ಕಿರಾಣಿಗೆ ಹೋದ.', 'raahul kiraniige hoda', 'Rahul went to the kirana store.'],
      ['ಅವನು ಹೇಳಿದ: ಹಾಲು ಬೇಕು, ಬ್ಯಾಗ್ ಬೇಡ.', 'avanu helida: haalu beku, bag beda', 'He said, I want milk, no bag needed.'],
      ['ಅಂಗಡಿಯವರು ಕೇಳಿದರು: ಚಿಲ್ಲರೆ ಇದೆಯಾ?', 'angadiyavaru kelidaru: chillare ideya?', 'The shopkeeper asked, do you have change?'],
    ],
    'What does Rahul decline?',
    'A carry bag',
    { newWordCount: 15, readTimeMinutes: 7, imagePath: 'story-kirana-run.svg' },
  ),
  makeStory(
    'pg-problems',
    'PG Problems',
    'Scene: PG owner conversation',
    'Advanced',
    [
      ['ಪಿಜಿಯಲ್ಲಿ ಬೆಳಿಗ್ಗೆ ನೀರು ಬರಲಿಲ್ಲ.', 'pg-yalli beligge neeru baralilla', 'In the PG, water did not come in the morning.'],
      ['ರಾಹುಲ್ ಮಾಲೀಕರಿಗೆ ಹೇಳಿದ: ನೀರಿನ ಸಮಸ್ಯೆ ಇದೆ.', 'raahul maalikarige helida: neerina samasye ide', 'Rahul told the owner, there is a water problem.'],
      ['ಮಾಲೀಕರು ಹೇಳಿದರು: ಒಂದು ಗಂಟೆಯಲ್ಲಿ ಬರುತ್ತೆ.', 'maalikaru helidaru: ondu ganteyalli barutte', 'The owner said, it will come in one hour.'],
    ],
    'What is the PG problem?',
    'Water is not coming',
    { newWordCount: 20, readTimeMinutes: 8, imagePath: 'story-pg-problems.svg' },
  ),
]

export function getLevelOneCurriculum(): Curriculum {
  return {
    level: 1,
    title: 'Survival Kannada',
    description: 'Real Bangalore Kannada for greetings, transport, food, and everyday help.',
    phrases: survivalPhrases,
    exercises: lessonExercises,
  }
}

export function getExerciseCoverage(): ExerciseType[] {
  return ['translate', 'arrange', 'fillBlank', 'listening', 'speaking', 'matchPairs', 'typeKannada', 'dialogue']
}

export function getAllLessonExercises(units = allUnits): LessonExercise[] {
  return units.flatMap((unit) => unit.lessons.flatMap((lesson) => lesson.exercises))
}

export function getExercisesForMastery(lesson: CurriculumLesson, masteryLevel: number): LessonExercise[] {
  if (masteryLevel <= 0) {
    return lesson.exercises
  }

  if (masteryLevel === 1) {
    return lesson.exercises.map(reduceToThreeOptions)
  }

  if (masteryLevel === 2) {
    return lesson.exercises.map(addTypingVariant)
  }

  if (masteryLevel === 3) {
    return lesson.exercises.map(addTimedMode)
  }

  const hardTimedExercises = lesson.exercises.map(reduceToThreeOptions).map(addTimedMode)
  const typingChallenges = lesson.exercises
    .filter((exercise) => exercise.type !== 'typeKannada')
    .slice(0, 2)
    .map(addTypingVariant)
    .map(addTimedMode)

  return [...typingChallenges, ...hardTimedExercises.reverse()]
}

export function getScriptCurriculumUnit(): CurriculumUnit {
  return scriptUnit
}

export function getLessonById(lessonId: string): CurriculumLesson | null {
  return allUnits.flatMap((unit) => unit.lessons).find((lesson) => lesson.id === lessonId) ?? null
}

export function getNextAvailableLesson(units: CurriculumUnit[], progress: ProgressState): CurriculumLesson | null {
  const unlockedLessons = units
    .filter((unit) => !unit.optional)
    .flatMap((unit) => unit.lessons)
    .filter((lesson) => isLessonUnlocked(lesson.id, progress))

  const uncompletedLesson = unlockedLessons.find((lesson) => !isLessonCompleted(lesson.id, progress))
  if (uncompletedLesson) {
    return uncompletedLesson
  }

  const lowestMasteryLesson = unlockedLessons
    .filter((lesson) => (progress.lessonProgress[lesson.id]?.masteryLevel ?? 0) < 5)
    .sort((left, right) =>
      (progress.lessonProgress[left.id]?.masteryLevel ?? 0) -
      (progress.lessonProgress[right.id]?.masteryLevel ?? 0),
    )[0]

  if (lowestMasteryLesson) {
    return lowestMasteryLesson
  }

  return unlockedLessons.at(-1) ?? null
}

export function getUnlockedCurriculumUnits(units: CurriculumUnit[], progress: ProgressState): CurriculumUnit[] {
  const coreUnits = units.filter((unit) => !unit.optional)
  const unlockedCoreUnits = coreUnits.filter((_unit, index) => isCoreUnitUnlocked(coreUnits, index, progress))

  return [...unlockedCoreUnits, ...units.filter((unit) => unit.optional)]
}

export function isLessonUnlocked(lessonId: string, progress: ProgressState): boolean {
  const coreUnitIndex = coreCurriculumUnits.findIndex((unit) =>
    unit.lessons.some((lesson) => lesson.id === lessonId),
  )

  if (coreUnitIndex === -1) {
    return Boolean(scriptUnit.lessons.find((lesson) => lesson.id === lessonId))
  }

  if (!isCoreUnitUnlocked(coreCurriculumUnits, coreUnitIndex, progress)) {
    return false
  }

  const unit = coreCurriculumUnits[coreUnitIndex]
  const lessonIndex = unit.lessons.findIndex((lesson) => lesson.id === lessonId)

  if (lessonIndex === 0) {
    return true
  }

  const previousLesson = unit.lessons[lessonIndex - 1]
  return isLessonCompleted(previousLesson.id, progress)
}

function isCoreUnitUnlocked(units: CurriculumUnit[], unitIndex: number, progress: ProgressState): boolean {
  if (unitIndex === 0) {
    return true
  }

  const previousUnit = units[unitIndex - 1]
  return previousUnit.lessons.filter((lesson) => isLessonCompleted(lesson.id, progress)).length >= 3
}

function isLessonCompleted(lessonId: string, progress: ProgressState): boolean {
  return (progress.lessonProgress[lessonId]?.masteryLevel ?? 0) >= 1
}

function reduceToThreeOptions(exercise: LessonExercise): LessonExercise {
  if (!['translate', 'fillBlank', 'listening', 'dialogue'].includes(exercise.type) || exercise.options.length <= 3) {
    return exercise
  }

  const reducedOptions = [
    exercise.answer,
    ...exercise.options.filter((option) => option !== exercise.answer),
  ].slice(0, 3)

  return {
    ...exercise,
    options: reducedOptions,
  }
}

function addTypingVariant(exercise: LessonExercise): LessonExercise {
  if (exercise.type === 'typeKannada') {
    return exercise
  }

  const answer = containsKannada(exercise.answer) ? exercise.answer : exercise.kannada

  return {
    ...exercise,
    id: `${exercise.id}-mastery-type`,
    type: 'typeKannada',
    prompt: 'Type this in Kannada script:',
    answer,
    options: [exercise.transliteration ?? answer],
  }
}

function addTimedMode(exercise: LessonExercise): LessonExercise {
  return {
    ...exercise,
    timeLimitSeconds: 15,
  }
}

function containsKannada(text: string): boolean {
  return /[\u0C80-\u0CFF]/.test(text)
}

export function getStoryLockState(story: Story, progress: ProgressState): { locked: boolean; reason: string } {
  const storyIndex = stories.findIndex((candidate) => candidate.id === story.id)

  if (storyIndex <= 0) {
    return { locked: false, reason: 'Ready' }
  }

  const previousStory = stories[storyIndex - 1]
  const unlocked =
    progress.completedExerciseIds.includes(`story-${previousStory.id}`) ||
    progress.completedStoryIds.includes(previousStory.id) ||
    (progress.unlockedStoryIds ?? []).includes(story.id)
  return {
    locked: !unlocked,
    reason: unlocked ? 'Ready' : `Complete ${previousStory.title} first`,
  }
}

export function transliterateLatinToKannada(value: string): string {
  const trimmedValue = value.trim()
  if (!trimmedValue) {
    return ''
  }

  const exactPhrase = getKnownTransliteration(trimmedValue)
  if (exactPhrase) {
    return syncTerminalPunctuation(trimmedValue, exactPhrase)
  }

  return trimmedValue
    .split(/\s+/)
    .map(transliterateLatinWord)
    .join(' ')
}

function buildCoreUnit(unitSeed: UnitSeed, unitIndex: number): CurriculumUnit {
  return {
    id: unitSeed.id,
    title: unitSeed.title,
    description: unitSeed.description,
    optional: false,
    tips: unitSeed.tips,
    scriptSymbols: [],
    lessons: unitSeed.lessons.map((lessonSeed, lessonIndex) => {
      const unitNumber = unitIndex + 1
      const lessonNumber = lessonIndex + 1
      const lessonId = `${unitSeed.id}-lesson-${lessonNumber}`
      const phrases = lessonSeed.phrases.map((seed, phraseIndex) => ({
        ...seed,
        id: `${lessonId}-phrase-${phraseIndex + 1}`,
        skillTag: lessonSeed.skillTag,
      }))

      return {
        id: lessonId,
        unitId: unitSeed.id,
        title: lessonSeed.title,
        subtitle: lessonSeed.subtitle,
        objective: lessonSeed.objective,
        exercises:
          unitNumber === 1 && lessonNumber === 1
            ? baseSurvivalExercises
            : buildExercisesForLesson(unitNumber, lessonNumber, lessonId, lessonSeed, phrases),
      }
    }),
  }
}

function buildExercisesForLesson(
  unitNumber: number,
  lessonNumber: number,
  lessonId: string,
  lessonSeed: LessonSeed,
  phrases: Phrase[],
): LessonExercise[] {
  const [first, second, third] = phrases
  const typeChoices = makeTypeOptions(first.english)
  const arrangedWords = first.kannada.split(/\s+/).filter(Boolean)
  const fillParts = second.kannada.split(/\s+/).filter(Boolean)
  const fillAnswer = fillParts.at(-1) ?? second.kannada
  const fillPrompt = fillParts.length > 1 ? `${fillParts.slice(0, -1).join(' ')} ___` : '___'
  const matchPairs = phrases.map((phrase) => `${phrase.kannada}=${phrase.english}`).join(';')
  const idPrefix = `${lessonId}-exercise`
  const reviewLesson = /\bReview$/.test(lessonSeed.title)
  const translateExercise =
    lessonNumber % 2 === 0 || reviewLesson
      ? reverseTranslateExercise(idPrefix, first, [first, second, third], lessonSeed.title)
      : exercise(idPrefix, 1, 'translate', `Translate for ${lessonSeed.title}:`, first, first.english, typeChoices, 2)

  const exercises = [
    translateExercise,
    {
      ...exercise(idPrefix, 2, 'arrange', 'Arrange the Kannada sentence:', first, first.kannada, arrangedWords, 3),
      english: first.english,
    },
    {
      ...exercise(idPrefix, 3, 'fillBlank', 'Fill in the missing Kannada word:', second, fillAnswer, [
        fillAnswer,
        first.kannada,
        third.kannada,
        'ಬೇಡ',
      ], 2),
      kannada: fillPrompt,
      english: second.english,
    },
    exercise(idPrefix, 4, 'listening', 'Listen and pick the phrase:', second, second.kannada, [
      second.kannada,
      first.kannada,
      third.kannada,
      'ಧನ್ಯವಾದ',
    ], 3),
    exercise(idPrefix, 5, 'speaking', 'Say this phrase:', third, third.transliteration, ['Record', 'Try Again'], 4),
    {
      ...exercise(idPrefix, 6, 'matchPairs', 'Match each Kannada phrase:', first, matchPairs, [
        ...phrases.map((phrase) => phrase.kannada),
        ...phrases.map((phrase) => phrase.english),
      ], 4),
      kannada: phrases.map((phrase) => phrase.kannada).join(', '),
      vocabularyIds: phrases.map((phrase) => phrase.id),
    },
    exercise(idPrefix, 7, 'typeKannada', 'Type this in Kannada script:', first, first.kannada, [
      first.transliteration,
      second.transliteration,
      third.transliteration,
    ], 4),
    exercise(idPrefix, 8, 'dialogue', 'Choose the best reply in this conversation:', second, second.kannada, [
      second.kannada,
      first.kannada,
      third.kannada,
      unitNumber > 4 || lessonNumber > 3 ? 'ನಂತರ ಹೇಳುತ್ತೇನೆ' : 'ನಮಸ್ಕಾರ',
    ], 3),
  ]

  return reviewLesson ? exercises : exercises.slice(0, 6)
}

function reverseTranslateExercise(
  idPrefix: string,
  phrase: Phrase,
  phrases: Phrase[],
  lessonTitle: string,
): LessonExercise {
  return {
    ...exercise(idPrefix, 1, 'translate', 'Translate to Kannada:', phrase, phrase.kannada, makeReverseTranslateOptions(phrase, phrases), 2),
    direction: 'enToKn',
    english: phrase.english,
    explanation: `${phrase.kannada} means "${phrase.english}" in ${lessonTitle}.`,
  }
}

function exercise(
  idPrefix: string,
  index: number,
  type: ExerciseType,
  prompt: string,
  phrase: Phrase,
  answer: string,
  options: string[],
  xp: number,
): LessonExercise {
  return {
    id: `${idPrefix}-${index}`,
    type,
    prompt,
    kannada: phrase.kannada,
    transliteration: phrase.transliteration,
    english: phrase.english,
    answer,
    options: Array.from(new Set(options)),
    explanation: `${phrase.kannada} means "${phrase.english}" in this lesson context.`,
    skillTag: phrase.skillTag,
    xp,
    vocabularyIds: [phrase.id],
  }
}

function phrase(id: string, kannada: string, english: string, context: string): PhraseSeed {
  return {
    kannada,
    transliteration: id.replace(/-/g, ' '),
    english,
    context,
  }
}

function priceLesson(title: string, subtitle: string, skillTag: string, rows: [string, string, string, string][]): LessonSeed {
  return makeLesson(title, subtitle, `Practice ${subtitle.toLocaleLowerCase()}.`, skillTag, rows)
}

function transportLesson(title: string, subtitle: string, rows: [string, string, string, string][]): LessonSeed {
  return makeLesson(title, subtitle, `Handle ${subtitle.toLocaleLowerCase()} in Bangalore.`, 'transport', rows)
}

function foodLesson(title: string, rows: [string, string, string, string][]): LessonSeed {
  return makeLesson(title, 'Order and respond at food counters', `Use food phrases for ${title}.`, 'food', rows)
}

function shoppingLesson(title: string, rows: [string, string, string, string][]): LessonSeed {
  return makeLesson(title, 'Buy, ask, and bargain', `Use shopping phrases for ${title}.`, 'shopping', rows)
}

function homeLesson(title: string, rows: [string, string, string, string][]): LessonSeed {
  return makeLesson(title, 'Handle PG and home life', `Use home-life phrases for ${title}.`, 'home', rows)
}

function officeLesson(title: string, rows: [string, string, string, string][]): LessonSeed {
  return makeLesson(title, 'Speak at work', `Use workplace phrases for ${title}.`, 'office', rows)
}

function emergencyLesson(title: string, rows: [string, string, string, string][]): LessonSeed {
  return makeLesson(title, 'Speak clearly under pressure', `Use urgent phrases for ${title}.`, 'emergency', rows)
}

function makeLesson(
  title: string,
  subtitle: string,
  objective: string,
  skillTag: string,
  rows: [string, string, string, string][],
): LessonSeed {
  return {
    title,
    subtitle,
    objective,
    skillTag,
    phrases: rows.map(([id, kannada, english, context]) => phrase(id, kannada, english, context)),
  }
}

function makeTypeOptions(answer: string): string[] {
  return [answer, 'Please speak slowly', 'I need help', 'How much is it?']
}

function makeReverseTranslateOptions(answer: Phrase, phrases: Phrase[]): string[] {
  return Array.from(new Set([
    answer.kannada,
    ...phrases.filter((phrase) => phrase.id !== answer.id).map((phrase) => phrase.kannada),
    'ಧನ್ಯವಾದ',
  ])).slice(0, 4)
}

function buildScriptUnit(): CurriculumUnit {
  const scriptSymbols: ScriptSymbol[] = [
    ...[
      ['ಅ', 'a'], ['ಆ', 'aa'], ['ಇ', 'i'], ['ಈ', 'ii'], ['ಉ', 'u'], ['ಊ', 'uu'], ['ಋ', 'ru'],
      ['ಎ', 'e'], ['ಏ', 'ee'], ['ಐ', 'ai'], ['ಒ', 'o'], ['ಓ', 'oo'], ['ಔ', 'au'], ['ಅಂ', 'am'],
    ].map(([kannada, transliteration]) => scriptSymbol('vowel', kannada, transliteration)),
    ...[
      ['ಕ', 'ka'], ['ಖ', 'kha'], ['ಗ', 'ga'], ['ಘ', 'gha'], ['ಙ', 'nga'], ['ಚ', 'cha'], ['ಛ', 'chha'],
      ['ಜ', 'ja'], ['ಝ', 'jha'], ['ಞ', 'nya'], ['ಟ', 'ta'], ['ಠ', 'tha'], ['ಡ', 'da'], ['ಢ', 'dha'],
      ['ಣ', 'na'], ['ತ', 'ta'], ['ಥ', 'tha'], ['ದ', 'da'], ['ಧ', 'dha'], ['ನ', 'na'], ['ಪ', 'pa'],
      ['ಫ', 'pha'], ['ಬ', 'ba'], ['ಭ', 'bha'], ['ಮ', 'ma'], ['ಯ', 'ya'], ['ರ', 'ra'], ['ಲ', 'la'],
      ['ವ', 'va'], ['ಶ', 'sha'], ['ಷ', 'ssa'], ['ಸ', 'sa'], ['ಹ', 'ha'], ['ಳ', 'la'],
    ].map(([kannada, transliteration]) => scriptSymbol('consonant', kannada, transliteration)),
    ...[
      ['ಕಾ', 'kaa'], ['ಕಿ', 'ki'], ['ಕೀ', 'kii'], ['ಕು', 'ku'], ['ಕೂ', 'kuu'], ['ಕೆ', 'ke'], ['ಕೈ', 'kai'],
      ['ಕೊ', 'ko'], ['ಕೌ', 'kau'],
    ].map(([kannada, transliteration]) => scriptSymbol('combination', kannada, transliteration)),
  ]
  const vowels = scriptSymbols.filter((symbol) => symbol.kind === 'vowel')
  const consonants = scriptSymbols.filter((symbol) => symbol.kind === 'consonant')
  const vowelSigns = scriptSymbols.filter((symbol) => symbol.kind === 'combination')
  const readingPracticeSymbols = [
    ['ಕನ್ನಡ', 'kannada'], ['ನಮಸ್ಕಾರ', 'namaskara'], ['ಸಾರ್', 'saar'], ['ಟಿಕೆಟ್', 'ticket'], ['ನೀರು', 'neeru'], ['ಧನ್ಯವಾದ', 'dhanyavada'], ['ಹೋಗಬೇಕು', 'hogbeku'], ['ಬೇಡ', 'beda'],
  ].map(([kannada, transliteration]) => scriptSymbol('combination', kannada, transliteration))
  const lessons: CurriculumLesson[] = [
    scriptLesson('script-vowels-1', 'Vowels Part 1', vowels.slice(0, 6)),
    scriptLesson('script-vowels-2', 'Vowels Part 2', vowels.slice(6)),
    scriptLesson('script-velars', 'Consonants: Velars', consonants.slice(0, 5)),
    scriptLesson('script-palatals', 'Consonants: Palatals', consonants.slice(5, 10)),
    scriptLesson('script-retroflexes', 'Consonants: Retroflexes', consonants.slice(10, 15)),
    scriptLesson('script-dentals', 'Consonants: Dentals', consonants.slice(15, 20)),
    scriptLesson('script-labials-others', 'Consonants: Labials + Others', consonants.slice(20)),
    scriptLesson('script-vowel-signs', 'Vowel Signs', vowelSigns),
    scriptLesson('script-reading-practice', 'Reading Practice', readingPracticeSymbols),
  ]

  return {
    id: 'unit-script',
    title: 'Kannada Script',
    description: 'Optional alphabet track for learners who want to read Kannada script.',
    optional: true,
    tips: [
      {
        title: 'Sound before handwriting',
        body: 'Recognize the sound and shape first. Tracing can come after the letter feels familiar.',
        examples: ['ಅ = a', 'ಕ = ka'],
      },
      {
        title: 'Vowel signs attach',
        body: 'Consonants combine with vowel marks, so ಕ plus the i sign becomes ಕಿ.',
        examples: ['ಕ + ಿ = ಕಿ', 'ಕ + ೀ = ಕೀ'],
      },
    ],
    lessons,
    scriptSymbols,
  }
}

function scriptSymbol(kind: ScriptSymbol['kind'], kannada: string, transliteration: string): ScriptSymbol {
  return {
    id: `script-${transliteration}-${kind}`,
    kind,
    kannada,
    transliteration,
    soundHint: `Sounds like ${transliteration}`,
  }
}

function buildScriptExercisesForLesson(lessonId: string, title: string, symbols: ScriptSymbol[]): LessonExercise[] {
  if (title === 'Reading Practice') {
    return symbols.slice(0, 8).map((symbol, index) =>
      scriptExercise({
        lessonId,
        index: index + 1,
        type: 'translate',
        prompt: 'Sound out this word:',
        symbol,
        answer: symbol.transliteration,
        options: makeScriptSoundOptions(symbol, symbols),
        xp: 2,
      }),
    )
  }

  const targetCount = title === 'Consonants: Labials + Others' || title === 'Vowel Signs' ? 10 : 8
  const exercises: LessonExercise[] = [
    scriptExercise({
      lessonId,
      index: 1,
      type: 'translate',
      prompt: `Which letter makes the "${symbols[0].transliteration}" sound?`,
      symbol: symbols[0],
      answer: symbols[0].kannada,
      options: makeScriptLetterOptions(symbols[0], symbols),
      xp: 2,
    }),
    scriptExercise({
      lessonId,
      index: 2,
      type: 'listening',
      prompt: 'Which letter did you hear?',
      symbol: symbols[1] ?? symbols[0],
      answer: (symbols[1] ?? symbols[0]).kannada,
      options: makeScriptLetterOptions(symbols[1] ?? symbols[0], symbols),
      xp: 3,
    }),
    scriptExercise({
      lessonId,
      index: 3,
      type: 'matchPairs',
      prompt: 'Match script to sound:',
      symbol: symbols[0],
      answer: makeScriptMatchPairs(symbols.slice(0, 4)),
      options: makeScriptMatchOptions(symbols.slice(0, 4)),
      xp: 4,
    }),
    scriptExercise({
      lessonId,
      index: 4,
      type: 'typeKannada',
      prompt: 'Type the transliteration:',
      symbol: symbols[0],
      answer: symbols[0].transliteration,
      options: makeScriptSoundOptions(symbols[0], symbols),
      xp: 3,
    }),
    scriptExercise({
      lessonId,
      index: 5,
      type: 'translate',
      prompt: `Which letter makes the "${(symbols[2] ?? symbols[0]).transliteration}" sound?`,
      symbol: symbols[2] ?? symbols[0],
      answer: (symbols[2] ?? symbols[0]).kannada,
      options: makeScriptLetterOptions(symbols[2] ?? symbols[0], symbols),
      xp: 2,
    }),
    scriptExercise({
      lessonId,
      index: 6,
      type: 'listening',
      prompt: 'Which letter did you hear?',
      symbol: symbols[3] ?? symbols[0],
      answer: (symbols[3] ?? symbols[0]).kannada,
      options: makeScriptLetterOptions(symbols[3] ?? symbols[0], symbols),
      xp: 3,
    }),
    scriptExercise({
      lessonId,
      index: 7,
      type: 'typeKannada',
      prompt: 'Type the transliteration:',
      symbol: symbols[1] ?? symbols[0],
      answer: (symbols[1] ?? symbols[0]).transliteration,
      options: makeScriptSoundOptions(symbols[1] ?? symbols[0], symbols),
      xp: 3,
    }),
    scriptExercise({
      lessonId,
      index: 8,
      type: 'matchPairs',
      prompt: 'Match script to sound:',
      symbol: symbols[0],
      answer: makeScriptMatchPairs(symbols.slice(2, 6)),
      options: makeScriptMatchOptions(symbols.slice(2, 6)),
      xp: 4,
    }),
  ]

  for (let index = exercises.length; index < targetCount; index += 1) {
    const symbol = symbols[index % symbols.length]
    exercises.push(scriptExercise({
      lessonId,
      index: index + 1,
      type: index % 2 === 0 ? 'translate' : 'listening',
      prompt: index % 2 === 0 ? `Which letter makes the "${symbol.transliteration}" sound?` : 'Which letter did you hear?',
      symbol,
      answer: symbol.kannada,
      options: makeScriptLetterOptions(symbol, symbols),
      xp: 2,
    }))
  }

  return exercises
}

function scriptExercise({
  lessonId,
  index,
  type,
  prompt,
  symbol,
  answer,
  options,
  xp,
}: {
  lessonId: string
  index: number
  type: ExerciseType
  prompt: string
  symbol: ScriptSymbol
  answer: string
  options: string[]
  xp: number
}): LessonExercise {
  return {
    id: `${lessonId}-script-${index}`,
    type,
    prompt,
    kannada: symbol.kannada,
    transliteration: symbol.transliteration,
    english: symbol.soundHint,
    answer,
    options: Array.from(new Set(options)),
    explanation: `${symbol.kannada} is read as "${symbol.transliteration}".`,
    skillTag: 'script',
    xp,
    vocabularyIds: [symbol.id],
  }
}

function makeScriptLetterOptions(answer: ScriptSymbol, symbols: ScriptSymbol[]): string[] {
  return Array.from(new Set([answer.kannada, ...symbols.map((symbol) => symbol.kannada)].filter(Boolean))).slice(0, 4)
}

function makeScriptSoundOptions(answer: ScriptSymbol, symbols: ScriptSymbol[]): string[] {
  return Array.from(new Set([answer.transliteration, ...symbols.map((symbol) => symbol.transliteration)].filter(Boolean))).slice(0, 4)
}

function makeScriptMatchPairs(symbols: ScriptSymbol[]): string {
  return symbols.map((symbol) => `${symbol.kannada}=${symbol.transliteration}`).join(';')
}

function makeScriptMatchOptions(symbols: ScriptSymbol[]): string[] {
  return [
    ...symbols.map((symbol) => symbol.kannada),
    ...symbols.map((symbol) => symbol.transliteration),
  ]
}

function scriptLesson(id: string, title: string, symbols: ScriptSymbol[]): CurriculumLesson {
  return {
    id,
    unitId: 'unit-script',
    title,
    subtitle: 'Read the shape and sound',
    objective: `Recognize ${title.toLocaleLowerCase()}.`,
    exercises: buildScriptExercisesForLesson(id, title, symbols),
  }
}

function makeStory(
  id: string,
  title: string,
  subtitle: string,
  difficulty: Story['difficulty'],
  sentenceRows: [string, string, string][],
  quizPrompt: string,
  quizAnswer: string,
  metadata: Partial<Pick<Story, 'newWordCount' | 'readTimeMinutes' | 'imagePath'>> = {},
): Story {
  return {
    id,
    title,
    subtitle,
    difficulty,
    readTimeMinutes: metadata.readTimeMinutes ?? (difficulty === 'Advanced' ? 8 : difficulty === 'Intermediate' ? 7 : 5),
    newWordCount: metadata.newWordCount ?? sentenceRows.length * 4,
    locked: id !== 'first-day-bangalore',
    imagePath: metadata.imagePath ?? 'story-bus-stop.svg',
    sentences: sentenceRows.map(([kannada, transliteration, english], index) => ({
      id: `${id}-${index + 1}`,
      kannada,
      transliteration,
      english,
      words: makeStoryWords(kannada, transliteration, english),
    })),
    quiz: {
      prompt: quizPrompt,
      answer: quizAnswer,
      options: Array.from(new Set([
        quizAnswer,
        'Did you eat?',
        'The price is high',
        'He needs help',
        'He needs to go to Majestic',
      ])).slice(0, 4),
      explanation: `${title} answers this through the story dialogue.`,
    },
  }
}

function makeStoryWords(kannada: string, transliteration: string, english: string): Story['sentences'][number]['words'] {
  return kannada
    .replace(/[?.:,]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4)
    .map((word, index) => ({
      text: word,
      transliteration: transliteration.split(/\s+/)[index] ?? transliteration,
      english: storyWordGlosses[word] ?? (english.split(/\s+/).slice(index, index + 2).join(' ') || english),
      note: index === 0 ? 'Tap words to build story vocabulary.' : 'Story word in context.',
    }))
}

let transliterationLookup: Map<string, string> | null = null

const transliterationDictionary: Record<string, string> = {
  namaskara: 'ನಮಸ್ಕಾರ',
  saar: 'ಸಾರ್',
  ticket: 'ಟಿಕೆಟ್',
  eshtu: 'ಎಷ್ಟು',
  nanage: 'ನನಗೆ',
  neeru: 'ನೀರು',
  beku: 'ಬೇಕು',
  beda: 'ಬೇಡ',
  hogbeku: 'ಹೋಗಬೇಕು',
  dhanyavada: 'ಧನ್ಯವಾದ',
  swalpa: 'ಸ್ವಲ್ಪ',
  kannada: 'ಕನ್ನಡ',
  baruttade: 'ಬರುತ್ತದೆ',
  oota: 'ಊಟ',
  aayta: 'ಆಯ್ತಾ',
  illi: 'ಇಲ್ಲಿ',
  nillisi: 'ನಿಲ್ಲಿಸಿ',
}

const independentVowels: Record<string, string> = {
  aa: 'ಆ',
  A: 'ಆ',
  ii: 'ಈ',
  I: 'ಈ',
  uu: 'ಊ',
  U: 'ಊ',
  ee: 'ಏ',
  E: 'ಏ',
  ai: 'ಐ',
  oo: 'ಓ',
  O: 'ಓ',
  au: 'ಔ',
  a: 'ಅ',
  i: 'ಇ',
  u: 'ಉ',
  e: 'ಎ',
  o: 'ಒ',
}

const dependentVowels: Record<string, string> = {
  aa: 'ಾ',
  A: 'ಾ',
  ii: 'ೀ',
  I: 'ೀ',
  uu: 'ೂ',
  U: 'ೂ',
  ee: 'ೇ',
  E: 'ೇ',
  ai: 'ೈ',
  oo: 'ೋ',
  O: 'ೋ',
  au: 'ೌ',
  a: '',
  i: 'ಿ',
  u: 'ು',
  e: 'ೆ',
  o: 'ೊ',
}

const consonants: Record<string, string> = {
  chha: 'ಛ',
  kha: 'ಖ',
  gha: 'ಘ',
  nga: 'ಙ',
  cha: 'ಚ',
  jha: 'ಝ',
  nya: 'ಞ',
  Tha: 'ಠ',
  Dha: 'ಢ',
  bha: 'ಭ',
  pha: 'ಫ',
  sha: 'ಶ',
  Sha: 'ಷ',
  ka: 'ಕ',
  ga: 'ಗ',
  ja: 'ಜ',
  Ta: 'ಟ',
  Da: 'ಡ',
  Na: 'ಣ',
  ta: 'ತ',
  tha: 'ಥ',
  da: 'ದ',
  dha: 'ಧ',
  na: 'ನ',
  pa: 'ಪ',
  ba: 'ಬ',
  ma: 'ಮ',
  ya: 'ಯ',
  ra: 'ರ',
  la: 'ಲ',
  va: 'ವ',
  wa: 'ವ',
  sa: 'ಸ',
  ha: 'ಹ',
  La: 'ಳ',
  kh: 'ಖ',
  gh: 'ಘ',
  ng: 'ಙ',
  chh: 'ಛ',
  ch: 'ಚ',
  jh: 'ಝ',
  ny: 'ಞ',
  Th: 'ಠ',
  Dh: 'ಢ',
  th: 'ಥ',
  dh: 'ಧ',
  ph: 'ಫ',
  bh: 'ಭ',
  sh: 'ಶ',
  k: 'ಕ',
  g: 'ಗ',
  c: 'ಚ',
  j: 'ಜ',
  T: 'ಟ',
  D: 'ಡ',
  N: 'ಣ',
  t: 'ತ',
  d: 'ದ',
  n: 'ನ',
  p: 'ಪ',
  b: 'ಬ',
  m: 'ಮ',
  y: 'ಯ',
  r: 'ರ',
  l: 'ಲ',
  v: 'ವ',
  w: 'ವ',
  S: 'ಷ',
  s: 'ಸ',
  h: 'ಹ',
  L: 'ಳ',
}

const consonantTokens = Object.keys(consonants)
  .filter((token) => !(token.endsWith('a') && consonants[token.slice(0, -1)] === consonants[token]))
  .sort((left, right) => right.length - left.length)
const vowelTokens = Object.keys(independentVowels).sort((left, right) => right.length - left.length)

function transliterateLatinWord(rawWord: string): string {
  const parts = rawWord.match(/^([^A-Za-z]*)([A-Za-z][A-Za-z-]*)([^A-Za-z]*)$/)
  if (!parts) {
    return rawWord
  }

  const [, prefix, latinWord, suffix] = parts
  const knownWord = getKnownTransliteration(latinWord)
  const transliterated = knownWord ?? transliterateLatinTokenByRules(latinWord)

  return `${prefix}${transliterated}${suffix}`
}

function transliterateLatinTokenByRules(word: string): string {
  let output = ''
  let index = 0

  while (index < word.length) {
    if (word[index] === '-') {
      output += '-'
      index += 1
      continue
    }

    const consonantToken = findTokenAt(word, index, consonantTokens)
    if (consonantToken) {
      index += consonantToken.length
      const vowelToken = findTokenAt(word, index, vowelTokens)
      output += consonants[consonantToken]

      if (vowelToken) {
        output += dependentVowels[vowelToken]
        index += vowelToken.length
      }

      continue
    }

    const vowelToken = findTokenAt(word, index, vowelTokens)
    if (vowelToken) {
      output += independentVowels[vowelToken]
      index += vowelToken.length
      continue
    }

    output += word[index]
    index += 1
  }

  return output
}

function findTokenAt(value: string, index: number, tokens: string[]): string | null {
  return tokens.find((token) => value.startsWith(token, index)) ?? null
}

function getKnownTransliteration(value: string): string | null {
  const key = normalizeTransliterationLookupKey(value)
  if (!key) {
    return null
  }

  return getTransliterationLookup().get(key) ?? transliterationDictionary[key] ?? null
}

function getTransliterationLookup(): Map<string, string> {
  if (transliterationLookup) {
    return transliterationLookup
  }

  const lookup = new Map<string, string>()

  for (const phrase of survivalPhrases) {
    addTransliterationPair(lookup, phrase.transliteration, phrase.kannada)
  }

  for (const unit of allUnits) {
    for (const lesson of unit.lessons) {
      for (const exercise of lesson.exercises) {
        if (exercise.transliteration && exercise.skillTag !== 'script') {
          addTransliterationPair(lookup, exercise.transliteration, exercise.kannada)
        }

        if (
          exercise.skillTag !== 'script' &&
          containsKannada(exercise.answer) &&
          exercise.options.length === 1 &&
          !containsKannada(exercise.options[0])
        ) {
          addTransliterationPair(lookup, exercise.options[0], exercise.answer)
        }
      }
    }
  }

  transliterationLookup = lookup
  return lookup
}

function addTransliterationPair(lookup: Map<string, string>, latin: string, kannada: string) {
  const normalizedLatin = normalizeTransliterationLookupKey(latin)
  if (!normalizedLatin || !containsKannada(kannada)) {
    return
  }

  if (!lookup.has(normalizedLatin)) {
    lookup.set(normalizedLatin, normalizeKannadaTransliterationOutput(kannada))
  }

  const latinWords = normalizedLatin.split(/\s+/).filter(Boolean)
  const kannadaWords = normalizeKannadaTransliterationOutput(kannada)
    .replace(/[?!.,:;]/g, '')
    .split(/\s+/)
    .filter(Boolean)

  if (latinWords.length !== kannadaWords.length) {
    return
  }

  latinWords.forEach((latinWord, index) => {
    if (!lookup.has(latinWord)) {
      lookup.set(latinWord, kannadaWords[index])
    }
  })
}

function normalizeTransliterationLookupKey(value: string): string {
  return value
    .normalize('NFC')
    .trim()
    .replace(/[?!.,:;"'“”‘’]/g, '')
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase()
}

function normalizeKannadaTransliterationOutput(value: string): string {
  return value.normalize('NFC').trim().replace(/\s+/g, ' ')
}

function syncTerminalPunctuation(input: string, kannada: string): string {
  const inputTerminal = input.trim().match(/[?!.,:;]+$/)?.[0]
  const withoutKannadaTerminal = kannada.replace(/[?!.,:;]+$/g, '')

  return inputTerminal ? `${withoutKannadaTerminal}${inputTerminal}` : withoutKannadaTerminal
}
