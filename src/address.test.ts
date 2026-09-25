import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AddressError, formatAddress, parseAddress } from './address.js';

test('strict: parses a well-formed two-line address', () => {
  const address = parseAddress('1600 Pennsylvania Ave NW\nWashington, DC 20500');
  assert.deepEqual(address, {
    line1: '1600 Pennsylvania Ave NW',
    city: 'Washington',
    state: 'DC',
    postalCode: '20500',
    country: 'US',
  });
});

test('strict: parses a three-line address with a second street line', () => {
  const address = parseAddress('350 Fifth Avenue\nSuite 7500\nNew York, NY 10118');
  assert.equal(address.line1, '350 Fifth Avenue');
  assert.equal(address.line2, 'Suite 7500');
  assert.equal(address.city, 'New York');
});

test('strict: accepts a ZIP+4 code', () => {
  const address = parseAddress('1 Infinite Loop\nCupertino, CA 95014-2083');
  assert.equal(address.postalCode, '95014-2083');
});

test('strict: rejects a missing comma before the state', () => {
  assert.throws(
    () => parseAddress('1600 Pennsylvania Ave NW\nWashington DC 20500'),
    (err: unknown) => err instanceof AddressError && err.field === 'city/state/zip',
  );
});

test('strict: rejects a full state name', () => {
  assert.throws(
    () => parseAddress('1600 Pennsylvania Ave NW\nWashington, District of Columbia 20500'),
    (err: unknown) => err instanceof AddressError && err.field === 'city/state/zip',
  );
});

test('strict: rejects an unrecognized state code', () => {
  assert.throws(
    () => parseAddress('123 Main St\nSpringfield, ZZ 12345'),
    (err: unknown) => err instanceof AddressError && err.field === 'state',
  );
});

test('strict: rejects a zip that is not 5 or 5+4 digits', () => {
  assert.throws(
    () => parseAddress('123 Main St\nSpringfield, IL 1234'),
    (err: unknown) => err instanceof AddressError && err.field === 'city/state/zip',
  );
});

test('strict: rejects a city with disallowed characters', () => {
  assert.throws(
    () => parseAddress('123 Main St\nSpringfield #2, IL 62701'),
    (err: unknown) => err instanceof AddressError && err.field === 'city',
  );
});

test('strict: rejects fewer than two lines', () => {
  assert.throws(
    () => parseAddress('123 Main St'),
    (err: unknown) => err instanceof AddressError && err.field === 'input',
  );
});

test('strict: rejects more than three lines', () => {
  assert.throws(
    () => parseAddress('123 Main St\nApt 4\nFloor 2\nSpringfield, IL 62701'),
    (err: unknown) => err instanceof AddressError && err.field === 'input',
  );
});

test('strict: rejects input that is only a city/state/zip line', () => {
  assert.throws(
    () => parseAddress('   \nSpringfield, IL 62701'),
    (err: unknown) => err instanceof AddressError && err.field === 'input',
  );
});

test('strict: rejects a street line over 60 characters', () => {
  const longLine = 'A'.repeat(61);
  assert.throws(
    () => parseAddress(`${longLine}\nSpringfield, IL 62701`),
    (err: unknown) => err instanceof AddressError && err.field === 'line1',
  );
});

test('lenient: accepts a missing comma before the state', () => {
  const address = parseAddress('1600 Pennsylvania Ave NW\nWashington DC 20500-1600', {
    lenient: true,
  });
  assert.equal(address.city, 'Washington');
  assert.equal(address.state, 'DC');
  assert.equal(address.postalCode, '20500-1600');
});

test('lenient: maps a full state name to its code', () => {
  const address = parseAddress('900 Congress Ave\nAustin, Texas 78701', { lenient: true });
  assert.equal(address.city, 'Austin');
  assert.equal(address.state, 'TX');
});

test('lenient: repairs a zip with stray whitespace', () => {
  const address = parseAddress('123 Main St\nSpringfield, IL 6 2 7 0 1', { lenient: true });
  assert.equal(address.postalCode, '62701');
});

test('lenient: restores a dropped leading zero in a zip', () => {
  const address = parseAddress('123 Main St\nBoston, MA 2101', { lenient: true });
  assert.equal(address.postalCode, '02101');
});

test('lenient: strips disallowed characters from a city name', () => {
  const address = parseAddress('123 Main St\nSpringfield #2, IL 62701', { lenient: true });
  assert.equal(address.city, 'Springfield');
});

test('lenient: collapses runs of internal whitespace', () => {
  const address = parseAddress('123   Main St\nSpringfield,  IL   62701', { lenient: true });
  assert.equal(address.line1, '123 Main St');
});

test('lenient: still throws when the state cannot be resolved at all', () => {
  assert.throws(
    () => parseAddress('123 Main St\nSpringfield, ***  62701', { lenient: true }),
    (err: unknown) => err instanceof AddressError,
  );
});

test('lenient: still throws when nothing resembling a zip is present', () => {
  assert.throws(
    () => parseAddress('123 Main St\nSpringfield, IL', { lenient: true }),
    (err: unknown) => err instanceof AddressError && err.field === 'city/state/zip',
  );
});

test('lenient: allows an unrecognized but plausible state code to pass through', () => {
  const address = parseAddress('123 Main St\nSpringfield, ZZ 62701', { lenient: true });
  assert.equal(address.state, 'ZZ');
});

test('formatAddress: round-trips a two-line address', () => {
  const address = parseAddress('1600 Pennsylvania Ave NW\nWashington, DC 20500');
  assert.deepEqual(formatAddress(address), ['1600 Pennsylvania Ave NW', 'Washington, DC 20500']);
});

test('formatAddress: includes line2 when present', () => {
  const address = parseAddress('350 Fifth Avenue\nSuite 7500\nNew York, NY 10118');
  assert.deepEqual(formatAddress(address), [
    '350 Fifth Avenue',
    'Suite 7500',
    'New York, NY 10118',
  ]);
});
