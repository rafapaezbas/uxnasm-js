const {test, solo } = require('brittle')
const fs = require('fs').promises
const path = require('path')
const assemble = require('../assembler.js')

solo()

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

test('Words not only letters', async (assert) => {
  const rom = await fs.readFile(path.join(__dirname, 'roms', '3.rom'))
  const code = (await fs.readFile(path.join(__dirname, 'uxntal', '3.tal'))).toString()
  assert.is(assemble(code), rom.toString('hex'))
})

test('Labels in main menory', async (assert) => {
  const rom = await fs.readFile(path.join(__dirname, 'roms', '4.rom'))
  const code = (await fs.readFile(path.join(__dirname, 'uxntal', '4.tal'))).toString()
  assert.is(assemble(code), rom.toString('hex'))
})

test('Sprites (addresses)', async (assert) => {
  const rom = await fs.readFile(path.join(__dirname, 'roms', '5.rom'))
  const code = (await fs.readFile(path.join(__dirname, 'uxntal', '5.tal'))).toString()
  assert.is(assemble(code), rom.toString('hex'))
})

test('label in page two of main', async (assert) => {
  const rom = await fs.readFile(path.join(__dirname, 'roms', '6.rom'))
  const code = (await fs.readFile(path.join(__dirname, 'uxntal', '6.tal'))).toString()
  assert.is(assemble(code), rom.toString('hex'))
})
