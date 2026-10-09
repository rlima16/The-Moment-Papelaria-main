/**
 * The Moment — servidor de pagamentos (Cloudflare Worker, plano gratuito)
 * Cartão de crédito, cartão de débito e Pix pelo Mercado Pago (Checkout Pro).
 *
 * Rotas:
 *   POST /criar-pagamento  -> cria o pedido no Firestore e o link de pagamento
 *   POST /webhook          -> recebe o aviso do Mercado Pago e atualiza o pedido
 *
 * Segredos (Cloudflare > Worker > Settings > Variables and Secrets):
 *   MP_ACCESS_TOKEN     OBRIGATÓRIO. Access Token do Mercado Pago (TEST-... ou APP_USR-...)
 *   FIREBASE_SA         Opcional. JSON da conta de serviço do Firebase: liga a
 *                       atualização automática do status do pedido (webhook)
 *   MP_WEBHOOK_SECRET   Opcional. Assinatura secreta do webhook do Mercado Pago
 */

const PROJECT_ID = 'the-moment-b3e02';
const FIREBASE_API_KEY = 'AIzaSyBhiNkiR7D_xI_W_2L2bLUG3gC1--HUn18'; // chave pública do site
const SITE_URL = 'https://lojathemoment.shop';
// E-mails que podem enviar arquivos pelo painel admin (mesma lista do admin.js)
const ADMIN_EMAILS = ['rodrigoalveslima5533@gmail.com'];
const MAX_ARQUIVO = 25 * 1024 * 1024; // limite do KV do Cloudflare
const ALLOWED_ORIGINS = [
  SITE_URL, 'https://www.lojathemoment.shop',
  'http://lojathemoment.shop', 'http://www.lojathemoment.shop', // enquanto o HTTPS não estiver forçado
  'https://themomentoficial.shop', 'https://www.themomentoficial.shop',
  'http://localhost:5500', 'http://127.0.0.1:5500',
];
const MP_API = 'https://api.mercadopago.com';
const FS_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const STATUS_MAP = {
  approved: 'Pago',
  authorized: 'Aguardando Pagamento',
  pending: 'Aguardando Pagamento',
  in_process: 'Em análise',
  in_mediation: 'Em análise',
  rejected: 'Pagamento recusado',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado',
  charged_back: 'Reembolsado',
};

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// ---------------------------------------------------------------- utilidades
const corsHeaders = (request) => {
  const origin = request.headers.get('Origin') || '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : SITE_URL,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Nome-Arquivo',
    'Access-Control-Expose-Headers': 'Content-Disposition, X-Nome-Arquivo',
    'Vary': 'Origin',
  };
};
const json = (data, status, request) => new Response(JSON.stringify(data), {
  status: status || 200,
  headers: { 'Content-Type': 'application/json; charset=utf-8', ...(request ? corsHeaders(request) : {}) },
});

const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64urlText = (text) => b64url(new TextEncoder().encode(text));

// ------------------------------------------ acesso ao Firestore (conta de serviço)
let cachedToken = null;
let cachedTokenExp = 0;

async function getGoogleToken(env) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedTokenExp - 60 > now) return cachedToken;
  if (!env.FIREBASE_SA) throw new HttpError(500, 'Servidor sem a conta de serviço do Firebase (FIREBASE_SA).');
  const sa = JSON.parse(env.FIREBASE_SA);
  const header = b64urlText(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64urlText(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claim}`));
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${header}.${claim}.${b64url(sig)}`,
  });
  const data = await resp.json();
  if (!resp.ok) throw new HttpError(500, 'Falha ao autenticar no Google: ' + (data.error_description || data.error));
  cachedToken = data.access_token;
  cachedTokenExp = now + (data.expires_in || 3600);
  return cachedToken;
}

// Converte valores JS <-> formato do Firestore REST
function toFs(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFs) } };
  return { mapValue: { fields: toFields(v) } };
}
const toFields = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, toFs(v)]));
function fromFs(v) {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromFs);
  if ('mapValue' in v) return fromFields(v.mapValue.fields || {});
  return null;
}
const fromFields = (fields) => Object.fromEntries(Object.entries(fields || {}).map(([k, v]) => [k, fromFs(v)]));

