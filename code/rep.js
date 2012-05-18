// $Id: //depot/prj/logoscript/master/code/rep.js#7 $
// Not really part of the REPL, but useful functions to have around.
dira=function(x) { var a=[];for (i in x) {a.push(i)};return a}
dirs=function(x) { return dira(x).sort().join(', ') }

// rep - Read, Eval, Print.
// The input is a node with id 'i'.
function rep()
{
  // Tediously, this function's environment gets used by any eval'ed
  // code.  To allow the interactor to use variables like p and e we
  // prefix all the variables in this function with '_rep_'.
  var _rep_e
  try {
    // See: http://www.w3.org/TR/REC-DOM-Level-1/level-one-html.html#ID-26809268
    var _rep_t = document.getElementById('i').value
    _rep_e = eval(_rep_t)
  } catch(thing) {
    _rep_e = 'Exception: ' + thing.message
  }
  op(_rep_t + ' \u21d2 ' + _rep_e)
}
