/**
 * Content-aware tutor replies for curated scenarios.
 * Picks a short English line from the student's utterance (intent rules),
 * not a blind turn counter — so "what's your name?" never gets "boarding pass?".
 *
 * Designed to tolerate imperfect Whisper transcripts (short phrases, missing
 * punctuation, occasional near-misses) and to echo concrete orders/topics.
 */

import type { PracticeScenario, PracticeScenarioId } from './practice-scenarios'

export function pickContextualTutorReply(options: {
  readonly scenario: PracticeScenario
  readonly userUtteranceEn: string
  readonly userTurnIndex: number
}): string {
  const normalized = normalizeUtterance(options.userUtteranceEn)
  if (!normalized || isTooUnclearToAnswer(normalized)) {
    return clarifyForScenario(options.scenario)
  }

  switch (options.scenario.id) {
    case 'restaurant':
      return restaurantReply(normalized, options.scenario, options.userTurnIndex)
    case 'airport':
      return airportReply(normalized, options.scenario, options.userTurnIndex)
    case 'job-interview':
      return jobInterviewReply(normalized, options.scenario, options.userTurnIndex)
    default:
      return clarifyForScenario(options.scenario)
  }
}

function restaurantReply(
  normalized: string,
  scenario: PracticeScenario,
  userTurnIndex: number,
): string {
  if (isGreetingOrName(normalized) && !isFoodOrDrinkOrder(normalized)) {
    return 'Hello! My name is Alex, and I will be your waiter. What would you like to order today?'
  }
  if (/\b(bill|check|pay|account|receipt)\b/.test(normalized)) {
    return 'Of course. I will bring the bill right away. How would you like to pay — card or cash?'
  }
  if (
    /\b(thank|thanks|bye|goodbye|see you)\b/.test(normalized) &&
    !isFoodOrDrinkOrder(normalized)
  ) {
    return 'You are welcome. Enjoy your meal, and call me if you need anything else.'
  }
  if (
    /\b(nothing else|that's all|that is all|just that|no thanks|no thank|i'm fine|im fine|i am fine|all set)\b/.test(
      normalized,
    )
  ) {
    return 'Perfect. I will bring your order soon. Enjoy your meal!'
  }
  if (/\b(menu|what do you have|options|recommend|special|today)\b/.test(normalized)) {
    return 'Today we have pasta, grilled chicken, fish, and a veggie salad. What sounds good to you?'
  }
  if (/\b(allerg|vegetarian|vegan|gluten|no meat)\b/.test(normalized)) {
    return 'Thanks for telling me. We can do a veggie salad or pasta without meat. What would you prefer?'
  }
  if (/\b(table|reservation|seat|window|booth)\b/.test(normalized)) {
    return 'Sure. I can seat you by the window. Are you ready to order, or do you need a minute with the menu?'
  }
  if (/\b(bathroom|restroom|toilet|washroom)\b/.test(normalized)) {
    return 'The restrooms are down the hall to your left. Can I get you anything else when you return?'
  }
  if (/\b(how much|price|cost|expensive)\b/.test(normalized)) {
    return 'Most mains are between ten and eighteen dollars. Would you like a recommendation in that range?'
  }

  const foods = extractFoodItems(normalized)
  const drinks = extractDrinkItems(normalized)

  if (foods.length > 0 && drinks.length > 0) {
    return `Perfect — ${joinItems(foods)} and ${joinItems(drinks)}. Would you like any side dishes?`
  }
  if (foods.length > 0) {
    return `Great choice — ${joinItems(foods)}. Would you like something to drink with that?`
  }
  if (drinks.length > 0) {
    return `Certainly — ${joinItems(drinks)}. Would you like a main dish with that?`
  }
  if (isOrderIntentWithoutItem(normalized)) {
    return 'Sure. We have pasta, chicken, fish, and salad. What would you like to order?'
  }
  if (/\b(water|more|another|refill|again)\b/.test(normalized)) {
    return 'Right away. I will bring that for you.'
  }
  if (looksLikeQuestion(normalized) && !isFoodOrDrinkOrder(normalized)) {
    return 'Happy to help. Are you ready to order food or a drink from the menu?'
  }

  // Stay in role with a clarifying line — do not jump to an unrelated scripted turn.
  if (userTurnIndex === 0) {
    return 'Welcome. What would you like to eat or drink today?'
  }
  return softScenarioProgression(scenario, userTurnIndex)
}

