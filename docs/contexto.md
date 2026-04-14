# Contexto RecebaFacil

## Problema encontrado

Em producao, apos o deploy do commit `362d433`, a API iniciava corretamente, reutilizava sessoes existentes e aplicava proxy HTTP no runtime. Mesmo assim, alguns fluxos ainda apresentavam inconsistencias:

- `/instance/all` e `/instance/info` retornavam `proxy: ""`, mesmo quando a instancia tinha proxy salvo e o runtime logava `Proxy enabled (http)`.
- `POST /instance/forcereconnect/:instanceId` podia retornar HTTP 400 com `{"error":"EOF"}` quando chamado sem body JSON.
- `ForceReconnect` acessava o client em memoria antes de validar se ele existia, o que falhava para instancias antigas sem runtime ativo.
- Alguns endpoints administrativos aceitavam somente UUID apesar de exemplos e usos do manager tratarem o path como identificador da instancia.

## Causa raiz

O proxy era removido explicitamente das respostas em `GetAll` e `Info`, criando divergencia entre banco/runtime e API. O `forcereconnect` exigia body com `number`, mesmo quando a instancia ja tinha JID/sessao persistida, e o servico assumia runtime em memoria existente antes de tentar reconectar.

## Arquivos alterados

- `pkg/instance/handler/instance_handler.go`
- `pkg/instance/repository/instance_repository.go`
- `pkg/instance/service/instance_service.go`
- `docs/contexto.md`

## Correcao aplicada

- `forcereconnect` aceita body vazio e nao vaza `EOF` cru.
- `ForceReconnect` busca a instancia primeiro, aceita UUID ou nome, e tenta reconectar usando a sessao/JID persistida quando disponivel.
- O reconnect recarrega e valida a configuracao de proxy antes de chamar o runtime.
- Se nao houver proxy por instancia, o servico persiste a configuracao global quando ela existir.
- As respostas de `/instance/all` e `/instance/info` voltam a indicar proxy configurado, mas mascaram a senha.
- Logs foram adicionados para diferenciar instancia inexistente, runtime ausente, sessao sem JID, proxy carregado, proxy ausente e tentativa de reconnect.

## Validacoes feitas

- `gofmt` nos arquivos Go alterados.
- `go test ./...` via container `golang:1.25`.
- `git diff --check`.

## Pontos de atencao

- O campo `proxy` nas respostas administrativas mostra a configuracao mascarada, nao a senha real.
- `forcereconnect` inicia a tentativa de reconexao; a confirmacao final de websocket/logged-in deve ser conferida em `/instance/status`, `/instance/all` ou logs da instancia.
- O endpoint agora aceita UUID ou `name` para compatibilidade com instancias antigas e usos do manager.

## Atualizacao - manager connect/reconnect/QR

Depois da primeira correcao, o manager ainda podia abrir a tela de QR ou acionar "Conectar/Reconnect" sem passar pelo mesmo caminho de hidratacao do proxy usado pelo `forcereconnect`. Isso deixava os fluxos comuns do manager diferentes do fluxo testado pela API: a sessao podia existir, mas o runtime era reiniciado sem proxy, demorava mais e, em alguns casos, ficava aguardando QR sem gerar codigo.

### Causa raiz adicional

`Connect`, `Reconnect`, `GetQr` e `Pair` chamavam `StartClient` ou `ReconnectClient` sem garantir antes que `instance.Proxy` estivesse carregado/persistido. No `Connect`, ainda havia um bloco antigo que tentava fazer `json.Unmarshal` de `instance.Proxy` mesmo quando ele estava vazio, dependendo de configuracao global, o que podia reproduzir erro opaco e iniciar sem proxy.

### Correcao adicional

- Criado helper unico para carregar, persistir e logar proxy por fluxo.
- `Connect` agora hidrata proxy antes de salvar a instancia e usa o resultado para `ClientData.IsProxy`.
- `Reconnect` agora recarrega a instancia do banco, hidrata proxy e registra se ha JID persistido antes de reiniciar o runtime.
- `GetQr` e `Pair` agora tambem hidratam proxy antes de iniciar/reiniciar o client.
- O bloco antigo de parse manual de proxy no `Connect` foi removido para evitar `EOF` em proxy vazio.
- Novas instancias criadas sem proxy nao persistem mais `proxy: "null"`, e configs incompletas sem host/porta deixam de ser tratadas como proxy valido.
- O manager agora injeta um card "Proxy da instancia" em `/manager/instances/:id/settings`, permitindo editar host, porta, usuario e senha depois da criacao.
- Quando a senha do proxy fica em branco no update, o backend preserva a senha existente para evitar remover credencial sem querer.
- A tela de criacao do manager tambem recebeu seletor de protocolo (`HTTP`, `HTTPS`, `SOCKS5`) para o proxy. Como o manager distribuido esta minificado, um script complementar injeta o campo e garante que `proxy.protocol` entre no payload `POST /instance/create`.

### Validacoes desta rodada

- `git diff --check`.
- Validacao de Go fica pendente se `go`/Docker nao estiverem disponiveis no ambiente local.

## Atualizacao - estabilidade send-only

O uso do RecebaFacil depende de sessoes WhatsApp longas, mas sem consumo de historico, mensagens recebidas ou midias. O modo `SEND_ONLY_MODE` ja impede processamento de mensagens recebidas, ignora `HistorySync` e pula dispatch externo, porem o client nativo estava com auto-reconnect desligado. Se o websocket caisse de forma silenciosa, a instancia podia ficar presa ate reiniciar a API ou acionar conectar manualmente.

### Correcao aplicada

- `EnableAutoReconnect` do client whatsmeow foi religado.
- O handler de `Disconnected` agora agenda reconnect com debounce, em vez de reiniciar imediatamente e permitir duplicidade.
- Criado watchdog de conexao para `SEND_ONLY_MODE`: a cada 5 minutos ele verifica instancias do `CLIENT_NAME` com JID persistido e runtime ausente/deslogado/desconectado.
- O watchdog ignora instancias sem JID e sessoes marcadas como `logged out`, para nao forcar QR em conta realmente deslogada.
- Se o runtime ja tiver recuperado sozinho, o watchdog/agenda marca a instancia como conectada no banco para evitar painel preso em desconectado.
- Reconnects duplicados ficam bloqueados por uma trava temporaria de 2 minutos por instancia.
- O modo send-only continua sem baixar imagens, videos, audios, documentos ou mensagens recebidas, porque o processamento de `events.Message` retorna antes dos downloads quando `SEND_ONLY_MODE=true`.

### Recomendacao de ambiente

Para o RecebaFacil, manter explicitamente:

- `SEND_ONLY_MODE: "true"`
- `DATABASE_SAVE_MESSAGES: "false"`
- `WEBHOOK_FILES: "false"`

`SEND_ONLY_MODE` e o mais importante para reduzir consumo de proxy. As outras duas flags reforcam que o produto nao precisa armazenar mensagens nem arquivos recebidos.
