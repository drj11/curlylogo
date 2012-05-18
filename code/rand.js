// From:
// "Maximally Equidistributed Combined Tausworthe Generators";
// Pierre L'Ecuyer; Mathematics of Computation, Volume 65, Number 213;
// 1996-01.
//
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
