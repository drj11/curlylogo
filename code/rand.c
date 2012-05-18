unsigned long s1 = 0x64, s2 = 0x72, s3 = 0x6a, b; 
double taus88 () 
{ /* Generates numbers between 0 and 1. */ 
b = (((s1 << 13) ^ s1) >> 19); 
s1 = (((s1 & 4294967294) << 12) ^ b); 
b = (((s2 << 2) ^ s2) >> 25); 
s2 = (((s2 & 4294967288) << 4) ^ b); 
b = (((s3 << 3) ^ s3) >> 11); 
s3 = (((s3 & 4294967280) << 17) ^ b); 
return ((s1 ^ s2 ^ s3) * 2.3283064365e-10); 
}

#include <stdio.h>
int main(void) {
  int i;
  for(i=0; i<10; ++i) {
    printf("%.17g\n", taus88());
  }
  return 0;
}