function airportReply(
  normalized: string,
  scenario: PracticeScenario,
  userTurnIndex: number,
): string {
  if (isGreetingOrName(normalized) && !isAirportTopic(normalized)) {
    return 'Hello! I am Sam at the airline desk. How can I help with your flight today?'
  }
  if (/\b(gate|boarding|board|where do i go)\b/.test(normalized)) {
    return 'Your gate is B12, and boarding starts in about twenty minutes. Do you need a seat map?'
  }
  if (/\b(bag|baggage|luggage|suitcase|lost|carousel)\b/.test(normalized)) {
    return 'I can help with that. Checked bags are at carousel three. Do you have your claim tag?'
  }
  if (/\b(delay|late|cancel|cancelled|canceled|on time|status)\b/.test(normalized)) {
    return 'I am sorry about the delay. The flight is now expected in forty minutes. Can I rebook you if needed?'
  }
  if (/\b(passport|visa|id card|identity|document)\b/.test(normalized)) {
    return 'Please keep your passport ready for security. Do you also need your boarding pass printed?'
  }
  if (/\b(boarding pass|ticket|check[- ]?in|checkin)\b/.test(normalized)) {
    return 'Sure. May I see your ID, and I will print your boarding pass.'
  }
  if (/\b(seat|window|aisle|upgrade)\b/.test(normalized)) {
    return 'I can move you to a window seat in row 14. Shall I confirm that change?'
  }
  if (/\b(connection|connecting|transfer|layover|miss)\b/.test(normalized)) {
    return 'Your connection is in terminal C. You have about fifty minutes — I can show you the fastest route.'
  }
  if (/\b(wifi|lounge|food|coffee|bathroom|restroom)\b/.test(normalized)) {
    return 'Free Wi‑Fi is available, and there is a cafe near gate B10. Anything else for your flight?'
  }
  if (/\b(thank|thanks|bye|goodbye|safe flight)\b/.test(normalized)) {
    return 'You are welcome. Have a safe flight!'
  }
  if (looksLikeQuestion(normalized) && !isAirportTopic(normalized)) {
    return 'I can help with gates, bags, seats, or check-in. What do you need for your flight?'
  }
  if (userTurnIndex === 0) {
    return 'Of course. Are you checking in, looking for your gate, or asking about bags?'
  }
  return softScenarioProgression(scenario, userTurnIndex)
}

function jobInterviewReply(
  normalized: string,
  scenario: PracticeScenario,
  userTurnIndex: number,
): string {
  if (isGreetingOrName(normalized) && !isInterviewTopic(normalized) && !isSelfIntroduction(normalized)) {
    return 'Nice to meet you. Please introduce yourself briefly and tell me about your background.'
  }
  if (isSelfIntroduction(normalized) || isBackgroundStatement(normalized)) {
    return 'Thank you. Why are you interested in this role?'
  }
  if (
    /\b(because|interested|passion|motivated|i like|i love|i want this|excited about)\b/.test(
      normalized,
    ) ||
    (/\b(want|join|apply|role|position|company)\b/.test(normalized) &&
      /\b(because|since|as|interested)\b/.test(normalized))
  ) {
    return 'That is helpful. Can you describe a challenge you solved recently?'
  }
  if (/\b(challenge|problem|project|solved|difficult|hardest|obstacle)\b/.test(normalized)) {
    return 'Good example. How do you usually work with other people on a team?'
  }
  if (/\b(team|collaborate|together|colleague|coworker|pair)\b/.test(normalized)) {
    return 'Thanks for sharing. Do you have any questions for us about the role?'
  }
  if (/\b(strength|weakness|skill|improve)\b/.test(normalized)) {
    return 'I appreciate your honesty. What is one goal you hope to achieve in this job?'
  }
  if (/\b(question|ask you|for me|about the company|salary|hours|remote)\b/.test(normalized)) {
    return 'Of course. What would you like to know about the role or the company?'
  }
  if (/\b(thank|thanks|bye|goodbye)\b/.test(normalized)) {
    return 'Thank you for your time today. We will follow up soon.'
  }
  if (looksLikeQuestion(normalized)) {
    return 'Good question. In this role you would join a small product team. Do you have experience with deadlines?'
  }
  if (userTurnIndex === 0) {
    return 'Please tell me your name and a little about your background.'
  }
  return softScenarioProgression(scenario, userTurnIndex)
}

/**
 * Only use scripted progression when the learner said something on-topic-ish
 * but no specific intent fired — never as the first reaction to unclear ASR.
 */
function softScenarioProgression(scenario: PracticeScenario, userTurnIndex: number): string {
  const lines = scenario.tutorFollowUpLinesEn
  if (lines.length === 0) {
    return scenario.tutorFollowUpPlaceholderEn
  }
  // Prefer mid/later lines so turn 0 scripts do not pretend a specific prior order.
  const index = Math.max(0, Math.min(userTurnIndex, lines.length - 1))
  return lines[index] ?? scenario.tutorFollowUpPlaceholderEn
}

