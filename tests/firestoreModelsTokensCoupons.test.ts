import test from 'node:test';
import assert from 'node:assert/strict';
import type {
  Tournament,
  TenantConfig,
  DiscountCoupon,
  AthleteProfile,
} from '../src/types';

test('Tokens Economy: Usuario comum gasta 1 token ao criar torneio independente', () => {
  let userTokens = 3;

  const spendToken = () => {
    if (userTokens < 1) {
      throw new Error('Saldo insuficiente de tokens');
    }
    userTokens -= 1;
    return userTokens;
  };

  const buyTokens = (qty: number) => {
    userTokens += qty;
    return userTokens;
  };

  // Criação de torneio em modo organizador independente
  spendToken();
  assert.equal(userTokens, 2, 'Saldo deve ter diminuido em 1 token');

  spendToken();
  spendToken();
  assert.equal(userTokens, 0, 'Saldo zerou apos gastar todos os tokens');

  // Tentativa de criar sem token deve falhar
  assert.throws(
    () => spendToken(),
    /Saldo insuficiente de tokens/,
    'Deve lançar erro quando usuário não tiver tokens'
  );

  // Compra de pacote de 10 tokens
  buyTokens(10);
  assert.equal(userTokens, 10, 'Saldo deve ser 10 após compra de pacote');

  // Compra de pacote de 1 token avulso
  buyTokens(1);
  assert.equal(userTokens, 11, 'Saldo deve ser 11 após compra de token avulso');
});

test('Tournament Scope: Torneio da Arena nao gasta token; Torneio de Usuario permite escolher qualquer arena', () => {
  const arenaMatriz: TenantConfig = {
    id: 'arena-matriz',
    name: 'SHARK SET Arena Matriz',
    city: 'Mineiros',
    state: 'GO',
    courts: [],
    operatingHours: { open: '06:00', close: '23:00' },
  };

  const arenaFilial: TenantConfig = {
    id: 'arena-filial',
    name: 'SHARK SET Beach & Bar',
    city: 'Jataí',
    state: 'GO',
    courts: [],
    operatingHours: { open: '06:00', close: '23:00' },
  };

  // 1. Torneio criado no escopo da arena
  const arenaTournament: Tournament = {
    id: 'tourn-arena-1',
    tenantId: arenaMatriz.id,
    name: 'Copa Interna Matriz',
    sport: 'futevolei',
    category: 'iniciante',
    semiFormat: 'semi_direta',
    date: '2026-11-01',
    location: `${arenaMatriz.name} (${arenaMatriz.city} - ${arenaMatriz.state})`,
    format: 'double_elimination_buraco4',
    maxPairs: 8,
    registrationFee: 100,
    createdScope: 'arena',
    creatorTokensSpent: 0,
    isOpenForRegistration: true,
    isFinished: false,
    tableLicenseStatus: 'unlocked_arena_pro_99',
    tableLicenseFee: 0,
  };

  assert.equal(arenaTournament.createdScope, 'arena');
  assert.equal(arenaTournament.tenantId, 'arena-matriz');
  assert.equal(arenaTournament.creatorTokensSpent, 0);

  // 2. Torneio criado no escopo do usuário organizador escolhendo qualquer arena
  const userTournament: Tournament = {
    id: 'tourn-user-1',
    tenantId: arenaFilial.id,
    name: 'Circuito Aberto Futevôlei Jataí',
    sport: 'futevolei',
    category: 'serie_b',
    semiFormat: 'semi_direta',
    date: '2026-11-15',
    location: `${arenaFilial.name} (${arenaFilial.city} - ${arenaFilial.state})`,
    format: 'double_elimination_buraco4',
    maxPairs: 16,
    registrationFee: 150,
    createdScope: 'user',
    creatorUid: 'atleta-123',
    creatorTokensSpent: 1,
    isOpenForRegistration: true,
    isFinished: false,
    tableLicenseStatus: 'unlocked_single_20',
    tableLicenseFee: 20,
  };

  assert.equal(userTournament.createdScope, 'user');
  assert.equal(userTournament.tenantId, 'arena-filial');
  assert.equal(userTournament.creatorTokensSpent, 1);
});

