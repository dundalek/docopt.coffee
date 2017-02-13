const fs = require('fs');
const assert = require('assert');
const { docopt } = require('./docopt');

function parseTests(raw) {
  raw = raw.replace(/#.*$/mg, '');

  return raw.split('r"""').slice(1).map((fixture) => {

    var name = '';
    var parts = fixture.split('"""');
    var doc = parts[0];
    var body = parts[1];

    var cases = body.split('$').slice(1).map((c) => {
      parts = c.trim().split('\n');
      var expected = JSON.parse(parts.slice(1).join('\n'));
      parts = parts[0].trim().split(' ');
      var prog = parts[0];
      var argv = parts.slice(1).join(' ');
      return { prog, argv, expected };
    });

    return { doc, cases };
  });
}

describe('docopt', () => {
  parseTests(fs.readFileSync('docopt/testcases.docopt', 'utf-8'))
    .forEach(({ doc, cases }, i) => {
      describe(`${i}`, () => {
        cases.forEach(({ prog, argv, expected }) => {
          it(`${prog} ${argv}`, () => {
            var actual;
            try {
              actual = docopt(doc, { argv });
            } catch (e) {
              actual = 'user-error';
            }
            assert.deepEqual(actual, expected);
          });
        });
      });
    });
});
