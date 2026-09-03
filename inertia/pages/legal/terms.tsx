import { LegalPage } from '~/components/legal/legal_page'

const sections = [
  {
    title: '1. Catálogo público',
    content: (
      <>
        <p>
          Cidades, categorias e fichas publicadas podem ser consultadas sem cadastro. As informações
          vêm de conteúdo submetido e revisado, mas horários, contatos e disponibilidade podem
          mudar.
        </p>
        <p>
          Rotas, telefone, WhatsApp, sites e redes sociais abrem serviços externos. Essas ações não
          representam reserva, compra, visita confirmada ou garantia de atendimento.
        </p>
      </>
    ),
  },
  {
    title: '2. Conta pessoal',
    content: (
      <>
        <p>
          Para criar uma conta, informe dados verdadeiros, mantenha sua senha protegida e aceite
          estes Termos e a Política de Privacidade. Não crie contas falsas, automatizadas ou
          destinadas a spam, fraude ou abuso de benefícios.
        </p>
        <p>
          A conta começa como acesso pessoal. Capacidades sobre uma organização dependem de um
          vínculo ativo com essa organização e das políticas verificadas no servidor; parceiro não é
          um papel global escolhido no cadastro.
        </p>
      </>
    ),
  },
  {
    title: '3. Organizações e conteúdo publicado',
    content: (
      <p>
        Dados legais pertencem à organização; endereço, horários, categorias e mídia pertencem às
        unidades públicas. O envio de conteúdo não garante publicação: informações incompletas ou em
        desacordo com as regras podem receber pedido de correção, rejeição ou suspensão, com
        registro operacional da decisão.
      </p>
    ),
  },
  {
    title: '4. Acessos e benefícios',
    content: (
      <>
        <p>
          Um acesso à edição não é, por si só, uma compra. No piloto, acessos podem ser concedidos
          pela operação e a carteira calcula a disponibilidade de cada benefício em tempo real.
        </p>
        <p>
          A apresentação temporária expira em cinco minutos e não conclui o uso sozinha. A
          utilização existe somente depois da confirmação, no servidor, por uma pessoa autorizada da
          organização. O comprovante preserva os termos vigentes naquele momento.
        </p>
      </>
    ),
  },
  {
    title: '5. Limites do piloto',
    content: (
      <p>
        O produto atual não oferece reserva, checkout, pagamento, reembolso ou utilização offline. O
        serviço pode receber correções e indisponibilidades próprias de uma validação operacional.
        Nenhuma interface substitui as regras específicas informadas pelo estabelecimento.
      </p>
    ),
  },
  {
    title: '6. Encerramento da conta',
    content: (
      <p>
        A conta pode ser encerrada na área de configurações mediante confirmação de senha.
        Credenciais ativas são revogadas e os identificadores da própria conta são substituídos.
        Snapshots transacionais já registrados em comprovantes de utilização, incluindo nome e
        e-mail vigentes no momento da transação, podem permanecer para preservar integridade,
        segurança e auditoria, conforme a política vigente.
      </p>
    ),
  },
  {
    title: '7. Alterações e dúvidas',
    content: (
      <p>
        Mudanças relevantes devem produzir uma nova versão deste documento. Durante o piloto
        assistido, dúvidas e solicitações são encaminhadas à equipe responsável pelo acesso à
        operação.
      </p>
    ),
  },
] as const

export default function TermsPage() {
  return (
    <LegalPage
      title="Termos de Uso"
      description="Regras para usar o catálogo, a conta, o Portal e os benefícios do Experimente+."
      sections={sections}
      relatedHref="/privacidade"
      relatedLabel="Ler a Política de Privacidade"
    />
  )
}
