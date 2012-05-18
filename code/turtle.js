// $Id: //depot/prj/logoscript/master/code/turtle.js#22 $

turtle = {
  // Please call to initialise the object properly.
  // Mostly just sets members that can't be initialised using literal
  // object syntax.
  ipl: function() {
    // Would depend on the svg field but in Firefox 2.0.0.8 the SVG
    // element does not implement getElementById, so we invoke it on
    // document instead.
    this.canvas = document.getElementById('canvas')
    var m = this.element.transform.baseVal.getItem(0).matrix
    this.setXY(m.e, m.f)
    // :turtle:homexy:
    this.homeXY = this.getXY()
    this.homeH = 0
    this.penDown()
    // :ipl:beep: Create an object for the beep sound
    var e = document.createElementNS("http://www.w3.org/1999/xhtml", "embed")
    e.autostart = "true"
    e.loop = "false"
    e.src =
      'data:audio/midi;base64,TVRoZAAAAAYAAAABADxNVHJrAAAACwCZUWA8UQAA/y8A'
    this.beepObject = e
    delete this.ipl // can now be GCed.
  },
  // This name is used quite a lot, consider making it very short to
  // minimise code on the wire.
  element: document.getElementById('turtle'),
  // :svg:create: Required so that various create methods can be
  // accessed.  Consider using ownerSVGElement (see
  // http://www.w3.org/TR/SVG11/types.html#BasicDOMInterfaces )
  svg: document.getElementsByTagName('svg')[0],
  // Many of the turtle accessors use the SVG DOM.
  // this.element is the element with id 'turtle', this is expected to
  // be some sort of SVG element with a two-stage transformation matrix
  // (see :turtle:transform:two ).
  // this.element.transform.baseVal is an InterfaceSVGTransformList
  // http://www.w3.org/TR/SVG11/coords.html#InterfaceSVGTransformList

  // Return Turtle's X and Y as a (fresh) 2-element array.
  getXY: function() {
    return [this.x, this.y]
  },
  getX: function() {
    return this.getXY()[0]
  },
  getY: function() {
    return this.getXY()[1]
  },
  x: 99,
  y: 99,
  // Consider: Do we need to wrap penUp/penDown around here so that a
  // new path is started?  Or do we leave that to our callers (currently
  // just 'home')?
  setXY: function(x, y) {
    this.x = x
    this.y = y
    this.refreshTransform()
  },
  h: 0,
  // set heading: 0 is North, 90 is East
  // :turtle:transform:two
  setH: function(h) {
    this.h = h % 360
    this.refreshTransform()
  },
  // :turtle:transform:two
  getH: function() {
    return this.h
  },
  refreshTransform: function() {
    var p = this.getXY()
    this.element.setAttribute('transform',
        'translate(' + p + ') rotate(' + this.getH() + ')' )
  },
  home: function() {
    // :turtle:homexy
    var v = this.homeXY
    // penUp/penDown forces a new path
    this.penUp()
    this.setXY(v[0], v[1])
    this.setH(this.homeH)
    this.penDown()
  },
  // Sets home state to position vector v (which is referenced,
  // callers should not subsequently use it) and heading h.
  setHome: function(v, h) {
    h = h || 0
    this.homeXY = v
    this.homeH = h
  },
  clean: function() {
    this.penUp()
    // http://www.w3.org/TR/REC-DOM-Level-1/level-one-core.html#ID-1950641247
    while(this.canvas.firstChild) {
      this.canvas.removeChild(this.canvas.firstChild)
    }
    this.penDown()
  },
  cs: function() {
    this.home()
    this.clean()
  },
  right: function(a) {
    a = +a
    if(isNaN(a)) {
      return
    }
    this.setH(this.getH() + a)
  },
  left: function(a) {
    this.right(-a)
  },
  forward: function(a) {
    a = +a
    if(isNaN(a)) {
      return
    }
    var dx = a * Math.sin(Math.PI*this.getH()/180)
    var dy = -a * Math.cos(Math.PI*this.getH()/180)
    var t = this.getXY()
    this.setXY(t[0] + dx, t[1] + dy)
    this.extendPath(this.getXY())
  },
  back: function(a) {
    this.forward(-a)
  },
  penUp: function() {
    if(this.penPos !== 'up') {
      this.flush()
    }
    this.penPos = 'up'
  },
  penDown: function() {
    if(this.penPos !== 'down') {
      this.newPath()
    }
    this.penPos = 'down'
  },
  setPenWidth: function(w) {
    var old = this.penWidth
    this.penWidth = w
    if(w !== old) {
      // Changing penWidth requires a new path, because a path has a
      // constant stroke-width.
      this.newPath()
    }
  },
  // Converts a colour to a canonical string form.
  // The colour, c, is either a small integer or a string (symbol)
  // matching an SVG color keyword,
  // http://www.w3.org/TR/SVG11/types.html#ColorKeywords .
  // Allowing small integers is mostly just a concession to the 80's
  // Logos.
  toColour: function(c) {
    var l
    if(typeof c === 'number') {
      // Apple-II Logo colours, according to
      // http://ccgi.frindsbury.force9.co.uk/greatlogoatlas/?The_Apple_II_Standard
      // l = ['black', 'white', 'green', 'violet', 'orange', 'blue']
      // drj's set:
      l = ['black', 'red', 'orange', 'yellow', 'green', 'blue',
        'indigo', 'violet', 'white', 'gray', 'pink', 'brown']
      c = l[c]
    }
    return c
  },
  setPenColour: function(c) {
    var old = this.penColour
    c = this.toColour(c)
    if(!c) {
      return
    }
    this.penColour = c
    if(c !== old) {
      this.newPath()
    }
  },
  setBackground: function(c) {
    c = this.toColour(c)
    // Turn into URL ?
    if(/^(htt|ft)p:/.test(c)) {
      c = 'url(' + c + ')'
    }
    // :link:unclean: Not entirely clean linking to the host XML document.
    this.svg.parentNode.style.background = c
  },
  hideTurtle: function() {
    // http://www.w3.org/TR/SVG11/painting.html#VisibilityProperty
    this.element.setAttribute('visibility', 'hidden')
  },
  showTurtle: function() {
    this.element.setAttribute('visibility', 'visible')
  },
  beep: function() {
    var span = this.beepSpan
    if(span) {
      span.parentNode.removeChild(span)
    }
    span = document.createElementNS('http://www.w3.org/1999/xhtml', 'span')
    // Already created, see :ipl:beep
    span.appendChild(this.beepObject)
    span.style.visibility = "hidden"
    span.style.position = "absolute"
    span.style.top = '0px'
    // :link:unclean
    this.svg.parentNode.appendChild(span)
    this.beepSpan = span
  },
  // path and flushed store the state of the possibly undrawn SVG path.
  path: [],
  flushed: false,
  // (if the pen is down) extend the current path with a line drawn
  // (from the path's current endpoint) to the specified point.
  // to is a 2-element array.
  extendPath: function(to) {
    if(this.penPos === 'up') {
      return
    }
    // 'to' is a 2-element array which stringises to 'X,Y' which is just
    // what we need.
    this.path.push('L'+to)
  },
  newPath: function() {
    this.flush()
    this.flushed=false
    this.path=['M'+this.getXY()]
  },
  // Convert the path array into an SVG path, thereby drawing it.
  flush: function() {
    // This 'if' means that a PD PU doesn't draw a dot.
    if(this.path.length<2) {
      return
    }
    var p,
        a
    if(this.flushed) {
      // use existing path
      p = this.canvas.lastChild
    } else {
      p = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      a = this.penWidth
      if(a!=null) {
        // Note: even a === 0 sets stroke-width.  This is good because it
        // means codes like "setpw 1 + cos repcount" are sensible.
        // :todo: What about negative widths?
        p.setAttribute('stroke-width', a)
      }
      a = this.penColour
      if(a) {
        p.setAttribute('stroke', a)
      }
      this.canvas.appendChild(p)
    }
    p.setAttribute('d', this.path.join(' '))
    this.flushed=true
  }
}

