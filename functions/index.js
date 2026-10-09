/**
 * Cloud Functions da The Moment — pagamentos com Mercado Pago
 * (cartão de crédito, cartão de débito e Pix pelo Checkout Pro).
 *
 * Configuração (arquivo functions/.env, que NÃO vai para o GitHub):
 *   MERCADOPAGO_ACCESS_TOKEN=...   (Access Token da sua conta Mercado Pago)
 *   MERCADOPAGO_WEBHOOK_SECRET=... (Assinatura secreta do Webhook)
 */

const {setGlobalOptions} = require("firebase-functions/v2");
const {onCall, onRequest, HttpsError} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const crypto = require("crypto");

admin.initializeApp();
const db = admin.firestore();

const REGION = "southamerica-east1";
setGlobalOptions({region: REGION, maxInstances: 10});

const SITE_URL = "https://lojathemoment.shop";
const PROJECT_ID = "the-moment-b3e02";
const WEBHOOK_URL =
  `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/webhookMercadoPago`;
const MP_API = "https://api.mercadopago.com";

const getToken = () => {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) {
    throw new HttpsError("failed-precondition",
        "Pagamento com cartão indisponível no momento.");
  }
  return token;
};

// Status do Mercado Pago -> status mostrado para o cliente
const STATUS_MAP = {
  approved: "Pago",
  authorized: "Aguardando Pagamento",
  pending: "Aguardando Pagamento",
  in_process: "Em análise",
  in_mediation: "Em análise",
  rejected: "Pagamento recusado",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
  charged_back: "Reembolsado",
};

/**
 * Cria o pedido e a preferência de pagamento no Mercado Pago.
 * Os preços são lidos do banco (nunca confiamos no valor vindo do navegador).
 */
exports.criarPagamento = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated",
        "Entre na sua conta para finalizar a compra.");
  }
  const data = request.data || {};
  const nome = String(data.nome || "").trim().slice(0, 120);
  const email = String(data.email || "").trim().slice(0, 160);
  const cpf = String(data.cpf || "").replace(/\D/g, "");
  const ids = Array.isArray(data.itemIds) ?
    [...new Set(data.itemIds.map(String))].slice(0, 50) : [];

  if (!nome || !email.includes("@") || cpf.length !== 11 || !ids.length) {
    throw new HttpsError("invalid-argument",
        "Confira nome, e-mail, CPF e os itens do carrinho.");
  }

  const snaps = await db.getAll(...ids.map((id) =>
    db.collection("products").doc(id)));
  const items = snaps.filter((s) => s.exists).map((s) => {
    const p = s.data();
    return {
      id: s.id,
      title: String(p.title || "Arquivo digital"),
      price: Number(p.price) || 0,
      image: p.image || "",
    };
  }).filter((i) => i.price > 0);

  if (!items.length) {
    throw new HttpsError("invalid-argument", "Nenhum produto válido.");
  }

  const total = Math.round(items.reduce((s, i) => s + i.price, 0) * 100) /
    100;
  const orderRef = db.collection("pedidos").doc();
  const orderId = "TM-" + Date.now();

  await orderRef.set({
    userId: request.auth.uid,
    userName: nome,
    userEmail: email,
    userCpf: cpf,
    orderId: orderId,
    items: items,
    total: total,
    status: "Aguardando Pagamento",
    paymentMethod: "Mercado Pago",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const preference = {
    items: items.map((i) => ({
      id: i.id,
      title: i.title.slice(0, 250),
      description: "Arquivo digital .studio3 para Silhouette",
      picture_url: i.image || undefined,
      category_id: "others",
      quantity: 1,
      currency_id: "BRL",
      unit_price: i.price,
    })),
    payer: {
      name: nome,
      email: email,
      identification: {type: "CPF", number: cpf},
    },
    external_reference: orderRef.id,
    notification_url: WEBHOOK_URL,
    back_urls: {
      success: `${SITE_URL}/minha-conta.html?pagamento=aprovado`,
      pending: `${SITE_URL}/minha-conta.html?pagamento=pendente`,
      failure: `${SITE_URL}/carrinho.html?pagamento=falhou`,
    },
    auto_return: "approved",
    statement_descriptor: "THEMOMENT",
    payment_methods: {
      excluded_payment_types: [{id: "ticket"}], // sem boleto
      installments: 3,
    },
    metadata: {order_id: orderId},
  };

  const resp = await fetch(`${MP_API}/checkout/preferences`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${getToken()}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": orderRef.id,
    },
    body: JSON.stringify(preference),
  });
  const body = await resp.json();

  if (!resp.ok || !body.init_point) {
    logger.error("Erro ao criar preferência", {status: resp.status, body});
    await orderRef.update({status: "Cancelado"});
    throw new HttpsError("internal",
        "Não foi possível iniciar o pagamento. Tente novamente.");
  }

  await orderRef.update({mpPreferenceId: body.id});
  return {checkoutUrl: body.init_point, orderId: orderId};
});

