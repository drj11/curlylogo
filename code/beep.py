# $Id: //depot/prj/logoscript/master/code/beep.py#1 $
# A simple beep.
# Based on //depot/prj/pysound/master/code/s0.py
# First draft is for Curly Logo so a small gzipped size is desirable.
# 640ms long.

import math
import struct
import wave

class sinw :
  """Generate a series of sine wave samples."""
  def __init__(self, f, s) :
    """Sine wave of frequency f Hz at s samples per second."""
    self.t = 0
    # Each sample output increments t by a constant, k.  This is the number
    # of radians for each sample.  We compute it here.
    self.k = 2 * math.pi * f / s

  def next(self) :
    """Return the next sample, x.  -0x8000 <= x < 0x8000."""
    self.t += self.k
    return 0x7fff * math.sin(self.t)

l = 0.640 # length of sound in seconds

R=int(32e3)
w = wave.open('beep.wav', 'wb')
w.setnchannels(1)
w.setsampwidth(2)
w.setframerate(R)
s = sinw(500, R)
a=[]
N = int(l*R) # number of samples in total.
for i in xrange(N) :
  a.append(s.next())
# depop in and out by multiplying by linear ramp for 1ms
P = int(0.001 * R)
if 1 :
  for i in xrange(P) :
    m = float(i)/P
    a[i] *= m
    a[len(a)-i-1] *= m
w.writeframes(struct.pack('<%dh' % N, *a))
w.close()