async function fsGet(env, path) {
  const token = await getGoogleToken(env);
  const resp = await fetch(`${FS_BASE}/${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (resp.status === 404) return null;
  const data = await resp.json();
  if (!resp.ok) throw new HttpError(500, 'Erro ao ler o banco: ' + JSON.stringify(data.error || data));
  return { id: data.name.split('/').pop(), ...fromFields(data.fields) };
}

async function fsCreate(env, collection, obj) {
  const token = await getGoogleToken(env);
  const resp = await fetch(`${FS_BASE}/${collection}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: toFields(obj) }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new HttpError(500, 'Erro ao salvar o pedido: ' + JSON.stringify(data.error || data));
  return data.name.split('/').pop();
}

async function fsUpdate(env, path, obj) {
  const token = await getGoogleToken(env);
  const mask = Object.keys(obj).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
  const resp = await fetch(`${FS_BASE}/${path}?${mask}&currentDocument.exists=true`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: toFields(obj) }),
  });
  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    throw new HttpError(500, 'Erro ao atualizar o pedido: ' + JSON.stringify(data.error || data));
  }
}

// ------------------------------------------------------------ criar pagamento
// Lê um produto. Com a conta de serviço usa acesso de servidor; sem ela, usa a leitura
// pública (a mesma que o site usa para mostrar os produtos).
async function getProduct(env, id) {
  const path = `products/${encodeURIComponent(id)}`;
  if (env.FIREBASE_SA) return fsGet(env, path);
  const resp = await fetch(`${FS_BASE}/${path}?key=${FIREBASE_API_KEY}`);
  if (resp.status === 404) return null;
  const data = await resp.json();
  if (!resp.ok) throw new HttpError(500, 'Erro ao ler os produtos: ' + JSON.stringify(data.error || data));
  return { id, ...fromFields(data.fields) };
}

async function criarPagamento(request, env) {
  if (!env.MP_ACCESS_TOKEN) throw new HttpError(500, 'Pagamento com cartão indisponível no momento (falta o MP_ACCESS_TOKEN).');
  const body = await request.json().catch(() => ({}));

  const orderDocId = String(body.orderDocId || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
  const orderId = String(body.orderId || '').slice(0, 40);
  const nome = String(body.nome || '').trim().slice(0, 120);
  const email = String(body.email || '').trim().slice(0, 160);
  const cpf = String(body.cpf || '').replace(/\D/g, '');
  const ids = Array.isArray(body.itemIds) ? [...new Set(body.itemIds.map(String))].slice(0, 50) : [];
  if (!orderDocId || !nome || !email.includes('@') || cpf.length !== 11 || !ids.length) {
    throw new HttpError(400, 'Confira nome, e-mail, CPF e os itens do carrinho.');
  }

  // Preços SEMPRE lidos do banco (nunca do navegador)
  const products = await Promise.all(ids.map((id) => getProduct(env, id)));
  const items = products.filter(Boolean).map((p) => ({
    id: p.id,
    title: String(p.title || 'Arquivo digital'),
    price: Number(p.price) || 0,
    image: p.image || '',
  })).filter((i) => i.price > 0);
  if (!items.length) throw new HttpError(400, 'Nenhum produto válido no carrinho.');

  const origin = new URL(request.url).origin;
  const preference = {
    items: items.map((i) => ({
      id: i.id,
      title: i.title.slice(0, 250),
      description: 'Arquivo digital .studio3 para Silhouette',
      picture_url: i.image || undefined,
      category_id: 'others',
      quantity: 1,
      currency_id: 'BRL',
      unit_price: i.price,
    })),
    payer: { name: nome, email, identification: { type: 'CPF', number: cpf } },
    external_reference: orderDocId,
    back_urls: {
      success: `${SITE_URL}/minha-conta?pagamento=aprovado`,
      pending: `${SITE_URL}/minha-conta?pagamento=pendente`,
      failure: `${SITE_URL}/carrinho?pagamento=falhou`,
    },
    auto_return: 'approved',
    statement_descriptor: 'THEMOMENT',
    payment_methods: { excluded_payment_types: [{ id: 'ticket' }, { id: 'bank_transfer' }, { id: 'atm' }], installments: 3 },
    metadata: { order_id: orderId, order_doc_id: orderDocId },
  };
  // Atualização automática do pedido só quando a chave do Firebase estiver configurada
  if (env.FIREBASE_SA) preference.notification_url = `${origin}/webhook`;

  const resp = await fetch(`${MP_API}/checkout/preferences`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.MP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': orderDocId,
    },
    body: JSON.stringify(preference),
  });
  const pref = await resp.json();
  if (!resp.ok || !pref.init_point) {
    console.error('Erro ao criar preferência', resp.status, JSON.stringify(pref));
    throw new HttpError(502, 'Não foi possível iniciar o pagamento. Tente novamente.');
  }
  if (env.FIREBASE_SA) {
    try { await fsUpdate(env, `pedidos/${orderDocId}`, { mpPreferenceId: String(pref.id) }); } catch (e) { console.warn(e.message); }
  }
  return { checkoutUrl: pref.init_point };
}