/**
 * Confere a assinatura enviada pelo Mercado Pago no webhook.
 * @param {object} req requisição recebida
 * @param {string} dataId id do pagamento
 * @return {boolean} true se a assinatura for válida (ou não configurada)
 */
const assinaturaValida = (req, dataId) => {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) return true; // sem segredo: seguimos, pois consultamos a API
  const header = String(req.get("x-signature") || "");
  const requestId = String(req.get("x-request-id") || "");
  const parts = {};
  header.split(",").forEach((p) => {
    const [k, v] = p.split("=").map((x) => (x || "").trim());
    if (k) parts[k] = v;
  });
  if (!parts.ts || !parts.v1) return false;
  const manifest = `id:${String(dataId).toLowerCase()};` +
    `request-id:${requestId};ts:${parts.ts};`;
  const hash = crypto.createHmac("sha256", secret)
      .update(manifest).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(hash),
        Buffer.from(parts.v1));
  } catch (e) {
    return false;
  }
};

/**
 * Recebe os avisos do Mercado Pago e atualiza o status do pedido.
 */
exports.webhookMercadoPago = onRequest(async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Método não permitido");
    return;
  }
  const body = req.body || {};
  const type = req.query.type || req.query.topic || body.type;
  const dataId = req.query["data.id"] || (body.data && body.data.id);

  if (type !== "payment" || !dataId) {
    res.status(200).send("ignorado");
    return;
  }
  if (!assinaturaValida(req, dataId)) {
    logger.warn("Assinatura inválida no webhook", {dataId});
    res.status(401).send("assinatura inválida");
    return;
  }

  try {
    // Sempre consultamos o pagamento direto no Mercado Pago
    const resp = await fetch(`${MP_API}/v1/payments/${encodeURIComponent(
        dataId)}`, {headers: {Authorization: `Bearer ${getToken()}`}});
    const pay = await resp.json();
    if (!resp.ok) {
      logger.error("Erro ao consultar pagamento", {dataId, pay});
      res.status(500).send("erro");
      return;
    }

    const ref = pay.external_reference;
    if (!ref) {
      res.status(200).send("sem referência");
      return;
    }
    const orderRef = db.collection("pedidos").doc(String(ref));
    const order = await orderRef.get();
    if (!order.exists) {
      logger.warn("Pedido não encontrado", {ref});
      res.status(200).send("pedido não encontrado");
      return;
    }

    let status = STATUS_MAP[pay.status] || "Aguardando Pagamento";
    const valorPedido = Number(order.data().total) || 0;
    if (pay.status === "approved" &&
        Math.abs(Number(pay.transaction_amount) - valorPedido) > 0.01) {
      status = "Verificar pagamento";
      logger.warn("Valor pago diferente do pedido", {ref, pay: pay.id});
    }

    await orderRef.update({
      status: status,
      mpPaymentId: String(pay.id),
      mpStatus: pay.status,
      mpStatusDetail: pay.status_detail || "",
      paymentType: pay.payment_type_id || "",
      paymentMethodId: pay.payment_method_id || "",
      paidAt: pay.date_approved || null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    logger.info("Pedido atualizado", {ref, status});
    res.status(200).send("ok");
  } catch (e) {
    logger.error("Falha no webhook", e);
    res.status(500).send("erro");
  }
});
