import { STATE_CODE_BY_NAME, STATE_NAMES } from './us-states.js';

export interface UsAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: 'US';
}

export interface ParseOptions {
  /**
   * Off by default. Strict mode expects a fixed shape ("Street", optional
   * "Street 2", "City, ST 12345") and rejects anything that doesn't match
   * exactly. Turn this on to accept the messier input real users type:
   * full state names, missing commas, stray whitespace, zips with dashes
   * in odd places.
   */
  lenient?: boolean;
}

export class AddressError extends Error {
  readonly field: string;

  constructor(field: string, message: string) {
    super(message);
    this.name = 'AddressError';
    this.field = field;
  }
}

const ZIP_STRICT = /^\d{5}(-\d{4})?$/;
const CITY_PATTERN = /^[A-Za-z][A-Za-z .'-]*$/;
const STRICT_TAIL = /^(.+),\s*([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/;
const LENIENT_TAIL = /^(.+?),?\s+([A-Za-z]{2,})\s+([\d\s-]{4,})$/;

export function parseAddress(input: string, options: ParseOptions = {}): UsAddress {
  const lenient = options.lenient ?? false;
  const normalized = lenient ? input.trim().replace(/[ \t]+/g, ' ') : input.trim();

  const lines = normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    throw new AddressError('input', 'expected at least a street line and a city/state/zip line');
  }
  if (lines.length > 3) {
    throw new AddressError(
      'input',
      'too many lines; expected a street line, an optional second line, and a city/state/zip line',
    );
  }

  const line1 = lines[0] as string;
  const line2 = lines.length === 3 ? (lines[1] as string) : undefined;
  const tail = lines[lines.length - 1] as string;

  const { city, state, postalCode } = parseCityStateZip(tail, lenient);

  return {
    line1: normalizeStreetLine(line1, lenient),
    ...(line2 !== undefined ? { line2: normalizeStreetLine(line2, lenient) } : {}),
    city,
    state,
    postalCode,
    country: 'US',
  };
}

export function formatAddress(address: UsAddress): string[] {
  const lines = [address.line1];
  if (address.line2) {
    lines.push(address.line2);
  }
  lines.push(`${address.city}, ${address.state} ${address.postalCode}`);
  return lines;
}

function parseCityStateZip(
  tail: string,
  lenient: boolean,
): Pick<UsAddress, 'city' | 'state' | 'postalCode'> {
  const strictMatch = tail.match(STRICT_TAIL);
  if (strictMatch) {
    const [, cityPart, stateCode, zip] = strictMatch as unknown as [string, string, string, string];
    return finishCityStateZip(cityPart, stateCode, zip, lenient);
  }

  if (!lenient) {
    throw new AddressError('city/state/zip', `expected "City, ST 12345", got "${tail}"`);
  }

  const lenientMatch = tail.match(LENIENT_TAIL);
  if (!lenientMatch) {
    throw new AddressError('city/state/zip', `could not find a city, state, and zip in "${tail}"`);
  }
  const [, cityPart, stateRaw, zipRaw] = lenientMatch as unknown as [string, string, string, string];
  const stateCode = STATE_CODE_BY_NAME.get(stateRaw.toLowerCase()) ?? stateRaw.toUpperCase();
  const zip = zipRaw.replace(/[^\d-]/g, '');
  return finishCityStateZip(cityPart, stateCode, zip, lenient);
}

function finishCityStateZip(
  cityPart: string,
  stateCode: string,
  zip: string,
  lenient: boolean,
): Pick<UsAddress, 'city' | 'state' | 'postalCode'> {
  return {
    city: normalizeCity(cityPart, lenient),
    state: normalizeState(stateCode, lenient),
    postalCode: normalizePostalCode(zip, lenient),
  };
}

function normalizeCity(value: string, lenient: boolean): string {
  const city = value.trim();
  if (CITY_PATTERN.test(city)) {
    return city;
  }
  if (!lenient) {
    throw new AddressError('city', `"${city}" contains characters not allowed in a city name`);
  }
  const stripped = city.replace(/[^A-Za-z .'-]/g, '').trim();
  if (stripped.length === 0) {
    throw new AddressError('city', `"${value}" has no usable city name, even leniently`);
  }
  return stripped;
}

function normalizeState(code: string, lenient: boolean): string {
  const upper = code.toUpperCase();
  if (!STATE_NAMES.has(upper) && !lenient) {
    throw new AddressError('state', `"${code}" is not a recognized USPS state or territory code`);
  }
  return upper;
}

function normalizePostalCode(zip: string, lenient: boolean): string {
  if (ZIP_STRICT.test(zip)) {
    return zip;
  }
  if (!lenient) {
    throw new AddressError('postalCode', `"${zip}" is not a valid 5-digit or ZIP+4 postal code`);
  }
  const digits = zip.replace(/\D/g, '');
  if (digits.length === 5) {
    return digits;
  }
  if (digits.length === 9) {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }
  if (digits.length === 4) {
    // most common cause: a leading zero got dropped somewhere upstream
    return `0${digits}`;
  }
  throw new AddressError('postalCode', `"${zip}" does not contain a usable zip code, even leniently`);
}

function normalizeStreetLine(value: string, lenient: boolean): string {
  const line = value.trim();
  if (line.length === 0) {
    throw new AddressError('line1', 'street line cannot be blank');
  }
  if (!lenient && line.length > 60) {
    throw new AddressError('line1', 'street line exceeds 60 characters');
  }
  return line;
}
