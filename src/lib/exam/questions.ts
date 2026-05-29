import type {
  ExamPaper,
  ListeningQuestion,
  ReadingQuestion,
  SpeakingPrompt,
  WritingTask,
} from '@/types'

export const EXAM_PAPERS: ExamPaper[] = [
  {
    id: 'j-001',
    code: 'J-001',
    title: 'Irodori Starter (A1)',
    level: 'A1',
    description: 'Hiragana/Katakana level — basic reading, listening, and everyday Japanese.',
    status: 'active',
    readingCount: 5,
    listeningCount: 5,
    readingMinutes: 60,
    listeningMinutes: 30,
    writingMinutes: 45,
    speakingMinutes: 15,
  },
  {
    id: 'j-002',
    code: 'J-002',
    title: 'Irodori Elementary 1 (A2)',
    level: 'A2',
    description: 'Elementary Japanese for daily life and workplace basics.',
    status: 'active',
    readingCount: 40,
    listeningCount: 40,
    readingMinutes: 60,
    listeningMinutes: 30,
    writingMinutes: 45,
    speakingMinutes: 15,
  },
  {
    id: 'j-003',
    code: 'J-003',
    title: 'Irodori Elementary 2 (A2-B1)',
    level: 'A2-B1',
    description: 'Bridge from elementary to pre-intermediate communication.',
    status: 'active',
    readingCount: 40,
    listeningCount: 40,
    readingMinutes: 60,
    listeningMinutes: 30,
    writingMinutes: 45,
    speakingMinutes: 15,
  },
  {
    id: 'j-004',
    code: 'J-004',
    title: 'Irodori Pre-intermediate (B1)',
    level: 'B1',
    description: 'Pre-intermediate Irodori — longer texts and complex tasks.',
    status: 'active',
    readingCount: 40,
    listeningCount: 40,
    readingMinutes: 60,
    listeningMinutes: 30,
    writingMinutes: 45,
    speakingMinutes: 15,
  },
  {
    id: 'j-005',
    code: 'J-005',
    title: 'JLPT N5 Practice',
    level: 'A2',
    description: 'JLPT N5 format practice paper for Japan-bound students.',
    status: 'active',
    readingCount: 40,
    listeningCount: 40,
    readingMinutes: 60,
    listeningMinutes: 30,
    writingMinutes: 45,
    speakingMinutes: 15,
  },
  {
    id: 'j-006',
    code: 'J-006',
    title: 'JLPT N4 Practice',
    level: 'B1',
    description: 'JLPT N4 format practice paper with kanji and grammar focus.',
    status: 'active',
    readingCount: 40,
    listeningCount: 40,
    readingMinutes: 60,
    listeningMinutes: 30,
    writingMinutes: 45,
    speakingMinutes: 15,
  },
]

export const SAMPLE_READING_QUESTIONS: Omit<ReadingQuestion, 'id'>[] = [
  {
    questionNumber: 1,
    passageText: 'えきの　まえに　コンビニが　あります。',
    questionText: 'Where is the convenience store?',
    options: ['Near the station', 'Near the school', 'Near the hospital', 'Near the park'],
    correctAnswer: 'A',
    explanation: "えきの まえに means 'in front of the station'",
  },
  {
    questionNumber: 2,
    passageText: 'きょうは　月曜日です。あしたは　火曜日です。',
    questionText: 'What day is tomorrow?',
    options: ['Monday', 'Tuesday', 'Wednesday', 'Thursday'],
    correctAnswer: 'B',
    explanation: "あした means 'tomorrow', 火曜日 means Tuesday",
  },
  {
    questionNumber: 3,
    passageText: 'わたしは　まいあさ　6じに　おきます。',
    questionText: 'What time does the person wake up?',
    options: ['5:00 AM', '6:00 AM', '7:00 AM', '8:00 AM'],
    correctAnswer: 'B',
    explanation: '6じ means 6 o clock',
  },
  {
    questionNumber: 4,
    passageText: 'スーパーで　りんごを　3つ　かいました。',
    questionText: 'How many apples were bought?',
    options: ['1', '2', '3', '4'],
    correctAnswer: 'C',
    explanation: '3つ means three (counting objects)',
  },
  {
    questionNumber: 5,
    passageText: 'でんしゃは　9じ15ふんに　でます。',
    questionText: 'When does the train depart?',
    options: ['9:05', '9:15', '9:25', '9:50'],
    correctAnswer: 'B',
    explanation: '9じ15ふん means 9:15',
  },
]

export const SAMPLE_LISTENING_QUESTIONS: Omit<ListeningQuestion, 'id'>[] = [
  {
    questionNumber: 1,
    questionText: 'What does the woman want to buy?',
    options: ['A book', 'A pen', 'A bag', 'A phone'],
    correctAnswer: 'C',
    audioUrl: null,
  },
  {
    questionNumber: 2,
    questionText: 'Where are they meeting?',
    options: ['At school', 'At the station', 'At home', 'At the park'],
    correctAnswer: 'B',
    audioUrl: null,
  },
  {
    questionNumber: 3,
    questionText: 'What time is the meeting?',
    options: ['2:00', '2:30', '3:00', '3:30'],
    correctAnswer: 'C',
    audioUrl: null,
  },
  {
    questionNumber: 4,
    questionText: 'How will they get there?',
    options: ['By bus', 'By train', 'By car', 'On foot'],
    correctAnswer: 'B',
    audioUrl: null,
  },
  {
    questionNumber: 5,
    questionText: 'What is the weather like?',
    options: ['Sunny', 'Rainy', 'Cloudy', 'Snowy'],
    correctAnswer: 'A',
    audioUrl: null,
  },
]

export const SAMPLE_WRITING_TASKS: Omit<WritingTask, 'id'>[] = [
  {
    taskNumber: 1,
    prompt:
      'あなたの　ともだちに　メールを　書いてください。あしたの　かいぎの　じかんと　ばしょを　伝えてください。(Write a short message to your friend about tomorrow meeting time and place.)',
    minWords: 50,
    timeMinutes: 45,
  },
  {
    taskNumber: 2,
    prompt:
      '「わたしの　しゅうまつ」について　150字以上で　書いてください。何を　しますか。だれと　いきますか。(Write about your weekend in 150+ characters.)',
    minWords: 150,
    timeMinutes: 45,
  },
]

export const SAMPLE_SPEAKING_PROMPTS: Omit<SpeakingPrompt, 'id'>[] = [
  {
    partNumber: 1,
    prompt: '自己紹介を　してください。名前、国、仕事を　言ってください。(Introduce yourself: name, country, job.)',
    prepTime: 0,
    timeLimit: 60,
  },
  {
    partNumber: 2,
    prompt:
      'この　写真を　見て　説明してください。どこですか。何を　していますか。(Describe the photo — where and what people are doing.)',
    prepTime: 60,
    timeLimit: 60,
  },
  {
    partNumber: 3,
    prompt: '日本に　行きたい　理由を　話してください。(Explain why you want to go to Japan.)',
    prepTime: 0,
    timeLimit: 60,
  },
]

export function getPaperById(paperId: string): ExamPaper | undefined {
  return EXAM_PAPERS.find((p) => p.id === paperId)
}

export function withIds<T extends { questionNumber?: number; taskNumber?: number; partNumber?: number }>(
  items: T[],
  prefix: string,
): (T & { id: string })[] {
  return items.map((item, i) => ({
    ...item,
    id: `${prefix}-${item.questionNumber ?? item.taskNumber ?? item.partNumber ?? i + 1}`,
  }))
}
