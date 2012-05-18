// $Id: //depot/prj/logoscript/master/code/png.js#12 $
// Code to generate a 1x1 4-channel PNG file

// Conventionally in this file binary octet strings are represented in
// JavaScript by ordinary strings all of whose code points lie between 0
// and 255 inclusive.

// Return 4 element string of x coded as a big-endian 32 bit int
// (common inside PNGs).
be32 = function(x) {
  x|=0
  var i, s = ''
  for(i=0; i<4; ++i) {
    s += String.fromCharCode((x >> 24) & 0xff)
    x <<= 8
  }
  return s
}
// Return 2 element string of x coded as a little-endian 16 bit int.
le16 = function(x) {
  x|=0
  var i, s = ''
  for(i=0; i<2; ++i) {
    s += String.fromCharCode(x&0xff)
    x >>= 8
  }
  return s
}

png = {
  // Constructor for 4-channel PNG.
  // w is the width in pixels, due to a limitation imposed by the choice
  // of format it should be <= 8191.
  // h is the height in pixels.  As far as I know this can be up to
  // 2**32-1.
  PNG: function(w, h) {
    this.w = w
    this.h = h
    this.b = 32
    this.p = {}
  },
  // update binary field if necessary
  updateBinary: function() {
    if(!this.p) {
      return
    }
    var d = '', // total scanline data
        i, j, t,
        cd = '\x78\x9c' // (IDAT) chunk data
    for(i=0; i<this.h; ++i) {
      t = '\x00'        // Accumulate scanline data in t
      for(j=0; j<this.w; ++j) {
        t += be32(this.p[i*this.w + j])
      }
      if(i == this.h - 1) {
        cd += '\x01' // final scanline
      } else {
        cd += '\x00'
      }
      u = this.w*this.b/8 + 1
      cd += le16(u) + le16(u ^ 0xffff) + t
      d += t
    }
    cd += be32(this.adler32(d))
    this.binary = '\x89PNG\r\n\x1A\n' +
      this.chunk('IHDR', be32(this.w) + be32(this.h) +
                         '\x08\x06\x00\x00\x00') +
      this.chunk('IDAT', cd) +
      this.chunk('IEND', '')
  },
  // Constructor for 1x1 png of colour 0xRRGGBBAA.
  Unit: function(n) {
    this.binary = this.unit(n)
  },
  // Constructor that takes an RFC 2397 URL.
  // Only intended to work sensibly for 1x1 PNGs created with this code.
  FromURL: function(url) {
    this.binary = atob(url.replace(/.*,/, ''))
    this.w = 1
    this.h = 1
  },
  // Return RFC 2397 URL for this PNG.
  asURL: function() {
    this.updateBinary()
    return 'data:image/png;base64,' + btoa(this.binary)
  },
  // x and y are measured from bottom left.
  getPixel: function(x, y) {
    x |= 0
    y |= 0
    if(x < 0 || x >= this.w) {
      throw 'Pixel: x out of range'
    }
    if(y < 0 || y >= this.h) {
      throw 'Pixel: y out of range'
    }
    y = this.h-1 - y
    if(this.p) {
      return 0|this.p[this.w*y + x]
    }
    // Only works for restricted 1x1 case.
    var n = 0, i
    for(i=0; i<4; ++i) {
      n <<= 8
      n += this.binary.charCodeAt(0x31 + i)
    }
    return n
  },
  setPixel: function(x, y, n) {
    x |= 0
    y |= 0
    if(x < 0 || x >= this.w) {
      throw 'Pixel: x out of range'
    }
    if(y < 0 || y >= this.h) {
      throw 'Pixel: y out of range'
    }
    if(!this.p) {
      throw 'Cannot edit image'
    }
    y = this.h-1 - y
    this.p[this.w*y+x] = n
  },

  // See http://www.ietf.org/rfc/rfc1950.txt section 9.
  // Computes Adler32 checksum of the binary string buf.  The second argument
  // is optional but if present it specifies the current value of an
  // incrementally computed checksum (it defaults to 1 which is the value
  // used to begin a checksum computation).
  adler32: function(buf, adler) {
    if(adler === undefined) {
      adler = 1
    }
    var s1 = adler & 0xffff, s2 = (adler >> 16) & 0xffff
    var n, BASE = 65521
    for (n = 0; n < buf.length; n++) {
      s1 = (s1 + buf.charCodeAt(n)) % BASE;
      s2 = (s2 + s1)     % BASE;
    }
    return (s2 << 16) + s1
  },

  // From http://www.w3.org/TR/2003/REC-PNG-20031110/#D-CRCAppendix
  crctable:
  // make_crc_table
  (function() {
    var c, n, k, t = {}
    for(n=0; n<256; ++n) {
      c = n
      for(k=0; k<8; ++k) {
        if(c & 1) {
          c = 0xedb88320 ^ (c >>> 1)
        } else {
          c = c >>> 1
        }
      }
      t[n] = c
    }
    return t
  }()),

  // From http://www.w3.org/TR/2003/REC-PNG-20031110/#D-CRCAppendix
  // Updates an incrementally computed 32-bit CRC.  If crc is not supplied
  // it defaults to all 1's to begin the computation.  Note: CRC
  // computations in PNG require that the result is complemented.  See
  // pngcrc.
  crc32: function(buf, crc) {
    if(crc === undefined) {
      crc = 0xffffffff
    }
    var i
    for(i=0; i<buf.length; ++i) {
      crc = this.crctable[(crc^buf.charCodeAt(i)) & 0xff] ^ (crc >>> 8)
    }
    return crc
  },

  // Returns a CRC suitable for use as the last part of a PNG chunk.
  // See http://www.w3.org/TR/2003/REC-PNG-20031110/#5Chunk-layout
  crc: function(buf) {
    return this.crc32(buf) ^ 0xffffffff
  },

  // Create a PNG chunk.  Supply type and data, length and CRC are
  // computed.
  chunk: function(type, data) {
    return be32(data.length) + type + data +
        be32(this.crc(type + data))
  },

  // Create binary data for a 1x1 4-channel PNG.  The colour is specified
  // by the number n: 0xRRGGBBAA
  unit: function(n) {
    var d = '\x00' + be32(n) // PNG scanline data.
    return '\x89PNG\r\n\x1A\n' +
      this.chunk('IHDR', be32(1) + be32(1) + '\x08\x06\x00\x00\x00') +
      this.chunk('IDAT',
          '\x78\x9c\x01\x05\x00\xfa\xff' + d + be32(this.adler32(d))) +
      this.chunk('IEND', '')
  },
  // Create binary data for a 1xN 4-channel PNG.  The colour of each of
  // N pixels is specified by each of N arguments: 0xRRGGBBAA.
  duplex: function() {
    var p = new this.PNG(1, arguments.length)
    var i
    for(i=0; i<arguments.length; ++i) {
      p.p[i] = arguments[i]
    }
    p.updateBinary()
    return p.binary
  }
}
// Set prototype fields of constructors.
png.Unit.prototype=png
png.FromURL.prototype=png
png.PNG.prototype=png

