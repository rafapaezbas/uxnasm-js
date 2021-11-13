const { sequenceOf, whitespace, endOfInput, anyOfString, str, choice, char, anyChar, possibly, letters, many, exactly, everyCharUntil } = require('arcsecond')
const fs = require('fs')
const path = require('path')

const labels = new Map()
const macros = new Map()

const toHex = (i) => {
  i = i.toString(16)
  return i.length < 2 ? '0' + i : i
}

const opCodes = ['BRK', 'INC', 'POP', 'DUP', 'NIP', 'SWP', 'OVR', 'ROT', 'EQU', 'NEQ', 'GTH', 'LTH', 'JMP', 'JCN', 'JSR', 'STH', 'LDZ', 'STZ', 'LDR', 'STR', 'LDA', 'STA', 'DEI', 'DEO', 'ADD', 'SUB', 'MUL', 'DIV', 'AND', 'ORA', 'EOR', 'SFT']
const hexOpCodes = new Map()
opCodes.forEach((op, i) => hexOpCodes.set(op, toHex(i)))
hexOpCodes.set('LIT', '80')
opCodes.push('LIT')

const addIODevice = (e) => {
  let pad = e.value[0].value[1].join('')
  const label = e.value[1].value[1]
  labels.set(label, pad)
  e.value[2].value.forEach(f => {
    if (f.type === 'sublabel') {
      labels.set(label + '/' + f.value[1], pad)
    }
    if (f.type === 'pad') {
      pad = (parseInt(pad, 16) + parseInt(f.value[1], 16)).toString(16)
      if (pad.length === 1) pad = '0' + pad
    }
  })
}

const op = (e) => {
  const k = e.filter(e => e === 'k')[0] ? 0x80 : 0x00
  const r = e.filter(e => e === 'r')[0] ? 0x40 : 0x00
  const s = e.filter(e => e === '2')[0] ? 0x20 : 0x00
  return (parseInt(hexOpCodes.get(e[0]), 16) + k + r + s).toString(16)
}

const tokens = []

const hexadecimal = anyOfString('0123456789abdcef')
const opModifier = choice([char('k'), char('r'), char('2')])
const sublabel = sequenceOf([char('&'), letters]).map(e => ({ type: 'sublabel', value: e }))
const deviceReadability = many(choice([whitespace, char('['), char(']')]))
tokens['label'] = sequenceOf([char('@'), letters]).map(e => ({ type: 'label', value: e }))
tokens['ioPad'] = sequenceOf([char('|'), many(hexadecimal)]).map(e => ({ type: 'ioPad', value: e }))
tokens['pad'] = sequenceOf([char('$'), many(hexadecimal)]).map(e => ({ type: 'pad', value: e }))
tokens['ioAddresses'] = many(choice([whitespace, sublabel, tokens['pad']])).map(e => ({ type: 'ioAddresses', value: e }))
tokens['device'] = sequenceOf([tokens['ioPad'], whitespace, tokens['label'], deviceReadability, tokens['ioAddresses'], deviceReadability])
tokens['sublabelAddress'] = sequenceOf([char('.'), letters, char('/'), letters])
tokens['literalChar'] = sequenceOf([char('\''), anyChar])
tokens['macro'] = sequenceOf([char('%'), everyCharUntil(whitespace), whitespace, char('{'), everyCharUntil(char('}')), char('}')])
tokens['mainMemoryPad'] = sequenceOf([char('|'), exactly(4)(hexadecimal)])
tokens['comment'] = sequenceOf([char('('), everyCharUntil(char(')')), char(')')])
tokens['literalNumber'] = sequenceOf([hexadecimal, hexadecimal])
tokens['push'] = sequenceOf([char('#'), hexadecimal, hexadecimal])
tokens['pushShort'] = sequenceOf([char('#'), hexadecimal, hexadecimal, hexadecimal, hexadecimal])
tokens['ops'] = sequenceOf([choice(opCodes.map(e => str(e))), possibly(opModifier), possibly(opModifier), possibly(opModifier), whitespace])
tokens['word'] = letters

const x = ['word', 'ops','pushShort', 'push','literalNumber', 'comment', 'mainMemoryPad', 'macro', 'literalChar', 'sublabelAddress', 'device']
x.forEach(token => {
	console.log(token)
	tokens[token] = tokens[token].map(e => ({ type: token, value: e}))
})

const parser = sequenceOf([many(choice([tokens['comment'], tokens['device'], tokens['macro'], tokens['sublabelAddress'], tokens['pad'], tokens['label'], tokens['mainMemoryPad'], tokens['ioPad'], tokens['literalChar'], tokens['literalNumber'], tokens['pushShort'], tokens['push'], tokens['ops'], tokens['word'], whitespace])), endOfInput])

const assemble = (code) => {
  const context = parser.run(code)
  if (context.isError) throw Error(context.error) // TODO pretty print this
  let ast = context.result[0] // Since result[1] is endOfInput
  ast = ast.filter(e => e.type !== undefined) // Filter non-token
  return ast.map((e, i) => {
    switch (e.type) {
      case 'comment':
        return ''
      case 'label':
        labels.set(e.value[1], i)
        return ''
      case 'sublabelAddress':
        return '80' + labels.get(e.value[1] + '/' + e.value[3])
      case 'device':
   	e.value = e.value.filter(n => n.type !== undefined)
        addIODevice(e)
        return ''
      case 'macro':
        macros.set(e.value[1], assemble(e.value[4]))
        return ''
      case 'mainMemoryPad':
        // TODO
        return ''
      case 'ioPad':
        // TODO
        return ''
      case 'literalChar':
        return e.value[1].charCodeAt(0).toString(16)
      case 'literalNumber':
        return e.value[0] + e.value[1]
      case 'push':
        return '80' + e.value[1] + e.value[2]
      case 'pushShort':
        return 'a0' + e.value[1] + e.value[2] + e.value[3] + e.value[4]
      case 'ops':
        return op(e.value)
      case 'word':
        return macros.get(e.value) // TODO throw if word doesnt exist
      default:
    }
    return ''
  }).join('')
}

module.exports = assemble
