import { test } from '@japa/runner'

import {
  detectBlockedTerm,
  detectContact,
  detectLink,
  detectPaymentData,
  maskPaymentData,
  normalizeText,
  runDetectors,
} from '#modules/reviews/services/automatic_moderation_detectors'

/**
 * ADR-0031 detectors. Every "miss" below is ordinary text a review is likely to
 * contain; a detector that fires on these would hold honest reviews, which is
 * the failure that makes people stop trusting automatic moderation.
 */
const ordinary = [
  'Café excelente, atendimento rápido. Voltarei com certeza!',
  'Paguei R$ 10.50 no expresso e R$ 1.234,56 no jantar da empresa.',
  'O Sr.Silva atendeu muito bem, fica a 2.5km do centro.',
  'Abre das 18h às 22h, fui dia 12/10/2025 com a família.',
  'Fica na rua do CEP 86010-190, perto da praça.',
  'Pedido 1234-5678 chegou certinho, nota 10 de 10.',
  'Frequento desde 2019-2023, sempre bom. Paguei no pix, super rápido.',
  'Cuscuz maravilhoso, melhor da cidade.',
]

test.group('Automatic moderation detectors (ADR-0031)', () => {
  test('ordinary Portuguese text triggers nothing', ({ assert }) => {
    for (const text of ordinary) {
      assert.deepEqual(runDetectors([text], ['cu', 'idiota']), [], text)
    }
  })

  test('links: explicit, www, bare domains and social handles', ({ assert }) => {
    assert.equal(detectLink('veja em https://promo.com/x?y=1')?.evidence, 'link: promo.com')
    assert.equal(
      detectLink('www.cafepromo.com.br tem desconto')?.evidence,
      'link: www.cafepromo.com.br'
    )
    assert.equal(detectLink('acesse cafepromo.com.br agora')?.evidence, 'link: cafepromo.com.br')
    assert.equal(detectLink('sigam @cafe_promo para cupons')?.evidence, 'perfil: @cafe_promo')
    // An e-mail address is a contact, not a link.
    assert.isNull(detectLink('meu e-mail é joao@gmail.com'))
  })

  test('contacts: e-mail and Brazilian phones, masked', ({ assert }) => {
    assert.equal(
      detectContact('escreve pra joao.silva@gmail.com')?.evidence,
      'e-mail j***@gmail.com'
    )
    assert.equal(detectContact('chama no (43) 99999-1234')?.evidence, 'telefone terminado em 34')
    assert.equal(detectContact('fixo 43 3333-4444')?.evidence, 'telefone terminado em 44')
    assert.equal(detectContact('+55 43 99876-5432 whatsapp')?.evidence, 'telefone terminado em 32')
    assert.equal(detectContact('liga 98765-4321')?.evidence, 'telefone terminado em 21')
    // Area codes never end in zero, landlines start 2 to 5, mobiles start 9.
    assert.isNull(detectContact('protocolo 1099999-1234'))
    assert.isNull(detectContact('código 4318887777'))
  })

  test('payment data: cards pass Luhn and a network prefix; Pix keys need the word Pix', ({
    assert,
  }) => {
    assert.equal(
      detectPaymentData('meu cartão 4111 1111 1111 1111')?.evidence,
      'cartão terminado em 1111'
    )
    assert.equal(detectPaymentData('5555-5555-5555-4444')?.evidence, 'cartão terminado em 4444')
    // Fails the check digit.
    assert.isNull(detectPaymentData('4111 1111 1111 1112'))
    // Passes nothing a card network issues.
    assert.isNull(detectPaymentData('nota fiscal 1234567890123452'))
    assert.equal(
      detectPaymentData('manda o pix: 123e4567-e89b-12d3-a456-426614174000')?.evidence,
      'chave Pix aleatória'
    )
    assert.equal(detectPaymentData('pix no cpf 529.982.247-25')?.evidence, 'chave Pix (CPF)')
    assert.isNull(detectPaymentData('meu cpf é 529.982.247-25'))
    assert.isNull(detectPaymentData('pix 111.111.111-11'))
  })

  test('the evidence never carries the raw data it found', ({ assert }) => {
    const hits = runDetectors(['cartão 4111111111111111 e joao.silva@gmail.com'], [])
    const evidence = hits.map((hit) => hit.evidence).join(' ')
    assert.notInclude(evidence, '4111111111111111')
    assert.notInclude(evidence, 'joao.silva@')
  })

  test('blocked terms match whole words, without case or accents', ({ assert }) => {
    assert.equal(
      detectBlockedTerm('Que atendente IDIÓTA', ['idiota'])?.evidence,
      'termo bloqueado: "idiota"'
    )
    assert.isNotNull(detectBlockedTerm('isso é golpe   de mestre', ['golpe de mestre']))
    assert.isNull(detectBlockedTerm('cuscuz maravilhoso', ['cu']))
    assert.isNull(detectBlockedTerm('bostaninha', ['bosta']))
    assert.isNull(detectBlockedTerm('qualquer texto', ['   ']))
  })

  test('every rule that fires is reported, not only the first', ({ assert }) => {
    const rules = runDetectors(['liga 98765-4321 ou veja cafepromo.com.br, idiota'], ['idiota'])
      .map((hit) => hit.rule)
      .sort()
    assert.deepEqual(rules, ['blocked_term', 'contact', 'link'])
  })

  test('the moderation view masks card numbers and leaves other numbers alone', ({ assert }) => {
    assert.equal(
      maskPaymentData('cartão 4111 1111 1111 1111, pedido 1234567890123452'),
      'cartão •••• 1111, pedido 1234567890123452'
    )
  })

  test('normalisation removes accents and case', ({ assert }) => {
    assert.equal(normalizeText('ÁÉÍÕÇ café'), 'aeioc cafe')
  })
})
