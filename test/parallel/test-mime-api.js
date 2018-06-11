'use strict';

require('../common');
const assert = require('assert');
const { MIME } = require('mime');


const WHITESPACES = '\t\n\f\r ';
const NOT_HTTP_TOKEN_CODE_POINT = ',';
const NOT_HTTP_QUOTED_STRING_CODE_POINT = '\n';

const mime = new MIME('application/ecmascript; ');
const mime_descriptors = Object.getOwnPropertyDescriptors(mime);
const mime_proto = Object.getPrototypeOf(mime);
const mime_impersonator = Object.create(mime_proto);
for (const key of Object.keys(mime_descriptors)) {
  const descriptor = mime_descriptors[key];
  if (descriptor.get) {
    assert.throws(descriptor.get.call(mime_impersonator), /Invalid receiver/i);
  }
  if (descriptor.set) {
    assert.throws(descriptor.set.call(mime_impersonator, 'x'), /Invalid receiver/i);
  }
}



assert.strictEqual(JSON.stringify(mime), JSON.stringify('application/ecmascript'));
assert.strictEqual(`${mime}`, 'application/ecmascript');
assert.strictEqual(mime.type, 'application');
assert.strictEqual(mime.subtype, 'ecmascript');
assert.ok(mime.params);
assert.deepStrictEqual([], [...mime.params]);
assert.strictEqual(mime.params.has('not found'), false);
assert.strictEqual(mime.params.get('not found'), null);
assert.strictEqual(mime.params.delete('not found'), undefined);


mime.type = 'text';
assert.strictEqual(mime.type, 'text');
assert.strictEqual(JSON.stringify(mime), JSON.stringify('text/ecmascript'));
assert.strictEqual(`${mime}`, 'text/ecmascript');

mime.type = `${WHITESPACES}text`;
assert.strictEqual(mime.type, 'text');
assert.strictEqual(JSON.stringify(mime), JSON.stringify('text/ecmascript'));
assert.strictEqual(`${mime}`, 'text/ecmascript');

assert.throws(() => mime.type = '', /type/i);
assert.throws(() => mime.type = '/', /type/i);
assert.throws(() => mime.type = 'x/', /type/i);
assert.throws(() => mime.type = '/x', /type/i);
assert.throws(() => mime.type = NOT_HTTP_TOKEN_CODE_POINT, /type/i);
assert.throws(() => mime.type = `${NOT_HTTP_TOKEN_CODE_POINT}/`, /type/i);
assert.throws(() => mime.type = `/${NOT_HTTP_TOKEN_CODE_POINT}`, /type/i);


mime.subtype = 'javascript';
assert.strictEqual(mime.type, 'text');
assert.strictEqual(JSON.stringify(mime), JSON.stringify('text/javascript'));
assert.strictEqual(`${mime}`, 'text/javascript');

mime.subtype = `javascript${WHITESPACES}`;
assert.strictEqual(mime.type, 'text');
assert.strictEqual(JSON.stringify(mime), JSON.stringify('text/javascript'));
assert.strictEqual(`${mime}`, 'text/javascript');

assert.throws(() => mime.subtype = '', /subtype/i);
assert.throws(() => mime.subtype = ';', /subtype/i);
assert.throws(() => mime.subtype = 'x;', /subtype/i);
assert.throws(() => mime.subtype = ';x', /subtype/i);
assert.throws(() => mime.subtype = NOT_HTTP_TOKEN_CODE_POINT, /subtype/i);
assert.throws(() => mime.subtype = `${NOT_HTTP_TOKEN_CODE_POINT};`, /subtype/i);
assert.throws(() => mime.subtype = `;${NOT_HTTP_TOKEN_CODE_POINT}`, /subtype/i);


const params = mime.params;
params.set('charset', 'utf-8');
assert.strictEqual(params.has('charset'), true);
assert.strictEqual(params.get('charset'), 'utf-8');
assert.deepStrictEqual([...params], [['charset', 'utf-8']]);
assert.strictEqual(JSON.stringify(mime), JSON.stringify('text/javascript;charset=utf-8'));
assert.strictEqual(`${mime}`, 'text/javascript;charset=utf-8');

params.set('goal', 'module');
assert.strictEqual(params.has('goal'), true);
assert.strictEqual(params.get('goal'), 'module');
assert.deepStrictEqual([...params], [['charset', 'utf-8'],['goal', 'module']]);
assert.strictEqual(JSON.stringify(mime), JSON.stringify('text/javascript;charset=utf-8;goal=module'));
assert.strictEqual(`${mime}`, 'text/javascript;charset=utf-8;goal=module');

params.set(`${WHITESPACES}goal`, 'module');
assert.strictEqual(params.has('goal'), true);
assert.strictEqual(params.get('goal'), 'module');
assert.deepStrictEqual([...params], [['charset', 'utf-8'],['goal', 'module']]);
assert.strictEqual(JSON.stringify(mime), JSON.stringify('text/javascript;charset=utf-8;goal=module'));
assert.strictEqual(`${mime}`, 'text/javascript;charset=utf-8;goal=module');

params.set('charset', 'iso-8859-1');
assert.strictEqual(params.has('charset'), true);
assert.strictEqual(params.get('charset'), 'iso-8859-1');
assert.deepStrictEqual([...params], [['charset', 'iso-8859-1'],['goal','module']]);
assert.strictEqual(JSON.stringify(mime), JSON.stringify('text/javascript;charset=iso-8859-1;goal=module'));
assert.strictEqual(`${mime}`, 'text/javascript;charset=iso-8859-1;goal=module');

params.delete('charset');
assert.strictEqual(params.has('charset'), false);
assert.strictEqual(params.get('charset'), null);
assert.deepStrictEqual([...params], [['goal', 'module']]);
assert.strictEqual(JSON.stringify(mime), JSON.stringify('text/javascript;goal=module'));
assert.strictEqual(`${mime}`, 'text/javascript;goal=module');

assert.throws(() => params.set('', 'x'), /parameter name/i);
assert.throws(() => params.set('=', 'x'), /parameter name/i);
assert.throws(() => params.set('x=', 'x'), /parameter name/i);
assert.throws(() => params.set('=x', 'x'), /parameter name/i);
assert.throws(() => params.set(`${NOT_HTTP_TOKEN_CODE_POINT}=`, 'x'), /parameter name/i);
assert.throws(() => params.set(`${NOT_HTTP_TOKEN_CODE_POINT}x`, 'x'), /parameter name/i);
assert.throws(() => params.set(`x${NOT_HTTP_TOKEN_CODE_POINT}`, 'x'), /parameter name/i);

assert.throws(() => params.set('x', ''), /parameter value/i);
assert.throws(() => params.set('x', `${NOT_HTTP_QUOTED_STRING_CODE_POINT};`), /parameter value/i);
assert.throws(() => params.set('x', `${NOT_HTTP_QUOTED_STRING_CODE_POINT}x`), /parameter value/i);
assert.throws(() => params.set('x', `x${NOT_HTTP_QUOTED_STRING_CODE_POINT}`), /parameter value/i);
