/*
 * Ansible Rulebook Condition Parser Grammar
 *
 * This PEG grammar is based on the Python pyparsing implementation in:
 * ansible-rulebook/ansible_rulebook/condition_parser.py
 *
 * It parses condition expressions used in Ansible Rulebook rules.
 *
 * Supported features:
 * - Identifiers with prefixes: events, event, facts, vars, fact
 * - Operators: arithmetic (+, -, *, /), comparison (==, !=, <, <=, >, >=)
 * - Logical operators: and, or, not
 * - Special operators: is, is not, in, not in, contains, not contains
 * - Built-in functions: select(), selectattr(), regex(), match(), search()
 * - Data types: numbers, strings, booleans, null, lists
 * - Array/object access: dot notation and bracket notation
 */

{
  function makeInteger(digits) {
    return { type: 'Integer', value: parseInt(digits, 10) };
  }

  function makeFloat(parts) {
    return { type: 'Float', value: parseFloat(parts) };
  }

  function makeString(str) {
    return { type: 'String', value: str };
  }

  function makeBoolean(val) {
    return { type: 'Boolean', value: val.toLowerCase() === 'true' };
  }

  function makeNull() {
    return { type: 'Null', value: null };
  }

  function makeIdentifier(id) {
    return { type: 'Identifier', value: id };
  }

  function makeOperatorExpression(left, operator, right) {
    return { type: 'OperatorExpression', left, operator, right };
  }

  function makeNegateExpression(operator, value) {
    return { type: 'NegateExpression', operator, value };
  }

  function makeSearchType(kind, pattern, options) {
    return { type: 'SearchType', kind: makeString(kind), pattern, options: options || [] };
  }

  function makeSelectType(operator, value) {
    return { type: 'SelectType', operator, value };
  }

  function makeSelectattrType(key, operator, value) {
    return { type: 'SelectattrType', key, operator, value };
  }

  function makeKeywordValue(name, value) {
    return { type: 'KeywordValue', name, value };
  }

  function makeCondition(value) {
    return { type: 'Condition', value };
  }
}

// Entry point
Condition
  = _ expr:OrExpression _ { return makeCondition(expr); }

// Logical operators (lowest precedence)
OrExpression
  = left:AndExpression _ "or"i _ right:OrExpression { return makeOperatorExpression(left, 'or', right); }
  / AndExpression

AndExpression
  = left:NotExpression _ "and"i _ right:AndExpression { return makeOperatorExpression(left, 'and', right); }
  / NotExpression

NotExpression
  = "not"i _ expr:NotExpression { return makeNegateExpression('not', expr); }
  / ComparisonExpression

// Comparison and membership operators
ComparisonExpression
  = left:ShiftExpression _ op:("is not"i __ "defined"i) {
      return makeOperatorExpression(left, 'is not defined', makeString('defined'));
    }
  / left:ShiftExpression _ op:("is"i __ "defined"i) {
      return makeOperatorExpression(left, 'is defined', makeString('defined'));
    }
  / left:ShiftExpression _ op:ComparisonOperator _ right:ShiftExpression {
      return makeOperatorExpression(left, op, right);
    }
  / ShiftExpression

ComparisonOperator
  = "not contains"i { return 'not contains'; }
  / "contains"i { return 'contains'; }
  / "not in"i { return 'not in'; }
  / "in"i { return 'in'; }
  / "is not"i _ kind:SearchKind _ search:StringSearch {
      return makeOperatorExpression('is not', kind, search);
    }
  / "is not"i { return 'is not'; }
  / "is"i _ kind:SearchKind _ search:StringSearch {
      return makeOperatorExpression('is', kind, search);
    }
  / "is"i { return 'is'; }
  / "==" { return '=='; }
  / "!=" { return '!='; }
  / "<=" { return '<='; }
  / ">=" { return '>='; }
  / "<" { return '<'; }
  / ">" { return '>'; }

SearchKind
  = "match"i { return 'match'; }
  / "regex"i { return 'regex'; }
  / "search"i { return 'search'; }

// Shift operator
ShiftExpression
  = left:AdditiveExpression _ "<<" _ right:ShiftExpression {
      return makeOperatorExpression(left, '<<', right);
    }
  / AdditiveExpression

