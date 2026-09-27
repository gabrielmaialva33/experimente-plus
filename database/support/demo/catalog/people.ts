/**
 * Fictitious people and organizations of the demo.
 *
 * Partners own the organizations and act through the partner portal's own
 * services; consumers write the reviews. Names are generic, surnames are
 * initials, and every e-mail address uses a reserved domain, so no account can
 * be mistaken for, or reach, a real person.
 */

export interface DemoPerson {
  key: string
  full_name: string
  /** Local part; the domain depends on the environment. */
  email_local: string
}

export interface DemoOrganization {
  key: string
  slug: string
  trade_name: string
  legal_name: string
  /** Branch digits of the sample CNPJ root 12.345.678; check digits are computed. */
  cnpj_branch: string
  owner: string
}

export const DEMO_PARTNERS: DemoPerson[] = [
  { key: 'partner-paineira', full_name: 'Helena V.', email_local: 'helena.v.parceira' },
  { key: 'partner-terra-roxa', full_name: 'Marcos T.', email_local: 'marcos.t.parceiro' },
  { key: 'partner-ipe', full_name: 'Sofia A.', email_local: 'sofia.a.parceira' },
  { key: 'partner-fermento', full_name: 'Otávio R.', email_local: 'otavio.r.parceiro' },
  { key: 'partner-palco', full_name: 'Lívia M.', email_local: 'livia.m.parceira' },
  { key: 'partner-rotas', full_name: 'Caio B.', email_local: 'caio.b.parceiro' },
  { key: 'partner-raiz', full_name: 'Yumi K.', email_local: 'yumi.k.parceira' },
  { key: 'partner-oficina', full_name: 'Denise F.', email_local: 'denise.f.parceira' },
  { key: 'partner-pioneiro', full_name: 'Joaquim S.', email_local: 'joaquim.s.parceiro' },
  { key: 'partner-traco', full_name: 'Rita N.', email_local: 'rita.n.parceira' },
  { key: 'partner-vale', full_name: 'André P.', email_local: 'andre.p.parceiro' },
]

export const DEMO_CONSUMERS: DemoPerson[] = [
  { key: 'mariana-t', full_name: 'Mariana T.', email_local: 'mariana.t' },
  { key: 'rafael-k', full_name: 'Rafael K.', email_local: 'rafael.k' },
  { key: 'juliana-m', full_name: 'Juliana M.', email_local: 'juliana.m' },
  { key: 'tiago-n', full_name: 'Tiago N.', email_local: 'tiago.n' },
  { key: 'camila-s', full_name: 'Camila S.', email_local: 'camila.s' },
  { key: 'gustavo-h', full_name: 'Gustavo H.', email_local: 'gustavo.h' },
  { key: 'beatriz-o', full_name: 'Beatriz O.', email_local: 'beatriz.o' },
  { key: 'lucas-f', full_name: 'Lucas F.', email_local: 'lucas.f' },
  { key: 'patricia-a', full_name: 'Patrícia A.', email_local: 'patricia.a' },
  { key: 'diego-y', full_name: 'Diego Y.', email_local: 'diego.y' },
  { key: 'fernanda-l', full_name: 'Fernanda L.', email_local: 'fernanda.l' },
  { key: 'henrique-b', full_name: 'Henrique B.', email_local: 'henrique.b' },
  { key: 'larissa-c', full_name: 'Larissa C.', email_local: 'larissa.c' },
  { key: 'mateus-p', full_name: 'Mateus P.', email_local: 'mateus.p' },
  { key: 'aline-d', full_name: 'Aline D.', email_local: 'aline.d' },
  { key: 'bruno-v', full_name: 'Bruno V.', email_local: 'bruno.v' },
  { key: 'isabela-g', full_name: 'Isabela G.', email_local: 'isabela.g' },
  { key: 'rodrigo-e', full_name: 'Rodrigo E.', email_local: 'rodrigo.e' },
  { key: 'natalia-r', full_name: 'Natália R.', email_local: 'natalia.r' },
  { key: 'vinicius-t', full_name: 'Vinícius T.', email_local: 'vinicius.t' },
  { key: 'carolina-u', full_name: 'Carolina U.', email_local: 'carolina.u' },
  { key: 'eduardo-i', full_name: 'Eduardo I.', email_local: 'eduardo.i' },
  { key: 'gabriela-z', full_name: 'Gabriela Z.', email_local: 'gabriela.z' },
  { key: 'pedro-w', full_name: 'Pedro W.', email_local: 'pedro.w' },
]

