# MIME

<!--introduced_in=REPLACEME-->

> Stability: 1 - Experimental

The `mime` module provides utilities for MIME parsing. It can be
accessed using:

```js
const mime = require('mime');
```

## MIME Strings and MIME Objects

A MIME string is a structured string containing multiple meaningful components.
When parsed, a MIME object is returned containing properties for each of these
components.

The `mime` module provides a single API for working with MIMEs based upon the [WHATWG MIME Standard](https://mimesniff.spec.whatwg.org/).

Parsing a MIME string using the WHATWG parsing algorithm:

```js
const myMIME = new MIME('text/javascript; goal=script');
```

## The MIME API

### Class: MIME
<!-- YAML
added: REPLACEME
-->

`MIME` class, implemented by following the WHATWG MIME Parsing Algorithm.
[Examples of parsed MIMEs][] may be found in the Standard itself.

In accordance with browser conventions, all properties of `MIME` objects
are implemented as getters and setters on the class prototype, rather than as
data properties on the object itself.

#### Constructor: new MIME(input)

* `input` {string} The input MIME to parse

Creates a new `MIME` object by parsing the `input`.

```js
const myMIME = new MIME('text/plain');
```

A `TypeError` will be thrown if the `input` is not a valid MIME. Note
that an effort will be made to coerce the given values into strings. For
instance:

```js
const myMIME = new MIME({ toString: () => 'text/plain' });
// text/plain
```

#### mime.type

* {string}

Gets and sets the type portion of the MIME.

```js
const myMIME = new MIME('text/javascript');
console.log(myMIME.type);
// Prints text

myMIME.type = 'application';
console.log(myMIME.type);
// Prints application
```

#### mime.subtype

* {string}

Gets and sets the subtype portion of the MIME.

```js
const myMIME = new MIME('text/ecmascript');
console.log(myMIME.subtype);
// Prints ecmascript

myMIME.subtype = 'javascript';
console.log(myMIME.subtype);
// Prints javascript
```

#### mime.params

* {MIMEParams}

Gets the [`MIMEParams`][] object representing the parameters of the
MIME. This property is read-only. See [`MIMEParams`][]
documentation for details.

#### mime.toString()

* Returns: {string}

The `toString()` method on the `MIME` object returns the serialized MIME. The
value returned is equivalent to that of [`mime.toJSON()`][].

Because of the need for standard compliance, this method does not allow users
to customize the serialization process of the MIME.

#### mime.toJSON()

* Returns: {string}

The `toJSON()` method on the `MIME` object returns the serialized MIME. The
value returned is equivalent to that of [`mime.toString()`][].

This method is automatically called when an `MIME` object is serialized
with [`JSON.stringify()`][].

```js
const myMIMES = [
  new MIME('img/png'),
  new MIME('img/gif')
];
console.log(JSON.stringify(myMIMES));
// Prints ["img/png", "img/gif"]
```

### Class: MIMEParams
<!-- YAML
added: REPLACEME
-->

The `MIMEParams` API provides read and write access to the parameters of a
`MIME`.

#### Constructor: new MIMEParams()

Instantiate a new empty `MIMEParams` object.

#### mimeParams.delete(name)

* `name` {string}

Remove all name-value pairs whose name is `name`.

#### mimeParams.entries()

* Returns: {Iterator}

Returns an ES6 Iterator over each of the name-value pairs in the parameters.
Each item of the iterator is a JavaScript Array. The first item of the Array
is the `name`, the second item of the Array is the `value`.

Alias for [`mimeParams[@@iterator]()`][`mimeParams@@iterator()`].

#### mimeParams.get(name)

* `name` {string}
* Returns: {string} or `null` if there is no name-value pair with the given
  `name`.

Returns the value of the first name-value pair whose name is `name`. If there
are no such pairs, `null` is returned.

#### mimeParams.has(name)

* `name` {string}
* Returns: {boolean}

Returns `true` if there is at least one name-value pair whose name is `name`.

#### mimeParams.keys()

* Returns: {Iterator}

Returns an ES6 Iterator over the names of each name-value pair.

```js
const { params } = new MIME('text/plain;foo=0;bar=1');
for (const name of params.keys()) {
  console.log(name);
}
// Prints:
//   foo
//   bar
```

#### mimeParams.set(name, value)

* `name` {string}
* `value` {string}

Sets the value in the `MIMEParams` object associated with `name` to
`value`. If there are any pre-existing name-value pairs whose names are `name`,
set the first such pair's value to `value`.

```js
const { params } = new MIME('text/plain;foo=0;bar=1');
params.set('foo', 'def');
params.set('baz', 'xyz');
console.log(params.toString());
// Prints foo=def&bar=1&baz=xyz
```

#### mimeParams.values()

* Returns: {Iterator}

Returns an ES6 Iterator over the values of each name-value pair.

#### mimeParams\[@@iterator\]()

* Returns: {Iterator}

Returns an ES6 Iterator over each of the name-value pairs in the query string.
Each item of the iterator is a JavaScript Array. The first item of the Array
is the `name`, the second item of the Array is the `value`.

Alias for [`mimeParams.entries()`][].

```js
const { params } = new MIME('text/plain;foo=bar;xyz=baz');
for (const [name, value] of params) {
  console.log(name, value);
}
// Prints:
//   foo bar
//   xyz baz
```
