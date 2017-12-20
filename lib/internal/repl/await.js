'use strict';

const acorn = require('internal/deps/acorn/dist/acorn');
const walk = require('internal/deps/acorn/dist/walk');

const declare = (node, type, ids, state) => {
  const hoistedInit = type === 'function';
  const tdz = type === 'class' || type === 'let' || type === 'const';
  if (!tdz) {
    const src = state.wrapped.slice(node.start, node.end);
    state.preamble[state.preamble.length] = (context) => {
      let ret = `${ hoistedInit ? src : '' };`;
      ret += `${context}.defineProperties(${context}.env, { ${
        ids.map(id => `${id}: {
          value: ${hoistedInit ? id : 'void 0'},
          writable: true,
          enumerable: true,
          configurable: true
        }`).join(', ')
      } });`;
      return `await (async () => { ${ret} })();`;
    }
  } else {
    state.preamble[state.preamble.length] = (context) => {
      let ret = `${context}.defineProperties(${context}.env, { ${
        ids.map(id => `${id}: {
          get() {${id}; let ${id};},
          set($${id}) {${id}; let ${id};},
          enumerable: true,
          configurable: true
        }`).join(', ')
      } });`;
      return ret;
    };
  }
  if (hoistedInit) {
    state.replace(node.start, node.end, '');
  } else {
    const src = state.wrapped.slice(node.start, node.end);
    state.replace(node.start, node.end, (context) => {
      let ret = `${src};`;
      ret += `${context}.defineProperties(${context}.env, { ${
        ids.map(id => `${id}: {
          get: () => ${id},
          set: ($${id}) => ${id} = $${id},
          enumerable: true,
          configurable: true
        }`).join(', ')
      } });`;
      return `await (async () => { ${ret} })()${src.slice(-1) === ';' ? ';' : ''}`;
    });
  }
};

const gatherIdentifiers = (node) => {
  if (node.type === 'VariableDeclarator') {
    return gatherIdentifiers(node.id);
  }
  if (node.type === 'Identifier') {
    return [node.name];
  }
  if (node.type === 'ObjectPattern') {
    return node.properties.reduce((acc, prop) => {
      return [...acc, ...gatherIdentifiers(prop.value)];
    }, []);
  }
  if (node.type === 'AssignmentPattern') {
    return gatherIdentifiers(node.left);
  }
  if (node.type === 'ArrayPattern') {
    return node.elements.reduce((acc, element) => {
      return [...acc, ...gatherIdentifiers(element)];
    }, []);
  }
  return [];
}
const isNotInBlock = (state) => {
  search:
  for (let i = state.ancestors.length - 2; i >= 0; i--) {
    const ancestor = state.ancestors[i];
    if (ancestor === state.body) return true;
    switch (ancestor.type) {
      case 'LabeledStatement':
        break;
      default:
        return false;
    }
  }
  return false;
}
const visitorsWithoutAncestors = {
  __proto__: null,
  ClassDeclaration(node, state, c) {
    if (isNotInBlock(state)) {
      const id = node.id.name;
      state.identifiers.add(id);
      declare(node, 'class', [id], state);
    }
    state.functionDepth++;
    state.frameDepth++;
    walk.base.ClassDeclaration(node, state, c);
    state.frameDepth--;
    state.functionDepth--;
  },
  FunctionDeclaration(node, state, c) {
    // console.error('depth=', state.frameDepth, 'FunctionDecl', node.id.name)
    if (state.frameDepth === 0) {
      const id = node.id.name;
      state.identifiers.add(id);
      declare(node, 'function', [id], state);
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
  CallExpression(node, state, c) {
    if (node.callee.type === 'Identifier' && node.callee.name === 'eval') {
      const inside = state.cut(node.start, node.end);
      state.replace(node, context => {
        `(${context}.guard(), {_:${inside(context)},$:${context}.unguard()})._)`
      });
    }
    walk.base.CallExpression(node, state, c);
  },
  ReturnStatement(node, state, c) {
    if (state.frameDepth === 0) {
      state.containsInvalidSyntax = true;
    }
    walk.base.ReturnStatement(node, state, c);
  },
  VariableDeclaration(node, state, c) {
    if (state.frameDepth === 0) {
      if (node.kind === 'var' || isNotInBlock(state)) {
        const declaringIds = [];
        for (const declarator of node.declarations) {
          const ids = gatherIdentifiers(declarator);
          for (const id of ids) {
            state.identifiers.add(id);
          }
          declaringIds.push(...ids);
        }
        declare(node, node.kind, declaringIds, state);
      }
    }

    walk.base.VariableDeclaration(node, state, c);
  },
  BlockStatement(node, state, c) {
    if (node === state.body) {
      const prologues = [];
      const stmts = node.body;
      for (let i = 0; i < stmts.length; i++) {
        const stmt = stmts[i];
        if (stmt.type !== 'ExpressionStatement') break;
        if (stmt.expression.type !== 'Literal') break;
        if (typeof stmt.expression.value !== 'string') break;
        prologues.push(stmt.expression.raw);
      }
      if (prologues.length) {
        state.replace(node.start, node.start+1, `{${prologues.join(';')};`);
      }
    }
    walk.base.BlockStatement(node, state, c);
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
    cut(from, to) {
      let items = [];
      for (var i = from; i < to; i++) {
        items[items.length] = wrappedArray[i];
        wrappedArray[i] = '';
      }
      return (context) => items.map(_ => typeof _ === 'function' ?
                                          _(context) :
                                          _)
                                        .join('');
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
  const preamble = state.preamble.map((item) => {
    if (typeof item === 'function') {
      return item(ctxId);
    }
    return item;
  }).join('');
  const code = wrappedArray.map((item) => {
    if (typeof item === 'function') {
      return item(ctxId);
    }
    return item;
  }).join('');
  const retWrapped = `(async (${
    ctxId
  }) => { with (${ctxId}.env) { ${preamble} return (await (${
    code
  }), [${ctxId}.completionValue]); } })`;
  // console.error('wrapped', retWrapped)
  return retWrapped;
}

module.exports = {
  processTopLevelAwait
};
