const test = require('brittle')
const fs = require('fs').promises
const path = require('path')
const assemble = require('../assembler.js')

test('Macros, devices and basics', async (assert) => {
  const rom = await fs.readFile(path.join(__dirname, 'roms', '1.rom'))
  const code = (await fs.readFile(path.join(__dirname, 'uxntal', '1.tal'))).toString()
  assert.is(assemble(code), rom.toString('hex'))
})

test('Shorts and ops short mode', async (assert) => {
  const rom = await fs.readFile(path.join(__dirname, 'roms', '2.rom'))
  const code = (await fs.readFile(path.join(__dirname, 'uxntal', '2.tal'))).toString()
  assert.is(assemble(code), rom.toString('hex'))
})
