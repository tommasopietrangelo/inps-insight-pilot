/**
 * Rilevamento "caso particolare" con punteggio pesato.
 * Obiettivo: segnalare solo quando la risposta descrive davvero
 * un'eccezione / casistica non standard, non a ogni risposta.
 */

const STRONG = [
  /\bcaso particolar\w*/i,
  /\bcasistic\w+ particolar\w*/i,
  /\bin derog\w*\b/i,
  /\bderog\w+ (?:a|al|alla|alle|ai|agli)\b/i,
  /\beccezion\w*\b/i,
  /\bfattispecie particolar\w*/i,
  /\bnon rientra (?:nei|nella|nel|tra)\b/i,
  /\bfuori standard\b/i,
  /\bnon standard\b/i,
  /\bregime transitori\w*/i,
];

const MEDIUM = [
  /\bcontenzios\w*/i,
  /\bcontrovers\w*/i,
  /\bricorso amministrativ\w*/i,
  /\binterpretazione (?:estensiv|restrittiv|controvers|non univoc)\w*/i,
  /\bprass\w+ (?:difform|non uniform)\w*/i,
  /\bva valutat\w+ caso per caso\b/i,
  /\bcaso per caso\b/i,
  /\bdeve essere valutat\w+ dalla sede\b/i,
  /\bsede territorial\w+ compet\w+/i,
  /\bsalvo (?:diversa|specific)\w*/i,
];

const WEAK = [
  /\btuttavia\b/i,
  /\bfermo restando\b/i,
  /\bdubbi\w*/i,
  /\bincert\w+/i,
  /\bnon è chiaro\b/i,
  /\brichiede (?:un )?approfondiment\w*/i,
  /\bverificare con (?:la sede|l'istituto|INPS)\b/i,
];

export type CaseSignal = {
  isException: boolean;
  score: number;
  reasons: string[];
};

export function detectSpecialCase(answer: string, question = ""): CaseSignal {
  const text = `${answer ?? ""}`;
  if (text.trim().length < 200) return { isException: false, score: 0, reasons: [] };

  let score = 0;
  const reasons: string[] = [];

  for (const re of STRONG) {
    const m = text.match(re);
    if (m) {
      score += 3;
      reasons.push(m[0]);
      break;
    }
  }
  let mediumHits = 0;
  for (const re of MEDIUM) {
    const m = text.match(re);
    if (m && mediumHits < 2) {
      score += 2;
      mediumHits++;
      reasons.push(m[0]);
    }
  }
  let weakHits = 0;
  for (const re of WEAK) {
    const m = text.match(re);
    if (m && weakHits < 2) {
      score += 1;
      weakHits++;
      reasons.push(m[0]);
    }
  }

  // La domanda stessa può indicare una casistica anomala
  if (/(caso particolar|eccezion|deroga|e se|cosa succede se|nonostante|pur avendo)/i.test(question)) {
    score += 1;
  }

  return { isException: score >= 3, score, reasons: reasons.slice(0, 3) };
}
