import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isValidPackName } from '../src/features/vk-workspace/model/packName.ts'
import { isValidStickerReference } from '../src/features/vk-workspace/model/stickerReference.ts'

test('pack names accept supported characters and enforce the 64-character limit', () => {
  for (const name of ['My pack_2', 'Стикеры-Ёжик', 'a'.repeat(64)]) assert.equal(isValidPackName(name), true)
  for (const name of ['', '   ', '---', 'a'.repeat(65), 'Pack!', '😀']) assert.equal(isValidPackName(name), false)
})

test('sticker references accept only direct HTTPS files from VK Workspace', () => {
  assert.equal(isValidStickerReference('https://files.myteam.mail.ru/get/AbC123'), true)
  for (const reference of ['http://files.myteam.mail.ru/get/AbC123', 'https://other.example/get/AbC123', 'https://files.myteam.mail.ru/get/AbC123?x=1', 'https://files.myteam.mail.ru/get/AbC123#x', 'https://user:password@files.myteam.mail.ru/get/AbC123', 'https://files.myteam.mail.ru:8443/get/AbC123', 'not a url']) {
    assert.equal(isValidStickerReference(reference), false)
  }
})