// --------------------------------------------------------------------- webhook
async function assinaturaValida(request, env, dataId) {
  if (!env.MP_WEBHOOK_SECRET) return true; // sem segredo: seguimos, pois consultamos o pagamento na API
  const header = request.headers.get('x-signature') || '';
  const requestId = request.headers.get('x-request-id') || '';
  const parts = {};
  header.split(',').forEach((p) => {
    const [k, v] = p.split('=').map((x) => (x || '').trim());
    if (k) parts[k] = v;
  });
  if (!parts.ts || !parts.v1) return false;
  const manifest = `id:${String(dataId).toLowerCase()};request-id:${requestId};ts:${parts.ts};`;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.MP_WEBHOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(manifest));
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
  if (hex.length !== parts.v1.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ parts.v1.charCodeAt(i);
  return diff === 0;
}

async function webhook(request, env) {
  const url = new URL(request.url);
  const body = await request.json().catch(() => ({}));
  const type = url.searchParams.get('type') || url.searchParams.get('topic') || body.type;
  const dataId = url.searchParams.get('data.id') || (body.data && body.data.id);
  if (type !== 'payment' || !dataId) return new Response('ignorado', { status: 200 });
  if (!(await assinaturaValida(request, env, dataId))) {
    console.warn('Assinatura inválida no webhook', dataId);
    return new Response('assinatura inválida', { status: 401 });
  }

  // Sempre consultamos o pagamento direto no Mercado Pago
  const resp = await fetch(`${MP_API}/v1/payments/${encodeURIComponent(dataId)}`, {
    headers: { Authorization: `Bearer ${env.MP_ACCESS_TOKEN}` },
  });
  const pay = await resp.json();
  if (!resp.ok) {
    console.error('Erro ao consultar pagamento', dataId, JSON.stringify(pay));
    return new Response('erro', { status: 500 });
  }
  if (!pay.external_reference) return new Response('sem referência', { status: 200 });

  const orderPath = `pedidos/${encodeURIComponent(String(pay.external_reference))}`;
  const order = await fsGet(env, orderPath);
  if (!order) return new Response('pedido não encontrado', { status: 200 });

  let status = STATUS_MAP[pay.status] || 'Aguardando Pagamento';
  if (pay.status === 'approved' && Math.abs(Number(pay.transaction_amount) - (Number(order.total) || 0)) > 0.01) {
    status = 'Verificar pagamento';
    console.warn('Valor pago diferente do pedido', order.id, pay.id);
  }
  await fsUpdate(env, orderPath, {
    status,
    mpPaymentId: String(pay.id),
    mpStatus: String(pay.status || ''),
    mpStatusDetail: String(pay.status_detail || ''),
    paymentType: String(pay.payment_type_id || ''),
    paymentMethodId: String(pay.payment_method_id || ''),
    paidAt: pay.date_approved ? String(pay.date_approved) : null,
    updatedAt: new Date(),
  });
  return new Response('ok', { status: 200 });
}

