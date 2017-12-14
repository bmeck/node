'use strict';

const acorn = require('internal/deps/acorn/dist/acorn');
const walk = require('internal/deps/acorn/dist/walk');

const declare = (node, type, declarators, state) => {
  let hoistedInit = type === 'function';
  let tdz = type === 'class' || type === 'let' || type === 'const';
  if (!tdz) {
    state.preamble[state.preamble.length] = (
      context => `${ context }.defineProperties(${ context }.env, { ${
          Object.entries(declarators).map(
            ([id, init]) => `${id}: {
              value: ${hoistedInit ? state.wrapped.slice(init.start, init.end) : 'void 0'},
              writable: true,
              configurable: true
            }`
          ).join(', ')
        } });`
    );
  } else {
    state.preamble[state.preamble.length] = (
      context => `${ context }.defineProperties(${ context }.env, { ${
          Object.entries(declarators).map(
            ([id]) => `${id}: {
              get() {${ id }; let ${ id };},
              set(v) {${ id }; let ${ id };},
              configurable: true
            }`
          ).join(', ')
        } });`
    );
  }
  if (hoistedInit) {
    state.replace(node.start, node.end, '');
  }
  else {
    state.replace(node.start, node.end,
      context => `${ context }.defineProperties(${ context }.env, { ${
          Object.entries(declarators).map(
            ([id, init]) => `${id}: {
              value: ${ init ? state.wrapped.slice(init.start, init.end) : 'void 0' },
              writable: ${ type !== 'const' ? 'true' : 'false' },
              configurable: true
            }`
          ).join(', ')
        } });`
    );
  }
}

const noop = () => {};
const visitorsWithoutAncestors = {
  ClassDeclaration(node, state, c) {
    if (state.ancestors[state.ancestors.length - 2] === state.body) {
      declare(node, 'class', {
        [node.id.name]: node
      }, state, node);
    }
  },
  FunctionDeclaration(node, state, c) {
    const id = node.id.name;
    declare(node, 'function', {
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
        state.identifiers.add(decl.id.name);
        declarators[decl.id.name] = decl.init;
      }
      declare(node, node.kind, declarators, state);
    }

    walk.base.VariableDeclaration(node, state, c);
  },
  ExpressionStatement(node, state, c) {
    if (state.frameDepth === 0) {
      state.replace(node.start, node.end,
          context => `${context}.completionValue = ${state.wrapped.slice(node.start, node.end)}`
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

const WRAPPED_PREFIX = '(async () => {';
const WRAPPED_SUFFIX = '})()';
function processTopLevelAwait(src, contextObject) {
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
    wrapped,
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
    } while (state.identifiers.has(id));
    return id;
  }
  const contextIdentifier = generateHygenicIdentifier();
  const ret = wrappedArray.map((item)=>{
    if (typeof item === 'function') {
      return item(contextIdentifier);
    }
    return item;
  }).join('')
    .replace(WRAPPED_PREFIX, `(async (${contextIdentifier}) => {`)
    .slice(0, -WRAPPED_SUFFIX.length) + `; return ${contextIdentifier}.completionValue;` + WRAPPED_SUFFIX.replace('()', '')
  return ret;
}

module.exports = {
  processTopLevelAwait
};
