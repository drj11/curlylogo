// $Id: //depot/prj/logoscript/master/code/logo.js#77 $
// Copyright (C) 2007 David Jones.  <drj@pobox.com>
// logo.js
// Logo without the turtle.
// Messy.
//
// References
//
// [HLM] "The Homerton LOGO Manual"; Hilary Shuard and Fred Daly; CUP;
//   1987.
//
// [UTR25] "Unicode Support for Mathematics"; Barbara Beeton,
//   Asmus Freytag, Murray Sargent III; Unicode, Inc.;
//   http://unicode.org/reports/tr25/tr25-5.html

// [MECTG] "Maximally Equidistributed Combined Tausworthe Generators";
//   Pierre L'Ecuyer; Mathematics of Computation, Volume 65, Number 213;
//   1996-01.

// :todo:
// various functions in this logo object need to refer to each other.
// They can't legitimately do this via the logo object because we might
// want to move to logo object to some other global.  Therefore the
// object needs to be bound into their closure.  Something like this:
// logo = function() {
//   var me = {
//     eval: function(e) { ... me.apply(x) },
//     apply: ...
//   };return me}()
// (this is essentially the standard hack for introducing a temporary
// namespace then defining the big object inside that namespace.)
logo = {
  global: {},
  // Extends Logos global namespace with the supplied table (which is
  // shallow copied into the global namespace, not retained).
  // :docstr:doc: extend understands a docstring convention.
  // If the table contains a key of the form 'foodoc' and the
  // corresponding value is a string then the value is written
  // into the 'doc' property of the object with key 'foo' in the table.
  // The practical upshot is that passing a table like this:
  // { foodoc: 'foos the bar', foo: function() { ... } }
  // will result in the foo function having the doc string as its .doc
  // property.  logo.docstr can then extract this string.
  extend: function(l) {
    var n, // name of Logo thing
        p  // prefix of name of docstring of the form 'foodoc'
    for(n in l) {
      if(n.match(/doc$/) && typeof l[n] === 'string') {
        p = n.replace(/doc$/, '')
        l[p].doc = l[n]
      } else {
        logo.global[n] = l[n]
      }
    }
  },
  // Return documentation string for a Logo thing with name s
  // See :docstr:doc
  docstr: function(s) {
    // :todo: for some values (I have no idea what) this function raises
    // a security error in Firefox.  Probably we are poking around
    // inside some object in the global space and we shouldn't be.
    // Simplest thing to do now is to catch the exception.  And since
    // we're catching exceptions we don't need to guard the access to
    // .doc.
    try {
      return '' + this.global[s].doc
    } catch(e) {
      ;
    }
  },
  // Apply f to l
  apply: function(f, l) {
    return f.apply(null, l)
  },
  applyc: function(c, f, l) {
    return f.apply(null, [c].concat(l))
  },
  // Evaluate a Logo expression in Lisp form
  eval: function(e) {
    var i, l, f
    switch(typeof e) {
      // Symbols (which are represented by strings).
      case 'string':
        l = logo.global[e]
        if(l === undefined) {
          throw "I don't know how to " + e
        }
        return l
      case 'number':
        return e
      // A list of some sort.
      case 'object':
        if(e[0] == 'quote') {
          return e[1]
        }
        if(e[0] == 'cell') {
          // I wonder if I'll ever write an expression like this again?
          return e[1][e[2]]
        }
        // 'qthing'
        // an ordinary list to evaluate
        l = []
        for(i=0; i<e.length; ++i) {
          l[i] = this.eval(e[i])
        }
        f = l.shift()
        return f.apply(null, l)
    }
  },
  // Continuation passing form of eval.  Performs one step of evaluation
  // and returns a contiuation for the remainder of the evaluation.  The
  // argument c is the continuation that is receives the evaluated
  // result.  When the evaluation is simple (7, FD) then c is invoked
  // directly with the evaluated result.  e is the form to evaluate.
  evalc: function(c, e) {
    var l
    switch(typeof e) {
      case 'string':
        l = logo.global[e]
        return c(l)
      case 'number':
        return c(e)
    // more stuff here
    }
    throw "eval bong!"
  },

  // :arguments: This is a one-off placeholder object that causes
  // prin1js to print out the identifier "arguments" (as opposed to the
  // string containing "arguments").  The compiler uses this.
  Arguments: {},
  // Takes a Logo list and produces a literal JavaScript form for it.
  prin1js: function(l) {
    var a, i
    switch(typeof l) {
      case 'number':
        return l.toString()
      case 'string':
        // Escape single quotes and backslashes.
        return "'" + l.replace(/[\\']/g, '\\$&') + "'"
    }
    if(l === this.Arguments) {
      // :arguments
      return 'arguments'
    }
    // Assume Array
    a = '['
    for(i=0; i<l.length; ++i) {
      if(i) {
        a += ','
      }
      a += arguments.callee(l[i])
    }
    a += ']'
    return a
  },
  // :todo: should be in truly useful really.
  // Returns index of b in a, or -1 otherwise.
  // Tested using '===' operator.
  find: function(a, b) {
    var i
    for(i=0; i<a.length; ++i) {
      if(a[i] === b) {
        return i
      }
    }
    return -1
  },
  // Compile a Logo procedure and register it in the global namespace.
  // The argument l is a list of lists, each of the inner lists being the
  // result of reading a line of input.  The src argument is the list of
  // source lines corresponding to the Logo procedure.
  // See :design:to
  compileintern: function (l, src) {
    // assert l[0][0] === 'to'
    var decl = l[0],
        procname = decl[1],
        locals = decl.slice(2),
        p = [], // list of formal parameters in JavaScript form
        b='',   // body of function
        i,
        x
    // Check locals
    for(i=0; i<locals.length; ++i) {
      x = locals[i]
      if(typeof x === 'object' &&
          (x[0] === 'quote' || x[0] === 'qthing'))
      {
        x = x[1]
      }
      if(typeof x !== 'string') {
        return 'Cannot understand argument ' + this.prin1js(x) +
            ' when trying to define ' + procname + '.'
      }
      p.push(x)
    }
    // assert l[l.length-1] === 'end'
    l.length -= 1
    var inner = this  // so inner function can use 'this'
    // Replace Varible.  Replaces a symbol (string) that is a
    // reference to a lexically captured variable by the "compiled
    // form" of a variable reference.
    var rv = function(l) {
      var i,x,a
      switch(typeof l) {
        case 'number':
          return l
        case 'string':
          // A local variable?
          x = inner.find(locals, l)
          if(x >= 0) {
            // :arguments
            return ['cell', this.Arguments, x]
          }
          return l
      }
      // Assume Array
      a = []
      for(i=0; i<l.length; ++i) {
        a[i] = rv(l[i])
      }
      return a
    }
    // compile all lines but first
    for(i=1; i<l.length; ++i) {
      // Lexically bind all capture variables.
      l[i] = rv(l[i])
      // Convert to literal JavaScript
      b += 'logo.run(' + this.prin1js(l[i]) + ')\n'
    }
    p.push(b)
    // Slightly obscure way of invoking constructor in order to make new
    // function.
    x = Function.apply(null, p)
    x.src = src
    this.global[procname] = x
    return procname + ' defined'
  },
  // Co-ordinates with run in order to read the remainder of a 'TO'
  // special form.  :rep:runner Is a REP runner.
  readto: function(l, src) {
    this.accum.push(l)
    this.src.push(src)
    if(l.length == 1 && l[0] === 'end') {
      return [this.compileintern(this.accum, this.src)]
    }
    return [[], arguments.callee]
  },
  // Takes a symbol (string) and returns truthy if it's an infix operator.
  infixp: function(s) {
    s = this.global[s]
    return s && s.infix
  },
  // Precedence of an operator already on the stack (on the left
  // as it were).
  lprec: function(f) {
    if(typeof f === 'string') {
      f = this.global[f]
      if(f === undefined) {
        // Hmm.  undefined operator (eg 2 + 3 @ 5)
        return 0
      }
    }
    if(!f.length) {
      return 64
    }
    // The "|| 1" means that "ordinary" Logo operators, like FD, have
    // less precedence than any infix operator, which means "FD 50 + 10"
    // is parsed as (FD (+ 50 10)).
    return f.infix || 1
  },
  // Precedence of an operator under consideration for shifting
  // onto the stack.
  // The right precedence of an operator is the left precedence
  // rounded down to a multiple of 2 (least significant bit is
  // cleared).  That means:
  // odd precedence <-> left-associative (no shift occurs because
  //    the right operator is one lower than the left);
  // even precedence <-> right-associative (a shift occurs because
  //    both operators have equal precedence).
  // This is a fairly well known hack in compiler writing circles
  // but I couldn't find in Dragon.
  // Here's it being used in GCC:
  // http://gcc.gnu.org/ml/gcc-patches/2000-04/msg00010.html
  // Actually instead of &~1 (which clears bit 0) we use &~65 (which
  // clears bits 0 and 6) so that the special precedence hack for arity
  // 0 operators works.
  rprec: function(x) {
    return this.lprec(x)&~65
  },
  // Takes a list and runs it.  :rep:runner Is a REP runner.
  run: function(l, src) {
    var es = [], // expression stack
        i = 0,
        f, // index of top most function / operator
        // Number of args required by f, to its right in the case of
        // infix operators like *.
        required = Infinity,
        // Stack of [f,required] pairs pushed underneath.
        s = [],
        x
    // Check for special forms.
    // There is only one: "to".
    // :todo: modularise this
    if(l[0] === 'to') {
      this.accum = [l]
      this.src = [src]
      return [[], this.readto]
    }
    while(true) {
      x = l[i]
      if(x === undefined) {
        // Denoted $ in Dragon, end of input.
        x = {}
      }
      if(es.length === f + required + 1) {
        // A reduction is possible.
        // Consider left- and right-precedences to decide whether to
        // reduce.  Note that arity 0 operators and prefix operators
        // generally have special cases in lprec which Does The Right
        // Thing.
        if(this.lprec(es[f]) > this.rprec(x)) {
          // Apply a function to its arguments.
          // Should have some sort of guard on this so that an infinitely
          // higher order function (a function that keeps returning a
          // function that keeps returning a function ...) does not
          // result in an unbreakable infinite loop.  Currently this
          // doesn't happen anyway because a procedure that is returned
          // from a procedure will not get called.
          if(es[f].infix) {
            // swap es[f] and its predecessor in the array
            x = es[f-1]
            es[f-1] = es[f]
            es[f] = x
            -- f
          }
          x = this.apply(es[f], es.slice(f+1))
          es.length = f
          if(x !== undefined) {
            es.push(x)
          }
          // pop f and required off the stack.
          x = s.pop()
          f = x[0]
          required = x[1]
          continue
        }
      }
      if(i >= l.length) {
        break
      }
      // shift
      ++i
      x = this.eval(x)
      if(typeof x === 'function') {
        s.push([f, required])
        f = es.length
        required = x.length
        if(x.infix) {
          -- required;
        }
      }
      if(x !== undefined) {
        es.push(x)
      }
    }
    return [es]
  },
  // Continuation passing version of run
  runc: function(c, l, src) {
    var es = [], // expression stack
        i = 0,
        f, // index of top most function / operator
        // Number of args required by f, to its right in the case of
        // infix operators like *.
        required = Infinity,
        // Stack of [f,required] pairs pushed underneath.
        s = [],
        x,
        dis = this // so that inner functions have access to 'this'.  *sigh*
    // Check for special forms.
    // There is only one: "to".
    // :todo: modularise this
    if(l[0] === 'to') {
      throw "runc bob"
      this.accum = [l]
      this.src = [src]
      return [[], this.readto]
    }
    var loop = function() {
      x = l[i]
      if(x === undefined) {
        // Denoted $ in Dragon, end of input.
        x = {}
      }
      if(es.length === f + required + 1) {
        // A reduction is possible.
        // Consider left- and right-precedences to decide whether to
        // reduce.  Note that arity 0 operators and prefix operators
        // generally have special cases in lprec which Does The Right
        // Thing.
        if(dis.lprec(es[f]) > dis.rprec(x)) {
          // Apply a function to its arguments.
          // Should have some sort of guard on this so that an infinitely
          // higher order function (a function that keeps returning a
          // function that keeps returning a function ...) does not
          // result in an unbreakable infinite loop.  Currently this
          // doesn't happen anyway because a procedure that is returned
          // from a procedure will not get called.
          if(es[f].infix) {
            // swap es[f] and its predecessor in the array
            x = es[f-1]
            es[f-1] = es[f]
            es[f] = x
            -- f
          }
          return dis.applyc(
              function(x) {
                es.length = f
                if(x !== undefined) {
                  es.push(x)
                }
                // pop f and required off the stack.
                x = s.pop()
                f = x[0]
                required = x[1]
                return loop
              },
              es[f], es.slice(f+1))
        }
      }
      if(i >= l.length) {
        return c([es])
      }
      // shift
      ++i
      x = dis.eval(x)
      if(typeof x === 'function') {
        s.push([f, required])
        f = es.length
        // The required number of arguments (in Logo) is one fewer than
        // the number of required JavaScript arguments, because all
        // implementation functions take a continuation parameter, which
        // is supplied by the runtime (by applyc, in fact).
        required = x.length - 1
        if(x.infix) {
          -- required;
        }
      }
      if(x !== undefined) {
        es.push(x)
      }
      // Yay for eta abstraction.  Er, I think.
      return loop
    }
    return loop()
  },
  // RE that matches a Logo token.
  // Whitespace is treated as a valid token.
  // This tokenising rule is _extremely_ liberal, a token is either:
  // - one of a small number of one character tokens; or,
  // - a whitespace sequence; or,
  // - a sequence of anything else.
  // This last rule allows basically any unicode sequence as a token.
  // \xAB and \xBB are left- and right- double angle quotation marks
  // (french style guillemets).
  // Tokens ' \xAB \xBB are not standard Logo and are currently
  // reserved.
  // The parentheses around the second alternative, matching whitespace,
  // are required by tokstr in order to classify tokens as whitespace.
  // This is a bit horrible, sorry.
  // Note that most of the one char tokens are excluded from the last
  // alternative (everything else), effectively making them terminating
  // macro characters in Common Lisp terminology.  An exception is ':',
  // meaning that it is allowed inside a token.  This is primary so that
  // URLs can be quoted as strings easily.
  // :todo: comma has only been added so that the output of opps (which
  // is not perfect) tokenises helpfully for tooltips.
  tokre: /[\[\]():,"'\xAB\xBB]|(\s+)|[^\s\[\](),"'\xAB\xBB]+/,
  // Converts string into array of tokens.  Each element of the result
  // array is either a string (valid token), an array ['ws', x]
  // (whitespace token), or an array ['BAD: ', x] (bad token).
  // In the last two case x is the string of the (whitespace or bad) token.
  // The RE (second argument) defaults to this.tokre if not present.
  tokstr: function(str, re) {
    var a = [],
        m,
        x
    re = re || this.tokre
    while(str) {
      m = re.exec(str)
      if(m == null) {
        // A fake result that makes the remaining code spit out a bad
        // token (swallowing up the remainder of the string) and stop.
        m = {index: str.length}
      }
      if(m.index == 0) {
        x = m[0]
        if(m[1]) {
          x = ['ws', x]
        }
        a.push(x)
        str = str.substr(m[0].length)
      } else {
        a.push(['BAD: ', str.substr(0,m.index)])
        str = str.substr(m.index)
      }
    }
    return a
  },
  // "parses" a line into a list ready for running.
  read: function (str) {
    // First the string is scanned into a flat list of tokens;
    // then the list is assembled into structured form.
    // " foo -> (quote 'foo')
    // : foo -> (thing (quote 'foo')) -> (qthing 'foo')
    // [ ... ] -> (quote ( ... ))
    // ( f ... ) -> (f ... )
    var l = this.tokstr(str),
        i,
        build =
    function() {
      var r = [],
          next = 'normal',
          x
      while(true) {
        // [ECMA262-3] 15.4.4.9
        x = l.shift()
        if(typeof x === 'undefined') {
          // l is exhausted
          return r
        }
        if(typeof x !== 'string') {
          if(x[0] == 'ws') {
            continue
          }
          throw 'LEX: bad token <<' + x[1] + '>>'
        }
        // assert (typeof x) == 'string'
        if(x === ']' || x === ')') {
          return r
        }
        // :todo: We should check that the types of bracket match.
        // Currently we do not, so we allow "[ fd 50 )", which is
        // madness.
        if(x === '[') {
          next = 'quote'
          x = build()
        }
        if(x === '(') {
          x = build()
        }
        if(x === '"') {
          next = 'quote'
          continue
        }
        if(x === ':') {
          next = 'qthing'
          continue
        }
        // Numbers
        // Numbers consist of a mantissa followed by an optional exponent
        // (which begins with 'e' or 'E').  The mantissa is either an
        // integer optionally followed by a decimal point and a
        // fraction, or a fraction beginning with a decimal point.  The
        // mantissa may begin with a minus sign to indicate a negative
        // number.
        // The exponent (which is optional) consists of the 'e' or 'E'
        // marker, an optional sign, and an integer (which is not
        // optional).
        var isnum = /-?(\d+(\.\d*)?|(\.\d+))([eE][-+]?\d+)?/.exec(x)
        if(isnum && isnum[0] === x) {
          x = parseFloat(x, 10)
        }
        if(next !== 'normal') {
          x = [next, x]
          next = 'normal'
        }
        r.push(x)
      }
      return r
    }
    return build()
  },
  // rep - Read, Eval, Print.
  // :todo: too much is copied from rep.js
  // Takes optional argument which is a _line_ of input.
  rep: function() {
    var e, o, t = arguments[0]
      
  // The input is a node with id 'i'.
  // The output is made via a JavaScript function called 'op'.
  // The value of the input node is read and the Logo is evaluated.
  // The result of the evaluation is made into a paragraph
  // (XHTML p element) and inserted before the output node.
    try {
      // See: http://www.w3.org/TR/REC-DOM-Level-1/level-one-html.html#ID-26809268
      t = t || document.getElementById('i').value
      // :todo: ensure that all runners called by this function return
      // actual continuation run functions rather than relying on this
      // slightly dodgy default.
      if(!this.runner) {
        this.runner = this.run
      }
      // :rep:runner: This REP function operates a protocol between
      // itself and the functions that it calls to perform "execution".
      // The functions that it calls are called "runners" (whether they
      // actually run things or not) and the protocol is called the REP
      // runner protocol.  It's basically this line that implements the
      // protocol: runners are passed the results of a read (a list of
      // tokens) and the source text corresponding to that list.
      // Runners are expected to return a list [msg, continuation] where
      // msg is a message to output, and continuation is the runner to
      // call next time.
      e = this.runner(logo.read(t), t)
      this.runner = e[1]
      e = e[0]
    } catch(thing) {
      if(typeof thing !== 'string') {
        // Implicit conversion to string.
        e = 'Exception: ' + thing
      } else {
        e = thing
      }
    }
    // Deliberate coercion to string
    if(typeof e === 'object' && e == '') {
      o = t
    } else {
      o = t + ' \u21d2 ' + e
    }
    op(o)
  },
  // Like logo.rep, buts accepts multiple lines
  repm: function(s) {
    var i;
    s = s.split(/[\x0a\x0d]/)
    for(i=0; i<s.length; ++i) {
      if(s[i]) {
        logo.rep(s[i])
      }
    }
  },
  eol:''
}

getCookie = function(s) {
  var a = document.cookie.split(/; /),
      i
  for(i=0; i<a.length; ++i) {
    if(a[i].replace(/=.*/, '') == s) {
      return decodeURIComponent(a[i].replace(/.*?=/,''))
    }
  }
}
setCookie = function(key, value) {
  var x = new Date()
  // 1e11 millisecond is about 1157 days
  x.setTime(x.getTime()+1e11)
  // A few nasty characters are encoded.
  value = value.replace(/[\n=;%]/g, encodeURIComponent)
  var c = key+'='+value+'; expires='+x.toGMTString()+'; path=/'
  document.cookie = c
}

// Runtime functions.
logo.extend(
// :todo: I really ought to have an article to reference that explains
// the technique to create a self referencing literal object.
function() {
  var me = {
    // Session
    // [HLM]
    erasedoc: 'erase "foo - delete procedure foo from memory',
    erase: function(n) {
      // :todo: should we provide undo?
      delete logo.global[n]
    },
    oppsdoc: 'opps - output procedure names',
    opps: function() {
      // :todo: uses the dira function, which is fine, but it comes from
      // rep.js, which is not fine.
      return dira(logo.global)
    },
    helpdoc: 'help - print some brief help',
    help: function() {
      op("The command opps lists all procedures.")
    },
    browse: function() {
      var i, a = document.cookie.split(/; /)
      for(i=0; i<a.length; ++i) {
        a[i] = a[i].replace(/=.*/, '')
      }
      return a
    },
    savedoc: 'save [bob] - saves the procedure named bob, in a cookie',
    save: function(l) {
      if(typeof l !== 'object') {
        l = [l]
      }
      var i
      for(i=0; i<l.length; ++i) {
        if(typeof l[i] !== 'string') {
          throw "save needs a procedure name"
        }
        setCookie(l[i], logo.global[l[i]].src.join('\n'))
      }
    },
    loaddoc: 'load [bob] - loads the code saved under the name bob',
    load: function(s) {
      if(typeof s != 'object') {
        s = [s]
      }
      var i, x
      for(i=0; i<s.length; ++i) {
        x = getCookie(s[i])
        logo.repm(x)
      }
    },

    // Lists
    // [HLM]
    countdoc: 'count l - returns the number of elements in the list',
    count: function(l) {
      return l.length
    },
    itemdoc: 'item n l - the nth element of the list, counting from 1',
    item: function(n, l) {
      return l[n-1]
    },
    listdoc: 'list x y - a fresh list containing x and y',
    list: function(x, y) {
      var a = [],
          i
      for(i=0; i<arguments.length; ++i) {
        a[i] = arguments[i]
      }
      return a
    },
    'member?doc': 'member? e l - true when e is an element of the list l',
    'member?': function(e, l) {
      if(logo.find(l, e) >= 0) {
        return true
      }
      return false
    },

    // Control
    // true and false are self-evaluating.
    falsedoc: 'false - canonical false boolean value',
    'false': false,
    truedoc: 'true - canonical true boolean value',
    'true': true,
    'equal?doc': 'equal? a b - true when a equals b',
    'equal?': function(a, b) {
      return a === b
    },
    'not-equal?doc': 'not-equal? a b - true unless a equals b',
    'not-equal?': function(a, b) {
      return a !== b
    },
    // [HLM]
    repeatdoc:
      'repeat n l - repeats the list of commands n times;\n' +
      'repcount reports the number of repetitions',
    // :todo: how do we document repcount properly?  it isn't a constant
    // object reference.
    repeat: function(n, l) {
      var i,
          old = logo.global.repcount
      try {
        // In Logo REPCOUNT goes from 1 to N inclusive.
        for(i=1; i<=n; ++i) {
          logo.global.repcount = i
          logo.run(l)
        }
      } finally {
        logo.global.repcount = old
      }
    },
    rundoc: 'run l - runs the list',
    run: function(l) {
      return logo.run(l)
    },
    // ucblogo
    // whenfalse is an optional third argument.
    ifdoc: 'if e l - run list of commands l when e is true',
    'if': function(cond, whentrue) {
      var whenfalse = arguments[2]
      if(cond) {
        return logo.run(whentrue)
      } else if(whenfalse) {
        return logo.run(whenfalse)
      }
    },
    // ucblogo
    ifelsedoc: 'ifelse e lt lf - if e is true run list lt else run list lf',
    ifelse: function(cond, whentrue, whenfalse) {
      if(cond) {
        return logo.run(whentrue)
      } else {
        return logo.run(whenfalse)
      }
    },
    makedoc: 'make "foo x - set variable foo to be x',
    make: function(name, value) {
      // Catches most make x 4 mistakes, but perhaps not most helpful
      // message.
      if(typeof name != 'string') {
        throw "make needs a variable name"
      }
      logo.global[name] = value
    },

    // Executes the list and outputs the number of seconds (often a
    // fractional value) it took.
    timedoc:
      'time l - returns the running time in seconds taken to run the list',
    time: function(l) {
      var t0, t1
      t0 = new Date()
      logo.run(l)
      t1 = new Date()
      return (t1 - t0) / 1000
    },

    // Maths
    // [HLM]
    // Accepts any number of arguments, prefers 2.
    // (sum) -> 0
    sumdoc: 'sum n1 n2 - adds its inputs and returns the sum',
    sum: function(augend, addend) {
      var a = 0,
          i
      for(i=0; i<arguments.length; ++i) {
        a += arguments[i]
      }
      return a
    },
    // Accepts any number of arguments, prefers 2.
    // (prod) -> 1
    proddoc: 'prod n1 n2 - multiplies its inputs and returns the product',
    prod: function(multiplicand, multiplier) {
      var a = 1,
          i
      for(i=0; i<arguments.length; ++i) {
        a *= arguments[i]
      }
      return a
    },
    // As per / in Common Lisp.
    divdoc: 'div n1 n2 - returns n1 / n2 (as a fraction if necessary)',
    div: function(dividend, divisor) {
      var a = dividend,
          i
      if(arguments.length == 1) {
        return 1/a
      }
      // Starts from 1 not 0 because we only divide by all _subsequent_
      // arguments.
      for(i=1; i<arguments.length; ++i) {
        a /= arguments[i]
      }
      return a
    },
    // Truncates to an integer.
    // As per Common Lisp divisor defaults to 1.
    quotdoc: 'quot n1 n2 - returns n1 / n2 as a whole number',
    quot: function(dividend, divisor) {
      if(divisor === undefined) {
        divisor = 1
      }
      // :todo: Works, but may be very slow.
      return parseInt(dividend / divisor)
    },
    // :todo: This reference to 'me' keeps the whole table alive even
    // though it isn't morally needed after the contents are shallow
    // copied into the Logo globals.
    // divisor defaults to 1
    remdoc:
      'rem n1 n2 - returns remainder when n1 is divided by n2',
    rem: function(dividend, divisor) {
      if(divisor === undefined) {
        divisor = 1
      }
      var quot = me.quot(dividend, divisor)
      return dividend - divisor * quot
    },

    // Unary minus, from ucblogo.
    // But actually, like - from Common Lisp it takes any number of
    // arguments and subtracts all subsequent arguments from the first.
    minusdoc: 'minus n - returns n negated (minus n)',
    minus: function(x) {
      if(arguments.length == 1) {
        return -x
      }
      var i
      for(i=1; i<arguments.length; ++i) {
        x -= arguments[i]
      }
      return x
    },
    // Binary minus, from ucblogo.
    // Note that because this just calls minus, either minus or
    // diff can take any number of arguments.  The difference
    // (pun) is that "minus" prefers to take 1 argument, and
    // "diff" prefers to take 2.
    diffdoc: 'diff n1 n2 - subtracts n2 from n1',
    diff: function(minuend, subtrahend) {
      return me.minus.apply(this, arguments)
    },
    // A-level maths:
    pidoc: 'pi - ratio of circle circumference to diameter',
    // Shouldn't really be an object but doing so means that the
    // documentation string gets added without having to change
    // logo.docstr.
    pi: new Number(Math.PI),
    infdoc: 'inf - infinity',
    inf: new Number(Infinity),
    absdoc: 'abs - absolute value',
    abs: function(x) {
      return Math.abs(x)
    },
    sqrtdoc: 'sqrt x - square root of x',
    sqrt: function(x) {
      return Math.sqrt(x)
    },
    powerdoc: 'power x y - x raised to the power y',
    power: function(x, y) {
      return Math.pow(x, y)
    },
    expdoc: 'exp x - e raised to power x',
    exp: function(x) {
      return Math.exp(x)
    },
    lndoc: 'ln x - natural logarithm of x',
    ln: function(x) {
      return Math.log(x)
    },
    // Trig functions are in degrees
    sindoc: 'sin x - return the sine of x degrees',
    sin: function(x) {
      return Math.sin(x*Math.PI/180)
    },
    cosdoc: 'cos x - return the cosine of x degrees',
    cos: function(x) {
      return Math.cos(x*Math.PI/180)
    },
    tandoc: 'tan x - return the tangent of x degrees',
    tan: function(x) {
      return Math.tan(x*Math.PI/180)
    },
    atandoc: 'atan x [y] - return the arctangent (in degrees) of point (x,y)',
    atan: function(x) {
      var y = arguments[1]
      if(typeof y === 'number') {
        // Care: JavaScript atan2 has arguments in order y, x (like C).
        // This Logo, after ucblogo, take them in order x, y
        return Math.atan2(y, x) * 180 / Math.PI
      }
      return Math.atan(x) * 180 / Math.PI
    },

    // Semantics from ucblogo
    randomdoc: 'random n - a randomly chosen integer r; 0 <= r < n',
    random: function(n) {
      var x = taus88()
      var bias = 0
      if(arguments.length === 0) {
        return x
      }
      if(typeof n == 'object') {
       // list
       return n[Math.floor(x * n.length)]
      }
      n |= 0
      if(arguments.length > 1) {
        // For two arguments, p q, produces numbers in [p, q]
        bias = n
        n = arguments[1] | 0
        n = n - bias + 1
      }
      return bias + Math.floor(x * n)
    }
  }
  // aliases
  // Unicode alternatives
  me['\u03c0'] = me.pi
  me['\u221e'] = me.inf
  // So that when JavaScript prints Infinity out as 'Infinity' it also
  // works as input and for tooltips.
  me.Infinity = me.inf

  me.product = me.prod
  me.difference = me.diff
  me.quotient = me.quot
  me.remainder = me.rem

  // Infix operators
  var infix = function(prec, original) {
    var i,
        f =
    function(x, y) {
      return original(x, y)
    }
    f.infix = prec
    for(i=2; i<arguments.length; ++i) {
      me[arguments[i]] = f
    }
  }
  infix(9, me.prod, '*', '\u00d7')
  infix(9, me.div, '/', '\u00f7')
  // Python uses '//' for quot (well, kind of), as does poplog-11 (well,
  // kind of).
  // '%' was here, but I removed it.  Too controversial.  Besides, maybe
  // we can use it for computing percentages?
  infix(5, me.sum, '+')
  // [UTR25] recommends the use of U+2212 MINUS SIGN for the unary and
  // binary minus sign.  Boy those guys are funny.  Anyway, in the
  // unlikely event that you can actually type it, we do define an alias
  // for it.  When I tried (OS X, Lucida Grande) it looked just like "-".
  infix(5, me.diff, '-', '\u2212')
  infix(3, me['equal?'], '=')
  infix(3, me['not-equal?'], '!=', '/=', '\u2260')
return me
}())

// From [MECTG]
// s1, s2, and s3 are the variables holding the generator state.
// Each is (treated as) a 32-bit integer where the bottom {1, 3, 4} bits
// are ignored respectively for s1, s2, s3.  Thus the total state is 88
// bits.  The period of the generator is almost 2**88.
// Each state variable should be seeded with a non-zero value (ignoring
// the ignored bits).
var s1 = 0x6400, s2 = 0x7200, s3 = 0x6a00, b; 
function taus88 () 
{ /* Generates numbers between 0 and 1. */ 
b = (((s1 << 13) ^ s1) >>> 19); 
s1 = (((s1 & 4294967294) << 12) ^ b); // 0xfffffffe
b = (((s2 << 2) ^ s2) >>> 25); 
s2 = (((s2 & 4294967288) << 4) ^ b);  // 0xfffffff8
b = (((s3 << 3) ^ s3) >>> 11); 
s3 = (((s3 & 4294967280) << 17) ^ b); // 0xfffffff0
// Get 32-bits as a non-negative integer.  For compatibility with C code (which
// uses unsigned).  Then the 32-bits are deposited into a double to
// make a number in [0,1).  Specifically an integer in the range
// [0,2**32) is multiplied by the rational (2**-32 + 2**-64), which
// broadly has the effect of placing the 32-bits in the most-significant
// part of the mantissa and duplicating them in the remainder of the
// mantissa.
// Note x - 2*(x&0x80000000) also converts to unsigned and _might_ be
// ever so slightly quicker.
return (((s1 ^ s2 ^ s3) + 0x100000000) % 0x100000000 *
  2.3283064370807974e-10); // 2 **-32 + 2**-64
}

// Returns (initial) character of string as unicode hex literal
// :todo: remove me
function uni(s) {
  var i = arguments[1] || 0
  s = s.charCodeAt(i).toString(16)
  while(s.length < 4) {
    s = '0' + s
  }
  return '\\u' + s
}


// Used by the packager to strip out the test suite.
function deletefromhere(){}

// :todo: very silly hack to see if we are being run in a browser or
// from command line

zap = function() {}

if(!this.document) {
  zap = print
}

// run the logo text and returns its first result.
function result1(x) {
  return logo.run(logo.read(x))[0][0]
}

// utbegin
// Test Assert
function tass(id, cond) {
  if(cond === undefined) {
    cond = id
    id = 'unknown'
  }
  if(!cond) {
    zap("FAILED: " + id)
  }
}
// Assert that 2 things are eq using the === operator.
function tasseq(id, x, y) {
  if(x === y) {
    return
  }
  zap("FAILED: " + id + " " + x + " " + y)
}
// utend

tasseq(72, 3, logo.tokstr("foo bar").length)
zap(logo.tokstr('foo.bar :foo "bar'))
tasseq(75, 1, logo.tokstr('foo//bar').length)
logo.global.x = 7
tasseq(80, 12, result1('sum x 5'))
tasseq(81, 9, logo.tokstr('[fd 50 rt 90]').length)
tasseq(82, 3, logo.read('repeat 4 [ fd 50 rt 90 ]').length)
zap(logo.prin1js([['foo'],7,"'",'\\']))
zap(logo.prin1js(logo.read('1.1 3e4 1e-2 1e+2 0.1e1 0')))
x = logo.read('1e . 1. .1e1 1ee1 1+e1')
tasseq(94, '1e', x[0])
tasseq(95, '.', x[1])
tasseq(96, 1, x[2])
tasseq(97, 1, x[3])
tasseq(98, '1ee1', x[4])
tasseq(99, '1+e1', x[5])
tasseq(100, 2, result1('sum 4 -2'))
// Tests the unicode division sign
tasseq(101, 2.5, result1('10 \u00f7 4'))
// Test the unicode multiplication sign
tasseq(102, 5, result1('2.5 \u00d7 2'))
tasseq(103, 2, result1('minus difference 2 4'))
tasseq(104, 2, result1('difference 4 minus -2'))
tasseq(105, 2, result1('remainder 11 -3'))
tasseq(106, -2, result1('remainder -11 3'))
tasseq(107, 14, result1('2 + 3 * 4'))
tasseq(108, 5, result1('1 + 2 - 3 + 4 - 5 + 6'))
tasseq(109, 0, result1('10 - 4 - 3 - 2 - 1'))
tasseq(110, 50, result1('prod 3 + x x - 2'))
tasseq(111, 8, result1('prod 2 2 + 2'))
tasseq(112, result1('false'), result1('member? 0 []'))
tasseq(113, result1('true'), result1('member? 0 [2 0 1]'))
tasseq(114, result1('equal? 0 0'), result1('2 = 2'))
// Bug in lexical analysis: double-quote should prevent 0 being
// recognised as a number but it does not.
// tasseq(115, result1('false'), result1('0 = "0'))
tasseq(116, result1('false'), result1('0 = 1'))


