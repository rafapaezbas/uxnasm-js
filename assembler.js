const { sequenceOf, whitespace, endOfInput, anyOfString, str, choice, char, anyChar, possibly, many, many1, everyCharUntil } = require('arcsecond')

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
const allowedChars = anyOfString('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_')
const opModifier = choice([char('k'), char('r'), char('2')])
const word = many1(allowedChars)

const tokens = []
tokens.comment = sequenceOf([char('('), everyCharUntil(char(')')), char(')')])
tokens.macro = sequenceOf([char('%'), everyCharUntil(whitespace), whitespace, char('{'), everyCharUntil(char('}')), char('}')])
tokens.label = sequenceOf([char('@'), word])
tokens.sublabel = sequenceOf([char('&'), word])
tokens.pad = sequenceOf([char('|'), many(hexadecimal)])
tokens.relativePad = sequenceOf([char('$'), many1(hexadecimal)])
tokens.literalChar = sequenceOf([char('\''), anyChar])
tokens.literalNumber = sequenceOf([hexadecimal, hexadecimal])
tokens.push = sequenceOf([char('#'), hexadecimal, hexadecimal])
tokens.pushShort = sequenceOf([char('#'), hexadecimal, hexadecimal, hexadecimal, hexadecimal])
tokens.ops = sequenceOf([choice(opCodes.map(e => str(e))), possibly(opModifier), possibly(opModifier), possibly(opModifier), whitespace])
tokens.zeroPageAddress = sequenceOf([char('.'), word, possibly(sequenceOf([char('/'), word]))])
tokens.absoluteAddress = sequenceOf([char(';'), word, possibly(sequenceOf([char('/'), word]))])
tokens.relativeAddress = sequenceOf([char(','), char('&'), word])
tokens.word = word

Object.keys(tokens).forEach(token => {
  tokens[token] = tokens[token].map(e => ({ type: token, value: e }))
})

const parser = sequenceOf([many(choice([tokens.comment, tokens.macro, tokens.sublabel, tokens.zeroPageAddress, tokens.pad, tokens.label, tokens.absoluteAddress, tokens.relativePad, tokens.relativeAddress, tokens.literalChar, tokens.literalNumber, tokens.pushShort, tokens.push, tokens.ops, tokens.word, whitespace])), endOfInput])

const f = []

f.comment = (e) => {
  return undefined
}

f.label = (e, i, acc) => {
  currentLabel = e.value[1].join('')
  labels.set(e.value[1].join(''), toHex(acc.length / 2))
  return undefined
}

f.zeroPageAddress = (e) => {
  const label = e.value[1].join('')
  const sublabel = e.value[2] ? '/' + e.value[2][1].join('') : ''
  return '80' + labels.get(label + sublabel)
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

f.absoluteAddress = (e, i, acc) => {
  const label = e.value[1].join('')
  const sublabel = e.value[2] ? '/' + e.value[2][1].join('') : ''
  if (labels.get(label + sublabel) !== undefined) {
    const pad = labels.get(label + sublabel)
    const page = toHex((Math.floor(parseInt(pad, 16) / 256) + 1))
    const offset = toHex(((parseInt(pad, 16) % 256)))
    return 'a0' + page + offset
  } else {
    nonResolvedLiteralAbsoluteAddreses.push(label + sublabel)
    return 'a0____'
  }
}

f.relativeAddress = (e, i, acc) => {
  const label = labels.get(currentLabel + '/' + e.value[2].join(''))
  if (label) {
    const distance = label - (acc.length / 2) - 3
    // if (distance > 126) TODO throw error
    return '80' + toHex(256 + (distance))
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
    const i = typeof pad === 'string' ? parseInt(pad, 16) : pad
    const page = toHex((Math.floor(i / 256) + 1))
    const offset = toHex(((i % 256)))
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
