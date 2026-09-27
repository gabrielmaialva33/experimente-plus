import { LegalPage } from '~/components/legal/legal_page'

const sections = [
  {
    title: '1. Catálogo público',
    content: (
      <>
        <p>
          Cidades, categorias e lugares publicados podem ser consultados sem cadastro. As
          informações são enviadas pelos próprios lugares e revisadas antes de publicar, mas
          horários, contatos e disponibilidade podem mudar.
        </p>
        <p>
          Rotas, telefone, WhatsApp, sites e redes sociais abrem serviços de terceiros. Usá-los não
          é uma reserva, uma compra nem uma garantia de atendimento.
        </p>
      </>
    ),
  },
  {
    title: '2. Sua conta',
    content: (
      <>
        <p>
          Para criar uma conta, informe dados verdadeiros, mantenha sua senha em segredo e aceite
          estes Termos e a Política de Privacidade. Não crie contas falsas ou automáticas, nem use o
          Experimente+ para spam, fraude ou abuso de benefícios.
        </p>
        <p>
          Toda conta começa como pessoal. Administrar um negócio no Portal depende de um vínculo com
          a organização desse negócio, conferido pela equipe do Experimente+; não é algo escolhido
          no cadastro.
        </p>
      </>
    ),
  },
  {
    title: '3. Negócios e conteúdo publicado',
    content: (
      <p>
        Cada organização responde pelos dados que envia sobre seus lugares, experiências e eventos.
        Enviar conteúdo não garante a publicação: o que estiver incompleto ou fora das regras pode
        receber pedido de correção, ser recusado ou ser suspenso, e cada decisão fica registrada.
      </p>
    ),
  },
  {
    title: '4. Avaliações, fotos e denúncias',
    content: (
      <>
        <p>
          Você pode avaliar lugares com nota, comentário e fotos. A avaliação aparece na hora, e o
          lugar pode responder. Escreva sobre a sua experiência; não publique conteúdo ofensivo,
          falso, propaganda, dados pessoais de outras pessoas nem fotos que você não tenha o direito
          de usar.
        </p>
        <p>
          Qualquer pessoa pode denunciar uma avaliação, uma resposta ou um lugar. A moderação pode
          ocultar o que desrespeitar estas regras, e você pode editar ou excluir suas avaliações na
          sua conta.
        </p>
      </>
    ),
  },
  {
    title: '5. Compras e benefícios',
    content: (
      <>
        <p>
          Pacotes da cidade e vouchers de lugares podem ser comprados no aplicativo. Antes de
          comprar, você vê e aceita as condições do benefício: o que inclui, onde vale, quantas
          vezes pode ser usado e até quando. O benefício entra na sua carteira depois que o
          pagamento é confirmado. Um pedido ainda não pago pode ser cancelado. Pedidos de reembolso
          seguem as condições do benefício e a lei aplicável.
        </p>
        <p>
          Para usar, você mostra ao lugar um código que vale por cinco minutos. O uso só conta
          quando uma pessoa autorizada do lugar o confirma. O comprovante guarda as condições que
          valiam naquele momento.
        </p>
      </>
    ),
  },
  {
    title: '6. Fase de validação',
    content: (
      <p>
        O Experimente+ está em fase de validação e pode passar por correções e indisponibilidades.
        Não há reserva nem uso de benefício sem conexão. As regras informadas por cada lugar
        continuam valendo no atendimento.
      </p>
    ),
  },
  {
    title: '7. Encerramento da conta',
    content: (
      <p>
        Você pode excluir sua conta em Conta, confirmando a senha. O acesso é encerrado e os dados
        que identificam a conta são substituídos. Os comprovantes de benefícios já usados podem
        manter o nome e o e-mail vigentes no momento do uso, para garantir a integridade dos
        registros, a segurança e a auditoria.
      </p>
    ),
  },
  {
    title: '8. Alterações e dúvidas',
    content: (
      <p>
        Mudanças relevantes geram uma nova versão deste documento. Durante a fase de validação,
        dúvidas e pedidos são atendidos pela equipe responsável pelo Experimente+ na sua região.
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
