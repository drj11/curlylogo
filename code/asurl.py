#!/usr/bin/env python
# $Id: //depot/prj/logoscript/master/code/asurl.py#1 $
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
