const { sequenceOf, whitespace, endOfInput, anyOfString, str, choice, char, anyChar, possibly, letters, many, many1, exactly, everyCharUntil } = require('arcsecond')

const labels = new Map()
const macros = new Map()
const relativeLabels = new Map()
const nonResolvedLiteralAbsoluteAddreses = []
const nonResolvedRelativeAddresses = []

const toHex = (i) => {
  i = i.toString(16)
  const result = i.length < 2 ? '0' + i : i
  return result
}

const replaceUnresolvedAddresses = (s) => {
  nonResolvedLiteralAbsoluteAddreses.reverse()
  while (s.indexOf('____') !== -1) {
    const label = nonResolvedLiteralAbsoluteAddreses.pop()
    const pad = labels.get(label)
    const page = toHex((Math.floor(parseInt(pad, 16) / 256) + 1))
    const offset = toHex(((parseInt(pad, 16) % 256)))
    s = s.replace('____', page + offset)
  }
  return s
}

const replaceUnresolvedRelativeAddress = (s) => {
  nonResolvedRelativeAddresses.reverse()
  while (s.indexOf('++++') !== -1) {
    const label = nonResolvedRelativeAddresses.pop()
    const distance = toHex((relativeLabels.get(label.label) - (label.pos + 3)))
    if (parseInt(distance, 16) > 128) {
      // TODO error label to far away
    }
    s = s.replace('++++', '80' + distance)
  }
  return s
}

const opCodes = ['BRK', 'INC', 'POP', 'DUP', 'NIP', 'SWP', 'OVR', 'ROT', 'EQU', 'NEQ', 'GTH', 'LTH', 'JMP', 'JCN', 'JSR', 'STH', 'LDZ', 'STZ', 'LDR', 'STR', 'LDA', 'STA', 'DEI', 'DEO', 'ADD', 'SUB', 'MUL', 'DIV', 'AND', 'ORA', 'EOR', 'SFT']
const hexOpCodes = new Map()
opCodes.forEach((op, i) => hexOpCodes.set(op, toHex(i)))
hexOpCodes.set('LIT', '80')
opCodes.push('LIT')

const tokens = []

const hexadecimal = anyOfString('0123456789abdcef')
const allowedChars = anyOfString('0123456789abcdefghijklmnopqrstuwxyzABCDEFGHIJKLMNOPQRSTUWXYZ-')
const opModifier = choice([char('k'), char('r'), char('2')])
const sublabel = sequenceOf([char('&'), letters]).map(e => ({ type: 'sublabel', value: e }))
const deviceReadability = many(choice([whitespace, char('['), char(']')]))
tokens.label = sequenceOf([char('@'), many1(allowedChars)]).map(e => ({ type: 'label', value: e }))
tokens.ioPad = sequenceOf([char('|'), many(hexadecimal)]).map(e => ({ type: 'ioPad', value: e }))
tokens.pad = sequenceOf([char('$'), many1(hexadecimal)]).map(e => ({ type: 'pad', value: e }))
tokens.ioAddresses = many(choice([whitespace, sublabel, tokens.pad])).map(e => ({ type: 'ioAddresses', value: e }))
tokens.device = sequenceOf([tokens.ioPad, whitespace, tokens.label, deviceReadability, tokens.ioAddresses, deviceReadability])
tokens.sublabelAddress = sequenceOf([char('.'), letters, char('/'), letters])
tokens.literalChar = sequenceOf([char('\''), anyChar])
tokens.macro = sequenceOf([char('%'), everyCharUntil(whitespace), whitespace, char('{'), everyCharUntil(char('}')), char('}')])
tokens.mainMemoryPad = sequenceOf([char('|'), exactly(4)(hexadecimal)])
tokens.comment = sequenceOf([char('('), everyCharUntil(char(')')), char(')')])
tokens.literalNumber = sequenceOf([hexadecimal, hexadecimal])
tokens.push = sequenceOf([char('#'), hexadecimal, hexadecimal])
tokens.pushShort = sequenceOf([char('#'), hexadecimal, hexadecimal, hexadecimal, hexadecimal])
tokens.ops = sequenceOf([choice(opCodes.map(e => str(e))), possibly(opModifier), possibly(opModifier), possibly(opModifier), whitespace])
tokens.word = many1(allowedChars)
tokens.literalAbsoluteAddress = sequenceOf([char(';'), many1(allowedChars)])
tokens.literalRelativeAddress = sequenceOf([char(','), many1(allowedChars)])
tokens.relativeAddress = sequenceOf([char(','), char('&'), many1(allowedChars)])
tokens.relativeLabel = sequenceOf([char('&'), many1(allowedChars)])