function ipl() {
  var tc = { // turtle commands
    // Top-level Turtle Commands
    // Mostly after the description of Logotron LOGO in [HLM] Glossary
    // These are deliberately shallow bound to the turtle variable to
    // introduce the possibility that the turtle variable might be switched
    // for a different turtle.  These commands would then affect that new
    // turtle.
    forwarddoc: 'fd n - move turtle forward n steps',
    forward: function(a) {
      return turtle.forward(a)
    },
    fdc: function(c, a) {
      turtle.forward(a)
      return c
    },
    backdoc: 'bk n - move turtle backward n steps without turning round',
    back: function(a) {
      return turtle.back(a)
    },
    leftdoc: 'lt n - turn turtle left n degrees without moving forward',
    left: function(a) {
      return turtle.left(a)
    },
    rightdoc: 'rt n - turn turtle right n degrees without moving forward',
    right: function(a) {
      return turtle.right(a)
    },
    homedoc:
      'home - return turtle to its home (starting) position, without erasing',
    home: function() {
      return turtle.home()
    },
    sethomedoc: 'sethome - sets the new home to be the current position',
    sethome: function() {
      return turtle.setHome(turtle.getXY(), turtle.getH())
    },
    csdoc: 'cs - clears the screen and sends turtle home',
    cs: function() {
      return turtle.cs()
    },
    ctdoc: 'ct - clears the text area',
    ct: function() {
      return clear()
    },
    cleandoc: "clean - clears the screen but doesn't move turtle",
    clean: function() {
      return turtle.clean()
    },
    pddoc: 'pd - pen down, moving the turtle draws lines',
    pd: function() {
      return turtle.penDown()
    },
    pudoc: 'pu - pen up, moving the turtle will not draw lines',
    pu: function() {
      return turtle.penUp()
    },
    setpcdoc: 'setpc n - changes the colour of the pen',
    setpc: function(c) {
      return turtle.setPenColour(c)
    },
    setbgdoc: 'setbg c - change background colour',
    setbg: function(c) {
      return turtle.setBackground(c)
    },
    setpwdoc: 'setpw n - changes the width of the pen',
    setpw: function(w) {
      return turtle.setPenWidth(w)
    },
    stdoc: 'st - show turtle on screen',
    st: function() {
      return turtle.showTurtle()
    },
    htdoc: 'ht - hide turtle from view (it still moves and draws)',
    ht: function() {
      return turtle.hideTurtle()
    },
    beepdoc: 'beep - turtle beeps',
    beep: function() {
      return turtle.beep()
    }
  }
  tc.fd = tc.forward
  tc.bk = tc.back
  tc.lt = tc.left
  tc.rt = tc.right
  tc.hideturtle = tc.ht
  tc.showturtle = tc.st
  tc.setpencolour = tc.setpc
  tc.setpencolor = tc.setpc
  tc.penup = tc.pu
  tc.pendown = tc.pd
  logo.extend(tc)
  turtle.ipl()
  urlscrape()
  turtle.flush()
}

// Scrape Logo code from the # part of the URL
function urlscrape() {
  var s = location.href
  if(!/#/.test(s)) {
    return
  }
  s = s.replace(/.*#/,'')
  s = decodeURIComponent(s)
  logo.repm(s)
}

