import { parseFichaPdfText } from './index'

export const FICHA_A_TEXT = `Ficha de Imóvel CA9999 (Casa)
Valor de locação: R$ 10.000,00
Proprietário: ZZ TESTE Casa Proprietario
Celular:(75) 90000-0001
Rua Teste, nº 1 Cond. Teste Lumiere, Casa 1, Teste - Feira de Santana/BA CEP: 44000000
Finalidade: Residencial
Empreendimento: Condomínio: Condomínio Teste Lumiere R$ cond. 0,00
Área construída: 0,00   Área do terreno: 150,00
Dormitórios: (3)Dormitórios (2)Suítes (3)Nº de banheiros (2)Vagas cobertas
Lazer: (X)Churrasqueira (X)Piscina
Local da chave: Na imobiliaria`

export const FICHA_B_TEXT = `Ficha de Imóvel AP9998 (Apartamento)
Valor de venda: R$ 500.000,00
Valor de locação: R$ 3.000,00
Proprietário: ZZ TESTE Apto Proprietario
Celular:(71) 90000-0002
Rua Teste, nº 2 Apto 101, Teste - Feira de Santana/BA CEP: 44000001
Finalidade: Residencial
Empreendimento: Edifício: Teste Residence R$ cond. 0,00
Área útil: 80,00   Área total: 0,00
Íntima: (3)Dormitórios (1)Suítes (3)Nº de banheiros
Infraestrutura: (X)Elevador (X)Mobiliado Tipo de vaga: Não informado`

export interface TestResultItem {
  field: string
  expected: any
  actual: any
  pass: boolean
}

export function testFichas(): {
  fichaA: { pass: boolean; items: TestResultItem[] }
  fichaB: { pass: boolean; items: TestResultItem[] }
} {
  const resA = parseFichaPdfText(FICHA_A_TEXT)
  if (!resA.ok) {
    throw new Error('Ficha A falhou no parse inicial')
  }

  const expectedA: Record<string, any> = {
    'imovel.purpose': 'locacao',
    'imovel.rent_price': 10000,
    'imovel.sale_price': undefined,
    'imovel.bedrooms': 3,
    'imovel.bathrooms': 3,
    'imovel.parking': 2,
    'imovel.area': undefined,
    'imovel.condominium_name': 'Teste Lumiere',
    'imovel.condo_fee': undefined,
    'imovel.street': 'Teste',
    'imovel.street_number': '1',
    'imovel.complement': 'Cond. Teste Lumiere, Casa 1',
    'proprietario.name': 'ZZ TESTE Casa Proprietario',
    'proprietario.phone': '(75) 90000-0001',
    'proprietario.cpf': undefined,
  }

  const actualA: Record<string, any> = {
    'imovel.purpose': resA.imovel.purpose,
    'imovel.rent_price': resA.imovel.rent_price,
    'imovel.sale_price': resA.imovel.sale_price,
    'imovel.bedrooms': resA.imovel.bedrooms,
    'imovel.bathrooms': resA.imovel.bathrooms,
    'imovel.parking': resA.imovel.parking,
    'imovel.area': resA.imovel.area,
    'imovel.condominium_name': resA.imovel.condominium_name,
    'imovel.condo_fee': resA.imovel.condo_fee,
    'imovel.street': resA.imovel.street,
    'imovel.street_number': resA.imovel.street_number,
    'imovel.complement': resA.imovel.complement,
    'proprietario.name': resA.proprietario.name,
    'proprietario.phone': resA.proprietario.phone,
    'proprietario.cpf': resA.proprietario.cpf,
  }

  const itemsA: TestResultItem[] = Object.keys(expectedA).map((key) => ({
    field: key,
    expected: expectedA[key],
    actual: actualA[key],
    pass: actualA[key] === expectedA[key],
  }))

  const resB = parseFichaPdfText(FICHA_B_TEXT)
  if (!resB.ok) {
    throw new Error('Ficha B falhou no parse inicial')
  }

  const expectedB: Record<string, any> = {
    'imovel.purpose': 'ambos',
    'imovel.sale_price': 500000,
    'imovel.rent_price': 3000,
    'imovel.bedrooms': 3,
    'imovel.bathrooms': 3,
    'imovel.parking': undefined,
    'imovel.area': 80,
    'imovel.condominium_name': 'Teste Residence',
    'imovel.street': 'Teste',
    'imovel.street_number': '2',
    'imovel.complement': 'Apto 101',
    'proprietario.phone': '(71) 90000-0002',
  }

  const actualB: Record<string, any> = {
    'imovel.purpose': resB.imovel.purpose,
    'imovel.sale_price': resB.imovel.sale_price,
    'imovel.rent_price': resB.imovel.rent_price,
    'imovel.bedrooms': resB.imovel.bedrooms,
    'imovel.bathrooms': resB.imovel.bathrooms,
    'imovel.parking': resB.imovel.parking,
    'imovel.area': resB.imovel.area,
    'imovel.condominium_name': resB.imovel.condominium_name,
    'imovel.street': resB.imovel.street,
    'imovel.street_number': resB.imovel.street_number,
    'imovel.complement': resB.imovel.complement,
    'proprietario.phone': resB.proprietario.phone,
  }

  const itemsB: TestResultItem[] = Object.keys(expectedB).map((key) => ({
    field: key,
    expected: expectedB[key],
    actual: actualB[key],
    pass: actualB[key] === expectedB[key],
  }))

  return {
    fichaA: {
      pass: itemsA.every((it) => it.pass),
      items: itemsA,
    },
    fichaB: {
      pass: itemsB.every((it) => it.pass),
      items: itemsB,
    },
  }
}
