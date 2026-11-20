/**
 * Generates a valid standard PDF-1.4 binary containing sample DLCF AFIT Bible Quiz questions.
 * Runs anywhere without external dependencies.
 */
export function generateSamplePdfBytes(): Uint8Array {
  const lines = [
    'DLCF AFIT LIVE BIBLE QUIZ - QUESTION BANK TEMPLATE',
    'Theme Scripture: 2 Timothy 2:15',
    '--------------------------------------------------------------------------------',
    '',
    'Question 1: Which epistle instructs believers to Study to shew thyself approved unto God?',
    'A. 1 Timothy',
    'B. 2 Timothy',
    'C. Titus',
    'D. Hebrews',
    'Correct Answer: B',
    'Scripture: 2 Timothy 2:15',
    'Explanation: Paul wrote this solemn charge to Timothy in his second epistle.',
    'Timer: 20s',
    '',
    'Question 2: According to Psalm 119:105, what is God word described as unto our path?',
    'A. A lamp unto my feet, and a light unto my path',
    'B. A shield and buckler in the day of battle',
    'C. A hammer that breaketh the rock in pieces',
    'D. A two-edged sword piercing even to the soul',
    'Correct Answer: A',
    'Scripture: Psalm 119:105',
    'Explanation: David declares that God word illuminates our practical daily walk.',
    'Timer: 20s',
    '',
    'Question 3: In Acts 1:8, Jesus promised believers power after what occurs?',
    'A. They fasted for forty days in Jerusalem',
    'B. The Holy Ghost is come upon you',
    'C. They appointed Matthias to replace Judas',
    'D. They preached to the Gentiles in Antioch',
    'Correct Answer: B',
    'Scripture: Acts 1:8',
    'Explanation: Jesus promised the Holy Ghost for bold Gospel witness.',
    'Timer: 20s',
    '',
    'Question 4: What is the biblical definition of faith given in Hebrews 11:1?',
    'A. Believing God will give you whatever you imagine',
    'B. A feeling of peace when facing trials',
    'C. The substance of things hoped for, the evidence of things not seen',
    'D. Good works performed before all men',
    'Correct Answer: C',
    'Scripture: Hebrews 11:1',
    'Explanation: Faith is the firm foundation of our hope in God promises.',
    'Timer: 20s',
    '',
    'Question 5: According to 1 Thessalonians 5:17, believers are commanded to do what?',
    'A. Fasting every weekend',
    'B. Pray without ceasing',
    'C. Singing psalms only',
    'D. Studying the Law',
    'Correct Answer: B',
    'Scripture: 1 Thessalonians 5:17',
    'Explanation: Believers are instructed to maintain persistent prayer.',
    'Timer: 20s',
  ];

  // Construct PDF stream text
  let streamContent = 'BT\n/F1 10 Tf\n14 TL\n40 760 Td\n';
  lines.forEach((line) => {
    // Escape parens and backslashes
    const escaped = line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    streamContent += `(${escaped}) '\n`;
  });
  streamContent += 'ET\n';

  const streamLength = streamContent.length;

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];

  // Object 1: Catalog
  offsets.push(pdf.length);
  pdf += '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';

  // Object 2: Pages
  offsets.push(pdf.length);
  pdf += '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n';

  // Object 3: Page
  offsets.push(pdf.length);
  pdf += '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n';

  // Object 4: Font
  offsets.push(pdf.length);
  pdf += '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n';

  // Object 5: Contents
  offsets.push(pdf.length);
  pdf += `5 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamContent}endstream\nendobj\n`;

  // Xref
  const startXref = pdf.length;
  pdf += 'xref\n0 6\n0000000000 65535 f \n';
  offsets.forEach((off) => {
    pdf += off.toString().padStart(10, '0') + ' 00000 n \n';
  });

  pdf += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`;

  const encoder = new TextEncoder();
  return encoder.encode(pdf);
}
