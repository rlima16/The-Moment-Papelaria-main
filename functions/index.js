// Importa as ferramentas necessárias
const functions = require("firebase-functions");
const mercadopago = require("mercadopago");
const cors = require("cors")({ origin: true });

// Carrega as variáveis de ambiente do arquivo .env
require("dotenv").config();

// Configura o Mercado Pago com a sua chave secreta
mercadopago.configure({
    access_token: process.env.MERCADOPAGO_ACCESS_TOKEN,
});

/**
 * Cloud Function que cria uma preferência de pagamento no Mercado Pago.
 * Ela é chamada pelo nosso site (front-end).
 */
exports.createPaymentPreference = functions.https.onCall(async (data, context) => {
    // 'data' contém as informações que nosso site enviou (o item do carrinho)
    const item = data.item;

    // Objeto de preferência que enviaremos ao Mercado Pago
    const preference = {
        items: [{
            title: item.title,
            unit_price: item.price,
            quantity: 1,
        }],
        // URLs para onde o cliente será redirecionado
        back_urls: {
            success: "https://rlima16.github.io/The-Moment-Papelaria-main/carrinho.html?status=success", // URL do seu site ao vivo
            failure: "https://rlima16.github.io/The-Moment-Papelaria-main/carrinho.html?status=failure",
            pending: "https://rlima16.github.io/The-Moment-Papelaria-main/carrinho.html?status=pending",
        },
        auto_return: "approved", // Retorna automaticamente para o site após pagamento aprovado
    };

    try {
        const response = await mercadopago.preferences.create(preference);
        console.log("Preferência de pagamento criada:", response.body);

        // Retorna o link de checkout para o nosso site
        return {
            checkoutUrl: response.body.init_point,
        };
    } catch (error) {
        console.error("Erro ao criar preferência de pagamento:", error);
        throw new functions.https.HttpsError("internal", "Não foi possível criar a preferência de pagamento.");
    }
});