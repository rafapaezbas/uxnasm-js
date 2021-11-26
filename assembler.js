const { sequenceOf, whitespace, endOfInput, anyOfString, str, choice, char, possibly, many, many1, everyCharUntil } = require('arcsecond')

let currentLabel = 'default'
let currentPad = 256 // By default, write in main memory

const labels = new Map()
const macros = new Map()
const nonResolvedLiteralAbsoluteAddreses = []
const nonResolvedRelativeAddresses = []

const toHex = (i) => {
  i = i.toString(16)
  const result = i.length < 2 ? '0' + i : i
  return result
}

const opCodes = ['BRK', 'INC', 'POP', 'DUP', 'NIP', 'SWP', 'OVR', 'ROT', 'EQU',
  'NEQ', 'GTH', 'LTH', 'JMP', 'JCN', 'JSR', 'STH', 'LDZ', 'STZ',
  'LDR', 'STR', 'LDA', 'STA', 'DEI', 'DEO', 'ADD', 'SUB', 'MUL',
  'DIV', 'AND', 'ORA', 'EOR', 'SFT', 'LIT', 'LIT2']

const hexOpCodes = new Map()
opCodes.forEach((op, i) => {
  if (op === 'LIT') {
    hexOpCodes.set('LIT', '80')
  } else if (op === 'LIT2') {
    hexOpCodes.set('LIT2', 'a0')
  } else {
    hexOpCodes.set(op, toHex(i))
  }
})

const LIT = '80'
const LIT2 = 'a0'
const UNRESOLVED_ADDRESS = '____'
const UNRESOLVED_RELATIVE_ADDRESS = '===='
const PAD = '0'

const hexadecimal = anyOfString('0123456789abdcef')
const allowedChars = anyOfString('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_/><+*?!=&,\\".')
const opModifier = choice([char('k'), char('r'), char('2')])
const word = many1(allowedChars)

const tokens = []
tokens.comment = sequenceOf([char('('), everyCharUntil(char(')')), char(')')])
tokens.macro = sequenceOf([char('%'), everyCharUntil(whitespace), whitespace, char('{'), everyCharUntil(char('}')), char('}')])
tokens.zeroPageAddress = sequenceOf([char('.'), word])
tokens.absoluteAddress = sequenceOf([char(';'), word])
tokens.relativeAddress = sequenceOf([char(','), word])
tokens.pad = sequenceOf([char('|'), many(hexadecimal)])
tokens.relativePad = sequenceOf([char('$'), many1(hexadecimal)])
tokens.label = sequenceOf([char('@'), word])
tokens.sublabel = sequenceOf([char('&'), word])
tokens.literalChar = sequenceOf([char('\''), allowedChars])
tokens.literalNumber = sequenceOf([hexadecimal, hexadecimal, whitespace])
tokens.literalShort = sequenceOf([hexadecimal, hexadecimal, hexadecimal, hexadecimal, whitespace])
tokens.pushShort = sequenceOf([char('#'), hexadecimal, hexadecimal, hexadecimal, hexadecimal])
tokens.push = sequenceOf([char('#'), hexadecimal, hexadecimal])
tokens.ops = sequenceOf([choice(opCodes.map(e => str(e))), possibly(opModifier), possibly(opModifier), possibly(opModifier), whitespace])
tokens.string = sequenceOf([char('"'), many1(allowedChars)])
tokens.word = word
tokens.whitespace = whitespace

Object.keys(tokens).forEach(token => {
  tokens[token] = tokens[token].map(e => ({ type: token, value: e }))
})

const parser = sequenceOf([many(choice(Object.keys(tokens).map(e => tokens[e]))), endOfInput])

const f = []

f.comment = (e) => {
  // comment :)
}

f.label = (e, i, acc) => {
  currentLabel = e.value[1].join('')
  if (currentPad < 256) {
    labels.set(e.value[1].join(''), toHex(currentPad))
  } else {
    labels.set(e.value[1].join(''), toHex(acc.length / 2))
  }
}

f.zeroPageAddress = (e) => {
  const label = e.value[1].join('')
  return LIT + labels.get(label)
}

f.macro = (e) => {
  macros.set(e.value[1], assemble(e.value[4]))
}

f.literalChar = (e) => {
  return e.value[1].charCodeAt(0).toString(16)
}

f.literalNumber = (e) => {
  return e.value[0] + e.value[1]
}

f.literalShort = (e) => {
  return e.value[0] + e.value[1] + e.value[2] + e.value[3]
}

f.push = (e) => {
  return LIT + e.value[1] + e.value[2]
}

f.pushShort = (e) => {
  return LIT2 + e.value[1] + e.value[2] + e.value[3] + e.value[4]
}

