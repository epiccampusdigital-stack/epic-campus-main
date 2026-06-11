export type QuizGoal = 'work' | 'study' | 'both' | 'certificate'
export type QuizEducation = 'ol' | 'al' | 'diploma' | 'working'
export type QuizTimeline = '6months' | '1year' | 'planning' | 'learn'
export type QuizEnglish = 'basic' | 'okay' | 'good' | 'excellent'

export type RecommendedPath = 'japan-ssw' | 'korea' | 'china' | 'ielts'

export interface QuizAnswers {
  goal?: QuizGoal
  education?: QuizEducation
  timeline?: QuizTimeline
  english?: QuizEnglish
}

export interface DestinationRecommendation {
  path: RecommendedPath
  headline: string
  reason: string
  flag: string
  timeline: string
  bullets: string[]
  courseId: 'japan-ssw' | 'korea-d2d4' | 'china' | 'ielts'
}

const RECOMMENDATIONS: Record<RecommendedPath, Omit<DestinationRecommendation, 'path' | 'courseId'> & { courseId: DestinationRecommendation['courseId'] }> = {
  'japan-ssw': {
    headline: 'Japan SSW is your best path!',
    reason: 'No degree needed. Earn ¥200,000+ per month. Go within 6-12 months.',
    flag: '🇯🇵',
    timeline: 'You could be on your way in 6-12 months',
    bullets: [
      'Specified Skilled Worker visa — no university degree required',
      'High demand in trucking, construction, and caregiving',
      'Epic Campus trains you in Japanese and prepares your visa documents',
    ],
    courseId: 'japan-ssw',
  },
  korea: {
    headline: 'Study in Korea is perfect for you!',
    reason: 'Scholarships available, world-class universities, great career future.',
    flag: '🇰🇷',
    timeline: 'You could start within 8-12 months',
    bullets: [
      'Scholarship opportunities for qualified A/L students',
      'Strong programs in engineering, business, and the arts',
      'Build language skills and a global career in East Asia',
    ],
    courseId: 'korea-d2d4',
  },
  china: {
    headline: 'China is your ideal study destination!',
    reason: 'Full scholarships available, affordable living, no English barrier.',
    flag: '🇨🇳',
    timeline: 'You could start within 6-10 months',
    bullets: [
      'Full and partial scholarships for international students',
      'Medicine, IT, and business programs at top universities',
      'Affordable living costs compared to Western countries',
    ],
    courseId: 'china',
  },
  ielts: {
    headline: 'Start with IELTS — then the world is yours!',
    reason: 'Boost your English first, then apply to any country with confidence.',
    flag: '📚',
    timeline: '3 months IELTS + then your chosen country',
    bullets: [
      'Intensive residential program targeting band 6.0–7.0+',
      'Strong English opens doors to Korea, UK, Australia, and more',
      'Expert trainers with proven results at Epic Campus',
    ],
    courseId: 'ielts',
  },
}

export function getRecommendation(answers: QuizAnswers): DestinationRecommendation {
  const { goal, education, timeline, english } = answers
  const fastTimeline = timeline === '6months' || timeline === '1year'
  const workGoal = goal === 'work' || goal === 'certificate'
  const studyGoal = goal === 'study'
  const bothGoal = goal === 'both'

  let path: RecommendedPath = 'ielts'

  // Study + O/Ls + basic English → China (no English barrier needed)
  if ((studyGoal || bothGoal) && education === 'ol' && english === 'basic') {
    path = 'china'
  }
  // Work goal + fast timeline → Japan SSW
  else if ((workGoal || bothGoal) && fastTimeline && english !== 'basic') {
    path = 'japan-ssw'
  }
  else if (workGoal && fastTimeline) {
    path = 'japan-ssw'
  }
  // Study + A/Ls + okay/good English → Korea
  else if ((studyGoal || bothGoal) && education === 'al' && (english === 'okay' || english === 'good' || english === 'excellent')) {
    path = 'korea'
  }
  // English is the primary concern → IELTS first
  else if (english === 'basic' || english === 'okay') {
    path = 'ielts'
  }
  // Study-oriented fallbacks
  else if (studyGoal || bothGoal) {
    path = education === 'ol' ? 'china' : 'korea'
  }
  // Work-oriented fallback
  else if (workGoal) {
    path = 'japan-ssw'
  }

  const base = RECOMMENDATIONS[path]
  return { path, ...base }
}

export function getRecommendedPathLabel(path: RecommendedPath | string): string {
  switch (path) {
    case 'japan-ssw':
      return 'Japan SSW'
    case 'korea':
      return 'Korea'
    case 'china':
      return 'China'
    case 'ielts':
      return 'IELTS'
    default:
      return String(path)
  }
}
