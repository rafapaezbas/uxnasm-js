const { sequenceOf, whitespace, endOfInput, anyOfString, str, choice, char, anyChar, possibly, letters, many, many1, everyCharUntil } = require('arcsecond')

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

const opCodes = ['BRK', 'INC', 'POP', 'DUP', 'NIP', 'SWP', 'OVR', 'ROT', 'EQU', 'NEQ', 'GTH', 'LTH', 'JMP', 'JCN', 'JSR', 'STH', 'LDZ', 'STZ', 'LDR', 'STR', 'LDA', 'STA', 'DEI', 'DEO', 'ADD', 'SUB', 'MUL', 'DIV', 'AND', 'ORA', 'EOR', 'SFT', 'LIT']

const hexOpCodes = new Map()
opCodes.forEach((op, i) => {
  if (op !== 'LIT') {
    hexOpCodes.set(op, toHex(i))
  } else {
    hexOpCodes.set('LIT', '80')
  }
})

const hexadecimal = anyOfString('0123456789abdcef')
const allowedChars = anyOfString('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-')
const opModifier = choice([char('k'), char('r'), char('2')])
const word = many1(allowedChars)

const tokens = []
tokens.sublabel = sequenceOf([char('&'), word])
tokens.label = sequenceOf([char('@'), word])
tokens.pad = sequenceOf([char('|'), many(hexadecimal)])
tokens.relativePad = sequenceOf([char('$'), many1(hexadecimal)])
tokens.sublabelAddress = sequenceOf([char('.'), letters, char('/'), letters])
tokens.literalChar = sequenceOf([char('\''), anyChar])
tokens.macro = sequenceOf([char('%'), everyCharUntil(whitespace), whitespace, char('{'), everyCharUntil(char('}')), char('}')])
tokens.comment = sequenceOf([char('('), everyCharUntil(char(')')), char(')')])
tokens.literalNumber = sequenceOf([hexadecimal, hexadecimal])
tokens.push = sequenceOf([char('#'), hexadecimal, hexadecimal])
tokens.pushShort = sequenceOf([char('#'), hexadecimal, hexadecimal, hexadecimal, hexadecimal])
tokens.ops = sequenceOf([choice(opCodes.map(e => str(e))), possibly(opModifier), possibly(opModifier), possibly(opModifier), whitespace])
tokens.word = word
tokens.literalAbsoluteAddress = sequenceOf([char(';'), word])
tokens.literalRelativeAddress = sequenceOf([char(','), word])
tokens.relativeAddress = sequenceOf([char(','), char('&'), word])

Object.keys(tokens).forEach(token => {
  tokens[token] = tokens[token].map(e => ({ type: token, value: e }))
})

const parser = sequenceOf([many(choice([tokens.comment, tokens.macro, tokens.sublabel, tokens.sublabelAddress, tokens.pad, tokens.label, tokens.literalAbsoluteAddress, tokens.relativePad, tokens.relativeAddress, tokens.literalChar, tokens.literalNumber, tokens.pushShort, tokens.push, tokens.ops, tokens.word, whitespace])), endOfInput])

const f = []

f.comment = (e) => {
  return undefined
}

f.label = (e, i, acc) => {
  currentLabel = e.value[1].join('')
  labels.set(e.value[1].join(''), toHex(acc.length / 2))
  return undefined
}

f.sublabelAddress = (e) => {
  return '80' + labels.get(e.value[1] + '/' + e.value[3])
}

f.macro = (e) => {
  macros.set(e.value[1], assemble(e.value[4]))
  return undefined
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
  currentPad = pad
  if (pad >= 256) {
    return '0'.repeat((pad - 256) * 2)
  } else {
    return ''
  }
}

f.relativePad = (e, i, acc) => {
  const pad = parseInt(e.value[1].join(''), 16)
  if (currentPad >= 256) {
    currentPad += pad
    return '0'.repeat(pad * 2)
  } else {
    currentPad += pad
    return ''
  }
}

f.relativeAddress = (e, i, acc) => {
  const label = labels.get(currentLabel + '/' + e.value[2].join(''))
  if (label) {
    const distance = 255 - (label * 2) + 1
    // if (distance > 128) TODO throw error
    return '80' + toHex(distance)
  } else {
    nonResolvedRelativeAddresses.push({ label: currentLabel + '/' + e.value[2].join(''), pos: acc.length / 2 })
    return '++++'
  }
}

f.sublabel = (e, i, acc) => {
  const label = e.value[1].join('')
  if (currentPad < 256) {
    labels.set(currentLabel + '/' + label, toHex(currentPad))
  } else {
    labels.set(currentLabel + '/' + label, acc.length / 2)
  }
  return ''
}

const assemble = (code) => {
  code = code.replace(/\[|\]/g, ' ')
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
    const distance = toHex((labels.get(label.label) - (label.pos + 3)))
    if (parseInt(distance, 16) > 128) {
      // TODO error label to far away
    }
    s = s.replace('++++', '80' + distance)
  }
  return s
}

module.exports = assemble