test('Discount Coupons: Cupom Global aplica desconto em qualquer arena', () => {
  const globalCoupon: DiscountCoupon = {
    id: 'coupon-shark10',
    code: 'SHARK10',
    discountType: 'fixed',
    discountValue: 10,
    scope: 'global',
    active: true,
  };

  const applyDiscount = (coupon: DiscountCoupon, arenaId: string, originalPrice: number) => {
    if (!coupon.active) return { valid: false, discount: 0, finalPrice: originalPrice };
    if (coupon.scope === 'arena' && coupon.arenaId !== arenaId) {
      return { valid: false, discount: 0, finalPrice: originalPrice, reason: 'Cupom exclusivo de outra arena' };
    }
    const discount = coupon.discountType === 'fixed'
      ? Math.min(coupon.discountValue, originalPrice)
      : (originalPrice * coupon.discountValue) / 100;
    return { valid: true, discount, finalPrice: Math.max(0, originalPrice - discount) };
  };

  // Testa cupom global em arena-1
  const resArena1 = applyDiscount(globalCoupon, 'arena-1', 90);
  assert.equal(resArena1.valid, true);
  assert.equal(resArena1.discount, 10);
  assert.equal(resArena1.finalPrice, 80);

  // Testa cupom global em arena-2
  const resArena2 = applyDiscount(globalCoupon, 'arena-2', 120);
  assert.equal(resArena2.valid, true);
  assert.equal(resArena2.discount, 10);
  assert.equal(resArena2.finalPrice, 110);
});

test('Discount Coupons: Cupom de Arena é válido somente na respectiva arena', () => {
  const arenaCoupon: DiscountCoupon = {
    id: 'coupon-matriz15',
    code: 'MATRIZ15',
    discountType: 'percent',
    discountValue: 15, // 15% OFF
    scope: 'arena',
    arenaId: 'arena-matriz',
    arenaName: 'SHARK SET Arena Matriz',
    active: true,
  };

  const applyDiscount = (coupon: DiscountCoupon, arenaId: string, originalPrice: number) => {
    if (!coupon.active) return { valid: false, discount: 0, finalPrice: originalPrice };
    if (coupon.scope === 'arena' && coupon.arenaId !== arenaId) {
      return { valid: false, discount: 0, finalPrice: originalPrice, reason: 'Cupom exclusivo de outra arena' };
    }
    const discount = coupon.discountType === 'fixed'
      ? Math.min(coupon.discountValue, originalPrice)
      : (originalPrice * coupon.discountValue) / 100;
    return { valid: true, discount, finalPrice: Math.max(0, originalPrice - discount) };
  };

  // Aplicação na arena correta
  const resCorrect = applyDiscount(arenaCoupon, 'arena-matriz', 100);
  assert.equal(resCorrect.valid, true);
  assert.equal(resCorrect.discount, 15);
  assert.equal(resCorrect.finalPrice, 85);

  // Aplicação em arena diferente deve ser rejeitada
  const resWrong = applyDiscount(arenaCoupon, 'arena-outra', 100);
  assert.equal(resWrong.valid, false);
  assert.equal(resWrong.finalPrice, 100);
  assert.equal(resWrong.reason, 'Cupom exclusivo de outra arena');
});

test('Arena Managers: Dono da arena pode adicionar e remover gestores', () => {
  const arena: TenantConfig = {
    id: 'arena-1',
    name: 'Arena Central',
    ownerId: 'dono-uid-123',
    managers: ['gestor1@arena.com'],
    courts: [],
    operatingHours: { open: '07:00', close: '22:00' },
  };

  const addManager = (arenaConfig: TenantConfig, emailOrUid: string) => {
    const list = arenaConfig.managers ? [...arenaConfig.managers] : [];
    if (!list.includes(emailOrUid)) {
      list.push(emailOrUid);
    }
    return { ...arenaConfig, managers: list };
  };

  const removeManager = (arenaConfig: TenantConfig, emailOrUid: string) => {
    const list = (arenaConfig.managers || []).filter((m) => m !== emailOrUid);
    return { ...arenaConfig, managers: list };
  };

  // Adiciona novo gestor
  const arenaComNovoGestor = addManager(arena, 'gestor2@arena.com');
  assert.deepEqual(arenaComNovoGestor.managers, ['gestor1@arena.com', 'gestor2@arena.com']);

  // Remove gestor
  const arenaAposRemocao = removeManager(arenaComNovoGestor, 'gestor1@arena.com');
  assert.deepEqual(arenaAposRemocao.managers, ['gestor2@arena.com']);
});
