// Test PDF stream green text extraction

export function extractGreenTextsFromPdf(text) {
  const greenTexts = new Set();
  
  // Matches RGB color operator: r g b rg where g is dominant (green)
  // e.g. "0 0.8 0 rg", "0.1 0.7 0.2 rg", "0 0.5 0 rg"
  const rgbGreenPattern = /(\d*(?:\.\d+)?)\s+(\d*(?:\.\d+)?)\s+(\d*(?:\.\d+)?)\s+rg\s*([\s\S]*?)(?=(?:\d*(?:\.\d+)?\s+\d*(?:\.\d+)?\s+\d*(?:\.\d+)?\s+rg|ET))/gi;
  
  let match;
  while ((match = rgbGreenPattern.exec(text)) !== null) {
    const r = parseFloat(match[1]);
    const g = parseFloat(match[2]);
    const b = parseFloat(match[3]);
    const block = match[4];

    // If green is notably higher than red and blue, it's green!
    if (g > 0.35 && g > r + 0.15 && g > b + 0.15) {
      // Extract Tj or TJ text
      const tjRegex = /\((.*?)\)\s*Tj/g;
      let tjMatch;
      while ((tjMatch = tjRegex.exec(block)) !== null) {
        const clean = tjMatch[1].replace(/\\([()\\])/g, '$1').trim();
        if (clean.length > 0) greenTexts.add(clean.toLowerCase());
      }
      
      const tjArrRegex = /\[(.*?)\]\s*TJ/g;
      let arrMatch;
      while ((arrMatch = tjArrRegex.exec(block)) !== null) {
        const inner = arrMatch[1];
        const innerRegex = /\((.*?)\)/g;
        let inM;
        let fullStr = '';
        while ((inM = innerRegex.exec(inner)) !== null) {
          fullStr += inM[1].replace(/\\([()\\])/g, '$1');
        }
        if (fullStr.trim().length > 0) greenTexts.add(fullStr.trim().toLowerCase());
      }
    }
  }

  return Array.from(greenTexts);
}

const sampleStream = `
BT
/F1 12 Tf
0 0 0 rg
(1. Who defeated Goliath?) Tj
0 0 0 rg
(A. Saul) Tj
0.1 0.8 0.1 rg
(B. David) Tj
0 0 0 rg
(C. Solomon) Tj
ET
`;

console.log('Green texts extracted:', extractGreenTextsFromPdf(sampleStream));
