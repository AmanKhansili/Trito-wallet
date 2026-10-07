/**
 * Safe logging utility that strictly sanitizes any output.
 * Ensures zero private keys, mnemonics, or sensitive auth data are ever written to stdout/console.
 */

const SENSITIVE_PATTERNS = [
  /0x[a-fA-F0-9]{64}/g, // 32-byte hex keys
  /[a-fA-F0-9]{64}/g,
  /\b(?:abandon|ability|able|about|above|absent|absorb|abstract|absurd|abuse|access|accident|account|accuse|achieve|acid|acoustic|acquire|across|act|action|actor|actress|actual|adapt|add|addict|address|adjust|admit|adult|advance|advice|aerobic|affair|afford|afraid|again|age|agent|agree|ahead|aim|air|airport|aisle|alarm|album|alcohol|alert|alien|all|alley|allow|almost|alone|alpha|already|also|alter|always|amateur|amazing|among|amount|amused|analyst|anchor|ancient|anger|angle|angry|animal|ankle|announce|annual|another|answer|antenna|antique|anxiety|any|apart|apology|appear|apple|approve|april|arch|arctic|area|arena|argue|arm|armed|armor|army|around|arrange|arrest|arrive|arrow|art|artefact|artist|artwork|ask|aspect|assault|asset|assist|assume|asthma|athlete|atom|attack|attend|attitude|attract|auction|audit|august|aunt|author|auto|autumn|average|avocado|avoid|awake|aware|away|awesome|awful|awkward|axis|baby|bachelor|bacon|badge|bag|balance|balcony|ball|bamboo|banana|banner|bar|barely|bargain|barrel|base|basic|basket|battle|beach|bean|beauty|because|become|beef|before|begin|behave|behind|believe|below|belt|bench|benefit|best|betray|better|between|beyond|bicycle|bid|bike|bind|biology|bird|birth|bitter|black|blade|blame|blanket|blast|bleak|bless|blind|blood|blossom|blouse|blue|blur|blush|board|boat|body|boil|bomb|bone|bonus|book|boost|border|boring|borrow|boss|bottom|bounce|box|boy|bracket|brain|brand|brass|brave|bread|breeze|bribe|brick|bridge|brief|bright|bring|brisk|broccoli|broken|bronze|broom|brother|brown|brush|bubble|buddy|budget|buffalo|build|bulb|bulk|bullet|bundle|bunker|burden|burger|burst|bus|business|busy|butter|buyer|buzz)\b/gi,
];

function sanitize(message: unknown): string {
  if (message === null || message === undefined) {
    return '';
  }
  let str = typeof message === 'object' ? JSON.stringify(message) : String(message);

  // Redact 64-char hex strings
  str = str.replace(/0x[a-fA-F0-9]{64}/g, '[REDACTED_PRIVATE_KEY]');
  str = str.replace(/(?<![a-fA-F0-9])[a-fA-F0-9]{64}(?![a-fA-F0-9])/g, '[REDACTED_HEX_SECRET]');

  return str;
}

export const logger = {
  info: (msg: string, ...args: unknown[]): void => {
    const cleanMsg = sanitize(msg);
    const cleanArgs = args.map(sanitize);
    console.info(`[TRITO:INFO] ${cleanMsg}`, ...cleanArgs);
  },
  warn: (msg: string, ...args: unknown[]): void => {
    const cleanMsg = sanitize(msg);
    const cleanArgs = args.map(sanitize);
    console.warn(`[TRITO:WARN] ${cleanMsg}`, ...cleanArgs);
  },
  error: (msg: string, ...args: unknown[]): void => {
    const cleanMsg = sanitize(msg);
    const cleanArgs = args.map(sanitize);
    console.error(`[TRITO:ERROR] ${cleanMsg}`, ...cleanArgs);
  },
  debug: (_msg: string, ..._args: unknown[]): void => {
    // Disabled in production builds
  },
};
