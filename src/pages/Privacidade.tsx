import React, { useEffect } from 'react'
import { PublicLayout } from '@/components/public/PublicLayout'
import { Enter } from '@/components/public/Enter'

/**
 * Controle de aviso de rascunho / revisão jurídica no topo da página.
 * Quando a revisão for concluída pelo jurídico, basta alterar para false.
 */
const PRIVACY_IS_DRAFT = true

export const Privacidade: React.FC = () => {
  useEffect(() => {
    const prevTitle = document.title
    document.title = 'Política de Privacidade'
    return () => {
      document.title = prevTitle
    }
  }, [])

  return (
    <PublicLayout showContactButton={true}>
      <Enter step={0} className="w-full py-8 sm:py-12 px-4 sm:px-6">
        <article className="max-w-[720px] mx-auto w-full text-foreground break-words">
          {PRIVACY_IS_DRAFT && (
            <aside
              role="note"
              aria-label="Aviso de status do documento"
              className="mb-8 p-3.5 sm:p-4 rounded-[8px] border border-border bg-muted/60 text-muted-foreground text-xs sm:text-sm flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                <span className="font-medium text-foreground">Texto em revisão jurídica</span>
              </div>
              <span className="eyebrow text-[10px] text-muted-foreground shrink-0">Rascunho</span>
            </aside>
          )}

          <header className="mb-8 space-y-2">
            <span className="eyebrow text-muted-foreground block">Institucional</span>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
              Política de Privacidade
            </h1>
          </header>

          <div className="space-y-8 text-sm sm:text-base leading-relaxed text-foreground/90">
            {/* Quem cuida dos seus dados */}
            <section className="p-4 sm:p-5 rounded-[8px] border border-border bg-card">
              <p>
                <strong>Quem cuida dos seus dados:</strong> Imobiliária Janeide Xavier (
                <code className="text-xs sm:text-sm px-1 py-0.5 rounded bg-muted font-mono">
                  [razão social, CNPJ e endereço]
                </code>
                ), em Feira de Santana, Bahia. Contato para assuntos de privacidade:{' '}
                <code className="text-xs sm:text-sm px-1 py-0.5 rounded bg-muted font-mono">
                  [e-mail ou WhatsApp do responsável]
                </code>
                .
              </p>
            </section>

            {/* 1. Que dados coletamos */}
            <section className="space-y-3">
              <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
                1. Que dados coletamos
              </h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong>Quando você fala conosco pelo site</strong> (formulário ou pedido de
                  visita): nome, telefone/WhatsApp e, se você quiser, e-mail; o imóvel que você
                  estava vendo e o horário de visita escolhido.
                </li>
                <li>
                  <strong>Como você usa a busca:</strong> os filtros que você usou (bairro, tipo,
                  quartos, preço) e os imóveis que viu, para a equipe entender o que você procura.
                </li>
                <li>
                  <strong>Origem da visita:</strong> de qual anúncio ou campanha você veio (por
                  exemplo, parâmetros{' '}
                  <code className="text-xs sm:text-sm px-1 py-0.5 rounded bg-muted font-mono">
                    utm
                  </code>
                  ), para sabermos o que funciona.
                </li>
                <li>
                  <strong>Seu consentimento:</strong> a data e o canal em que você autorizou o
                  contato.
                </li>
                <li>
                  <strong>No seu navegador:</strong> guardamos apenas suas escolhas (tema
                  claro/escuro e preferência de cookies).{' '}
                  <code className="text-xs sm:text-sm px-1 py-0.5 rounded bg-muted font-mono">
                    [Se o Meta Pixel e o Google Ads forem ativados: eles usam cookies de medição, só
                    depois da sua autorização.]
                  </code>
                </li>
              </ul>
            </section>

            {/* 2. Para que usamos */}
            <section className="space-y-3">
              <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
                2. Para que usamos
              </h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>Responder ao seu contato e falar sobre o imóvel de interesse.</li>
                <li>Agendar e acompanhar visitas.</li>
                <li>Medir se nossos anúncios e o site funcionam (com a sua autorização).</li>
                <li>Manter o site seguro e evitar abusos.</li>
              </ul>
              <p className="pt-1">Não vendemos seus dados.</p>
            </section>

            {/* 3. Com quem compartilhamos */}
            <section className="space-y-3">
              <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
                3. Com quem compartilhamos
              </h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  Os <strong>corretores e a equipe</strong> da imobiliária que vão atender você.
                </li>
                <li>
                  <strong>Provedores que hospedam o sistema</strong> (a plataforma Skip, da Adapta,
                  que guarda os dados em servidores da Amazon Web Services nos Estados Unidos, o que
                  é uma transferência internacional de dados){' '}
                  <code className="text-xs sm:text-sm px-1 py-0.5 rounded bg-muted font-mono">
                    [confirmar a base legal da transferência]
                  </code>
                  .
                </li>
                <li>
                  <code className="text-xs sm:text-sm px-1 py-0.5 rounded bg-muted font-mono">
                    [Meta e Google, somente se os pixels de medição forem ativados e você
                    autorizar.]
                  </code>
                </li>
                <li>
                  Google Agenda dos corretores: se o corretor conectar a sua Google Agenda, o
                  Imobdigital usa essa agenda, com a autorização dele, apenas para criar, atualizar
                  e apagar eventos de visita. Guardamos o token de acesso criptografado, e o
                  corretor pode desconectar a qualquer momento (os eventos futuros criados pelo
                  sistema são removidos). O uso e a transferência dos dados recebidos do Google
                  seguem a Política de Dados do Usuário dos Serviços de API do Google, inclusive os
                  requisitos de uso limitado. O evento na agenda nunca contém o telefone do cliente.
                </li>
              </ul>
            </section>

            {/* 4. Por quanto tempo guardamos */}
            <section className="space-y-3">
              <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
                4. Por quanto tempo guardamos
              </h2>
              <p>
                <code className="text-xs sm:text-sm px-1 py-0.5 rounded bg-muted font-mono">
                  [prazo a definir com o advogado: por exemplo, enquanto durar o atendimento e por X
                  anos depois]
                </code>
                . Passado o prazo, os dados são apagados ou anonimizados.
              </p>
            </section>

            {/* 5. Seus direitos */}
            <section className="space-y-3">
              <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
                5. Seus direitos
              </h2>
              <p>
                Você pode, a qualquer momento: saber quais dados temos sobre você, corrigi-los,
                pedir que sejam apagados, retirar o consentimento e pedir uma cópia. Basta escrever
                para{' '}
                <code className="text-xs sm:text-sm px-1 py-0.5 rounded bg-muted font-mono">
                  [e-mail ou WhatsApp do responsável]
                </code>
                . Respondemos em até{' '}
                <code className="text-xs sm:text-sm px-1 py-0.5 rounded bg-muted font-mono">
                  [prazo]
                </code>
                .
              </p>
            </section>

            {/* 6. Menores de idade */}
            <section className="space-y-3">
              <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
                6. Menores de idade
              </h2>
              <p>O site não é destinado a menores de 18 anos.</p>
            </section>

            {/* 7. Mudanças nesta política */}
            <section className="space-y-3">
              <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
                7. Mudanças nesta política
              </h2>
              <p>Quando mudarmos este texto, a data abaixo será atualizada.</p>
            </section>

            {/* Rodapé do texto com última atualização */}
            <footer className="pt-6 border-t border-border">
              <p>
                <strong>Última atualização:</strong>{' '}
                <code className="text-xs sm:text-sm px-1 py-0.5 rounded bg-muted font-mono">
                  [data da publicação]
                </code>
              </p>
            </footer>
          </div>
        </article>
      </Enter>
    </PublicLayout>
  )
}

export default Privacidade
