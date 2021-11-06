const fs = require('fs')
const path = require('path')
const { sequenceOf, whitespace, choice, char, letters, digit, digits, many, everyCharUntil } = require('arcsecond')

const toHex = (i) => {
	i = i.toString(16)
	return i.length < 2 ? '0' + i : i 
}

const opCodes = ["BRK","INC","POP","DUP","NIP","SWP","OVR","ROT","EQU","NEQ","GTH","LTH","JMP","JCN","JSR","STH","LDZ","STZ","LDR","STR","LDA","STA","DEI","DEO","ADD","SUB","MUL","DIV","AND","ORA","EOR","SFT"]
let hexOpCodes = new Map()
opCodes.forEach((op,i) => hexOpCodes.set(op,toHex(i)))

const label = sequenceOf([char('@'), letters])
const macro = sequenceOf([char('%'), everyCharUntil(whitespace), whitespace, char('{'), everyCharUntil(char('}')), char('}')])
const address = sequenceOf([char('|'), everyCharUntil(whitespace)])
const comment = sequenceOf([char('('), everyCharUntil(char(')')), char(')')])
const literal = sequenceOf([char('\''), letters])
const push = sequenceOf([char('#'), digit, digit])
const word = letters

const parser = many(choice([comment, label, macro, address, literal, push, word, digits, whitespace]))

const file = fs.readFileSync('/home/rpaezbas/Escritorio/uxn/projects/examples/exercises/hello-world.tal').toString()
console.log(file)
console.log(parser.run(file))

const hex = Buffer.from('806380011880181780618018' + hexOpCodes.get('INC'), 'hex')
fs.writeFileSync(path.resolve('./test.rom'), hex)
