#!/usr/bin/env python
# $Id: //depot/prj/logoscript/master/code/ts.py#2 $
# Writes out a pretty small PNG.
# After Gareth Rees, http://gareth-rees.livejournal.com/9988.html

import codecs
import struct
import sys
import zlib

def chunk(type, data):
 return (struct.pack('>I', len(data)) + type + data
  + struct.pack('>i', zlib.crc32(type + data)))

png = ('\x89PNG\r\n\x1A\n'
 + chunk('IHDR', struct.pack('>IIBBBBB', 1, 1, 8, 6, 0, 0, 0))
 + chunk('IDAT', zlib.compress('\x00\xc5\x00\x5c\x6d'))
 + chunk('IEND', ''))

# This creates the contents of the zlib chunk "by hand" using the
# uncompressed block scheme of the deflate format (RFC 1951).
# This scheme has the advantage that the 4 octets of our 1x1 image
# appear as plain octets in the resulting stream, so are easy to
# "edit".
z = '789c010500faff00c5005c6d'
z += codecs.encode(
    struct.pack('>i', zlib.adler32(codecs.decode(z[-10:], 'hex'))), 'hex')

apng = ('\x89PNG\r\n\x1A\n'
 + chunk('IHDR', struct.pack('>IIBBBBB', 1, 1, 8, 6, 0, 0, 0))
 + chunk('IDAT', codecs.decode(z, 'hex'))
 + chunk('IEND', ''))

sys.stdout.write(png)
