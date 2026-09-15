import assert from 'node:assert/strict';
import test from 'node:test';

import {
  EXPECTED_TRACK_COUNT,
  TrackCatalogValidationError,
  loadTrackCatalog,
  parseTrackCatalog,
} from '../src/tracks/catalog.js';

test('bundled FH6 catalog validates and exposes all 77 normalized routes', () => {
  const catalog = loadTrackCatalog();

  assert.equal(catalog.version, 1);
  assert.equal(catalog.game, 'fh6');
  assert.equal(catalog.count, EXPECTED_TRACK_COUNT);
  assert.equal(catalog.routes.length, 77);
  assert.equal(Object.keys(catalog.byId).length, 77);

  assert.deepEqual(catalog.byId['airfield-trail'], {
    id: 'airfield-trail',
    name: 'Airfield Trail',
    kind: 'sprint',
    start: { x: 852.5, z: -1256.7 },
    distance: 5951.6,
    span: { x: 2382.2, z: 2073.9 },
  });
  assert.equal(catalog.byId['the-goliath'].name, 'The Goliath');
  assert.ok(Object.isFrozen(catalog));
  assert.ok(Object.isFrozen(catalog.routes));
  assert.ok(Object.isFrozen(catalog.routes[0].start));
});

test('catalog validation reports indexed field diagnostics and duplicate IDs', () => {
  const source = {
    version: 1,
    game: 'fh6',
    routes: [
      { key: 'same', name: 'Valid', kind: 'sprint', start: [1, 2], length: 3, span: [4, 5] },
      { key: 'same', name: '', kind: 'oval', start: [1, 'bad'], length: 0, span: [-1, 2] },
    ],
  };

  assert.throws(
    () => parseTrackCatalog(source, { expectedCount: 2 }),
    (error) => {
      assert.ok(error instanceof TrackCatalogValidationError);
      assert.equal(error.code, 'ERR_FH6_TRACK_CATALOG');
      assert.deepEqual(
        error.issues.map(({ path, code }) => ({ path, code })),
        [
          { path: 'routes[1].key', code: 'duplicate_id' },
          { path: 'routes[1].name', code: 'invalid_name' },
          { path: 'routes[1].kind', code: 'invalid_kind' },
          { path: 'routes[1].start[1]', code: 'invalid_number' },
          { path: 'routes[1].span[0]', code: 'non_positive' },
          { path: 'routes[1].length', code: 'non_positive' },
        ],
      );
      return true;
    },
  );
});

test('catalog validation rejects malformed JSON and wrong catalog metadata', () => {
  assert.throws(
    () => parseTrackCatalog('{nope'),
    (error) => error instanceof TrackCatalogValidationError
      && error.issues[0].code === 'invalid_json',
  );

  assert.throws(
    () => parseTrackCatalog({ version: 2, game: 'other', routes: [] }),
    (error) => {
      assert.deepEqual(error.issues.map((entry) => entry.code), [
        'unsupported_version',
        'unsupported_game',
        'unexpected_count',
      ]);
      return true;
    },
  );
});

