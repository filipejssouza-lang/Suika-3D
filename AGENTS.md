# 🧠 Diretrizes Globais da Orquestra Lupin (PC, Vivo Neo 9, Cavalo de Fogo & Robozinho)

Estas regras são globais e obrigatórias em **qualquer pasta, repositório ou projeto** aberto no Antigravity (tanto no **PC** quanto no **Vivo Neo 9**).

## 1. Papel do Usuário (O Orquestrador) & Propósito da Infraestrutura
- O usuário (**Filipe / Zeusdin**) atua como **Orquestrador** do ecossistema e se comunica em **linguagem natural** (Português do Brasil).
- **A Infraestrutura é a Oficina dos Agentes:** Todo o hardware do cluster (PC, Cavalo de Fogo, Robozinho P30 Pro, Vivo Neo 9 e nuvem GitHub/Colab) existe para que **os agentes executem o trabalho pesado de forma inteligente**. O fruto do trabalho dos agentes torna-se o **produto do usuário**.
- **Ciclo de Vida e Arquivamento:**
  1. Ao usar um processo pesado no **Cavalo de Fogo** (como o Blender Headless), o processo deve **executar a tarefa, entregar os arquivos e morrer imediatamente**, devolvendo 100% da RAM.
  2. Tudo o que for criado a pedido do usuário (modelos 3D, scripts, APKs, módulos, configurações de monetização) deve ficar **arquivado de forma organizada dentro da infraestrutura** e registrado na memória contextual (`lupin-memory`) para compor produtos futuros.
- **Compreensão de Intenção:** Traduza os pedidos naturais do usuário em ações técnicas precisas, sem exigir termos de programação e **sem transformar metáforas ou analogias conversacionais em nomes oficiais de ferramentas ou títulos**.
- **Proibido Respostas Genéricas:** Nunca inicie uma sessão com um vazio *"Como posso ajudar?"*. Demonstre imediatamente consciência do estado atual do projeto e do cluster.

## 2. Sincronização e Memória Unificada (Nunca Comece do Zero)
- Ao iniciar qualquer sessão ou falar de projetos do ecossistema:
  1. Execute `sync-memory` para sincronizar `~/.agents/memory/` entre **PC**, **Vivo Neo 9** e **Robozinho (P30 Pro)**.
  2. Leia `~/.agents/memory/estado_atual.md` e `~/.agents/memory/dispositivos_cluster.md`.
  3. Ao concluir qualquer avanço relevante, atualize `estado_atual.md` e execute `sync-memory`.

## 3. Convenção Obrigatória de Nomes
- Estação Fedora Linux x86_64 (`192.168.1.10`) = Chamar SEMPRE e exclusivamente de **PC** (nunca "notebook", "laptop" ou "Vivobook").
- Xiaomi Mi 11 Ultra (`192.168.31.101` via OTG `mi11-eth` / `192.168.1.12`) = **Cavalo de Fogo**.
- Huawei P30 Pro (`192.168.1.4`) = **Robozinho**.
- Vivo iQOO Neo 9 (`192.168.1.23`) = **Vivo Neo 9**.

## 4. Proteção Absoluta de Recursos e Divisão de Trabalho
- **PC (Fedora — 7 GB RAM):**
  - Dedicado exclusivamente à interface visual (2 monitores), edição, navegação e coordenação leve.
  - **TERMINANTEMENTE PROIBIDO** compilar APKs Android localmente no PC (`./gradlew`, `gradle`), abrir `GradleDaemon` Java, rodar modelos pesados de IA ou manter containers/servidores ociosos consumindo RAM e Swap do PC.
- **Compilação de Apps Android (Suika 3D, Odin, Lupin Terminal, Meus Gastos):**
  - Todo build de APK DEVE ser feito na nuvem via **GitHub Actions** (`git push` + `gh workflow run` / `gh run watch` / `gh run download`), com consumo zero de RAM/CPU física local.
- **Cavalo de Fogo (Mi 11 Ultra — 12 GB RAM, Cabo OTG 0.5ms `mi11-eth`, Caixa Peltier 40°C):**
  - Trabalha em regime **SOB DEMANDA** (`~9.2 GB` de RAM livres).
  - Não mantenha servidores pesados (Minecraft, OpenDesign, OpenCode, LLMs grandes) travados 24/7 sem uso. Suba o serviço apenas quando solicitado para uma tarefa real e encerre ao terminar.
- **Robozinho (Huawei P30 Pro — 8 GB RAM, Caixa Peltier 34°C):**
  - Guardião 24/7 do cofre central de memórias (`~/.agents/memory/`), voz física sob demanda (`:8088/falar` — nunca usar TTS automático sem pedido ou alerta crítico) e serviços contínuos leves.
- **Vivo Neo 9 (Termux Master):**
  - Terminal móvel de comando e despacho. Preservar bateria (sem builds pesados nem loops contínuos).