// ------------------------------------------------------------ Pix direto
// Cria o pagamento Pix pela API e devolve o QR Code para o site mostrar na própria tela.
async function criarPix(request, env) {
  if (!env.MP_ACCESS_TOKEN) throw new HttpError(500, 'Pagamento indisponível no momento (falta o MP_ACCESS_TOKEN).');
  const body = await request.json().catch(() => ({}));
  const orderDocId = cleanIdPix(body.orderDocId);
  const orderId = String(body.orderId || '').slice(0, 40);
  const nome = String(body.nome || '').trim().slice(0, 120);
  const email = String(body.email || '').trim().slice(0, 160);
  const cpf = String(body.cpf || '').replace(/\D/g, '');
  const ids = Array.isArray(body.itemIds) ? [...new Set(body.itemIds.map(String))].slice(0, 50) : [];
  if (!orderDocId || !nome || !email.includes('@') || cpf.length !== 11 || !ids.length) {
    throw new HttpError(400, 'Confira nome, e-mail, CPF e os itens do carrinho.');
  }

  // Preços lidos do banco. A chave de idempotência (pix-<pedido>) evita gerar dois Pix para o mesmo pedido.
  const products = await Promise.all(ids.map((id) => getProduct(env, id)));
  const items = products.filter(Boolean).map((p) => ({
    id: p.id, title: String(p.title || 'Arquivo digital'), price: Number(p.price) || 0,
  })).filter((i) => i.price > 0);
  if (!items.length) throw new HttpError(400, 'Nenhum produto válido no carrinho.');
  const total = Math.round(items.reduce((s, i) => s + i.price, 0) * 100) / 100;

  const expira = new Date(Date.now() + 30 * 60 * 1000); // 30 minutos
  const partes = nome.split(/\s+/);
  const pagamento = {
    transaction_amount: total,
    description: items.length === 1 ? items[0].title.slice(0, 200) : `${items.length} arquivos digitais - The Moment`,
    payment_method_id: 'pix',
    external_reference: orderDocId,
    date_of_expiration: expira.toISOString().replace('Z', '+00:00'),
    statement_descriptor: 'THEMOMENT',
    payer: {
      email,
      first_name: partes[0],
      last_name: partes.slice(1).join(' ') || partes[0],
      identification: { type: 'CPF', number: cpf },
    },
    additional_info: {
      items: items.map((i) => ({ id: i.id, title: i.title.slice(0, 250), quantity: 1, unit_price: i.price, category_id: 'others' })),
    },
    metadata: { order_id: orderId, order_doc_id: orderDocId },
  };
  if (env.FIREBASE_SA) pagamento.notification_url = `${new URL(request.url).origin}/webhook`;

  const resp = await fetch(`${MP_API}/v1/payments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.MP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': `pix-${orderDocId}`,
    },
    body: JSON.stringify(pagamento),
  });
  const pay = await resp.json().catch(() => ({}));
  const tx = pay.point_of_interaction && pay.point_of_interaction.transaction_data;
  if (!resp.ok || !tx || !tx.qr_code) {
    console.error('Erro ao criar Pix', resp.status, JSON.stringify(pay));
    throw new HttpError(502, 'Não foi possível gerar o Pix agora. Tente novamente.');
  }
  return {
    paymentId: String(pay.id),
    status: pay.status,
    valor: total,
    qrCode: tx.qr_code,
    qrCodeBase64: tx.qr_code_base64,
    expiraEm: pay.date_of_expiration || expira.toISOString(),
  };
}
const cleanIdPix = (v) => String(v || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);

// ------------------------------------------------------- consultar status
// Pergunta ao Mercado Pago a situação de até 50 pedidos (pelo id do pedido no site).
// Devolve só o status (sem dados pessoais).
async function consultarStatus(request, env) {
  if (!env.MP_ACCESS_TOKEN) throw new HttpError(500, 'Falta o MP_ACCESS_TOKEN.');
  const body = await request.json().catch(() => ({}));
  const ids = Array.isArray(body.ids) ?
    [...new Set(body.ids.map((x) => String(x).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64)).filter(Boolean))].slice(0, 50) : [];
  const result = {};
  await Promise.all(ids.map(async (id) => {
    try {
      const resp = await fetch(`${MP_API}/v1/payments/search?external_reference=${encodeURIComponent(id)}&sort=date_created&criteria=desc&limit=10`, {
        headers: { Authorization: `Bearer ${env.MP_ACCESS_TOKEN}` },
      });
      const data = await resp.json();
      if (!resp.ok) return;
      const pays = data.results || [];
      if (!pays.length) { result[id] = { status: null }; return; }
      const pay = pays.find((p) => p.status === 'approved') || pays[0];
      result[id] = {
        status: STATUS_MAP[pay.status] || 'Aguardando Pagamento',
        mpStatus: pay.status,
        mpPaymentId: String(pay.id),
        paymentType: pay.payment_type_id || '',
        amount: Number(pay.transaction_amount) || 0,
        approvedAt: pay.date_approved || null,
      };
    } catch (e) { console.warn('status', id, e.message); }
  }));
  return result;
}

// ------------------------------------------------------ arquivos dos topos
// Os arquivos ficam no Cloudflare KV (binding ARQUIVOS):
//   arquivo:<idProduto>  -> o .studio3 (download)
//   previa:<idProduto>   -> imagem ou PDF para visualizar no navegador (opcional)

async function verifyUser(request) {
  const auth = request.headers.get('Authorization') || '';
  const idToken = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!idToken) throw new HttpError(401, 'Entre na sua conta para acessar seus arquivos.');
  const resp = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  const data = await resp.json().catch(() => ({}));
  const user = data.users && data.users[0];
  if (!resp.ok || !user) throw new HttpError(401, 'Sua sessão expirou. Entre na conta novamente.');
  return { uid: user.localId, email: String(user.email || '').toLowerCase(), idToken };
}
const isAdmin = (user) => ADMIN_EMAILS.includes(user.email);

const cleanId = (v) => String(v || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);

function kv(env) {
  if (!env.ARQUIVOS) throw new HttpError(500, 'Armazenamento de arquivos não configurado (KV "ARQUIVOS").');
  return env.ARQUIVOS;
}

// Painel admin envia o arquivo de um produto
async function enviarArquivo(request, env, url) {
  const user = await verifyUser(request);
  if (!isAdmin(user)) throw new HttpError(403, 'Apenas administradores podem enviar arquivos.');
  const produto = cleanId(url.searchParams.get('produto'));
  const tipo = url.searchParams.get('tipo') === 'previa' ? 'previa' : 'arquivo';
  if (!produto) throw new HttpError(400, 'Produto não informado.');
  const nome = decodeURIComponent(request.headers.get('X-Nome-Arquivo') || '') || `${produto}.studio3`;
  const body = await request.arrayBuffer();
  if (!body.byteLength) throw new HttpError(400, 'Arquivo vazio.');
  if (body.byteLength > MAX_ARQUIVO) throw new HttpError(413, 'Arquivo maior que 25 MB.');
  const type = request.headers.get('Content-Type') || 'application/octet-stream';
  await kv(env).put(`${tipo}:${produto}`, body, {
    metadata: { name: nome.slice(0, 200), type, size: body.byteLength, enviadoEm: new Date().toISOString() },
  });
  return { ok: true, nome, tamanho: body.byteLength };
}

// Confere no Mercado Pago se o pedido foi pago e se inclui o produto
async function pedidoPagoInclui(env, pedidoId, produto, order) {
  const resp = await fetch(`${MP_API}/v1/payments/search?external_reference=${encodeURIComponent(pedidoId)}&sort=date_created&criteria=desc&limit=10`, {
    headers: { Authorization: `Bearer ${env.MP_ACCESS_TOKEN}` },
  });
  const data = await resp.json().catch(() => ({}));
  const pagos = (data.results || []).filter((p) => p.status === 'approved');
  if (!pagos.length) return false;
  for (const pay of pagos) {
    const itens = (pay.additional_info && pay.additional_info.items) || [];
    if (itens.length) {
      if (itens.some((i) => String(i.id) === produto)) return true;
    } else {
      // sem a lista de itens no pagamento: confere pelo pedido e pelo valor
      const total = Number(order.total) || 0;
      const temItem = (order.items || []).some((i) => i && String(i.id) === produto);
      if (temItem && Number(pay.transaction_amount) + 0.01 >= total) return true;
    }
  }
  return false;
}

// Cliente baixa (modo=baixar) ou visualiza (modo=ver) um arquivo comprado
async function entregarArquivo(request, env, url) {
  const user = await verifyUser(request);
  const produto = cleanId(url.searchParams.get('produto'));
  const pedidoId = cleanId(url.searchParams.get('pedido'));
  const modo = url.searchParams.get('modo') === 'ver' ? 'ver' : 'baixar';
  if (!produto) throw new HttpError(400, 'Produto não informado.');

  if (!isAdmin(user)) {
    if (!pedidoId) throw new HttpError(400, 'Pedido não informado.');
    // Lê o pedido com o login do próprio cliente (respeita as regras do Firestore)
    const r = await fetch(`${FS_BASE}/pedidos/${pedidoId}`, { headers: { Authorization: `Bearer ${user.idToken}` } });
    if (!r.ok) throw new HttpError(403, 'Pedido não encontrado na sua conta.');
    const d = await r.json();
    const order = fromFields(d.fields);
    if (order.userId !== user.uid) throw new HttpError(403, 'Este pedido não é da sua conta.');
    if (!(await pedidoPagoInclui(env, pedidoId, produto, order))) {
      throw new HttpError(402, 'O pagamento deste pedido ainda não foi confirmado.');
    }
  }

  const chave = `${modo === 'ver' ? 'previa' : 'arquivo'}:${produto}`;
  const { value, metadata } = await kv(env).getWithMetadata(chave, { type: 'stream' });
  if (!value) {
    throw new HttpError(404, modo === 'ver' ? 'sem-previa' : 'O arquivo deste topo ainda está sendo preparado. Avisaremos você!');
  }
  const meta = metadata || {};
  const nome = meta.name || `${produto}.studio3`;
  return new Response(value, {
    headers: {
      ...corsHeaders(request),
      'Content-Type': meta.type || 'application/octet-stream',
      'Content-Disposition': `${modo === 'ver' ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(nome)}`,
      'X-Nome-Arquivo': encodeURIComponent(nome),
      'Cache-Control': 'private, no-store',
    },
  });
}

// ----------------------------------------------------------------- roteamento
export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) });
    try {
      if (request.method === 'POST' && pathname === '/criar-pagamento') {
        return json(await criarPagamento(request, env), 200, request);
      }
      const url = new URL(request.url);
      if (request.method === 'POST' && pathname === '/pix') {
        return json(await criarPix(request, env), 200, request);
      }
      if (request.method === 'POST' && pathname === '/admin/arquivo') {
        return json(await enviarArquivo(request, env, url), 200, request);
      }
      if (request.method === 'GET' && pathname === '/arquivo') {
        return await entregarArquivo(request, env, url);
      }
      if (request.method === 'POST' && pathname === '/status') {
        return json(await consultarStatus(request, env), 200, request);
      }
      if (request.method === 'POST' && pathname === '/webhook') {
        return await webhook(request, env);
      }
      if (request.method === 'GET' && pathname === '/') {
        return new Response('Servidor de pagamentos The Moment: online ✅', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
      return new Response('Não encontrado', { status: 404 });
    } catch (e) {
      console.error(e);
      const status = e instanceof HttpError ? e.status : 500;
      const message = e instanceof HttpError ? e.message : 'Erro inesperado. Tente novamente.';
      return pathname === '/webhook' ? new Response('erro', { status: 500 }) : json({ error: message }, status, request);
    }
  },
};
