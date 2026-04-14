(() => {
  const CARD_ID = "evo-proxy-settings-card";
  const CREATE_PROTOCOL_ID = "evo-create-proxy-protocol";

  function getAuthState() {
    try {
      const raw = window.localStorage.getItem("evolution-auth");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed.state || parsed;
    } catch {
      return null;
    }
  }

  function getInstanceId() {
    const match = window.location.pathname.match(/\/manager\/instances\/([^/]+)\/settings\/?$/);
    return match ? decodeURIComponent(match[1]) : "";
  }

  function apiBase(auth) {
    return (auth?.apiUrl || window.location.origin).replace(/\/$/, "");
  }

  function apiKey(auth) {
    return auth?.apiKey || "";
  }

  async function apiRequest(path, options = {}) {
    const auth = getAuthState();
    const key = apiKey(auth);
    if (!key) throw new Error("API key do manager nao encontrada.");

    const response = await fetch(`${apiBase(auth)}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        ...(options.headers || {}),
      },
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || data.message || "Falha ao chamar a API.");
    }
    return data;
  }

  function parseProxy(proxy) {
    if (!proxy || proxy === "null") return null;
    if (typeof proxy === "object") return proxy;
    try {
      return JSON.parse(proxy);
    } catch {
      return null;
    }
  }

  function field(label, name, placeholder, type = "text") {
    const wrap = document.createElement("label");
    wrap.className = "evo-proxy-field";
    wrap.innerHTML = `
      <span>${label}</span>
      <input name="${name}" type="${type}" placeholder="${placeholder}" autocomplete="off" />
    `;
    return wrap;
  }

  function createProtocolField() {
    const wrap = document.createElement("label");
    wrap.id = CREATE_PROTOCOL_ID;
    wrap.className = "evo-proxy-field evo-create-proxy-protocol";
    wrap.innerHTML = `
      <span>Protocolo do proxy</span>
      <select name="evoProxyProtocol">
        <option value="http">HTTP</option>
        <option value="https">HTTPS</option>
        <option value="socks5">SOCKS5</option>
      </select>
    `;
    const select = wrap.querySelector("select");
    select.value = window.localStorage.getItem("evo-create-proxy-protocol") || "http";
    select.addEventListener("change", () => {
      window.localStorage.setItem("evo-create-proxy-protocol", select.value || "http");
    });
    return wrap;
  }

  function setMessage(card, message, tone = "info") {
    const el = card.querySelector("[data-proxy-message]");
    if (!el) return;
    el.textContent = message || "";
    el.dataset.tone = tone;
  }

  async function loadProxy(card, instanceId) {
    setMessage(card, "Carregando proxy...", "info");
    const result = await apiRequest(`/instance/info/${encodeURIComponent(instanceId)}`);
    const instance = result.data || result;
    const proxy = parseProxy(instance.proxy);
    const form = card.querySelector("form");

    form.protocol.value = proxy?.protocol || "http";
    form.host.value = proxy?.host || "";
    form.port.value = proxy?.port || "";
    form.username.value = proxy?.username || "";
    form.password.value = "";

    const summary = card.querySelector("[data-proxy-summary]");
    if (proxy?.host && proxy?.port) {
      summary.textContent = `Proxy atual: ${proxy.protocol || "http"}://${proxy.host}:${proxy.port}${proxy.username ? " com usuario" : ""}.`;
      setMessage(card, "Senha protegida: deixe em branco para manter a senha atual.", "info");
    } else {
      summary.textContent = "Nenhum proxy configurado nesta instancia.";
      setMessage(card, "Preencha os campos para aplicar proxy e reconectar a instancia.", "info");
    }
  }

  async function saveProxy(card, instanceId) {
    const form = card.querySelector("form");
    const payload = {
      protocol: form.protocol.value || "http",
      host: form.host.value.trim(),
      port: form.port.value.trim(),
      username: form.username.value.trim(),
      password: form.password.value,
    };

    if (!payload.host || !payload.port) {
      setMessage(card, "Host e porta sao obrigatorios.", "error");
      return;
    }

    setMessage(card, "Salvando proxy e reconectando...", "info");
    await apiRequest(`/instance/proxy/${encodeURIComponent(instanceId)}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    await loadProxy(card, instanceId);
    setMessage(card, "Proxy salvo. A instancia foi enviada para reconexao.", "success");
  }

  async function removeProxy(card, instanceId) {
    if (!window.confirm("Remover o proxy desta instancia?")) return;
    setMessage(card, "Removendo proxy e reconectando...", "info");
    await apiRequest(`/instance/proxy/${encodeURIComponent(instanceId)}`, {
      method: "DELETE",
    });
    await loadProxy(card, instanceId);
    setMessage(card, "Proxy removido. A instancia foi enviada para reconexao.", "success");
  }

  function createCard(instanceId) {
    const card = document.createElement("section");
    card.id = CARD_ID;
    card.dataset.instanceId = instanceId;
    card.className = "rounded-lg border border-sidebar-border bg-card p-6 evo-proxy-settings";
    card.innerHTML = `
      <style>
        .evo-proxy-settings { color: hsl(var(--foreground)); }
        .evo-proxy-settings h2 { margin: 0 0 0.5rem; font-size: 1.125rem; font-weight: 600; }
        .evo-proxy-settings p { margin: 0; color: hsl(var(--muted-foreground)); font-size: 0.875rem; }
        .evo-proxy-grid { display: grid; gap: 1rem; margin-top: 1rem; grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .evo-proxy-field { display: grid; gap: 0.35rem; font-size: 0.875rem; font-weight: 500; }
        .evo-proxy-field input, .evo-proxy-field select {
          width: 100%; border: 1px solid hsl(var(--input)); border-radius: 0.375rem;
          background: hsl(var(--background)); color: hsl(var(--foreground)); padding: 0.55rem 0.75rem;
        }
        .evo-proxy-actions { display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 1rem; flex-wrap: wrap; }
        .evo-proxy-actions button {
          border: 1px solid hsl(var(--border)); border-radius: 0.5rem; padding: 0.6rem 1rem;
          font-size: 0.875rem; font-weight: 600; cursor: pointer;
        }
        .evo-proxy-save { background: hsl(var(--primary)); color: hsl(var(--primary-foreground)); }
        .evo-proxy-remove { background: rgba(220, 38, 38, 0.12); color: rgb(248, 113, 113); }
        [data-proxy-message] { margin-top: 0.8rem; }
        [data-proxy-message][data-tone="success"] { color: rgb(74, 222, 128); }
        [data-proxy-message][data-tone="error"] { color: rgb(248, 113, 113); }
        @media (max-width: 720px) { .evo-proxy-grid { grid-template-columns: 1fr; } }
      </style>
      <h2>Proxy da instancia</h2>
      <p data-proxy-summary>Nenhum proxy carregado ainda.</p>
      <form>
        <div class="evo-proxy-grid"></div>
        <div class="evo-proxy-actions">
          <button type="button" class="evo-proxy-remove">Remover proxy</button>
          <button type="submit" class="evo-proxy-save">Salvar proxy</button>
        </div>
      </form>
      <p data-proxy-message></p>
    `;

    const grid = card.querySelector(".evo-proxy-grid");
    const protocol = document.createElement("label");
    protocol.className = "evo-proxy-field";
    protocol.innerHTML = `
      <span>Protocolo</span>
      <select name="protocol">
        <option value="http">HTTP</option>
        <option value="https">HTTPS</option>
        <option value="socks5">SOCKS5</option>
      </select>
    `;
    grid.append(
      protocol,
      field("Host do proxy", "host", "ex: proxy.example.com"),
      field("Porta", "port", "ex: 8080"),
      field("Usuario do proxy", "username", "ex: usuario"),
      field("Senha do proxy", "password", "deixe em branco para manter", "password"),
    );

    card.querySelector("form").addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        await saveProxy(card, instanceId);
      } catch (error) {
        setMessage(card, error?.message || "Erro ao salvar proxy.", "error");
      }
    });

    card.querySelector(".evo-proxy-remove").addEventListener("click", async () => {
      try {
        await removeProxy(card, instanceId);
      } catch (error) {
        setMessage(card, error?.message || "Erro ao remover proxy.", "error");
      }
    });

    return card;
  }

  function findSettingsContainer() {
    return document.querySelector(".max-w-4xl.mx-auto.space-y-6");
  }

  function getCreateProxyProtocol() {
    const select = document.querySelector(`#${CREATE_PROTOCOL_ID} select`);
    return select?.value || window.localStorage.getItem("evo-create-proxy-protocol") || "http";
  }

  function findCreateDialog() {
    const candidates = Array.from(document.querySelectorAll('[role="dialog"], [data-radix-dialog-content], form, .fixed'));
    return candidates.find((node) => {
      const text = node.textContent || "";
      return text.includes("Nova Inst") || text.includes("Criar Inst") || text.includes("Nova Instancia");
    });
  }

  function findProxyHostInput(root) {
    const inputs = Array.from(root.querySelectorAll("input"));
    return inputs.find((input) => {
      const placeholder = (input.getAttribute("placeholder") || "").toLowerCase();
      const name = (input.getAttribute("name") || "").toLowerCase();
      return placeholder.includes("proxy.example") || placeholder.includes("proxy") || name.includes("proxyhost") || name === "host";
    });
  }

  function injectCreateProtocolField() {
    if (document.getElementById(CREATE_PROTOCOL_ID)) return;

    const dialog = findCreateDialog();
    if (!dialog) return;

    const hostInput = findProxyHostInput(dialog);
    if (!hostInput) return;

    const hostField = hostInput.closest("label") || hostInput.parentElement;
    if (!hostField?.parentElement) return;

    hostField.parentElement.insertBefore(createProtocolField(), hostField);
  }

  function patchCreateRequests() {
    if (window.__evoProxyProtocolPatched) return;
    window.__evoProxyProtocolPatched = true;

    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;
    const originalFetch = window.fetch;

    XMLHttpRequest.prototype.open = function patchedOpen(method, url, ...rest) {
      this.__evoMethod = method;
      this.__evoUrl = typeof url === "string" ? url : String(url || "");
      return originalOpen.call(this, method, url, ...rest);
    };

    XMLHttpRequest.prototype.send = function patchedSend(body) {
      const method = String(this.__evoMethod || "").toUpperCase();
      const url = String(this.__evoUrl || "");
      if (method === "POST" && url.includes("/instance/create") && typeof body === "string") {
        try {
          const payload = JSON.parse(body);
          if (payload.proxy && typeof payload.proxy === "object") {
            payload.proxy.protocol = getCreateProxyProtocol();
            body = JSON.stringify(payload);
          }
        } catch {
          // Keep the original body if it is not JSON.
        }
      }
      return originalSend.call(this, body);
    };

    if (typeof originalFetch === "function") {
      window.fetch = function patchedFetch(input, init = {}) {
        const url = typeof input === "string" ? input : input?.url || "";
        const method = String(init?.method || input?.method || "GET").toUpperCase();
        if (method === "POST" && url.includes("/instance/create") && typeof init?.body === "string") {
          try {
            const payload = JSON.parse(init.body);
            if (payload.proxy && typeof payload.proxy === "object") {
              payload.proxy.protocol = getCreateProxyProtocol();
              init = { ...init, body: JSON.stringify(payload) };
            }
          } catch {
            // Keep the original body if it is not JSON.
          }
        }
        return originalFetch.call(this, input, init);
      };
    }
  }

  function insertCard() {
    const instanceId = getInstanceId();
    const existing = document.getElementById(CARD_ID);
    if (!instanceId) {
      existing?.remove();
      return;
    }

    if (existing && existing.dataset.instanceId !== instanceId) {
      existing.remove();
    }

    const container = findSettingsContainer();
    if (!container || document.getElementById(CARD_ID)) return;

    const card = createCard(instanceId);
    const dangerCard = Array.from(container.children).find((child) => child.textContent?.includes("Zona de Perigo"));
    if (dangerCard) {
      container.insertBefore(card, dangerCard);
    } else {
      container.appendChild(card);
    }

    loadProxy(card, instanceId).catch((error) => {
      setMessage(card, error?.message || "Erro ao carregar proxy.", "error");
    });
  }

  const observer = new MutationObserver(insertCard);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("popstate", () => setTimeout(insertCard, 50));
  setInterval(insertCard, 1000);
  setInterval(injectCreateProtocolField, 500);
  patchCreateRequests();
  insertCard();
})();
