const fs = require('fs')
const path = require('path')
const { sequenceOf, whitespace, choice, char, anyChar, letters, digit, digits, many, everyCharUntil } = require('arcsecond')
const file = fs.readFileSync('./hello-world.tal').toString()

const labels = []
const macros = new Map()

const toHex = (i) => {
  i = i.toString(16)
  return i.length < 2 ? '0' + i : i
}

const opCodes = ['BRK', 'INC', 'POP', 'DUP', 'NIP', 'SWP', 'OVR', 'ROT', 'EQU', 'NEQ', 'GTH', 'LTH', 'JMP', 'JCN', 'JSR', 'STH', 'LDZ', 'STZ', 'LDR', 'STR', 'LDA', 'STA', 'DEI', 'DEO', 'ADD', 'SUB', 'MUL', 'DIV', 'AND', 'ORA', 'EOR', 'SFT']
const hexOpCodes = new Map()
opCodes.forEach((op, i) => hexOpCodes.set(op, toHex(i)))
hexOpCodes.set('LIT', '80')

const label = sequenceOf([char('@'), letters]).map(e => ({ type: 'label', value: e }))
const macro = sequenceOf([char('%'), everyCharUntil(whitespace), whitespace, char('{'), everyCharUntil(char('}')), char('}')]).map(e => ({ type: 'macro', value: e }))
const address = sequenceOf([char('|'), everyCharUntil(whitespace)]).map(e => ({ type: 'address', value: e }))
const comment = sequenceOf([char('('), everyCharUntil(char(')')), char(')')]).map(e => ({ type: 'comment', value: e }))
const literal = sequenceOf([char('\''), anyChar]).map(e => ({ type: 'literal', value: e }))
const push = sequenceOf([char('#'), digit, digit]).map(e => ({ type: 'push', value: e }))
const word = letters.map(e => ({ type: 'word', value: e }))

const parser = many(choice([comment, label, macro, address, literal, push, word, digits, whitespace]))

const assemble = (code) => {
  let ast = parser.run(code).result
  ast = ast.filter(e => e.type !== undefined) // Filter non-token
  return ast.map((e, i) => {
    console.log('TYPE', e)
    switch (e.type) {
      case 'comment':
        return ''
      case 'label':
        labels[e.value[1]] = i
        return ''
      case 'macro':
        macros.set(e.value[1],assemble(e.value[4]))
        return
      case 'address':
      // TODO
        return ''
      case 'literal':
        return e.value[1].charCodeAt(0).toString(16)
      case 'push':
        return '80' + e.value[1] + e.value[2]
      case 'word':
        return hexOpCodes.get(e.value) !== undefined ? hexOpCodes.get(e.value) : macros.get(e.value)
      default:
    }
    return ''
  }).join('')
}

const program = assemble(file)
console.log(program)
console.log('80638001188018178061801801')

fs.writeFileSync(path.resolve('./test.rom'), Buffer.from(program, 'hex'))
