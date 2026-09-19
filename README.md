# strict-address

Parsing and formatting for US postal addresses, strict by default.

## The problem

Most address parsers are lenient by default because they're built to accept
whatever a user typed into a form. That's the wrong default for anything
that eventually calls a shipping API, prints a label, or writes to a
database column with constraints on it. A city name with a stray comma in
it, a zip code missing a digit, or "California" where you needed "CA" will
silently corrupt a batch job or, worse, get accepted by the carrier and
misroute a package.

This library parses `"street, city, ST zip"`-shaped text into a typed
`UsAddress` and throws on anything that doesn't already match that shape.
If you're ingesting messier input (pasted from an email, scraped from a
web form, typed by hand) you opt into a `lenient` mode explicitly, field by
field, rather than getting silent normalization by default.

Only US addresses are handled right now. See the roadmap below.

## Usage

```ts
import { parseAddress, formatAddress, AddressError } from 'strict-address';

// strict mode (default): exact shape, real USPS state code, valid zip
const address = parseAddress('1600 Pennsylvania Ave NW\nWashington, DC 20500');
// => {
//   line1: '1600 Pennsylvania Ave NW',
//   city: 'Washington',
//   state: 'DC',
//   postalCode: '20500',
//   country: 'US',
// }

formatAddress(address);
// => ['1600 Pennsylvania Ave NW', 'Washington, DC 20500']

// strict mode rejects a full state name and a missing comma
try {
  parseAddress('1600 Pennsylvania Ave NW\nWashington DC 20500-1600');
} catch (err) {
  if (err instanceof AddressError) {
    console.error(`${err.field}: ${err.message}`);
    // => "city/state/zip: expected "City, ST 12345", got "Washington DC 20500-1600""
  }
}

// lenient mode accepts the same messy input and normalizes it
const lenient = parseAddress('1600 Pennsylvania Ave NW\nWashington DC 20500-1600', {
  lenient: true,
});
// => {
//   line1: '1600 Pennsylvania Ave NW',
//   city: 'Washington',
//   state: 'DC',
//   postalCode: '20500-1600',
//   country: 'US',
// }
```

A two-line street address (with a suite or apartment on its own line) is
also accepted:

```ts
parseAddress('350 Fifth Avenue\nSuite 7500\nNew York, NY 10118');
```

## What "strict" checks

- exactly two or three non-blank lines: street, optional second street
  line, then `City, ST 12345` (or `12345-6789`)
- `state` must be a real two-letter USPS state or territory code
- `postalCode` must be exactly 5 digits, or 5+4 with a dash
- `city` may only contain letters, spaces, periods, apostrophes, and
  hyphens
- `line1` and any `line2` must be non-blank and under 60 characters

Every failure throws an `AddressError` with a `field` property so callers
can build a useful validation message instead of a generic parse failure.

## What "lenient" relaxes

Lenient mode still validates, it just tries harder before giving up:
full state names are mapped to their code, a missing comma before the
state is tolerated, zip codes with stray spaces or a dropped leading zero
are repaired, and city names have disallowed characters stripped rather
than rejected outright. It still throws if it truly can't make sense of
the input.

## Status

Early skeleton. No build output is checked in; run `tsc` to compile
`src/` to `dist/` before publishing or consuming this as a package.
