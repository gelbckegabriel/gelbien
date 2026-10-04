import type { GuideContent } from ".";

const pt: GuideContent = {
  start: {
    title: "Primeiros passos",
    summary: "O que é o Gelbien, onde ficam seus dados e o que configurar primeiro.",
    intro: [
      "O Gelbien ajuda você a ver para onde vai o seu dinheiro e a decidir para onde ele deve ir. Você registra o que gasta, define um orçamento para cada mês, lista as contas que se repetem e junta dinheiro para suas metas. Em troca, tem uma visão clara de cada mês: quanto sobra, o que está por vir e o que mudar.",
      "Seus dados ficam numa planilha do Google no seu próprio Google Drive, chamada **Gelbien — seu nome**, criada na primeira vez que você entra. O Gelbien só consegue abrir os arquivos que ele mesmo cria, não o resto do seu Drive, e nunca pede senha de banco. Tudo o que você salva vai para essa planilha: ela é sua para abrir, copiar ou apagar.",
      "Só quer conhecer? **Explorar a demonstração**, na tela de entrada, carrega dados de exemplo que ficam só no seu navegador. Dá para entrar com o Google depois, pelo Perfil.",
    ],
    steps: [
      { title: "Entre com o Google", body: "Na tela de entrada, escolha **Continuar com o Google** e deixe marcada a permissão do Google Drive: o Gelbien precisa dela para criar a planilha. Isso acontece uma vez só; depois você vai direto para o painel." },
      { title: "Escolha idioma e moeda", body: "Vá em **Perfil → Preferências**. Escolha English, Português ou Français e a moeda em que todos os valores aparecem. Os dois ficam salvos na sua planilha, então todos os seus aparelhos seguem a mesma configuração." },
      { title: "Informe sua renda e um orçamento", body: "Na página **Orçamento**, digite sua renda líquida mensal e um limite de gasto para as categorias que importam. Não sabe que limites usar? **Sugerir pelos últimos 3 meses** funciona depois de algumas semanas de gastos registrados. Veja Orçamento, mais abaixo." },
      { title: "Liste suas contas recorrentes", body: "Aluguel, celular, seguro, streaming: adicione em **Gastos recorrentes**, na página Orçamento. O Gelbien passa a lembrar você quando vencem e já separa esse dinheiro no orçamento antes que ele saia." },
      { title: "Registre os gastos na hora", body: "Toque no botão dourado **+** sempre que gastar. Leva poucos segundos, e quanto mais constante você for, mais úteis ficam os gráficos, os insights e as sugestões." },
      { title: "Opcional: suas contas e uma meta", body: "Na página **Metas**, adicione suas contas bancárias e cartões e depois uma meta, como uma viagem ou um carro. Uma vez por mês você atualiza os saldos, e o Gelbien mostra seu patrimônio e quando você vai alcançar cada meta." },
    ],
    tips: [
      "O **seletor de mês**, no topo de todas as páginas, define o mês que você está vendo. O painel, o orçamento e a lista de gastos seguem esse mês. Toque no nome do mês para ir a qualquer mês, ou em **Este mês** para voltar.",
      "Para voltar a este guia: no celular, toque na sua foto no canto superior direito e depois em **Guia**; no computador, use o botão **?** no topo de cada página ou **Guia** no menu lateral. Ele abre na seção da página em que você estava.",
      "O Gelbien funciona no celular e no computador. No celular, use **Adicionar à tela de início** do navegador para abri-lo como um aplicativo.",
      "Se algo não for salvo (sem conexão, armazenamento do Google cheio…), o Gelbien explica o motivo e guarda o que você digitou para tentar de novo. Nada se perde.",
    ],
  },

  add: {
    title: "Registrar um gasto",
    summary: "O botão +, recibos com IA, dividir uma compra, reembolsos e edições.",
    intro: [
      "Registrar gastos é o que você mais vai fazer, então foi feito para levar segundos. Abra o formulário **Novo gasto** pelo botão dourado **+** (no canto inferior direito no computador, no centro da barra inferior no celular), pelo botão **Novo gasto** do menu lateral, ou apertando **N** no teclado em qualquer lugar do app.",
      "Só o valor e a categoria são obrigatórios. O resto deixa seus gráficos e sugestões mais precisos, e boa parte se preenche sozinha.",
    ],
    steps: [
      { title: "Valor e data", body: "Digite o valor. A data começa em hoje; mude se estiver registrando algo de outro dia. Datas futuras não são aceitas: registre as coisas quando acontecem." },
      { title: "Estabelecimento e descrição", body: "**Local / Estabelecimento** é onde você pagou (mercado, Uber, o proprietário do imóvel); **Descrição** é o que foi (compras da semana, corrida para casa). Se você já comprou ali antes, ao sair do campo o Gelbien preenche a categoria, a subcategoria, a forma de pagamento, o tipo e a prioridade que você usou da última vez. Aparece \"Preenchido pelo seu histórico em…\"." },
      { title: "Categoria e subcategoria", body: "Toque numa categoria. Se ela tiver subcategorias (Mercado → Supermercado, Padaria…), elas aparecem logo abaixo para detalhar; escolher uma é opcional. A categoria também define o tipo e a prioridade que você costuma usar nela. As categorias são editadas na página Categorias." },
      { title: "Pagamento, tipo e prioridade", body: "**Pagamento** é o cartão ou a conta que você usou; o último já vem selecionado. **Tipo**: Fixo para custos iguais todo mês (aluguel, plano de celular), Variável para os que mudam (mercado, restaurantes). **Prioridade**: Essencial (você precisa), Importante (vale a pena, mas tem margem) ou Supérfluo (seria bom ter). Seja sincero nas prioridades: elas alimentam o gráfico Essencial vs. supérfluo e as dicas da revisão do mês." },
      { title: "Salvar", body: "**Salvar** fecha o formulário. No computador, **Salvar e adicionar outro** deixa o formulário aberto para o próximo. Todo salvamento mostra um **Desfazer** por alguns segundos, caso você tenha tocado rápido demais." },
      { title: "Ler um recibo (opcional)", body: "No topo do formulário, solte, anexe ou cole uma foto ou PDF do recibo. No celular, **Câmera** tira a foto. Você também pode colar um recibo (Ctrl/⌘+V) ou arrastar um arquivo para qualquer página para começar um gasto novo com ele. Com uma IA conectada no Perfil, o Gelbien lê o valor, a data, o estabelecimento, a categoria e mais. Os campos que ele preencheu ganham a etiqueta **IA**, e os que ficaram incertos ganham um ⚠ para você conferir. Deixe **Salvar no meu Drive** ligado para guardar o recibo numa pasta \"Gelbien Receipts\" no seu Drive, ou desligue para usar o recibo só para preencher o formulário." },
      { title: "Dividir uma compra entre categorias", body: "Um recibo com coisas de tipos diferentes, como mercado e uma blusa na mesma loja? Toque em **Dividir**, acima das categorias. Dê a cada parte uma categoria e um valor (e, se quiser, os itens); o total é a soma das partes, e cada parte conta no orçamento da sua categoria. **Uma categoria só** junta tudo de novo." },
      { title: "Observações, gastos recorrentes e reembolsos", body: "Toque em **+ Observações · gasto recorrente · reembolso** para os extras. **Observações**: o que quiser lembrar. **Gasto recorrente**: liga este pagamento a uma das suas contas recorrentes, ou adiciona como uma nova na página Orçamento (veja Contas recorrentes). **É um reembolso**: dinheiro que voltou para você; diminui o gasto daquela categoria e aparece em verde." },
      { title: "Editar ou excluir", body: "Toque em qualquer gasto (na lista de Gastos ou em listas como Maiores gastos) para abri-lo de novo. Mude o que precisar e salve, ou use a lixeira para excluir. A exclusão pede confirmação e oferece Desfazer." },
    ],
    tips: [
      "Sem IA conectada? Tudo funciona igual; você só digita os campos.",
      "As chamadas à IA vão direto do seu navegador para o provedor que você escolheu. Sua chave fica guardada só no seu navegador.",
      "Registre na hora, mesmo que aproximado. Um gasto aproximado hoje vale mais do que um perfeito que você esquece.",
    ],
  },

  dashboard: {
    title: "Painel",
    summary: "Seu mês num relance: quanto sobra, o que vence e para onde foi o dinheiro.",
    intro: [
      "O painel responde a uma pergunta: como estou indo este mês? Tudo nele segue o seletor de mês no topo e se atualiza assim que você registra um gasto. Veja de cima para baixo.",
    ],
    steps: [
      { title: "Avisos: o que fazer agora", body: "Só aparecem quando necessário. **Hora do check-in mensal** pede para atualizar os saldos das contas (veja Metas). **\"Mês\" acabou — veja como foi** abre a revisão do mês que terminou. **Estas contas foram pagas?** lista contas recorrentes cobradas recentemente sem gasto registrado: toque em **Pago** (ou **Todas pagas**) para registrar, ou em ✕ para pular desta vez." },
      { title: "O número principal: gasto no mês", body: "Quanto você gastou em relação ao orçamento, quanto ainda **sobra** e quanto disso já está comprometido com contas a pagar. A linha \"…/dia disponíveis nos próximos N dias\" é a sua mesada diária: gaste menos que isso por dia e você fecha o mês dentro do orçamento. Num mês passado, mostra o resultado final." },
      { title: "Os quadros", body: "**Economizado** (ou **Déficit**): renda líquida menos gastos, com sua taxa de poupança. **Média por dia** dos gastos. **Supérfluo**: o que foi para coisas marcadas como supérfluas. **Autonomia**: quantos meses sua reserva duraria se você continuasse gastando mais do que ganha (precisa das suas contas em Metas; **Sustentável** quer dizer que a renda cobre os gastos). Depois, **Gastos fixos**, número de **Lançamentos**, **Recorrentes / mês** (contas e assinaturas por mês) e quanto você gastou no ano." },
      { title: "Insights", body: "Observações curtas sobre o que chama atenção: uma categoria acima do orçamento, gastos acima do ritmo, uma categoria maior ou menor que o normal, um teste grátis perto do fim. Com IA conectada, **Pedir insights à IA** acrescenta uma leitura personalizada do seu mês." },
      { title: "Os gráficos", body: "**Ritmo de gastos**: seu gasto acumulado comparado a um ritmo constante e ao mês passado. **Para onde foi**: a fatia de cada categoria. **Orçamento por categoria**: gasto × limite. **Próximas cobranças**: os próximos 30 dias (toque em ✓ para registrar uma que você já pagou). **Últimos 12 meses**: renda, gastos e poupança mês a mês. **Gastos por dia**: um calendário em que mais claro quer dizer dia mais pesado. **Fluxo do dinheiro**: da renda para as categorias e a poupança. Depois, **Essencial vs. supérfluo**, **Formas de pagamento**, **Maiores gastos**, **Projeção da reserva**, **Por dia da semana** e **O ano num relance**." },
    ],
    tips: [
      "Todo gráfico tem um botão de tabela no canto que troca o desenho pelos números exatos.",
      "Os gráficos mostram as maiores categorias e agrupam o resto em \"Demais\" para continuarem legíveis.",
      "Veja meses passados com o seletor de mês: o painel vira um resumo daquele mês.",
    ],
  },

  expenses: {
    title: "Gastos",
    summary: "Tudo o que você registrou: buscar, filtrar, editar, excluir ou exportar.",
    intro: [
      "A página Gastos lista tudo o que você registrou, agrupado por dia com o total de cada dia. O topo mostra quantos gastos aparecem e quanto somam. Ela começa no mês escolhido no topo; mude para **Todo o período** para buscar em todo o histórico.",
    ],
    steps: [
      { title: "Encontrar um gasto", body: "Digite na busca para procurar em descrições, estabelecimentos e observações. Filtre por categoria, prioridade ou forma de pagamento, e ordene por **Mais recentes** ou **Maiores primeiro**. **Limpar filtros** mostra tudo de novo." },
      { title: "Ler uma linha", body: "Cada linha mostra a descrição, a subcategoria (ou a categoria), o estabelecimento e a forma de pagamento, o valor e a prioridade. Ícones pequenos marcam gastos recorrentes (↻), compras divididas entre categorias e recibos anexados (📎). Reembolsos aparecem em verde." },
      { title: "Editar ou excluir", body: "Toque numa linha para abrir o gasto no formulário. Mude o que quiser e salve, ou exclua. Uma compra dividida abre com todas as suas partes." },
      { title: "Exportar", body: "**Exportar CSV** baixa os gastos que estão aparecendo, já com seus filtros, num arquivo que abre em qualquer programa de planilhas." },
    ],
    tips: [
      "Na página Orçamento, tocar numa categoria abre esta lista já filtrada por ela no mês.",
      "Busca + **Todo o período** é o jeito mais rápido de responder \"quando foi a última vez que paguei…?\"",
    ],
  },

  budget: {
    title: "Orçamento",
    summary: "Sua renda, um limite por categoria e como o mês está indo em relação ao plano.",
    intro: [
      "Um orçamento é um plano para a sua renda: quanto você se permite gastar em cada categoria e quanto sobra para guardar. O Gelbien compara esse plano com o que você realmente gasta, o mês inteiro, para você corrigir o rumo antes do mês acabar em vez de descobrir depois.",
      "O primeiro orçamento não precisa ser perfeito. Comece pelo que você realmente gasta e vá baixando uma ou duas categorias a cada mês.",
    ],
    steps: [
      { title: "Informe sua renda", body: "Em **Renda**, digite sua renda mensal **Bruta** (antes dos impostos) e **Líquida** (depois dos impostos). O Gelbien usa a líquida, o que realmente cai na sua conta, para todo o resto, e mostra os impostos e descontos entre as duas com a sua alíquota efetiva." },
      { title: "Defina um limite por categoria", body: "Em **Limites de gasto**, digite um valor mensal ao lado de cada categoria. Deixe em branco a categoria que não precisa de limite. A barra colorida mostra a fatia de cada categoria na sua renda líquida, e os totais mostram o **Gasto planejado**, a **Poupança planejada** (renda menos gasto planejado, ou **Distribuído a mais** se o plano passar da renda) e sua taxa de poupança." },
      { title: "Comece com uma ajuda", body: "**Sugerir pelos últimos 3 meses** preenche cada limite com a sua média de gasto naquela categoria, arredondada para cima de 10 em 10. **Copiar mês anterior** copia o plano do mês passado. Os dois só preenchem o formulário; nada é salvo até você tocar em Salvar." },
      { title: "Escolha os meses em que vale", body: "Em **Aplicar a**: **Todos os meses** salva como seu orçamento padrão, usado por todo mês que não tem um plano próprio. **Só \"mês\"** salva um plano personalizado só para este mês, um mês de férias, por exemplo. Um mês com plano personalizado mostra **Orçamento personalizado para este mês**, com **Usar padrão** para voltar." },
      { title: "Salvar", body: "Suas mudanças esperam numa barra na parte de baixo da tela: **Salvar**, ou **Redefinir** para descartar. Se tentar sair da página ou mudar de mês antes, o Gelbien pergunta se quer salvar." },
      { title: "Acompanhe o mês em Planejado × real", body: "Este quadro mostra quanto do plano você já gastou e quanto está **Livre para gastar**. A parte listrada da barra são contas ainda a pagar neste mês: dinheiro já separado. A marquinha vertical é onde você estaria hoje se gastasse por igual; se a sua barra passou dela, você está gastando mais rápido que o planejado. Quando o mês acaba, compara a poupança real com a planejada." },
      { title: "Confira cada categoria", body: "Cada limite tem uma barra de progresso e um status: **Dentro**, **Atenção** (passou do seu nível de aviso, 85% do limite por padrão, ajustável no Perfil) ou **Acima**. Toque numa categoria para ver os gastos dela no mês." },
      { title: "Revise o mês quando ele acabar", body: "Quando um mês termina, abra a revisão pelo aviso no painel ou por **Ver a revisão do mês** na página Orçamento. Ela mostra quanto você gastou e guardou, seu patrimônio e **O que mudar**: um limite que você sempre estoura (aumente, ou planeje cortar), um que nunca usa (diminua e libere dinheiro para as metas), gastos sem limite, assinaturas que você não tem certeza se valem. Depois, planejado × real por categoria, o que mudou em relação ao normal e seus maiores gastos. **Planejar \"próximo mês\"** leva direto ao próximo orçamento." },
    ],
    tips: [
      "Categorias sem limite continuam contando nos gastos; Planejado × real mostra quanto foi para elas.",
      "Uma regra prática com a qual muita gente começa: mais ou menos metade da renda líquida para necessidades, menos de um terço para desejos e pelo menos um quinto para poupança e dívidas.",
    ],
  },

  recurring: {
    title: "Contas recorrentes e assinaturas",
    summary: "Aluguel, contas de casa e assinaturas: lembretes, pagamentos antecipados e o ✓ para registrar.",
    intro: [
      "Gastos recorrentes são os pagamentos que se repetem: aluguel, celular, seguro e contas de casa (**contas**), Netflix, Spotify ou academia (**assinaturas**). Com eles listados, o Gelbien lembra você quando cada um vence, separa o dinheiro no orçamento antes de ele sair da conta e mostra quanto custam de verdade por mês e por ano.",
    ],
    steps: [
      { title: "Adicionar um", body: "Na página Orçamento, em **Gastos recorrentes**, toque em **Adicionar recorrente**. Escolha **Conta** ou **Assinatura** e preencha o **Nome**, o **Local / Estabelecimento** (quem cobra; vai junto em cada pagamento), o **Valor** e o **Ciclo de cobrança** (de semanal a anual), a **Categoria** e a **Subcategoria** opcional, o **Dia da cobrança** (para os mensais) ou a data da **Próxima cobrança** (para os outros ciclos), a forma de **Pagamento** e o **Status**: Ativo, Pausado, Cancelado ou, para assinaturas, Teste grátis com a data em que termina. Assinaturas também ganham uma nota em **Vale a pena?**." },
      { title: "Ou adicione ao registrar um gasto", body: "No formulário de gasto, abra **+ Observações · gasto recorrente · reembolso** e ligue **Gasto recorrente**. Escolha qual gasto recorrente é este pagamento, ou **Adicionar um novo**: ele entra na página Orçamento com o valor, a categoria e o estabelecimento deste gasto, repetindo a partir da data dele." },
      { title: "Registre cada pagamento", body: "Quando chega o dia de uma conta, ela aparece em **Estas contas foram pagas?** no painel: toque em **Pago** para registrar. Pagou antes? Toque no ✓ ao lado dela em **Próximas cobranças**, no painel, ou na lista de **Gastos recorrentes**, na página Orçamento; ela é registrada com a data de hoje. Cobranças registradas mostram um ✓ verde com a data. Passe o mouse por cima (ou toque, no celular) para remover aquele gasto; o Gelbien pede confirmação antes." },
      { title: "Veja quanto custam", body: "O quadro de Gastos recorrentes mostra o total ativo por mês e por ano, e quanto disso são assinaturas, geralmente o lugar mais fácil para cortar. Testes grátis aparecem marcados com a data de fim para você cancelar a tempo." },
    ],
    tips: [
      "Um gasto que você digita por conta própria conta como pago se estiver na mesma categoria e mencionar o nome ou o estabelecimento da conta. Não precisa ligar à mão.",
      "Contas ainda a pagar neste mês são descontadas do que sobra para gastar, no painel e em Planejado × real.",
      "Pause ou cancele uma assinatura em vez de excluí-la para manter o histórico. Pausadas e canceladas deixam de contar nos totais.",
      "A revisão do mês lista as assinaturas que você marcou como Talvez ou Não em Vale a pena?, com quanto custam por ano.",
    ],
  },

  goals: {
    title: "Metas, contas e patrimônio",
    summary: "Junte dinheiro para algo específico, acompanhe suas contas com um check-in mensal e veja seu patrimônio crescer.",
    intro: [
      "A página Metas tem três partes: suas **metas** (um carro, a entrada de um imóvel, uma viagem), suas **contas** (onde o dinheiro realmente está) e seu **patrimônio líquido** (tudo o que você tem menos tudo o que deve).",
      "O Gelbien nunca se conecta ao seu banco. Em vez disso, uma vez por mês você digita o saldo de cada conta, num **check-in mensal** de dois minutos. Assim metas, patrimônio e autonomia ficam corretos sem você compartilhar nenhuma senha.",
    ],
    steps: [
      { title: "Adicione suas contas", body: "Em **Contas**, toque em **Adicionar conta**: um nome, o banco ou a instituição, o tipo (conta corrente, poupança, investimentos, cartão de crédito, dinheiro ou outro) e o saldo atual. Para cartão de crédito, digite quanto você deve; esse valor é descontado do seu patrimônio." },
      { title: "Faça o check-in mensal", body: "No dia do seu check-in (dia 1 por padrão; mude no quadro de Contas), um aviso lembra você. Toque em **Check-in mensal**, digite cada saldo como aparece hoje no app do banco e salve. **Adicionar lembrete ao calendário** coloca um lembrete mensal no calendário do celular ou do computador." },
      { title: "Crie uma meta", body: "Toque em **Nova meta**. Dê um nome e um ícone, o **Valor da meta** e, se houver prazo, a **Data-alvo**. Depois, diga onde está o dinheiro. **Nas minhas contas**: escolha as contas que guardam esse dinheiro, e o progresso segue os saldos delas a cada check-in. **Controlar à mão**: digite quanto já juntou e use **Adicionar valor** sempre que guardar mais. Por fim, a **Contribuição mensal** e o **Rendimento anual esperado**; os atalhos ajudam: Dinheiro parado (0%), Poupança (~3%), Investimentos (~6%)." },
      { title: "Leia o cartão da meta", body: "Cada cartão mostra o progresso, quando você chega ao valor no ritmo atual e, se houver data-alvo, se você está **No caminho** ou **Atrasada** e quanto por mês a meta precisa." },
      { title: "Simule", body: "**Simular** deixa você brincar com uma meta: uma contribuição mensal maior, outro rendimento, um depósito único, outro valor ou outra data, ou cortar parte dos gastos supérfluos. Ele compara o cenário com o seu plano atual (\"8 meses antes\"). **Aplicar à meta** salva; nada muda até você aplicar." },
      { title: "Confira o plano mensal", body: "O **Plano mensal** coloca lado a lado o que suas metas precisam por mês, o que seu orçamento planeja poupar e o que você realmente tem poupado. Se as metas precisarem de mais do que você poupa, ele mostra quanto, para você ajustar uma meta ou o orçamento." },
      { title: "Acompanhe seu patrimônio", body: "**Patrimônio líquido** mostra seus bens, suas dívidas e o total, mês a mês, a partir do primeiro check-in. É o melhor número para ver seu progresso a longo prazo." },
    ],
    tips: [
      "Encerrou uma conta? Marque como **Encerrada / oculta** em vez de excluir, para manter o histórico.",
      "O quadro **Autonomia** e o gráfico **Projeção da reserva**, no painel, usam esses saldos.",
    ],
  },

  chat: {
    title: "Chat",
    summary: "Pergunte sobre o seu dinheiro com suas palavras, com respostas baseadas nos seus dados.",
    intro: [
      "O Chat é um assistente de IA que lê seus gastos, orçamento, pagamentos recorrentes, contas e metas antes de responder. Pergunte o que perguntaria a um amigo que entende de dinheiro: \"Quanto gastei comendo fora este mês?\", \"Onde posso cortar $200 no próximo mês?\", \"Quais assinaturas eu deveria repensar?\", \"Estou no caminho da minha meta de poupança?\"",
    ],
    steps: [
      { title: "Conecte uma IA", body: "O Chat precisa de IA. Em **Perfil → Assistente de IA**, escolha **Claude** (pago conforme o uso, com sua própria chave do console.anthropic.com, normalmente alguns centavos por pergunta) ou **Gemini (grátis)** (chave gratuita do aistudio.google.com, sem cartão). Cole a chave e toque em **Testar conexão**." },
      { title: "Pergunte", body: "Digite uma pergunta ou toque numa das sugestões para começar. As respostas aparecem enquanto são escritas; **Parar** interrompe uma resposta. Perguntas seguintes mantêm o contexto da conversa." },
      { title: "Recomece", body: "**Nova conversa** limpa a conversa. As conversas ficam guardadas só neste navegador." },
    ],
    tips: [
      "A mesma conexão de IA também lê recibos, escreve os insights do painel e ajuda a traduzir categorias.",
      "As chamadas vão direto do seu navegador para o provedor; sua chave nunca passa pelo servidor do Gelbien.",
      "No plano gratuito do Gemini, o Google pode usar suas perguntas, incluindo seus dados de gastos, para melhorar os produtos dele.",
      "A IA pode errar e não é aconselhamento financeiro. Confira números importantes no painel ou na página Orçamento.",
    ],
  },

  categories: {
    title: "Categorias e formas de pagamento",
    summary: "Organize os gastos do seu jeito: categorias, subcategorias, ícones, cores, ordem e formas de pagamento.",
    intro: [
      "As categorias definem como seus gastos são agrupados em todo lugar: orçamentos, gráficos e o formulário de gasto. O Gelbien começa com um conjunto sensato; deixe do seu jeito na página **Categorias** (no menu lateral no computador, ou na sua foto no canto superior direito, no celular).",
      "Um bom conjunto de categorias é pequeno o bastante para escolher em um segundo (umas 10 a 15) e combina com as decisões que você quer tomar. Use subcategorias para detalhar em vez de criar mais categorias.",
    ],
    steps: [
      { title: "Renomear, mudar cor e ícone", body: "Toque no nome de uma categoria para renomear; todos os gastos e orçamentos que a usam são atualizados junto. Toque no ícone para escolher uma cor e um ícone." },
      { title: "Subcategorias", body: "Toque na seta de uma categoria para abri-la e adicione subcategorias (Mercado → Supermercado, Padaria, Açougue). Toque numa subcategoria para renomeá-la (Enter mantém o novo nome, Esc cancela); todos os gastos e gastos recorrentes que a usam são atualizados quando você salva. ✕ remove uma." },
      { title: "Mudar a ordem", body: "Use as setas para cima e para baixo. É a ordem dos botões de categoria no formulário de gasto, então deixe as mais usadas no topo." },
      { title: "Adicionar, ocultar ou excluir", body: "**Adicionar categoria** cria uma nova. **Ocultar** tira a categoria do formulário de gasto, mas mantém o histórico. **Excluir categoria** remove, ou oculta no lugar de excluir se já houver gastos nela, para não perder o histórico." },
      { title: "Formas de pagamento", body: "À direita (abaixo, no celular) ficam os cartões e contas com que você paga. Adicione novas, renomeie (gastos passados e pagamentos recorrentes são atualizados também), toque num ícone para mudar a aparência, reordene com as setas (a primeira é a padrão para novos gastos recorrentes) ou remova com ✕." },
      { title: "Salvar", body: "As mudanças esperam na barra de baixo até você tocar em **Salvar**, ou em **Redefinir** para desfazer." },
      { title: "Traduzir", body: "Mudou o idioma do app? **Traduzir categorias** renomeia as categorias e formas de pagamento padrão para esse idioma e, com IA, também as que você criou. Você revisa cada nome antes de qualquer mudança." },
    ],
  },

  profile: {
    title: "Perfil",
    summary: "Idioma, moeda, IA, sua planilha, backups e sair.",
    intro: [
      "O Perfil guarda sua conta e suas configurações. No celular, toque na sua foto no canto superior direito e depois em **Perfil**; no computador, use a parte de baixo do menu lateral.",
    ],
    steps: [
      { title: "Conta", body: "Mostra quem está conectado, ou Demo. Na demonstração, **Entrar com o Google** passa para a sua própria conta. **Categorias** é um atalho para aquela página. **Sair** desconecta este navegador; seus dados continuam seguros na planilha." },
      { title: "Preferências", body: "**Idioma** e **Moeda** valem para o app inteiro e sincronizam com seus outros aparelhos pela planilha. **Meta mensal de poupança** é quanto você gostaria de guardar por mês; os insights avisam quando você chega lá. **Avisar quando o orçamento chegar a** define quando uma categoria passa para Atenção." },
      { title: "Assistente de IA", body: "Escolha **Desligado**, **Claude** ou **Gemini (grátis)**, cole sua chave (**Obter chave** abre a página do provedor), escolha um modelo e toque em **Testar conexão**. A chave fica guardada só neste navegador; adicione em cada aparelho que usar." },
      { title: "Seus dados", body: "**Abrir no Google Sheets** abre sua planilha. **Sincronizar agora** lê a planilha de novo. **Backup (JSON)** baixa tudo e **Gastos (CSV)**, os seus gastos; **Restaurar backup** substitui todos os dados por um arquivo de backup. **Importar planilha (.xlsx)** lê gastos, categorias, orçamento, renda e assinaturas de uma pasta de trabalho no estilo Money Sheet, e deixa você **Adicionar aos atuais** ou **Substituir tudo**." },
      { title: "Cache offline", body: "Uma cópia dos seus dados fica neste navegador para o Gelbien abrir na hora. **Limpar cache** esquece essa cópia (sua planilha não é tocada) e carrega tudo de novo, útil se algo parecer desatualizado. Na demonstração, **Redefinir dados de exemplo** recomeça do zero." },
    ],
  },

  concepts: {
    title: "Conceitos",
    summary: "Os termos que aparecem no Gelbien, explicados.",
    intro: ["Um glossário rápido. Se algum número na tela deixar você em dúvida, a explicação provavelmente está aqui."],
    terms: [
      { term: "Renda líquida", body: "O que cai na sua conta depois de impostos e descontos. Orçamentos, poupança e taxa de poupança se baseiam nela." },
      { term: "Orçamento (limite de gasto)", body: "O máximo que você planeja gastar numa categoria no mês. É um plano, não um castigo: ajuste quando a vida mudar." },
      { term: "Orçamento padrão × personalizado", body: "O orçamento padrão vale para todos os meses. Um personalizado substitui o padrão só naquele mês, como dezembro com presentes ou um mês com viagem." },
      { term: "Poupança planejada", body: "Renda líquida menos o gasto planejado: o que o orçamento deixa para guardar. Se for negativa, o plano está distribuído a mais." },
      { term: "Taxa de poupança", body: "A parte da renda líquida que você não gastou: (renda − gastos) ÷ renda. Uma taxa de 20% quer dizer que você guardou 1 de cada 5 que ganhou." },
      { term: "Ritmo", body: "Gastar por igual quer dizer ter usado metade do orçamento na metade do mês. Acima do ritmo quer dizer que você está gastando mais rápido que isso, então deve fechar acima do orçamento se não desacelerar." },
      { term: "Dentro · Atenção · Acima", body: "O status de uma categoria: abaixo do seu nível de aviso, acima dele (85% do limite por padrão) ou acima do limite. Sem meta quer dizer que a categoria não tem orçamento." },
      { term: "Fixo × variável", body: "Custos fixos são iguais todo mês (aluguel, celular); os variáveis mudam (mercado, combustível). É nos variáveis que as escolhas do dia a dia fazem diferença." },
      { term: "Essencial · Importante · Supérfluo", body: "O quanto você precisa de um gasto. Essencial: você pagaria de qualquer jeito. Importante: vale a pena, mas dá para escolher. Supérfluo: seria bom ter, e é o primeiro lugar para olhar quando quiser poupar mais." },
      { term: "Conta × assinatura", body: "As duas se repetem. Contas são obrigações (aluguel, luz, seguro); assinaturas são serviços que você escolheu (streaming, apps, academia) e normalmente pode cancelar. Só assinaturas têm teste grátis e a pergunta Vale a pena?." },
      { term: "Contas a pagar", body: "Cobranças recorrentes que vencem ainda neste mês e não têm gasto registrado. O Gelbien já as conta como gastas quando mostra quanto sobra." },
      { term: "Check-in mensal", body: "Uma vez por mês você digita o saldo de cada conta. É assim que o Gelbien conhece seu patrimônio e o progresso das metas sem se conectar ao seu banco." },
      { term: "Patrimônio líquido", body: "Tudo o que você tem (contas, investimentos, dinheiro) menos tudo o que você deve (cartões, empréstimos)." },
      { term: "Autonomia", body: "Se você gasta mais do que ganha, por quantos meses sua reserva cobriria a diferença. Sustentável quer dizer que sua renda cobre seus gastos." },
      { term: "Rendimento anual esperado", body: "Quanto o dinheiro de uma meta cresce sozinho por ano: cerca de 0% parado, alguns por cento numa conta remunerada, mais (com altos e baixos) quando investido." },
      { term: "Compra dividida", body: "Um pagamento repartido entre categorias, para cada parte contar no orçamento certo." },
      { term: "Reembolso", body: "Dinheiro de volta de uma compra. Fica registrado como um gasto negativo e diminui o gasto daquela categoria." },
    ],
  },

  faq: {
    title: "Perguntas",
    summary: "Privacidade, sua planilha, aparelhos, custos e mais.",
    intro: [],
    faq: [
      { q: "Onde ficam meus dados, e quem pode vê-los?", a: "Numa planilha do Google no seu próprio Google Drive. O Gelbien só consegue abrir os arquivos que ele criou, não o resto do seu Drive. Ninguém mais vê seus dados a menos que você compartilhe a planilha. A demonstração guarda os dados de exemplo só no seu navegador." },
      { q: "Posso editar a planilha diretamente?", a: "Pode. O Gelbien lê a planilha de novo depois de cada mudança e sempre que você sincroniza: pelo ícone de nuvem no topo, no computador, ou, no celular, pela sua foto no canto superior direito e depois Sincronizar agora. Mude os valores à vontade, mas não renomeie nem apague as abas, a linha de cabeçalho ou a coluna de id, senão o Gelbien não reconhece o formato." },
      { q: "Preciso conectar meu banco?", a: "Não, e o Gelbien nunca vai pedir: ele não aceita credenciais de banco. Você registra os gastos (ou usa recibos), e os saldos vêm do seu check-in mensal." },
      { q: "Tem algum custo?", a: "O Gelbien não exige nenhum serviço pago. A IA é opcional: o Gemini tem um plano gratuito, e o Claude cobra alguns centavos por uso na sua própria chave." },
      { q: "Posso usar no celular e no computador?", a: "Pode. Entre com a mesma conta do Google nos dois e seus dados ficam sincronizados pela planilha. Se algo que você acabou de adicionar não aparecer no outro aparelho, sincronize (ícone de nuvem no topo, ou sua foto → Sincronizar agora, no celular). Sua chave de IA é por navegador, então adicione em cada aparelho." },
      { q: "Algo não foi salvo. Perdi minhas mudanças?", a: "Não. O Gelbien explica o motivo (sem conexão, armazenamento do Google cheio, Google ocupado) e guarda o que você digitou para tentar de novo daqui a pouco." },
      { q: "Algo parece errado ou desatualizado.", a: "Sincronize primeiro (ícone de nuvem no topo, ou sua foto → Sincronizar agora, no celular). Se não resolver, Perfil → Limpar cache carrega tudo de novo da sua planilha. A planilha em si nunca é tocada." },
      { q: "Como recomeço a demonstração, ou saio dela?", a: "Perfil → Redefinir dados de exemplo recomeça do zero. Para usar seus próprios dados, toque em Entrar com o Google, no Perfil." },
      { q: "Como vejo o tour de boas-vindas de novo?", a: "No topo deste guia, toque em Rever o tour de boas-vindas." },
      { q: "Como apago meus dados?", a: "Seus dados são a planilha no seu Drive: apague-a lá (e esvazie a lixeira) e depois saia. Para tirar também o acesso do Gelbien, vá em Conta do Google → Segurança → Apps e serviços de terceiros." },
    ],
  },
};

export default pt;
