const functions = require("firebase-functions");
const admin = require("firebase-admin");
const mercadopago = require("mercadopago");

// Inicializa o app do Firebase Admin (necessário para mexer com usuários)
admin.initializeApp();

// Carrega as variáveis de ambiente (sua chave do Mercado Pago)
require("dotenv").config();
mercadopago.configure({
    access_token: process.env.MERCADOPAGO_ACCESS_TOKEN,
});

/**
 * Cloud Function para dar o privilégio de admin a um usuário.
 * Ela recebe um e-mail e adiciona a etiqueta { admin: true } a ele.
 */
exports.setAdminRole = functions.https.onCall(async (data, context) => {
    // Medida de segurança: Futuramente, podemos checar se quem chama já é admin.
    // if (context.auth.token.admin !== true) {
    //     return { error: "Apenas administradores podem adicionar outros administradores." };
    // }
    
    try {
        const user = await admin.auth().getUserByEmail(data.email);
        await admin.auth().setCustomUserClaims(user.uid, { admin: true });
        return { message: `Sucesso! O usuário ${data.email} agora é um administrador.` };
    } catch (error) {
        console.error(error);
        return { error: "Ocorreu um erro ao definir o usuário como admin." };
    }
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