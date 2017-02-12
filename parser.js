var fs = require('fs');
var ohm = require('ohm-js');
var docopt = require('./docopt');
var _ = require('lodash');

function optimize(e) {
  switch(e.type) {
    case 'Required':
    case 'Either':
      e.children = e.children.map(optimize);
      if (e.children.length === 1) {
        return e.children[0];
      }
      return e;
    case 'Optional':
      e.children = e.children.map(optimize);
      if (e.children.length === 1 && e.children[0].type === 'Required') {
        e.children = e.children[0].children;
      }
      return e;
  }
  if (e.children) {
    e.children = e.children.map(optimize);
  }
  return e;
}

function optimizeRoot(e) {
  var x = optimize(e);
  if (x.type !== 'Required') {
    return {type: 'Required', children: [x]};
  }
  return x;
}

var actionDict = {
  Start: function(a) {
    return optimizeRoot({
      type: 'Required',
      children: a.ast()
    });
  },
  Seq: function(e) {
    return {
      type: 'Required',
      children: e.ast()
    };
  },
  Expr: function(first, pipes, rest) {
    return {
      type: 'Either',
      children: [first.ast()].concat(rest.ast())
    };
  },
  AtomExpr: function(e, repeat) {
    if (repeat.ast().length > 0) {
      return {type: 'OneOrMore', children: [e.ast()]};
    }
    return e.ast();
  },
  Atom: function(e) {
    return e.ast();
  },
  Atom_options: function(e) {
    return {
      "type": "Optional",
      "children": [
        {
          "type": "AnyOptions",
          "children": []
        }
      ]
    };
  },
  Required: function(leftParen, e, rightParen) {
    return {
      type: 'Required',
      children: [e.ast()]
    };
  },
  Optional: function(leftParen, e, rightParen) {
    return {
      type: 'Optional',
      children: [e.ast()]
    };
  },
  longoption: function(dashes, name, c, arg) {
    var argcount = 0;
    var value = null;
    arg = arg.ast();
    if (arg.length && arg[0].type === 'Argument') {
      argcount = 1;
      value = arg[0].name;
    }
    return { type: 'Option', short: null, long: dashes.ast() + name.ast().join(''), argcount, value };
  },
  shortoptions: function(a, b) {
    // if (this.sourceString.length > 2) {
    //
    // }
    //  else {
    return {'type': 'Option', short: this.sourceString, long: null};
    //  }
  },
  ShortOptionsArg: function(a, b, c, d, e, f, g ,h) {
    return ['ShortOptionsArg', this.sourceString];
  },
  argument_bracketed(a, b, c) {
    return {type: 'Argument', name: this.sourceString, value: null};
  },
  argument_uppercased(a, b) {
    return {type: 'Argument', name: this.sourceString, value: null};
  },
  command(a) {
    return {type: 'Command', name: this.sourceString, value: false};
  },
  _terminal() {
    return this.sourceString;
  }
}

function translateAST(e) {
  if (e.children) {
    var children = e.children.map(translateAST);
    return new docopt[e.type](children);
  }
  switch (e.type) {
    case 'Argument': return new docopt[e.type](e.name, e.value);
    case 'Command': return new docopt[e.type](e.name, e.value);
    case 'Option': return new docopt[e.type](e.short, e.long, e.argcount, e.value);
  }
}

function traverseArgs(e, options, idx) {
  if (!idx) {
    options = options.map(x => JSON.parse(JSON.stringify(x)));
    idx = {
      short: _(options).filter('short').keyBy('short').value(),
      long: _(options).filter('long').keyBy('long').value()
    };
  }

  if (e.children) {
    var children = [];
    for (var i = 0; i < e.children.length; i += 1) {
      var child = traverseArgs(e.children[i], options, idx);

      if (child.type === 'Option' && child.short && child.short.length !== 2) {
        var opts = child.short.split('').slice(1).map(c => ({
          type: 'Option',
          short: '-' + c,
          argcount: 0,
          value: false,
        }));
        [].splice.apply(e.children, [i, 1].concat(opts));
        child = e.children[i];
      }

      if (child.type === 'Option' && (child.short in idx.short || child.long in idx.long)) {
        var opt = idx.short[child.short] || idx.long[child.long];
        if (child.short in idx.short) {
          child.long = child.long || idx.short[child.short].long;
        }
        if (child.long in idx.long) {
          child.short = child.short || idx.long[child.long].short;
        }
        if (opt.argcount > 0 && i < e.children.length - 1 && e.children[i+1].type === 'Argument') {
          child.argcount = 1;
          child.value = e.children[i+1].name;
          i += 1;
        } else if (!child.value) {
          child.value = true;
        }
      }
      children.push(child);
    }
    e.children = children;
  }
  return e;
}

var grammar = ohm.grammar(fs.readFileSync(__dirname + '/docopt.ohm', 'utf-8'));
var semantics = grammar.createSemantics().addOperation('ast', actionDict);

module.exports = {
  grammar,
  semantics,
  optimize,
  optimizeRoot,
  translateAST,
  traverseArgs
};
