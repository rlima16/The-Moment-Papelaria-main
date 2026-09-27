# Servidor de pagamentos no Cloudflare (grátis, sem cartão)

Este Worker substitui o Firebase Functions (que exige o plano Blaze).
Ele cria o link de pagamento do Mercado Pago e marca o pedido como "Pago" sozinho.

## 1. Criar o Worker
> Já feito: o Worker `the-moment-papelaria-main` está ligado ao GitHub. A cada push o Cloudflare publica
> automaticamente o `worker.js` (configurado no arquivo `wrangler.toml` na raiz do projeto).
> Endereço: https://the-moment-papelaria-main.rodrigoalveslima5533.workers.dev

(Forma manual, caso precise refazer:)
1. Crie uma conta grátis em https://dash.cloudflare.com/sign-up
2. Menu **Workers e Pages** > **Criar** > **Criar Worker**
3. Nome: `pagamentos-themoment` > **Implantar (Deploy)**
4. Clique em **Editar código**, apague tudo, cole o conteúdo de `worker.js` e clique em **Implantar**
5. Anote o endereço do Worker (ex.: `https://pagamentos-themoment.SEUNOME.workers.dev`)
   Abrindo esse endereço no navegador deve aparecer: "Servidor de pagamentos The Moment: online ✅"

## 2. Chave da conta de serviço do Firebase
1. Console do Firebase > ⚙️ Configurações do projeto > **Contas de serviço**
2. **Gerar nova chave privada** > baixa um arquivo `.json`
3. ⚠️ NÃO coloque esse arquivo na pasta do site (ele iria para a internet). Guarde em outro lugar.

## 3. Segredos do Worker
No Worker: **Configurações > Variáveis e segredos > Adicionar** (tipo **Secret**/Segredo):
| Nome | Valor |
|---|---|
| `MP_ACCESS_TOKEN` | Access Token do Mercado Pago (`TEST-...` para testes, `APP_USR-...` para vender) |
| `FIREBASE_SA` | Todo o conteúdo do arquivo `.json` baixado no passo 2 (abra no Bloco de Notas e copie tudo) |
| `MP_WEBHOOK_SECRET` | Assinatura secreta do webhook (passo 4) |

## 4. Webhook no Mercado Pago
Mercado Pago Developers > Suas integrações > sua aplicação > **Webhooks** > Configurar notificações
- URL: `https://the-moment-papelaria-main.rodrigoalveslima5533.workers.dev/webhook` (modo de teste e de produção)
- Evento: **Pagamentos** > Salvar
- Copie a **assinatura secreta** e cadastre como `MP_WEBHOOK_SECRET` (passo 3)

## 5. Ligar o site ao Worker
Em `cart-page.js`, troque `https://COLE-AQUI-O-ENDERECO.workers.dev` pelo endereço do passo 1.