function clarifyForScenario(scenario: PracticeScenario): string {
  switch (scenario.id) {
    case 'restaurant':
      return 'Sorry, I did not catch that. Could you please say what you would like to order?'
    case 'airport':
      return 'Sorry, I did not catch that. Are you asking about your gate, bags, or check-in?'
    case 'job-interview':
      return 'Sorry, I did not catch that. Could you please introduce yourself again?'
    default:
      return 'Sorry, I did not catch that. Could you please say it again more clearly?'
  }
}

function normalizeUtterance(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9'\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Very short or non-English-looking ASR noise → ask to repeat. */
function isTooUnclearToAnswer(normalized: string): boolean {
  const words = normalized.split(' ').filter(Boolean)
  if (words.length === 0) {
    return true
  }
  // Single short token with no known practice vocabulary.
  if (words.length === 1 && words[0]!.length <= 3) {
    return true
  }
  // Almost no vowels → often Whisper garbage for noise.
  const letters = normalized.replace(/[^a-z]/g, '')
  if (letters.length >= 6) {
    const vowels = (letters.match(/[aeiou]/g) ?? []).length
    if (vowels / letters.length < 0.15) {
      return true
    }
  }
  return false
}

function isGreetingOrName(normalized: string): boolean {
  return /\b(hello|hi|hey|good morning|good afternoon|good evening|what's your name|what is your name|your name|who are you|nice to meet)\b/.test(
    normalized,
  )
}

const FOOD_ITEMS = [
  'burger',
  'hamburger',
  'pizza',
  'pasta',
  'spaghetti',
  'fish',
  'salmon',
  'chicken',
  'steak',
  'beef',
  'salad',
  'soup',
  'sandwich',
  'rice',
  'fries',
  'dessert',
  'cake',
  'taco',
  'sushi',
  'noodles',
  'egg',
  'eggs',
  'toast',
  'bacon',
] as const

const DRINK_ITEMS = [
  'coffee',
  'tea',
  'water',
  'juice',
  'soda',
  'beer',
  'wine',
  'cola',
  'coke',
  'lemonade',
  'milk',
  'smoothie',
] as const

function extractFoodItems(normalized: string): string[] {
  return FOOD_ITEMS.filter((item) => wordBoundaryIncludes(normalized, item))
}

function extractDrinkItems(normalized: string): string[] {
  return DRINK_ITEMS.filter((item) => wordBoundaryIncludes(normalized, item))
}

function wordBoundaryIncludes(normalized: string, item: string): boolean {
  return new RegExp(`\\b${item}\\b`).test(normalized)
}

function joinItems(items: readonly string[]): string {
  if (items.length === 1) {
    return items[0]!
  }
  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`
  }
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}

function isFoodOrder(normalized: string): boolean {
  return (
    extractFoodItems(normalized).length > 0 ||
    /\b(main|dish|food|hungry|eat|meal|appetizer|starter)\b/.test(normalized)
  )
}

function isDrinkOrder(normalized: string): boolean {
  return extractDrinkItems(normalized).length > 0 || /\b(drink|beverage)\b/.test(normalized)
}

function isOrderIntentWithoutItem(normalized: string): boolean {
  return /\b(i('|)d like|i would like|i want|can i have|i'll have|i will have|get me|please bring|order)\b/.test(
    normalized,
  )
}

function isFoodOrDrinkOrder(normalized: string): boolean {
  return isFoodOrder(normalized) || isDrinkOrder(normalized) || isOrderIntentWithoutItem(normalized)
}

function isAirportTopic(normalized: string): boolean {
  return /\b(flight|gate|bag|baggage|luggage|board|boarding|passport|ticket|delay|plane|airport|check in|check-in|seat|window|aisle|connection|terminal)\b/.test(
    normalized,
  )
}

function isInterviewTopic(normalized: string): boolean {
  return /\b(job|role|work|experience|team|project|skill|study|university|challenge|strength|weakness|company|position)\b/.test(
    normalized,
  )
}

/** "My name is…", "I'm a student…", not bare "I am ready". */
function isSelfIntroduction(normalized: string): boolean {
  return (
    /\b(my name is|i am called|i'm called|this is \w+)\b/.test(normalized) ||
    /\b(i am|i'm|im)\s+(a|an)\b/.test(normalized) ||
    /\b(i work as|i work at|i study|i studied|i graduated)\b/.test(normalized)
  )
}

function isBackgroundStatement(normalized: string): boolean {
  return /\b(student|engineer|developer|teacher|years of|experience|background|university|degree|currently work)\b/.test(
    normalized,
  )
}

function looksLikeQuestion(normalized: string): boolean {
  return (
    normalized.includes('?') ||
    /^(what|where|when|why|how|who|which|can|could|do|does|is|are|may|would|will)\b/.test(
      normalized,
    )
  )
}

/** Exported for tests: which scenario ids the engine knows. */
export function supportedTutorReplyScenarioIds(): PracticeScenarioId[] {
  return ['restaurant', 'airport', 'job-interview']
}