// Arithmetic operators
AdditiveExpression
  = left:MultiplicativeExpression _ op:[+-] _ right:AdditiveExpression {
      return makeOperatorExpression(left, op, right);
    }
  / MultiplicativeExpression

MultiplicativeExpression
  = left:PrimaryExpression _ op:[*/] _ right:MultiplicativeExpression {
      return makeOperatorExpression(left, op, right);
    }
  / PrimaryExpression

// Primary expressions (highest precedence)
PrimaryExpression
  = "(" _ expr:OrExpression _ ")" { return expr; }
  / SelectattrExpression
  / SelectExpression
  / StringSearch
  / ListValue
  / Number
  / Null
  / Boolean
  / VarName
  / String

// Special function expressions
SelectattrExpression
  = "selectattr" _ "(" _ args:DelimitedList _ ")" {
      if (args.length < 3) {
        error('selectattr requires at least 3 arguments: key, operator, value');
      }
      return makeSelectattrType(args[0], args[1], args[2]);
    }

SelectExpression
  = "select" _ "(" _ args:DelimitedList _ ")" {
      if (args.length < 2) {
        error('select requires at least 2 arguments: operator, value');
      }
      return makeSelectType(args[0], args[1]);
    }

StringSearch
  = kind:SearchKind _ "(" _ args:StringSearchArgs? _ ")" {
      if (!args || args.length === 0) {
        error(kind + ' requires at least a pattern argument');
      }
      const pattern = args[0];
      const options = [];
      // Process keyword arguments
      for (let i = 1; i < args.length; i++) {
        if (args[i].type === 'KeywordValue') {
          options.push(args[i]);
        }
      }
      return makeSearchType(kind, pattern, options);
    }

StringSearchArgs
  = head:StringSearchArg tail:(_ "," _ StringSearchArg)* {
      return [head].concat(tail.map(t => t[3]));
    }

StringSearchArg
  = KeywordArg
  / VarName
  / String

KeywordArg
  = name:Identifier _ "=" _ value:AllowedValue {
      return makeKeywordValue(makeString(name), value);
    }

// List values
ListValue
  = "[" _ values:DelimitedList? _ "]" {
      return values || [];
    }

DelimitedList
  = head:AllowedValue tail:(_ "," _ AllowedValue)* {
      return [head].concat(tail.map(t => t[3]));
    }

AllowedValue
  = Number
  / Boolean
  / Null
  / VarName
  / String
  / ListValue

// Variable names with dot and bracket notation
VarName
  = prefix:ValidPrefix accessor:Accessor* {
      return makeIdentifier(prefix + accessor.join(''));
    }

ValidPrefix
  = "events" { return 'events'; }
  / "event" { return 'event'; }
  / "facts" { return 'facts'; }
  / "fact" { return 'fact'; }
  / "vars" { return 'vars'; }

Accessor
  = DotAccessor
  / BracketAccessor

DotAccessor
  = "." id:Identifier { return '.' + id; }

BracketAccessor
  = "[" _ index:(QuotedString / Integer) _ "]" {
      if (typeof index === 'object' && index.type === 'String') {
        return '["' + index.value + '"]';
      } else if (typeof index === 'object' && index.type === 'Integer') {
        return '[' + index.value + ']';
      }
      return '[' + index + ']';
    }

// Literals
Number "number"
  = Float
  / Integer

Integer "integer"
  = [+-]? [0-9]+ { return makeInteger(text()); }

Float "float"
  = [+-]? [0-9]+ "." [0-9]+ ([eE] [+-]? [0-9]+)? { return makeFloat(text()); }
  / [+-]? [0-9]+ [eE] [+-]? [0-9]+ { return makeFloat(text()); }

Boolean "boolean"
  = ("true"i / "false"i) { return makeBoolean(text()); }

Null "null"
  = "null"i { return makeNull(); }

String "string"
  = QuotedString

QuotedString
  = SingleQuotedString
  / DoubleQuotedString

SingleQuotedString
  = "'" chars:[^']* "'" { return makeString(chars.join('')); }

DoubleQuotedString
  = '"' chars:[^"]* '"' { return makeString(chars.join('')); }

// Identifiers (alphanumeric starting with letter or underscore)
Identifier "identifier"
  = [a-zA-Z_][a-zA-Z0-9_]* { return text(); }

// Whitespace
_ "whitespace"
  = [ \t\n\r]*

__ "required whitespace"
  = [ \t\n\r]+
