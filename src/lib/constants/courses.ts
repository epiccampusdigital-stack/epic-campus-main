export const COURSES = [
  { id: 'japan-ssw',        label: 'Japan SSW (Japanese Language)',  flag: '🇯🇵' },
  { id: 'korea-d2d4',       label: 'Korea D2/D4 (Korean Language)',  flag: '🇰🇷' },
  { id: 'china',            label: 'China Program',                  flag: '🇨🇳' },
  { id: 'ielts',            label: 'IELTS Residential',              flag: '🇬🇧' },
  { id: 'nvq-it',           label: 'NVQ — Information Technology',   flag: '💻' },
  { id: 'nvq-hospitality',  label: 'NVQ — Hospitality',              flag: '🏨' },
  { id: 'nvq-caregiving',   label: 'NVQ — Caregiving',               flag: '🏥' },
  { id: 'nvq-construction', label: 'NVQ — Construction',             flag: '🏗️' },
  { id: 'nvq-logistics',    label: 'NVQ — Logistics & Driving',      flag: '🚛' },
] as const

export const COURSE_MAP = Object.fromEntries(COURSES.map(c => [c.id, c]))