// copied from project/jsbmp/...
// Originally intended only to be used in the command line environment
// which does not traditionally include the browser-specific btoa
// function.  However, Opera (9.24 for OS X) does not have this function
// either.  Hence this test and the function must be before the
// 'deletefromhere' marker.
if(!this.btoa) {
  // This function is intended to be a portable replacement for the
  // version implemented in many browsers.  See the Mozilla
  // documentation for example:
  // http://developer.mozilla.org/en/docs/DOM:window.btoa
  btoa = function(s) {
    var e = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' +
            'abcdefghijklmnopqrstuvwxyz' +
            '0123456789+/',
        c, i, stop,
        r = '',
        x

    while(s) {
      x = 0
      stop = Infinity // Denotes which character to stop at.
      for(i=0;i<3; ++i) {
        c = s.charCodeAt(i)
        if(isNaN(c)) {
          c = 0
          if(i < stop) {
            stop = i
          }
        }
        x = (x << 8) + c
      }
      for(i=0;i<4;++i) {
        if(i > stop) {
          r += '='
        } else {
          r += e[x>>18]
          x = (x << 6) & 0xffffff
        }
      }
      s = s.substr(3)
    }
    return r
  }
}

function deletefromhere(){}

zap = function() {}

if(!this.document) {
  zap = print
}

function hex2(x) {
  x = '0' + x.toString(16)
  return x.substr(x.length-2)
}
function hex2s(d, sep) {
  sep = sep || ''
  var s=''
  for(i=0; i<d.length; ++i) {
    if(s) {
      s += sep
    }
    s += hex2(d.charCodeAt(i))
  }
  return s
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

tasseq(3, 991696909,
  png.adler32('Type "help", "copyright", "credits" or "license" for more information.'))
tasseq(4, 2081413087, png.crc('bob was here'))

apng = png.unit(0xc5005c6d)
zap(hex2s(apng))
tasseq(1, hex2s(apng), hex2s(png.duplex(0xc5005c6d)))
bpng = new png.Unit(0xc5005c6d)
zap(bpng.asURL())
tasseq(2, bpng.getPixel(0, 0), 0|0xc5005c6d)
d = png.duplex(0xaabbccff, 0x55aa55ff)
zap(hex2s(d))
d = new png.PNG(16, 16)
for(i=0;i<6;++i) {
  for(j=0;j<6;++j) {
    for(k=0;k<6;++k) {
      d.p[36*i + 6*j + k] = ((i*51)<<24) + ((j*51)<<16) + ((k*51)<<8) + 0xff
    }
  }
}
zap(d.asURL())
tasseq(5, 0x336600ff, d.getPixel(0, 12))
x = new png.PNG(2, 2)
x.setPixel(1, 0, 0xff8000ff)
x.setPixel(0, 1, 0x0055ffff)
zap(x.asURL())
