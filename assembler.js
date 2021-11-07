const { sequenceOf, whitespace, endOfInput, anyOfString, str, choice, char, anyChar, possibly, letters, many, exactly, everyCharUntil } = require('arcsecond')
const fs = require('fs')
const path = require('path')
const file = fs.readFileSync('./hello-world.tal').toString()

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
    }
  })
}

const op = (e) => {
  const k = e.filter(e => e === 'k')[0] ? 0x80 : 0x00
  const r = e.filter(e => e === 'r')[0] ? 0x40 : 0x00
  const s = e.filter(e => e === '2')[0] ? 0x20 : 0x00
  return (parseInt(hexOpCodes.get(e[0]), 16) + k + r + s).toString(16)
}

const hexadecimal = anyOfString('0123456789abdcef')
const label = sequenceOf([char('@'), letters]).map(e => ({ type: 'label', value: e }))
const sublabel = sequenceOf([char('&'), letters]).map(e => ({ type: 'sublabel', value: e }))
const ioPad = sequenceOf([char('|'), many(hexadecimal)]).map(e => ({ type: 'ioPad', value: e }))
const pad = sequenceOf([char('$'), many(hexadecimal)]).map(e => ({ type: 'pad', value: e }))
const ioAddresses = many(choice([whitespace, sublabel, pad])).map(e => ({ type: 'ioAddresses', value: e }))
const deviceReadability = many(choice([whitespace, char('['), char(']')]))
const device = sequenceOf([ioPad, whitespace, label, deviceReadability, ioAddresses, deviceReadability]).map(e => ({ type: 'device', value: e.filter(e => e.type !== undefined) }))
const sublabelAddress = sequenceOf([char('.'), letters, char('/'), letters]).map(e => ({ type: 'sublabelAddress', value: e }))
const literalChar = sequenceOf([char('\''), anyChar]).map(e => ({ type: 'literalChar', value: e }))
const macro = sequenceOf([char('%'), everyCharUntil(whitespace), whitespace, char('{'), everyCharUntil(char('}')), char('}')]).map(e => ({ type: 'macro', value: e }))
const mainMemoryPad = sequenceOf([char('|'), exactly(4)(hexadecimal)]).map(e => ({ type: 'mainMemoryPad', value: e }))
const comment = sequenceOf([char('('), everyCharUntil(char(')')), char(')')]).map(e => ({ type: 'comment', value: e }))
const literalNumber = sequenceOf([hexadecimal, hexadecimal]).map(e => ({ type: 'literalNumber', value: e }))
const push = sequenceOf([char('#'), hexadecimal, hexadecimal]).map(e => ({ type: 'push', value: e }))
const pushShort = sequenceOf([char('#'), hexadecimal, hexadecimal, hexadecimal, hexadecimal]).map(e => ({ type: 'pushShort', value: e }))
const opModifier = choice([char('k'), char('r'), char('2')])
const ops = sequenceOf([choice(opCodes.map(e => str(e))), possibly(opModifier), possibly(opModifier), possibly(opModifier)]).map(e => ({ type: 'op', value: e }))
const word = letters.map(e => ({ type: 'word', value: e }))

const parser = sequenceOf([many(choice([comment, device, macro, sublabelAddress, pad, label, mainMemoryPad, ioPad, literalChar, literalNumber, pushShort, push, ops, word, whitespace])), endOfInput])

const assemble = (code) => {
  const context = parser.run(code)
  if (context.isError) throw Error(context.error) // TODO pretty print this
  let ast = context.result[0] // Since result[1] is endOfInput
  ast = ast.filter(e => e.type !== undefined) // Filter non-token
  return ast.map((e, i) => {
    console.log(e)
    switch (e.type) {
      case 'comment':
        return ''
      case 'label':
        labels.set(e.value[1], i)
        return ''
      case 'sublabelAddress':
        return '80' + labels.get(e.value[1] + '/' + e.value[3])
      case 'device':
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
      case 'op':
        return op(e.value)
      case 'word':
        return macros.get(e.value) // TODO throw if word doesnt exist
      default:
    }
    return ''
  }).join('')
}

const program = assemble(file)
console.log(program)
console.log(labels)
fs.writeFileSync(path.resolve('./test.rom'), Buffer.from(program, 'hex'))
