'use strict';

const acorn = require('internal/deps/acorn/dist/acorn');
const walk = require('internal/deps/acorn/dist/walk');

const declare = (node, type, declarators, state) => {
  const hoistedInit = type === 'function';
  const tdz = type === 'class' || type === 'let' || type === 'const';
  if (!tdz) {
    state.preamble[state.preamble.length] = (context) =>
      `${context}.defineProperties(${context}.env, { ${
        Object.entries(declarators).map(
          ([id, init]) => `${id}: {
              value: ${hoistedInit ?
    state.wrapped.slice(init.start, init.end) :
    'void 0'},
              writable: true,
              enumerable: true,
              configurable: true
            }`
        ).join(', ')
      } });`;
  } else {
    state.preamble[state.preamble.length] = (context) =>
      `${context}.defineProperties(${context}.env, { ${
        Object.entries(declarators).map(
          ([id]) => `${id}: {
              get() {${id}; let ${id};},
              set(v) {${id}; let ${id};},
              enumerable: true,
              configurable: true
            }`
        ).join(', ')
      } });`;
  }
  if (hoistedInit) {
    state.replace(node.start, node.end, '');
  } else {
    state.replace(node.start, node.end,
                  (context) => `${context}.defineProperties(${context}.env, { ${
                    Object.entries(declarators).map(
                      ([id, init]) => `${id}: {
              value: ${init ?
    state.wrapped.slice(init.start, init.end) :
    'void 0'},
              writable: ${type !== 'const' ? 'true' : 'false'},
              enumerable: true,
              configurable: true
            }`
                    ).join(', ')
                  } });`);
  }
};

const visitorsWithoutAncestors = {
  __proto__: null,
  ClassDeclaration(node, state, c) {
    if (state.ancestors[state.ancestors.length - 2] === state.body) {
      const id = node.id.name;
      state.identifiers.add(id);
      declare(node, 'class', {
        [id]: node
      }, state, node);
    }
    state.functionDepth++;
    state.frameDepth++;
    walk.base.ClassDeclaration(node, state, c);
    state.frameDepth--;
    state.functionDepth--;
  },
  FunctionDeclaration(node, state, c) {
    if (state.frameDepth === 0) {
      const id = node.id.name;
      state.identifiers.add(id);
      declare(node, 'function', {
        [id]: node
      }, state);
    }
    state.functionDepth++;
    state.frameDepth++;
    walk.base.FunctionDeclaration(node, state, c);
    state.frameDepth--;
    state.functionDepth--;
  },
  Identifier(node, state, c) {
    state.identifiers.add(node.name);
    walk.base.Identifier(node, state, c);
  },
  Super(node, state, c) {
    if (state.functionDepth === 0) {
      state.containsInvalidSyntax = true;
    }
    walk.base.Super(node, state, c);
  },
  MetaProperty(node, state, c) {
    if (state.functionDepth === 0 &&
      node.meta.name === 'new' &&
      node.property.name === 'target') {
      state.containsInvalidSyntax = true;
    }
    walk.base.MetaProperty(node, state, c);
  },
  FunctionExpression(node, state, c) {
    state.functionDepth++;
    state.frameDepth++;
    walk.base.FunctionExpression(node, state, c);
    state.frameDepth--;
    state.functionDepth--;
  },
  // Arrow functions can contain super / new.target from outside
  ArrowFunctionExpression(node, state, c) {
    state.frameDepth++;
    walk.base.ArrowFunctionExpression(node, state, c);
    state.frameDepth--;
  },
  MethodDefinition(node, state, c) {
    state.functionDepth++;
    state.frameDepth++;
    walk.base.FunctionExpression(node, state, c);
    state.frameDepth--;
    state.functionDepth--;
  },
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
      const value = state.wrapped.slice(node.start, node.end);
      state.replace(node.start, node.end,
                    (context) => `${context}.completionValue = ${value}`
      );
    }
    walk.base.ExpressionStatement(node, state, c);
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
function processTopLevelAwait(src, env) {
  let isObject = /^\s*\{/.test(src);
  if (isObject) {
    // It's confusing for `{ a : 1 }` to be interpreted as a block
    // statement rather than an object literal.  So, we first try
    // to wrap it in parentheses, so that it will be interpreted as
    // an expression.
    src = `(${src.trim()})\n`;
  }

  const wrapped = `${WRAPPED_PREFIX}${src}${WRAPPED_SUFFIX}`;
  const wrappedArray = wrapped.split('');
  let root;
  try {
    root = acorn.parse(wrapped, { ecmaVersion: 8 });
  } catch (err) {
    return null;
  }
  const body = root.body[0].expression.callee.body;
  if (isObject && (body.body.length > 1 ||
    body.body[0].type !== 'ExpressionStatement' || 
    body.body[0].expression.type !== 'ObjectExpression')) {
    throw SyntaxError('Expected an Object');
  }
  const state = {
    body,
    wrapped,
    ancestors: [],
    preamble: [],
    functionDepth: 0,
    frameDepth: 0,
    identifiers: new Set(Object.keys(env)),
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
  const generateHygenicIdentifier = (taintedIdentifiers) => {
    let id;
    do {
      id = `$tmp$${lastId++}`;
    } while (taintedIdentifiers.has(id));
    return id;
  };
  const ctxId = generateHygenicIdentifier(state.identifiers);
  const ret = wrappedArray.map((item) => {
    if (typeof item === 'function') {
      return item(ctxId);
    }
    return item;
  }).join('');
  const retWrapped = `(async (${
    ctxId
  }) => { with (${ctxId}.env) { return (await (${
    ret
  }), [${ctxId}.completionValue]); } })`;
  return retWrapped;
}

module.exports = {
  processTopLevelAwait
};
