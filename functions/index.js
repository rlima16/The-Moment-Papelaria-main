const functions = require("firebase-functions");
const mercadopago = require("mercadopago");

// Configura o Mercado Pago com o Access Token que guardamos de forma segura
mercadopago.configure({
  access_token: functions.config().mercadopago.token,
});

// Nossa função principal que será chamada pelo site
exports.createPaymentPreference = functions.https.onCall(async (data, context) => {
  // Verifica se o usuário que está chamando a função está logado
  if (!context.auth) {
    throw new functions.https.HttpsError(
        "unauthenticated",
        "Você precisa estar logado para criar um pedido.",
    );
  }

  // Pega os itens do carrinho que o site enviou
  const cartItems = data.items;
  if (!cartItems || cartItems.length === 0) {
    throw new functions.https.HttpsError(
        "invalid-argument",
        "O carrinho não pode estar vazio.",
    );
  }

  // Monta o objeto de preferência de pagamento para o Mercado Pago
  const preference = {
    items: cartItems.map((item) => ({
      title: item.title,
      unit_price: Number(item.price),
      quantity: 1,
      currency_id: "BRL",
    })),
    back_urls: {
      // URLs para onde o cliente será redirecionado após o pagamento
      success: "https://r1ina16.github.io/carrinho.html?status=success", // Substitua pelo seu link
      failure: "https://r1ina16.github.io/carrinho.html?status=failure", // Substitua pelo seu link
      pending: "https://r1ina16.github.io/carrinho.html?status=pending", // Substitua pelo seu link
    },
    auto_return: "approved",
  };

  try {
    // Tenta criar a preferência de pagamento no Mercado Pago
    const response = await mercadopago.preferences.create(preference);
    
    // Se deu certo, devolve o link de pagamento para o site
    return {
      preferenceId: response.body.id,
      init_point: response.body.init_point,
    };
  } catch (error) {
    console.error("Erro ao criar preferência no Mercado Pago:", error);
    throw new functions.https.HttpsError(
        "internal",
        "Não foi possível criar a preferência de pagamento.",
    );
  }
});