import { practiceScenarios } from './practice-scenarios'

const STATIC_ENGINE_LINES_EN = [
  'Hello! My name is Alex, and I will be your waiter. What would you like to order today?',
  'Of course. I will bring the bill right away. How would you like to pay — card or cash?',
  'You are welcome. Enjoy your meal, and call me if you need anything else.',
  'Perfect. I will bring your order soon. Enjoy your meal!',
  'Today we have pasta, grilled chicken, fish, and a veggie salad. What sounds good to you?',
  'Thanks for telling me. We can do a veggie salad or pasta without meat. What would you prefer?',
  'Sure. I can seat you by the window. Are you ready to order, or do you need a minute with the menu?',
  'The restrooms are down the hall to your left. Can I get you anything else when you return?',
  'Most mains are between ten and eighteen dollars. Would you like a recommendation in that range?',
  'Sure. We have pasta, chicken, fish, and salad. What would you like to order?',
  'Right away. I will bring that for you.',
  'Happy to help. Are you ready to order food or a drink from the menu?',
  'Welcome. What would you like to eat or drink today?',
  'Hello! I am Sam at the airline desk. How can I help with your flight today?',
  'Your gate is B12, and boarding starts in about twenty minutes. Do you need a seat map?',
  'I can help with that. Checked bags are at carousel three. Do you have your claim tag?',
  'I am sorry about the delay. The flight is now expected in forty minutes. Can I rebook you if needed?',
  'Please keep your passport ready for security. Do you also need your boarding pass printed?',
  'Sure. May I see your ID, and I will print your boarding pass.',
  'I can move you to a window seat in row 14. Shall I confirm that change?',
  'Your connection is in terminal C. You have about fifty minutes — I can show you the fastest route.',
  'The restrooms are past security, near gate B10. Anything else for your flight?',
  'Free WiFi is available, and there is a cafe near gate B10. Anything else for your flight?',
  'You are welcome. Have a safe flight!',
  'I can help with gates, bags, seats, or check-in. What do you need for your flight?',
  'Of course. Are you checking in, looking for your gate, or asking about bags?',
  'Nice to meet you. Please introduce yourself briefly and tell me about your background.',
  'Thank you. Why are you interested in this role?',
  'That is helpful. Can you describe a challenge you solved recently?',
  'Good example. How do you usually work with other people on a team?',
  'Thanks for sharing. Do you have any questions for us about the role?',
  'I appreciate your honesty. What is one goal you hope to achieve in this job?',
  'Of course. What would you like to know about the role or the company?',
  'Thank you for your time today. We will follow up soon.',
  'Good question. In this role you would join a small product team. Do you have experience with deadlines?',
  'Please tell me your name and a little about your background.',
  'Sorry, I did not catch that. Could you please say what you would like to order?',
  'Sorry, I did not catch that. Are you asking about your gate, bags, or check-in?',
  'Sorry, I did not catch that. Could you please introduce yourself again?',
] as const

/** Unique English tutor lines that SpeechT5 can synthesize ahead of the first turn. */
export function listPrefetchableTutorLinesEn(): string[] {
  const unique = new Set<string>()
  for (const scenario of practiceScenarios) {
    unique.add(scenario.tutorOpeningLineEn)
    unique.add(scenario.tutorFollowUpPlaceholderEn)
    for (const line of scenario.tutorFollowUpLinesEn) {
      unique.add(line)
    }
  }
  for (const line of STATIC_ENGINE_LINES_EN) {
    unique.add(line)
  }
  return [...unique]
}
