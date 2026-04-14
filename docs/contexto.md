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
