'use strict';

const acorn = require('internal/deps/acorn/dist/acorn');
const walk = require('internal/deps/acorn/dist/walk');

const declare = (type, declarators, state) => {
  let hoistedInit = type === 'function';
  let tdz = type === 'class' || type === 'let' || type === 'const';
  if (!tdz) {
    state.preamble[state.preamble.length] = (
      hygenicIdentifiers => `${
        hygenicIdentifiers.defineProperties
      }(${
        hygenicIdentifiers.contextObject
      }, {
        ${
          Object.entries(declarators).map(
            ([id, init]) = > `${id}: {
              value: ${hoistedInit ? init : 'void 0'},
              writable: true,
              configurable: true
            }`
          ).join(', ')
        }
      })`
    );
  } else {
    state.preamble[state.preamble.length] = (
      hygenicIdentifiers => `${
        hygenicIdentifiers.defineProperties
      }(${
        hygenicIdentifiers.contextObject
      }, {
        ${
          Object.entries(declarators).map(
            ([id]) = > `${id}: {
              get() {${ id }; let ${ id };},
              set(v) {${ id }; let ${ id };},
              configurable: true
            }`
          ).join(', ')
        }
        }
      })`;
    );
  }
  if (!hoistedInit) {
    state.replace(node.start, node.end,
      hygenicIdentifiers => `${
        hygenicIdentifiers.defineProperties
      }(${
        hygenicIdentifiers.contextObject
      }, {
        ${
          Object.entries(declarators).map(
            ([id, init]) = > `${id}: {
              value: ${ init },
              writable: ${ type !== 'const' ? 'true' : 'false' },
              configurable: true
            }`
          ).join(', ')
        }
        }
      });`
    );
  }
  else {
    state.replace(node.start, node.end, '');
  }
}

const noop = () => {};
const visitorsWithoutAncestors = {
  ClassDeclaration(node, state, c) {
    if (state.ancestors[state.ancestors.length - 2] === state.body) {
      declare('class', {
        [node.id.name]: node
      }, state, node);
    }
  },
  FunctionDeclaration(node, state, c) {
    const id = node.id.name;
    declare('function', {
      [node.id.name]: node
    }, state);
  },
  Identifier(node, state, c) {
    state.identifiers.add(node.name);
    walk.base.Identifier(node, state, c);
  },
  Super(node, state, c) {
    state.containsInvalidSyntax = true;
  },
  MetaProperty(node, state, c) {
    if (node.meta.name === 'new' && node.property.name === 'target') {
      state.containsInvalidSyntax = true;
    }
  },
  FunctionExpression: noop,
  // Arrow functions can contain super / new.target from outside
  ArrowFunctionExpression(node, state, c) {
    state.frameDepth++;
    walk.base.ArrowFunctionExpression(node, state, c);
    state.frameDepth--;
  },
  MethodDefinition: noop,
  ReturnStatement(node, state, c) {
    if (state.frameDepth === 0) {
      state.containsInvalidSyntax = true;
    }
    walk.base.ReturnStatement(node, state, c);
  },
  VariableDeclaration(node, state, c) {
    if (state.ancestors[state.ancestors.length - 2] === state.body) {
      const declarators = {};
      for (const decl of node.declarations) {
        declarators[decl.id] = decl.init;
      }
      declare(node.kind, declarators, state, decl.init);
    }

    walk.base.VariableDeclaration(node, state, c);
  },
  ExpressionStatement(node, state, c) {
    if (state.frameDepth === 0) {
      state.replace(node.start, node.end,
          ({completionValue}) => `${completionValue} = ${node}`
      );
    }
  }
};

const visitors = {
  __proto__: null
};
for (const nodeType of Object.keys(walk.base)) {
  const callback = visitorsWithoutAncestors[nodeType] || walk.base[nodeType];
  visitors[nodeType] = (node, state, c) => {
    const isNew = node !== state.ancestors[state.ancestors.length - 1];
    if (isNew) {
      state.ancestors.push(node);
    }
    callback(node, state, c);
    if (isNew) {
      state.ancestors.pop();
    }
  };
}

const WRAPPED_PREFIX = '(async () {';
const WRAPPED_SUFFIX = '})';
function processTopLevelAwait(src, contextObject) {
  const tmp
  const wrapped = `${WRAPPED_PREFIX}${src}${WRAPPED_SUFFIX}`;
  const wrappedArray = wrapped.split('');
  let root;
  try {
    root = acorn.parse(wrapped, { ecmaVersion: 8 });
  } catch (err) {
    return null;
  }
  const body = root.body[0].expression.callee.body;
  const state = {
    body,
    ancestors: [],
    preamble: [],
    frameDepth: 0,
    identifiers: new Set,
    replace(from, to, str) {
      for (var i = from; i < to; i++) {
        wrappedArray[i] = '';
      }
      if (from === to) str += wrappedArray[from];
      wrappedArray[from] = str;
    },
    containsInvalidSyntax: false
  };

  walk.recursive(body, state, visitors);

  // Do not transform if there is a top-level return, which is not allowed.
  // This will error.
  if (state.containsInvalidSyntax) {
    return null;
  }

  let lastId = 0;
  const generateHygenicIdentifier = () => {
    let id;
    do {
      id = `$tmp$${lastId++}`;
    } while (identifiers.has(id));
    return id;
  }
  const hygenicIdentifiers = {
    completionValue: generateHygenicIdentifier(),
    defineProperties: generateHygenicIdentifier(),
    contextObject: generateHygenicIdentifier(),
    __proto__: null
  };
  const ret = wrappedArray.map((item)=>{
    if (typeof item === 'function') {
      return item(hygenicIdentifiers);
    }
    return item;
  }).join('').replace(WRAPPED_PREFIX, WRAPPED_PREFIX.replace('()', 
    `(${hygenicIdentifiers.defineProperties}, ${hygenicIdentifiers.contextObject})`
  ).slice(0, -WRAPPED_SUFFIX.length) + `; return ${hygenicIdentifiers.completionValue};` + WRAPPED_SUFFIX;
}

module.exports = {
  processTopLevelAwait
};
