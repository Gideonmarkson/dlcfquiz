const BIBLE_BOOKS = [
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth',
  '1 Samuel', '2 Samuel', '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra',
  'Nehemiah', 'Esther', 'Job', 'Psalm', 'Psalms', 'Proverbs', 'Ecclesiastes', 'Song of Solomon',
  'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos',
  'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah',
  'Malachi', 'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans', '1 Corinthians',
  '2 Corinthians', 'Galatians', 'Ephesians', 'Philippians', 'Colossians', '1 Thessalonians',
  '2 Thessalonians', '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews', 'James',
  '1 Peter', '2 Peter', '1 John', '2 John', '3 John', 'Jude', 'Revelation'
];

const BIBLE_REGEX = new RegExp(
  `\\b((?:[1-3]\\s+)?(?:${BIBLE_BOOKS.map(b => b.replace(/^[1-3]\s+/, '')).join('|')})\\s+\\d+:\\d+(?:-\\d+)?)\\b`,
  'i'
);

console.log('Match Acts 1:8:', 'In Acts 1:8, Jesus said...'.match(BIBLE_REGEX)?.[1]);
console.log('Match 2 Timothy 2:15 in parens:', 'Correct Answer: B (2 Timothy 2:15)'.match(BIBLE_REGEX)?.[1]);
console.log('Match 1 Thessalonians 5:17:', 'Ref: 1 Thessalonians 5:17'.match(BIBLE_REGEX)?.[1]);
