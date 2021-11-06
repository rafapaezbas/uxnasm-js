const fs = require('fs')
const { str, sequenceOf, whitespace, choice, char, letters, digits, anyChar, many, everyCharUntil, possibly } = require('arcsecond')
const tokens = []

const address = sequenceOf([char('|'),everyCharUntil(whitespace)]).map(x => ({type: 'address', value:x}))
const comment = sequenceOf([char('('),everyCharUntil(char(')')),char(')')])
const literal = sequenceOf([char('\''),letters])
const word = letters


const parser = many(choice([comment,address,literal, word, digits, whitespace]))



const file = fs.readFileSync('/home/rpaezbas/Escritorio/uxn/projects/examples/exercises/hello-world.tal').toString()
console.log(file)
console.log(parser.run(file))
