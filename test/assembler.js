const { test, solo } = require('brittle')
const fs = require('fs').promises
const path = require('path')

solo()

solo('Macros, devices and basics', async (assert) => {
  const assemble = requireUncached('../assembler.js')
  const rom = await fs.readFile(path.join(__dirname, 'roms', '1.rom'))
  const code = (await fs.readFile(path.join(__dirname, 'uxntal', '1.tal'))).toString()
  assert.is(assemble(code), rom.toString('hex'))
})

test('Shorts and ops short mode', async (assert) => {
  const assemble = requireUncached('../assembler.js')
  const rom = await fs.readFile(path.join(__dirname, 'roms', '2.rom'))
  const code = (await fs.readFile(path.join(__dirname, 'uxntal', '2.tal'))).toString()
  assert.is(assemble(code), rom.toString('hex'))
})

test('Words not only letters', async (assert) => {
  const assemble = requireUncached('../assembler.js')
  const rom = await fs.readFile(path.join(__dirname, 'roms', '3.rom'))
  const code = (await fs.readFile(path.join(__dirname, 'uxntal', '3.tal'))).toString()
  assert.is(assemble(code), rom.toString('hex'))
})

test('Labels in main menory', async (assert) => {
  const assemble = requireUncached('../assembler.js')
  const rom = await fs.readFile(path.join(__dirname, 'roms', '4.rom'))
  const code = (await fs.readFile(path.join(__dirname, 'uxntal', '4.tal'))).toString()
  assert.is(assemble(code), rom.toString('hex'))
})

test('Sprites (addresses)', async (assert) => {
  const assemble = requireUncached('../assembler.js')
  const rom = await fs.readFile(path.join(__dirname, 'roms', '5.rom'))
  const code = (await fs.readFile(path.join(__dirname, 'uxntal', '5.tal'))).toString()
  assert.is(assemble(code), rom.toString('hex'))
})

test('label in page two of main', async (assert) => {
  const assemble = requireUncached('../assembler.js')
  const rom = await fs.readFile(path.join(__dirname, 'roms', '6.rom'))
  const code = (await fs.readFile(path.join(__dirname, 'uxntal', '6.tal'))).toString()
  assert.is(assemble(code), rom.toString('hex'))
})

test('label in page 10 of main', async (assert) => {
  const assemble = requireUncached('../assembler.js')
  const rom = await fs.readFile(path.join(__dirname, 'roms', '7.rom'))
  const code = (await fs.readFile(path.join(__dirname, 'uxntal', '7.tal'))).toString()
  assert.is(assemble(code), rom.toString('hex'))
})

test('Compudanzas day 3 (hello-keyboard)', async (assert) => {
  const assemble = requireUncached('../assembler.js')
  const rom = await fs.readFile(path.join(__dirname, 'roms', '8.rom'))
  const code = (await fs.readFile(path.join(__dirname, 'uxntal', '8.tal'))).toString()
  assert.is(assemble(code), rom.toString('hex'))
})

test('relative address non resolved', async (assert) => {
  const assemble = requireUncached('../assembler.js')
  const rom = await fs.readFile(path.join(__dirname, 'roms', '9.rom'))
  const code = (await fs.readFile(path.join(__dirname, 'uxntal', '9.tal'))).toString()
  assert.is(assemble(code), rom.toString('hex'))
})

test('relative address resolved', async (assert) => {
  const assemble = requireUncached('../assembler.js')
  const rom = await fs.readFile(path.join(__dirname, 'roms', '10.rom'))
  const code = (await fs.readFile(path.join(__dirname, 'uxntal', '10.tal'))).toString()
  assert.is(assemble(code), rom.toString('hex'))
})

test('compudanzas day 3 "draw with arrows"', async (assert) => {
  const assemble = requireUncached('../assembler.js')
  const rom = await fs.readFile(path.join(__dirname, 'roms', '11.rom'))
  const code = (await fs.readFile(path.join(__dirname, 'uxntal', '11.tal'))).toString()
  assert.is(assemble(code), rom.toString('hex'))
})

test('compudanzas day 4 "hello line"', async (assert) => {
  const assemble = requireUncached('../assembler.js')
  const rom = await fs.readFile(path.join(__dirname, 'roms', '12.rom'))
  const code = (await fs.readFile(path.join(__dirname, 'uxntal', '12.tal'))).toString()
  assert.is(assemble(code), rom.toString('hex'))
})

function requireUncached (module) {
  delete require.cache[require.resolve(module)]
  return require(module)
}
