export const NOTIFICATIONS = [
  // early on, lots of urgent noise
  { signal: 5, text: "Congrats!! 🎉🎉🎉" },
  { signal: 5, text: "Can you hop on a quick call?" },
  { signal: 5, text: "Your calendar is double booked (x14)" },
  { signal: 5, text: "Reply ASAP - urgent!!" },
  { signal: 5, text: "Investor meeting moved to Monday" },
  { signal: 5, text: "Team Hyper: where are you?" },
  { signal: 4, text: "Forbes wants a comment" },
  { signal: 4, text: "Your deal coverage went viral" },
  { signal: 4, text: "Mom: Are you eating ok?" },
  { signal: 4, text: "Unknown +1 (212): Congrats! Let's chat." },
  { signal: 3, text: "Signal dropping... message may not send" },
  { signal: 3, text: "Mom: It went through right?" },
  { signal: 2, text: "1 bar. Inbox: 3,109 unread." },
  { signal: 2, text: "Calendar: 47 events this week. Location: unknown." },
  { signal: 1, text: "Message delayed. Retry?" },
  { signal: 1, text: "Team Hyper: still no word from Marc" },
  { signal: 0, text: "No service." },
  { signal: 0, text: "Your out-of-office reply is working hard for you." },
];

export const OOO_PRESETS = [
  "I'm currently off the grid in Mongolia. No ETA. The yaks can't Slack.",
  "Out of office. Possibly forever. Will respond when I find signal (or enlightenment).",
  "Taking some well-earned steppe time. Back soon. Probably.",
  "Hi, I'm away. My AI expense agent is handling my inbox. You're in good hands.",
  "Currently: unreachable. Status: great. ETA: unknown. Regards, Marc.",
];

export const MONGOLIAN_PHRASES = [
  { mongolian: "Sain baina uu", english: "Hello / How are you?", id: "hello" },
  { mongolian: "Bayarlalaa", english: "Thank you", id: "thanks" },
  { mongolian: "Amttai", english: "Delicious", id: "delicious" },
  { mongolian: "Tiim", english: "Yes", id: "yes" },
  { mongolian: "Ugui", english: "No", id: "no" },
  { mongolian: "Zugeer", english: "It's okay / fine", id: "fine" },
  { mongolian: "Sain", english: "Good", id: "good" },
  { mongolian: "Bolj ogno uu", english: "Please", id: "please" },
];

export const ENGLISH_WORDS = [
  { word: "yak", attempt: "yek? yaaak? yak!", category: "animals" },
  { word: "horse", attempt: "hors... horse!", category: "animals" },
  { word: "sheep", attempt: "sheeep!", category: "animals" },
  { word: "bucket", attempt: "buk-et? bucket!", category: "objects" },
  { word: "water", attempt: "wahter? water!", category: "objects" },
  { word: "sky", attempt: "sky!", category: "nature" },
  { word: "mountain", attempt: "moun-tin... mountain!", category: "nature" },
  { word: "sun", attempt: "sun!", category: "nature" },
  { word: "friend", attempt: "frend? friend!", category: "people" },
  { word: "hello", attempt: "hello!", category: "phrases" },
  { word: "thank you", attempt: "thank... you! thank you!", category: "phrases" },
  { word: "My name is ___", attempt: "My name is Anu!", category: "graduation" },
];

export const ACHIEVEMENTS = [
  { id: "wax_on", name: "Wax On, Water Off", desc: "Deliver buckets with under 10% spill" },
  { id: "yak_whisperer", name: "Yak Whisperer", desc: "Calm Gerel without a single rope burn" },
  { id: "ger_speedrun", name: "Ger Speedrun", desc: "Raise the ger under 10 minutes" },
  { id: "photo_op", name: "Photo Op", desc: "Feed Leo a forkful of noodles" },
  { id: "card_shark", name: "Card Shark", desc: "Beat Temuulen at cards" },
  { id: "mercy_rule", name: "Mercy Rule", desc: "Let Saraa win at tag" },
  { id: "angel_investor", name: "Angel Investor", desc: "Fund all three English students" },
  { id: "inbox_zero", name: "Inbox: Steppe Zero", desc: "Don't check phone for a full chapter" },
];

export const HYPER_AGENT_TOASTS = [
  "Aaruul x3 - Meals & Entertainment - receipt matched.",
  "Yak negotiation - Professional Services.",
  "Suutei tsai x1 - Meals & Entertainment - categorized.",
  "Ger construction - Real Estate - approved.",
  "Card night x1 - Team Building.",
  "English lesson - Education - logged.",
  "Steppe walk x1 - Wellness - auto-approved.",
  "Airag x1 - Meals & Entertainment - flagged (unusual).",
];