export const DEMO_ORGANIZATIONS: DemoOrganization[] = [
  {
    key: 'casa-paineira',
    slug: 'casa-paineira-gastronomia-demo',
    trade_name: 'Casa Paineira Gastronomia — demonstração',
    legal_name: 'Casa Paineira Gastronomia Ltda. (fictícia)',
    cnpj_branch: '0002',
    owner: 'partner-paineira',
  },
  {
    key: 'terra-roxa',
    slug: 'grupo-terra-roxa-sabores-demo',
    trade_name: 'Grupo Terra Roxa Sabores — demonstração',
    legal_name: 'Terra Roxa Sabores Ltda. (fictícia)',
    cnpj_branch: '0003',
    owner: 'partner-terra-roxa',
  },
  {
    key: 'ipe-cafes',
    slug: 'ipe-cafes-especiais-demo',
    trade_name: 'Ipê Cafés Especiais — demonstração',
    legal_name: 'Ipê Cafés Especiais Ltda. (fictícia)',
    cnpj_branch: '0004',
    owner: 'partner-ipe',
  },
  {
    key: 'forno-fermento',
    slug: 'forno-e-fermento-panificadora-demo',
    trade_name: 'Forno & Fermento Panificadora — demonstração',
    legal_name: 'Forno e Fermento Panificadora Ltda. (fictícia)',
    cnpj_branch: '0005',
    owner: 'partner-fermento',
  },
  {
    key: 'palco-norte',
    slug: 'coletivo-palco-norte-demo',
    trade_name: 'Coletivo Palco Norte — demonstração',
    legal_name: 'Associação Cultural Palco Norte (fictícia)',
    cnpj_branch: '0006',
    owner: 'partner-palco',
  },
  {
    key: 'rotas-norte',
    slug: 'rotas-do-norte-ecoturismo-demo',
    trade_name: 'Rotas do Norte Ecoturismo — demonstração',
    legal_name: 'Rotas do Norte Turismo Ltda. (fictícia)',
    cnpj_branch: '0007',
    owner: 'partner-rotas',
  },
  {
    key: 'raiz-bem-estar',
    slug: 'estudio-raiz-bem-estar-demo',
    trade_name: 'Estúdio Raiz Bem-estar — demonstração',
    legal_name: 'Raiz Bem-estar Ltda. (fictícia)',
    cnpj_branch: '0008',
    owner: 'partner-raiz',
  },
  {
    key: 'oficina-cia',
    slug: 'oficina-e-cia-servicos-locais-demo',
    trade_name: 'Oficina & Cia Serviços Locais — demonstração',
    legal_name: 'Oficina e Cia Serviços Ltda. (fictícia)',
    cnpj_branch: '0009',
    owner: 'partner-oficina',
  },
  {
    key: 'sabores-pioneiro',
    slug: 'sabores-do-pioneiro-demo',
    trade_name: 'Sabores do Pioneiro — demonstração',
    legal_name: 'Sabores do Pioneiro Alimentação Ltda. (fictícia)',
    cnpj_branch: '0010',
    owner: 'partner-pioneiro',
  },
  {
    key: 'traco-fino',
    slug: 'traco-fino-estudio-demo',
    trade_name: 'Traço Fino Estúdio — demonstração',
    legal_name: 'Traço Fino Arte e Estilo Ltda. (fictícia)',
    cnpj_branch: '0011',
    owner: 'partner-traco',
  },
  {
    key: 'vale-ivai',
    slug: 'vale-do-ivai-gastronomia-demo',
    trade_name: 'Vale do Ivaí Gastronomia — demonstração',
    legal_name: 'Vale do Ivaí Gastronomia Ltda. (fictícia)',
    cnpj_branch: '0012',
    owner: 'partner-vale',
  },
]

/**
 * A CNPJ with the sample root 12.345.678 the seeds already use for their
 * fictitious organizations, a distinct branch per organization and valid
 * check digits. It is private data: never shown in public surfaces.
 */
export function demoCnpj(branch: string): string {
  const base = `12345678${branch}`
  const digit = (value: string, weights: number[]) => {
    const sum = [...value].reduce((total, char, index) => total + Number(char) * weights[index], 0)
    const remainder = sum % 11
    return remainder < 2 ? 0 : 11 - remainder
  }
  const first = digit(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  const second = digit(`${base}${first}`, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  return `${base}${first}${second}`
}
