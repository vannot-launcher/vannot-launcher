const assert = require('node:assert/strict');
const test = require('node:test');
const { getRequiredJavaMajor, parseOptifineVersions } = require('../src/minecraft-service');

test('selects the Java generation required by common Minecraft releases', () => {
  assert.equal(getRequiredJavaMajor('1.12.2'), 8);
  assert.equal(getRequiredJavaMajor('1.17.1'), 16);
  assert.equal(getRequiredJavaMajor('1.20.4'), 17);
  assert.equal(getRequiredJavaMajor('1.20.5'), 21);
  assert.equal(getRequiredJavaMajor('1.21.0'), 21);
  assert.equal(getRequiredJavaMajor('1.21.11'), 21);
  assert.equal(getRequiredJavaMajor('26.3'), 25);
});

test('parses only official OptiFine installers for the selected Minecraft version', () => {
  const html = `
    <a href="http://optifine.net/adloadx?f=OptiFine_1.21.1_HD_U_J1.jar&x=abc">Stable</a>
    <a href="http://optifine.net/adloadx?f=preview_OptiFine_1.21.1_HD_U_J2_pre1.jar&x=def">Preview</a>
    <a href="http://optifine.net/adloadx?f=OptiFine_1.20.1_HD_U_I6.jar&x=ghi">Other Minecraft</a>`;

  assert.deepEqual(parseOptifineVersions(html, '1.21.1'), [
    { id: 'OptiFine_1.21.1_HD_U_J1.jar', label: 'HD_U_J1', stable: true },
    { id: 'preview_OptiFine_1.21.1_HD_U_J2_pre1.jar', label: 'Preview HD_U_J2_pre1', stable: false }
  ]);
});