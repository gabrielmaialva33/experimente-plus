import { LegalPage } from '~/components/legal/legal_page'

const sections = [
  {
    title: '1. Dados da sua conta',
    content: (
      <p>
        O cadastro usa nome, e-mail, nome de usuário (opcional) e senha. A senha é guardada de forma
        irreversível (hash), nunca em texto legível. Também guardamos se o e-mail foi confirmado e
        informações de segurança do acesso.
      </p>
    ),
  },
  {
    title: '2. Quem administra um negócio',
    content: (
      <p>
        Para quem administra uma organização ou um lugar, registramos o vínculo com a organização,
        as permissões, o conteúdo enviado, as decisões de moderação e o histórico de ações
        necessário para segurança e rastreabilidade. Nada disso aparece no catálogo público.
      </p>
    ),
  },
  {
    title: '3. Compras, benefícios e avaliações',
    content: (
      <>
        <p>
          Guardamos seus pedidos (o que foi comprado, o valor, o meio de pagamento escolhido e o
          andamento) e os usos dos seus benefícios. Os dados de pagamento vão para o provedor de
          pagamento e não ficam guardados conosco depois de processados.
        </p>
        <p>
          Avaliações, notas e fotos que você publica ficam ligadas à sua conta. Antes de publicar
          uma foto, removemos a localização e os dados do aparelho gravados nela.
        </p>
      </>
    ),
  },
  {
    title: '4. Descoberta e métricas',
    content: (
      <>
        <p>
          Medimos ações como ver um lugar, abrir sua ficha e tocar num contato, para entender o que
          funciona. Nessas métricas não guardamos seu endereço IP, dados do navegador ou do
          aparelho, sua localização nem o que você digita em formulários.
        </p>
        <p>
          Uma visita pode receber um identificador aleatório, guardado num cookie cifrado que a
          página não consegue ler; no nosso banco fica apenas uma versão embaralhada (HMAC) dele.
          Buscas sem resultado são apagadas quando parecem conter e-mail, telefone, endereço de site
          ou números longos.
        </p>
        <p>
          Se o seu navegador enviar os sinais Global Privacy Control ou Do Not Track, essas métricas
          não são guardadas e o identificador não é criado.
        </p>
      </>
    ),
  },
  {
    title: '5. Cookies',
    content: (
      <p>
        Usamos apenas cookies necessários para login, sessão e segurança dos formulários. O cookie
        da sua sessão não pode ser lido pelos scripts da página. Não usamos pixels de publicidade
        nem montamos perfis de comportamento entre aparelhos.
      </p>
    ),
  },
  {
    title: '6. Quem vê seus dados',
    content: (
      <>
        <p>
          Dados de administração só aparecem para pessoas com login e com a permissão e o vínculo
          necessários. Cada organização vê apenas os próprios dados e totais; a equipe do
          Experimente+ acessa o necessário para administrar, moderar e manter a segurança.
        </p>
        <p>
          Alguns serviços recebem só o indispensável para funcionar: o provedor de pagamento (seus
          pedidos), o serviço de e-mail (mensagens da sua conta) e, no Concierge, um provedor de
          inteligência artificial, que recebe o texto da sua pergunta e informações públicas do
          catálogo. Não escreva dados pessoais nas perguntas ao Concierge.
        </p>
      </>
    ),
  },
  {
    title: '7. Por quanto tempo guardamos',
    content: (
      <>
        <p>
          As métricas de descoberta ficam guardadas por 90 dias; totais e resumos, por até 25 meses.
          Aumentar esses prazos exige uma nova decisão de produto e de privacidade.
        </p>
        <p>
          Ao excluir sua conta, os dados que a identificam são substituídos, o acesso é encerrado e
          as permissões são removidas. Os comprovantes de benefícios já usados podem manter o nome e
          o e-mail vigentes no momento do uso, para garantir a integridade dos registros, a
          segurança e a auditoria.
        </p>
      </>
    ),
  },
  {
    title: '8. Seus pedidos',
    content: (
      <p>
        Em Conta você revisa seus dados e pode excluir a conta. Durante a fase de validação, outras
        solicitações, como correções, são atendidas pela equipe responsável pelo Experimente+ na sua
        região. Um canal público de atendimento será definido antes da abertura em escala.
      </p>
    ),
  },
] as const

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Política de Privacidade"
      description="Como o Experimente+ trata os dados da sua conta, das suas compras e da descoberta de lugares."
      sections={sections}
      relatedHref="/termos"
      relatedLabel="Ler os Termos de Uso"
    />
  )
}
