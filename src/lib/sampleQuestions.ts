import type { QuestionInput } from '@/types/quiz';

export const SAMPLE_BIBLE_QUESTIONS: QuestionInput[] = [
  {
    prompt: "Which epistle instructs believers to 'Study to shew thyself approved unto God, a workman that needeth not to be ashamed'?",
    options: ["1 Timothy", "2 Timothy", "Titus", "Hebrews"],
    correctOptionIndex: 1, // 2 Timothy
    scriptureRef: "2 Timothy 2:15",
    explanation: "Paul wrote this solemn charge to Timothy in his second epistle to ensure uncompromised handling of the Word of truth.",
    timeLimitSec: 20
  },
  {
    prompt: "According to Psalm 119:105, what is God's word described as unto our feet and our path?",
    options: [
      "A lamp unto my feet, and a light unto my path",
      "A shield and buckler in the day of battle",
      "A hammer that breaketh the rock in pieces",
      "A two-edged sword piercing even to the soul"
    ],
    correctOptionIndex: 0,
    scriptureRef: "Psalm 119:105",
    explanation: "David declares that God's word illuminates our practical daily walk and lifelong direction.",
    timeLimitSec: 20
  },
  {
    prompt: "In Acts 1:8, Jesus promised the disciples they would receive power after what occurred?",
    options: [
      "They had fasted for forty days in Jerusalem",
      "The Holy Ghost is come upon you",
      "They appointed Matthias to replace Judas",
      "They preached to the Gentiles in Antioch"
    ],
    correctOptionIndex: 1,
    scriptureRef: "Acts 1:8",
    explanation: "Jesus declared: 'But ye shall receive power, after that the Holy Ghost is come upon you: and ye shall be witnesses unto me...'",
    timeLimitSec: 20
  },
  {
    prompt: "What is the biblical definition of faith given in Hebrews 11:1?",
    options: [
      "Believing God will give you whatever you imagine",
      "A feeling of peace when facing trials",
      "The substance of things hoped for, the evidence of things not seen",
      "Good works performed before all men"
    ],
    correctOptionIndex: 2,
    scriptureRef: "Hebrews 11:1",
    explanation: "Faith grounds the Christian's confident hope on the immutable character and promises of God.",
    timeLimitSec: 20
  },
  {
    prompt: "According to 1 Thessalonians 5:17, believers are commanded to do what without ceasing?",
    options: ["Fasting", "Pray without ceasing", "Singing psalms", "Studying the Law"],
    correctOptionIndex: 1,
    scriptureRef: "1 Thessalonians 5:17",
    explanation: "Believers are instructed to maintain an unbroken, persistent posture of prayer throughout every season of life.",
    timeLimitSec: 20
  }
];