const inCodeTokens = ['word', 'ops', 'pushShort', 'push', 'literalNumber', 'comment', 'mainMemoryPad', 'macro', 'literalChar', 'sublabelAddress', 'device', 'literalAbsoluteAddress', 'relativeLabel', 'relativeAddress']
inCodeTokens.forEach(token => {
  tokens[token] = tokens[token].map(e => ({ type: token, value: e }))
})

const parser = sequenceOf([many(choice([tokens.comment, tokens.device, tokens.macro, tokens.sublabelAddress, tokens.pad, tokens.label, tokens.literalAbsoluteAddress, tokens.mainMemoryPad, tokens.relativeLabel, tokens.relativeAddress, tokens.ioPad, tokens.literalChar, tokens.literalNumber, tokens.pushShort, tokens.push, tokens.ops, tokens.word, whitespace])), endOfInput])

const f = []

f.comment = (e) => {
  return undefined
}

f.label = (e, i, acc) => {
  labels.set(e.value[1].join(''), toHex(acc.length / 2))
  return undefined
}

f.sublabelAddress = (e) => {
  return '80' + labels.get(e.value[1] + '/' + e.value[3])
}

f.device = (e) => {
  e.value = e.value.filter(n => n.type !== undefined)
  let pad = e.value[0].value[1].join('')
  const label = e.value[1].value[1].join('')
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
  return undefined
}

f.macro = (e) => {
  macros.set(e.value[1], assemble(e.value[4]))
  return undefined
}

f.mainMemoryPad = (e) => {
  return undefined // TODO
}

f.ioPad = (e) => {
  return undefined // TODO
}

f.literalChar = (e) => {
  return e.value[1].charCodeAt(0).toString(16)
}

f.literalNumber = (e) => {
  return e.value[0] + e.value[1]
}

f.push = (e) => {
  return '80' + e.value[1] + e.value[2]
}

f.pushShort = (e) => {
  return 'a0' + e.value[1] + e.value[2] + e.value[3] + e.value[4]
}

f.ops = (e) => {
  const k = e.value.filter(e => e === 'k')[0] ? 0x80 : 0x00
  const r = e.value.filter(e => e === 'r')[0] ? 0x40 : 0x00
  const s = e.value.filter(e => e === '2')[0] ? 0x20 : 0x00
  const op = (parseInt(hexOpCodes.get(e.value[0]), 16) + k + r + s).toString(16)
  return op.length > 1 ? op : '0' + op
}

f.word = (e) => {
  return macros.get(e.value.join('')) // TODO throw if word doesnt exist
}

f.literalAbsoluteAddress = (e, i, acc) => {
  const label = e.value[1].join('')
  if (labels.get(label) !== undefined) {
    return labels.get(label)
  } else {
    nonResolvedLiteralAbsoluteAddreses.push(label)
    return 'a0____'
  }
}

f.pad = (e, i, acc) => {
  const pad = parseInt(e.value[1].join(''), 16)
  return '0'.repeat(pad * 2)
}

f.relativeLabel = (e, i, acc) => {
  const label = e.value[1].join('')
  relativeLabels.set(label, acc.length / 2)
}

f.relativeAddress = (e, i, acc) => {
  const label = relativeLabels.get(e.value[2].join(''))
  if (label) {
    const distance = 255 - (label * 2) + 1
    // if (distance > 128) TODO throw error
    return '80' + toHex(distance)
  } else {
    nonResolvedRelativeAddresses.push({ label: e.value[2].join(''), pos: acc.length / 2 })
    return '++++'
  }
}

const assemble = (code) => {
  const context = parser.run(code)
  if (context.isError) throw Error(context.error) // TODO pretty print this
  let ast = context.result[0] // Since result[1] is endOfInput
  ast = ast.filter(e => e.type !== undefined) // Filter non-token
  const firstPass = ast.reduce((acc, e, i) => {
    const next = f[e.type] !== undefined ? f[e.type](e, i, acc) : undefined
    if (next) {
      return acc + next
    } else {
      return acc
    }
  }, '')
  return replaceUnresolvedRelativeAddress(replaceUnresolvedAddresses(firstPass))
}

module.exports = assemble
