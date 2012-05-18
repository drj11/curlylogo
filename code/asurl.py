#!/usr/bin/env python

"""
Convert stdin to a quoted URL fragment, suitable for
concatenating after the '#' of a URL.
"""

import sys
import urllib

f = sys.stdin
o = ''
while True :
  s = f.readline()
  if s == '' :
    break
  o += urllib.quote(s)
print o
