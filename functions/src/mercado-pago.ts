import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';

const TOKEN_PRICE_CENTS = 1990;
const SITE_URL = 'https://sharkset.web.app';
const WEBHOOK_URL = 'https://us-central1-sharkset-70de4.cloudfunctions.net/mercadoPagoWebhook';

interface TokenOrderRequest { uid: string; email: string; quantity: number }
interface NotificationInput {
  accessToken: string;
  webhookSecret: string;
  signature: string;
  requestId: string;
  dataId: string;
}

function verifySignature(input: NotificationInput): boolean {
  if (!input.signature || !input.requestId || !input.dataId) return false;
  const parts = new Map(input.signature.split(',').map(part => {
    const separator = part.indexOf('=');
    return separator > 0 ? [part.slice(0, separator).trim(), part.slice(separator + 1).trim()] : ['', ''];
  }));
  const timestamp = parts.get('ts');
  const provided = parts.get('v1');
  if (!timestamp || !provided || !/^\d+$/.test(timestamp) || !/^[a-f\d]{64}$/i.test(provided)) return false;
  if (Number(timestamp) > Date.now() + 5 * 60_000) return false;
  const manifest = `id:${input.dataId};request-id:${input.requestId};ts:${timestamp};`;
  const expected = createHmac('sha256', input.webhookSecret).update(manifest).digest();
  const actual = Buffer.from(provided, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function createTokenOrder(db: Firestore, accessToken: string, input: TokenOrderRequest) {
  if (!accessToken) throw new Error('Mercado Pago access token is not configured.');
  const orderId = randomUUID();
  const amountCents = TOKEN_PRICE_CENTS * input.quantity;
  const orderRef = db.doc(`token_orders/${orderId}`);
  await orderRef.create({
    id: orderId,
    uid: input.uid,
    quantity: input.quantity,
    amountCents,
    currency: 'BRL',
    provider: 'mercado_pago',
    status: 'creating',
    createdAt: FieldValue.serverTimestamp(),
  });

  try {
    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': orderId,
      },
      body: JSON.stringify({
        items: [{
          id: 'tournament-token',
          title: input.quantity === 1 ? 'Token de campeonato SHARKSET' : `${input.quantity} tokens de campeonato SHARKSET`,
          description: 'Cada token dá direito à criação de um campeonato com tabela, transmissões e relatório final.',
          quantity: input.quantity,
          currency_id: 'BRL',
          unit_price: TOKEN_PRICE_CENTS / 100,
        }],
        payer: input.email ? { email: input.email } : undefined,
        external_reference: orderId,
        notification_url: WEBHOOK_URL,
        back_urls: {
          success: `${SITE_URL}/?token_payment=success`,
          pending: `${SITE_URL}/?token_payment=pending`,
          failure: `${SITE_URL}/?token_payment=failure`,
        },
        auto_return: 'approved',
        metadata: { order_id: orderId, uid: input.uid, quantity: input.quantity },
      }),
    });
    const result = await response.json() as { id?: string; init_point?: string; sandbox_init_point?: string };
    const checkoutUrl = result.init_point || result.sandbox_init_point;
    if (!response.ok || !result.id || !checkoutUrl) throw new Error('Mercado Pago preference creation failed.');
    await db.runTransaction(async transaction => {
      const snapshot = await transaction.get(orderRef);
      if (!snapshot.exists) throw new Error('Token order disappeared.');
      const patch = {
        preferenceId: result.id,
        checkoutUrl,
        updatedAt: FieldValue.serverTimestamp(),
        ...(snapshot.data()?.status === 'approved' ? {} : { status: 'pending' }),
      };
      transaction.update(orderRef, patch);
    });
    return { orderId, checkoutUrl };
  } catch (error) {
    await orderRef.update({ status: 'failed', updatedAt: FieldValue.serverTimestamp() });
    throw error;
  }
}

export async function processMercadoPagoNotification(db: Firestore, input: NotificationInput): Promise<void> {
  if (!input.accessToken || !input.webhookSecret || !verifySignature(input)) return;
  if (!/^\d{1,24}$/.test(input.dataId)) return;

  const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(input.dataId)}`, {
    headers: { Authorization: `Bearer ${input.accessToken}` },
  });
  if (response.status >= 500 || response.status === 429) throw new Error('Mercado Pago payment lookup temporarily failed.');
  if (!response.ok) return;
  const payment = await response.json() as {
    id?: number;
    status?: string;
    external_reference?: string;
    transaction_amount?: number;
    currency_id?: string;
  };
  const orderId = payment.external_reference;
  if (!orderId || !/^[\da-f-]{36}$/i.test(orderId) || String(payment.id) !== input.dataId) return;

  const orderRef = db.doc(`token_orders/${orderId}`);
  const receiptRef = db.doc(`mercado_pago_payments/${input.dataId}`);
  await db.runTransaction(async transaction => {
    const [orderSnapshot, receiptSnapshot] = await Promise.all([
      transaction.get(orderRef),
      transaction.get(receiptRef),
    ]);
    if (!orderSnapshot.exists || receiptSnapshot.exists) return;
    const order = orderSnapshot.data()!;
    if (order.status === 'approved') return;
    if (payment.status !== 'approved') return;
    const expectedAmount = Number(order.amountCents) / 100;
    const isCorrectPayment = payment.status === 'approved' && payment.currency_id === 'BRL' &&
      Number(payment.transaction_amount) === expectedAmount && order.provider === 'mercado_pago' &&
      Number.isInteger(order.quantity) && Number(order.quantity) > 0 &&
      expectedAmount === (Number(order.quantity) * TOKEN_PRICE_CENTS) / 100;
    if (!isCorrectPayment) return;
    const profileRef = db.doc(`user_profiles/${String(order.uid)}`);
    const profileSnapshot = await transaction.get(profileRef);
    if (!profileSnapshot.exists) throw new Error('User profile is not ready for token credit.');

    transaction.create(receiptRef, {
      paymentId: input.dataId,
      orderId,
      status: String(payment.status || 'unknown'),
      receivedAt: FieldValue.serverTimestamp(),
    });
    const currentTokens = Number(profileSnapshot.data()?.tournamentTokens || 0);
    const quantity = Number(order.quantity);
    transaction.update(profileRef, { tournamentTokens: currentTokens + quantity });
    transaction.update(orderRef, {
      status: 'approved',
      paymentId: input.dataId,
      approvedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.create(db.doc(`user_profiles/${String(order.uid)}/token_ledger/${orderId}`), {
      id: orderId,
      type: 'purchase',
      quantity,
      amountCents: Number(order.amountCents),
      currency: 'BRL',
      provider: 'mercado_pago',
      paymentId: input.dataId,
      orderId,
      createdAt: FieldValue.serverTimestamp(),
    });
  });
}