f.ops = (e) => {
  const k = e.value.filter(e => e === 'k')[0] ? 0x80 : 0x00
  const r = e.value.filter(e => e === 'r')[0] ? 0x40 : 0x00
  const s = e.value.filter(e => e === '2')[0] ? 0x20 : 0x00
  return toHex(parseInt(hexOpCodes.get(e.value[0]), 16) + k + r + s)
}

f.word = (e) => {
  const value = macros.get(e.value.join(''))
  if (value) {
    return value
  } else {
    throw new Error('Macro not found: ' + e.value.join(''))
  }
}

f.pad = (e, i, acc) => {
  const pad = parseInt(e.value[1].join(''), 16)
  currentPad = pad
  if (pad >= 256) {
    return PAD.repeat((pad - 256) * 2)
  }
}

f.relativePad = (e, i, acc) => {
  const pad = parseInt(e.value[1].join(''), 16)
  if (currentPad >= 256) {
    currentPad += pad
    return PAD.repeat(pad * 2)
  } else {
    currentPad += pad
  }
}

f.absoluteAddress = (e, i, acc) => {
  const label = e.value[1].join('')
  if (labels.get(label) !== undefined) {
    const pad = labels.get(label)
    const page = toHex((Math.floor(parseInt(pad, 16) / 256) + 1))
    const offset = toHex(((parseInt(pad, 16) % 256)))
    return LIT2 + page + offset
  } else {
    nonResolvedLiteralAbsoluteAddreses.push(label)
    return LIT2 + UNRESOLVED_ADDRESS
  }
}

f.relativeAddress = (e, i, acc) => {
  const isRelative = e.value[1].indexOf('&') !== -1
  const completeLabel = isRelative ? currentLabel + '/' + e.value[1].join('').substring(1) : e.value[1].join('')
  const label = labels.get(completeLabel)
  if (label) {
    const distance = label - (acc.length / 2) - 3
    if (distance > 126) labelTooFarError(label)
    return LIT + toHex(256 + (distance))
  } else {
    nonResolvedRelativeAddresses.push({ label: completeLabel, pos: acc.length / 2 })
    return UNRESOLVED_RELATIVE_ADDRESS
  }
}

f.sublabel = (e, i, acc) => {
  const label = e.value[1].join('')
  if (currentPad < 256) {
    labels.set(currentLabel + '/' + label, toHex(currentPad))
  } else {
    labels.set(currentLabel + '/' + label, acc.length / 2)
  }
}

f.string = (e, i, acc) => {
  return e.value[1].map(e => e.charCodeAt(0).toString(16)).join('')
}

const assemble = (code) => {
  code = code.replace(/\[|\]/g, ' ')
  const context = parser.run(code)
  if (context.isError) throw Error(context.error)
  let ast = context.result[0] // Since result[1] is endOfInput
  ast = ast.filter(e => e.type !== undefined)
  const firstPass = ast.reduce((acc, e, i) => {
    const next = f[e.type] !== undefined ? f[e.type](e, i, acc) : undefined
    if (next) {
      return acc + next
    } else {
      return acc
    }
  }, '')
  return resolveAddresses(firstPass)
}

const resolveAddresses = (s) => {
  nonResolvedLiteralAbsoluteAddreses.reverse()
  while (s.indexOf(UNRESOLVED_ADDRESS) !== -1) {
    const label = nonResolvedLiteralAbsoluteAddreses.pop()
    const pad = labels.get(label)
    const i = typeof pad === 'string' ? parseInt(pad, 16) : pad
    const page = toHex((Math.floor(i / 256) + 1))
    const offset = toHex(((i % 256)))
    s = s.replace(UNRESOLVED_ADDRESS, page + offset)
  }

  nonResolvedRelativeAddresses.reverse()
  while (s.indexOf(UNRESOLVED_RELATIVE_ADDRESS) !== -1) {
    const label = nonResolvedRelativeAddresses.pop()
    const labelPos = typeof labels.get(label.label) === 'string' ? parseInt(labels.get(label.label), 16) : labels.get(label.label)
    if (labelPos === undefined) labelDoesNotExistError(label)
    const distance = toHex(labelPos - (label.pos + 3))
    if (parseInt(distance, 16) > 126) labelTooFarError(label)
    s = s.replace(UNRESOLVED_RELATIVE_ADDRESS, LIT + distance)
  }

  return s
}

const labelTooFarError = (label) => {
  throw new Error('Label: ' + label + 'too far.')
}

const labelDoesNotExistError = (label) => {
  throw new Error('Label: ' + label + 'does not exist.')
}

module.exports = assemble
