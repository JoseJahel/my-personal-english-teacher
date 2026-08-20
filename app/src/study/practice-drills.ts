import type { TransformarPracticeItem } from './study-types'

type DrillRow = readonly [string, string, string, string, readonly string[] | undefined]

function drillsFrom(rows: readonly DrillRow[]): TransformarPracticeItem[] {
  return rows.map((row, index) => {
    const [tema, prompt, stimulus, answer, options] = row
    const item: TransformarPracticeItem = {
      id: `${tema}-tr-${index + 1}`,
      tema,
      kind: 'transformar',
      prompt,
      stimulus,
      answer,
    }
    return options ? { ...item, options } : item
  })
}

const CONTRACTION = 'Contracción'
const QUESTION = 'Pregunta'
const NEGATIVE = 'Negación'

export const TRANSFORM_DRILLS: readonly TransformarPracticeItem[] = drillsFrom([
  [
    'besingular',
    CONTRACTION,
    'I am Helen.',
    "I'm Helen.",
    ["I'm Helen.", 'I am Helen.', "I's Helen."],
  ],
  [
    'besingular',
    CONTRACTION,
    'You are Tom.',
    "You're Tom.",
    ["You're Tom.", 'You are Tom.', "You's Tom."],
  ],
  [
    'besingular',
    CONTRACTION,
    'I am not Ellen.',
    "I'm not Ellen.",
    ["I'm not Ellen.", 'I am not Ellen.', "I isn't Ellen."],
  ],
  [
    'besingular',
    CONTRACTION,
    'You are not Dom.',
    "You aren't Dom.",
    ["You aren't Dom.", 'You are not Dom.', "You isn't Dom."],
  ],
  [
    'besingular',
    QUESTION,
    "You're Tom.",
    'Are you Tom?',
    ['Are you Tom?', 'You are Tom?', 'Is you Tom?'],
  ],
  [
    'besingular',
    QUESTION,
    "I'm in class 2.",
    'Am I in class 2?',
    ['Am I in class 2?', 'Are I in class 2?', 'I am in class 2?'],
  ],
  [
    'beplural',
    CONTRACTION,
    'We are American.',
    "We're American.",
    ["We're American.", 'We are American.', "We's American."],
  ],
  [
    'beplural',
    CONTRACTION,
    'They are German.',
    "They're German.",
    ["They're German.", 'They are German.', "They's German."],
  ],
  [
    'beplural',
    CONTRACTION,
    'We are not American.',
    "We aren't American.",
    ["We aren't American.", 'We are not American.', "We isn't American."],
  ],
  [
    'beplural',
    QUESTION,
    "They're from Russia.",
    'Are they from Russia?',
    ['Are they from Russia?', 'They are from Russia?', 'Is they from Russia?'],
  ],
  [
    'beplural',
    QUESTION,
    'You are American.',
    'Are you American?',
    ['Are you American?', 'You are American?', 'Is you American?'],
  ],
  [
    'nouns',
    'Demostrativo',
    'cerca + singular',
    'this',
    ['this', 'that', 'these', 'those'],
  ],
  [
    'nouns',
    'Demostrativo',
    'lejos + plural',
    'those',
    ['those', 'this', 'these', 'that'],
  ],
  [
    'nouns',
    'Artículo',
    'umbrella (singular)',
    'an umbrella',
    ['an umbrella', 'a umbrella', 'the umbrellas'],
  ],
  ['nouns', 'Plural', 'a bag', 'bags', ['bags', 'bag', 'bagges']],
  ['nouns', 'Plural', 'a country', 'countries', ['countries', 'countrys', 'countryes']],
  [
    'presentsimple',
    NEGATIVE,
    'I have coffee for breakfast.',
    "I don't have coffee for breakfast.",
    [
      "I don't have coffee for breakfast.",
      'I not have coffee for breakfast.',
      "I doesn't have coffee for breakfast.",
    ],
  ],
  [
    'presentsimple',
    QUESTION,
    'You live here.',
    'Do you live here?',
    ['Do you live here?', 'Live you here?', 'You live here?'],
  ],
  [
    'presentsimple',
    QUESTION,
    'They like children.',
    'Do they like children?',
    ['Do they like children?', 'Like they children?', 'They like children?'],
  ],
  [
    'presentsimple',
    'Respuesta corta',
    'Do you live near here? (sí)',
    'Yes, I do.',
    ['Yes, I do.', 'Yes, I live.', 'Yes, I am.'],
  ],
  [
    'canlike',
    QUESTION,
    'I can park here.',
    'Can I park here?',
    ['Can I park here?', 'Do I can park here?', 'I can park here?'],
  ],
  [
    'canlike',
    NEGATIVE,
    'I can swim.',
    "I can't swim.",
    ["I can't swim.", "I don't can swim.", 'I not can swim.'],
  ],
  [
    'canlike',
    'Respuesta corta',
    'Can you come at 8.30? (no)',
    "No, I can't.",
    ["No, I can't.", "No, I don't.", 'No, I am not.'],
  ],
  [
    'canlike',
    NEGATIVE,
    'I like shopping.',
    "I don't like shopping.",
    ["I don't like shopping.", 'I not like shopping.', "I doesn't like shopping."],
  ],
  [
    'pastsimple',
    NEGATIVE,
    'I arrived at seven o’clock.',
    "I didn't arrive at seven o’clock.",
    [
      "I didn't arrive at seven o’clock.",
      "I didn't arrived at seven o’clock.",
      'I not arrived at seven o’clock.',
    ],
  ],
  [
    'pastsimple',
    QUESTION,
    'You finished the book.',
    'Did you finish the book?',
    ['Did you finish the book?', 'Did you finished the book?', 'You finished the book?'],
  ],
  [
    'pastsimple',
    QUESTION,
    'They played tennis.',
    'Did they play tennis?',
    ['Did they play tennis?', 'Did they played tennis?', 'They played tennis?'],
  ],
  [
    'pastsimple',
    NEGATIVE,
    'She liked the film.',
    "She didn't like the film.",
    ["She didn't like the film.", "She didn't liked the film.", 'She not liked the film.'],
  ],
  [
    'jobs',
    NEGATIVE,
    'She works in a school.',
    "She doesn't work in a school.",
    [
      "She doesn't work in a school.",
      "She don't work in a school.",
      "She doesn't works in a school.",
    ],
  ],
  [
    'jobs',
    QUESTION,
    'He works in a hospital.',
    'Does he work in a hospital?',
    ['Does he work in a hospital?', 'Do he work in a hospital?', 'Does he works in a hospital?'],
  ],
  [
    'prescont',
    CONTRACTION,
    'I am working.',
    "I'm working.",
    ["I'm working.", 'I am working.', "I's working."],
  ],
  [
    'prescont',
    QUESTION,
    "You're working.",
    'Are you working?',
    ['Are you working?', 'Do you working?', 'You are working?'],
  ],
  [
    'classroom',
    QUESTION,
    'spell it',
    'How do you spell it?',
    ['How do you spell it?', 'How spell you it?', 'How do you spelling it?'],
  ],
  [
    'time',
    CONTRACTION,
    'It is three o’clock.',
    "It's three o’clock.",
    ["It's three o’clock.", 'It is three o’clock.', "Its three o’clock."],
  ],
  [
    'therewas',
    'Pasado',
    'There is a bank.',
    'There was a bank.',
    ['There was a bank.', 'There were a bank.', 'There is was a bank.'],
  ],
])
