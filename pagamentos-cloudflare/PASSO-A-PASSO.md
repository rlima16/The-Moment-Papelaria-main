# Pagamento com cartão (Mercado Pago) — passo a passo simples

O servidor de pagamentos já está publicado no Cloudflare (ligado ao GitHub).
Endereço: https://the-moment-papelaria-main.rodrigoalveslima5533.workers.dev

## Único passo obrigatório: cadastrar o token do Mercado Pago
1. Cloudflare > Compute > Workers & Pages > the-moment-papelaria-main
2. Aba **Settings** > **Variables and Secrets** > **+ Add**
3. Type: **Secret** | Variable name: `MP_ACCESS_TOKEN` | Value: o Access Token do Mercado Pago
4. Clique em **Deploy**

Pronto: o cliente já consegue pagar com cartão de crédito, débito ou Pix.
Os pagamentos aparecem no app/painel do Mercado Pago com o número do pedido (TM-...).
Depois de conferir, mude o status do pedido para "Pago" como vocês já fazem com o Pix.

## Opcional (depois): status "Pago" automático
Cadastre também `FIREBASE_SA` (JSON da conta de serviço do Firebase) e `MP_WEBHOOK_SECRET`
(assinatura do webhook, URL: .../webhook). Peça ajuda ao Claude quando quiser ativar.
