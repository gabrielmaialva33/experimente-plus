import { LegalPage } from '~/components/legal/legal_page'

const sections = [
  {
    title: '1. Dados de conta',
    content: (
      <p>
        O cadastro usa nome, e-mail, nome de usuário opcional e senha. A senha é armazenada como
        hash, não em texto legível. Também são mantidos estados técnicos de verificação de e-mail e
        segurança das credenciais.
      </p>
    ),
  },
  {
    title: '2. Dados operacionais',
    content: (
      <p>
        Quando alguém administra uma organização ou unidade, o produto registra vínculos com
        organizações, permissões, conteúdo enviado, decisões de moderação e eventos de auditoria
        necessários para isolamento, segurança e rastreabilidade. Dados privados não entram no
        catálogo público.
      </p>
    ),
  },
  {
    title: '3. Descoberta e métricas',
    content: (
      <>
        <p>
          O catálogo mede sinais como impressão, abertura de ficha e clique em contato para avaliar
          o piloto. O pipeline não persiste IP bruto, user agent bruto, fingerprint, coordenadas do
          visitante nem conteúdo de formulários.
        </p>
        <p>
          Uma sessão pública pode usar um identificador aleatório first-party, criptografado e
          HttpOnly. O banco recebe somente um HMAC desse identificador. Buscas sem resultado são
          redigidas quando parecem conter e-mail, telefone, URL ou sequência numérica longa.
        </p>
        <p>
          Os sinais Global Privacy Control e Do Not Track desativam a persistência dessas métricas e
          a criação do identificador analítico.
        </p>
      </>
    ),
  },
  {
    title: '4. Cookies e autenticação',
    content: (
      <p>
        Cookies técnicos protegem autenticação, sessão e formulários. O token da sessão autenticada
        é HttpOnly e não fica disponível ao JavaScript da página. O produto atual não implementa
        pixels de publicidade de terceiros nem perfil comportamental entre dispositivos.
      </p>
    ),
  },
  {
    title: '5. Acesso e compartilhamento',
    content: (
      <p>
        Dados administrativos são exibidos somente a pessoas autenticadas com a combinação
        necessária de permissão e vínculo de domínio. Organizações veem apenas seus próprios dados e
        agregados; a operação pode acessar informações compatíveis com suas tarefas de
        administração, moderação e segurança.
      </p>
    ),
  },
  {
    title: '6. Retenção e exclusão',
    content: (
      <>
        <p>
          Eventos brutos de descoberta têm retenção inicial de 90 dias. Agregados e conjuntos de
          sessão podem permanecer por até 25 meses; aumentar esses prazos exige nova decisão de
          produto e privacidade.
        </p>
        <p>
          Ao excluir a conta, os identificadores da própria conta são substituídos, tokens são
          revogados e papéis e permissões diretas são removidos. Snapshots transacionais já
          registrados em comprovantes de utilização, incluindo nome e e-mail vigentes no momento da
          transação, podem permanecer para preservar integridade, segurança e auditoria, conforme a
          política vigente.
        </p>
      </>
    ),
  },
  {
    title: '7. Controle e solicitações',
    content: (
      <p>
        A pessoa autenticada pode revisar dados básicos e solicitar a exclusão da própria conta nas
        configurações. Durante o piloto assistido, correções e outras solicitações são encaminhadas
        à equipe responsável pelo acesso à operação. Um canal público definitivo deve ser
        formalizado antes da abertura em escala.
      </p>
    ),
  },
] as const

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Política de Privacidade"
      description="Como o Experimente+ trata dados de conta, operação e descoberta no produto atual."
      sections={sections}
      relatedHref="/termos"
      relatedLabel="Ler os Termos de Uso"
    />
  )
}
