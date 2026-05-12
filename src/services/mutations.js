import { createId, db, saveLocal, softDeleteLocal, updateLocal } from '../db';
import { TABLES } from '../db/schema';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

export function normalizeMoney(value) {
  if (typeof value === 'number') return value;
  const normalized = String(value || '')
    .replace(/[^\d,.-]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');

  return Number(normalized || 0);
}

export function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function clampParcelas(value) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return 1;
  return Math.min(Math.max(parsed, 1), 24);
}

function addMonths(dateIso, monthsToAdd) {
  const [year, month, day] = dateIso.split('-').map(Number);
  const date = new Date(year, month - 1 + monthsToAdd, day);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function roundMoney(value) {
  return Number(Number(value || 0).toFixed(2));
}

function splitMoney(total, parts) {
  if (parts <= 0) return [];
  const base = roundMoney(total / parts);
  return Array.from({ length: parts }, (_, index) => {
    const isLast = index === parts - 1;
    return isLast ? roundMoney(total - base * (parts - 1)) : base;
  });
}

export async function createCliente({ nome, telefone, rua, numero_end, bairro, local_trabalho, observacoes }) {
  const enderecoParts = [rua, numero_end, bairro].filter(Boolean);
  const endereco = enderecoParts.join(', ');

  return saveLocal(TABLES.clientes, {
    id: createId(),
    nome: nome?.trim() ?? '',
    telefone: onlyDigits(telefone),
    endereco,
    rua: rua?.trim() ?? '',
    numero_end: numero_end?.trim() ?? '',
    bairro: bairro?.trim() ?? '',
    local_trabalho: local_trabalho?.trim() ?? '',
    observacoes: observacoes?.trim() ?? ''
  });
}

export async function updateCliente(id, { nome, telefone, rua, numero_end, bairro, local_trabalho, observacoes }) {
  const enderecoParts = [rua, numero_end, bairro].filter(Boolean);
  const endereco = enderecoParts.join(', ');

  return updateLocal(TABLES.clientes, id, {
    nome: nome?.trim() ?? '',
    telefone: onlyDigits(telefone),
    endereco,
    rua: rua?.trim() ?? '',
    numero_end: numero_end?.trim() ?? '',
    bairro: bairro?.trim() ?? '',
    local_trabalho: local_trabalho?.trim() ?? '',
    observacoes: observacoes?.trim() ?? ''
  });
}

export async function createContaComLembrete({
  clienteId,
  descricao,
  itemComprado,
  valorTotal,
  dataLembrete,
  parcelas = 1
}) {
  const quantidadeParcelas = clampParcelas(parcelas);
  const valorNumerico = normalizeMoney(valorTotal);
  const valoresParcelas = splitMoney(valorNumerico, quantidadeParcelas);

  const conta = await saveLocal(TABLES.contas, {
    id: createId(),
    cliente_id: clienteId,
    descricao: descricao?.trim() ?? '',
    item_comprado: itemComprado?.trim() ?? '',
    valor_total: valorNumerico,
    parcelas: quantidadeParcelas,
    data_criacao: new Date().toISOString().slice(0, 10)
  });

  await Promise.all(
    Array.from({ length: quantidadeParcelas }, (_, index) => {
      const parcelaNumero = index + 1;
      const valorPrevisto = valoresParcelas[index];

      return saveLocal(TABLES.lembretes, {
        id: createId(),
        cliente_id: clienteId,
        conta_id: conta.id,
        data_agendada: addMonths(dataLembrete, index),
        parcela_numero: parcelaNumero,
        valor_original: valorPrevisto,
        valor_pago: 0,
        valor_previsto: valorPrevisto,
        status: 'pendente'
      });
    })
  );

  return conta;
}

async function uploadComprovante(source, prefix = 'comprovante') {
  if (!isSupabaseConfigured || !supabase) return null;

  try {
    let file;

    if (source instanceof File) {
      file = source;
    } else if (typeof source === 'string' && source.startsWith('data:')) {
      const response = await fetch(source);
      const blob = await response.blob();
      const ext = blob.type.split('/')[1] ?? 'png';
      file = new File([blob], `${prefix}.${ext}`, { type: blob.type });
    } else {
      return null;
    }

    const ext = file.name.split('.').pop() ?? 'png';
    const fileName = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { data, error } = await supabase.storage
      .from('comprovantes')
      .upload(fileName, file, { upsert: false, cacheControl: '3600' });

    if (error) {
      console.error('Erro no upload do comprovante:', error);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from('comprovantes')
      .getPublicUrl(data.path);

    return urlData?.publicUrl ?? null;
  } catch (err) {
    console.error('Falha inesperada no upload do comprovante:', err);
    return null;
  }
}

export async function registrarPagamento({
  contaId,
  parcelaId,
  valorPago,
  metodo,
  observacao,
  comprovanteDataUrl,
  comprovanteFile
}) {
  const valorNumerico = normalizeMoney(valorPago);
  const transacao = await saveLocal(TABLES.transacoes, {
    id: createId(),
    conta_id: contaId,
    valor_pago: valorNumerico,
    data_pagamento: new Date().toISOString().slice(0, 10),
    metodo,
    observacao: observacao?.trim() ?? ''
  });

  const imagemFonte = comprovanteFile ?? comprovanteDataUrl ?? null;

  if (imagemFonte) {
    let localDataUrl = null;

    if (imagemFonte instanceof File) {
      localDataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(imagemFonte);
      });
    } else {
      localDataUrl = imagemFonte;
    }

    const urlPublica = await uploadComprovante(imagemFonte, transacao.id);

    await saveLocal(TABLES.comprovantes, {
      id: createId(),
      transacao_id: transacao.id,
      url_imagem: urlPublica || localDataUrl
    });
  }

  const ajuste = await aplicarPagamentoNasParcelas({ contaId, parcelaId, valorPago: valorNumerico });
  return { transacao, ajuste };
}

export async function resolverLembrete(lembreteId) {
  await updateLocal(TABLES.lembretes, lembreteId, {
    status: 'resolvido'
  });
}

export async function pagarParcela(cobranca, lembrete) {
  if (!cobranca || !lembrete || lembrete.status === 'resolvido') return null;

  const valorPrevisto = Number(lembrete.valor_previsto || 0);
  const valorPago = Math.min(valorPrevisto || cobranca.saldoRestante, cobranca.saldoRestante);
  if (valorPago <= 0) return null;

  const totalParcelas = Number(cobranca.conta.parcelas || cobranca.lembretesDaConta?.length || 1);
  const numeroParcela = Number(lembrete.parcela_numero || 1);

  return registrarPagamento({
    contaId: cobranca.conta.id,
    valorPago,
    metodo: 'dinheiro',
    observacao: `Parcela ${numeroParcela}/${totalParcelas}`
  });
}

function getParcelaOriginal(lembrete, valorPadrao) {
  return roundMoney(
    lembrete.valor_original ||
    (Number(lembrete.valor_pago || 0) + Number(lembrete.valor_previsto || 0)) ||
    lembrete.valor_previsto ||
    valorPadrao
  );
}

async function aplicarPagamentoNasParcelas({ contaId, parcelaId, valorPago }) {
  const conta = await db.contas.get(contaId);
  if (!conta) return { excedenteAbatido: 0 };

  const lembretes = await db.lembretes
    .where('conta_id')
    .equals(contaId)
    .filter((item) => !item.deleted_at)
    .toArray();

  const parcelas = lembretes.sort((a, b) => {
    const parcelaA = Number(a.parcela_numero || 0);
    const parcelaB = Number(b.parcela_numero || 0);
    if (parcelaA !== parcelaB) return parcelaA - parcelaB;
    return a.data_agendada.localeCompare(b.data_agendada);
  });

  const totalParcelas = Number(conta.parcelas || parcelas.length || 1);
  const valorPadrao = roundMoney(Number(conta.valor_total || 0) / totalParcelas);
  const parcelaSelecionadaIndex = parcelaId ? parcelas.findIndex((item) => item.id === parcelaId) : -1;
  const startIndex = parcelaSelecionadaIndex >= 0
    ? parcelaSelecionadaIndex
    : Math.max(parcelas.findIndex((item) => item.status !== 'resolvido'), 0);
  const parcelaSelecionada = parcelas[startIndex];
  const originalSelecionada = parcelaSelecionada ? getParcelaOriginal(parcelaSelecionada, valorPadrao) : 0;
  const pagoSelecionada = roundMoney(parcelaSelecionada?.valor_pago || 0);
  const saldoSelecionadaAntes = Math.max(roundMoney(originalSelecionada - pagoSelecionada), 0);

  let restantePagamento = roundMoney(valorPago);
  let excedenteAbatido = 0;

  for (let index = startIndex; index < parcelas.length; index += 1) {
    if (restantePagamento <= 0) break;

    const parcela = parcelas[index];
    const valorOriginal = getParcelaOriginal(parcela, valorPadrao);
    const valorPagoAtual = roundMoney(parcela.valor_pago || (parcela.status === 'resolvido' ? valorOriginal : 0));
    const saldoAtual = Math.max(roundMoney(valorOriginal - valorPagoAtual), 0);

    if (saldoAtual <= 0) {
      if (parcela.status !== 'resolvido') await resolverLembrete(parcela.id);
      continue;
    }

    const valorAplicado = Math.min(restantePagamento, saldoAtual);
    const novoValorPago = roundMoney(valorPagoAtual + valorAplicado);
    const novoSaldo = Math.max(roundMoney(valorOriginal - novoValorPago), 0);
    const novoStatus = novoSaldo <= 0.009 ? 'resolvido' : 'pendente';

    if (parcelaId && index > startIndex) {
      excedenteAbatido = roundMoney(excedenteAbatido + valorAplicado);
    }

    await updateLocal(TABLES.lembretes, parcela.id, {
      valor_original: valorOriginal,
      valor_pago: novoValorPago,
      valor_previsto: novoSaldo,
      status: novoStatus
    });

    restantePagamento = roundMoney(restantePagamento - valorAplicado);
  }

  if (parcelaId && valorPago > saldoSelecionadaAntes && excedenteAbatido <= 0) {
    excedenteAbatido = roundMoney(valorPago - saldoSelecionadaAntes);
  }

  return { excedenteAbatido: Math.max(excedenteAbatido, 0) };
}

export async function atualizarLembretesDaConta(contaId) {
  const transacoes = await db.transacoes
    .where('conta_id')
    .equals(contaId)
    .filter((item) => !item.deleted_at)
    .toArray();

  const lembretes = await db.lembretes
    .where('conta_id')
    .equals(contaId)
    .filter((item) => !item.deleted_at)
    .toArray();

  const temParcelasAlocadas = lembretes.some((item) => Number(item.valor_pago || 0) > 0);
  if (temParcelasAlocadas) return;

  for (const transacao of transacoes.sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    await aplicarPagamentoNasParcelas({ contaId, valorPago: Number(transacao.valor_pago || 0) });
  }
}
export async function resolverLembreteSeQuitado(contaId) {
  const conta = await db.contas.get(contaId);
  if (!conta) return;

  const transacoes = await db.transacoes
    .where('conta_id')
    .equals(contaId)
    .filter((item) => !item.deleted_at)
    .toArray();
  const valorPago = transacoes.reduce(
    (total, item) => total + Number(item.valor_pago || 0),
    0
  );

  if (valorPago < Number(conta.valor_total || 0)) return;

  const lembretes = await db.lembretes
    .where('conta_id')
    .equals(contaId)
    .filter((item) => item.status !== 'resolvido' && !item.deleted_at)
    .toArray();

  await Promise.all(lembretes.map((lembrete) => resolverLembrete(lembrete.id)));
}

async function getSaldoRestanteConta(contaId) {
  const conta = await db.contas.get(contaId);
  if (!conta) return { conta: null, saldoRestante: 0 };

  const transacoes = await db.transacoes
    .where('conta_id')
    .equals(contaId)
    .filter((item) => !item.deleted_at)
    .toArray();

  const valorPago = transacoes.reduce((total, item) => total + Number(item.valor_pago || 0), 0);
  const saldoRestante = Math.max(roundMoney(Number(conta.valor_total || 0) - valorPago), 0);

  return { conta, saldoRestante };
}

function buildPlanoAjustado(saldoRestante, quantidadeParcelas, valorParcela) {
  const saldo = roundMoney(saldoRestante);
  const valorMensal = roundMoney(normalizeMoney(valorParcela));

  if (saldo <= 0) return [];

  if (valorMensal > 0) {
    const plano = [];
    let restante = saldo;

    while (restante > 0.009 && plano.length < 24) {
      const valor = plano.length === 23 ? restante : Math.min(valorMensal, restante);
      plano.push(roundMoney(valor));
      restante = roundMoney(restante - valor);
    }

    return plano;
  }

  return splitMoney(saldo, clampParcelas(quantidadeParcelas));
}

async function listarParcelasAtivas(contaId) {
  const parcelas = await db.lembretes
    .where('conta_id')
    .equals(contaId)
    .filter((item) => !item.deleted_at)
    .toArray();

  return parcelas.sort((a, b) => {
    const parcelaA = Number(a.parcela_numero || 0);
    const parcelaB = Number(b.parcela_numero || 0);
    if (parcelaA !== parcelaB) return parcelaA - parcelaB;
    return a.data_agendada.localeCompare(b.data_agendada);
  });
}

async function salvarPlanoParcelas(conta, plano, primeiraData) {
  const parcelas = await listarParcelasAtivas(conta.id);
  const totalAtual = Number(conta.parcelas || parcelas.length || 1);
  const valorPadrao = roundMoney(Number(conta.valor_total || 0) / totalAtual);
  const pendentesSemPagamento = [];
  let parcelasResolvidas = 0;

  for (const parcela of parcelas) {
    const valorOriginal = getParcelaOriginal(parcela, valorPadrao);
    const valorPago = roundMoney(parcela.valor_pago || (parcela.status === 'resolvido' ? valorOriginal : 0));
    const saldoParcela = Math.max(roundMoney(valorOriginal - valorPago), 0);
    const estaResolvida = parcela.status === 'resolvido' || saldoParcela <= 0.009;

    if (estaResolvida) {
      parcelasResolvidas += 1;
      if (parcela.status !== 'resolvido') {
        await updateLocal(TABLES.lembretes, parcela.id, {
          valor_original: valorOriginal,
          valor_pago: valorOriginal,
          valor_previsto: 0,
          status: 'resolvido'
        });
      }
      continue;
    }

    if (valorPago > 0) {
      parcelasResolvidas += 1;
      await updateLocal(TABLES.lembretes, parcela.id, {
        valor_original: valorPago,
        valor_pago: valorPago,
        valor_previsto: 0,
        status: 'resolvido'
      });
      continue;
    }

    pendentesSemPagamento.push(parcela);
  }

  await Promise.all(
    plano.map((valor, index) => {
      const parcelaExistente = pendentesSemPagamento[index];
      const dados = {
        cliente_id: conta.cliente_id,
        conta_id: conta.id,
        data_agendada: addMonths(primeiraData, index),
        parcela_numero: parcelasResolvidas + index + 1,
        valor_original: valor,
        valor_pago: 0,
        valor_previsto: valor,
        status: 'pendente'
      };

      if (parcelaExistente) {
        return updateLocal(TABLES.lembretes, parcelaExistente.id, dados);
      }

      return saveLocal(TABLES.lembretes, {
        id: createId(),
        ...dados
      });
    })
  );

  const excedentes = pendentesSemPagamento.slice(plano.length);
  await Promise.all(excedentes.map((parcela) => softDeleteLocal(TABLES.lembretes, parcela.id)));

  await updateLocal(TABLES.contas, conta.id, {
    parcelas: parcelasResolvidas + plano.length
  });

  return {
    parcelasResolvidas,
    parcelasReorganizadas: plano.length,
    plano
  };
}

export async function ajustarParcelas(contaId, { quantidadeParcelas, valorParcela, primeiraData }) {
  const { conta, saldoRestante } = await getSaldoRestanteConta(contaId);
  if (!conta || saldoRestante <= 0) return { plano: [] };

  const plano = buildPlanoAjustado(saldoRestante, quantidadeParcelas, valorParcela);
  return salvarPlanoParcelas(conta, plano, primeiraData || new Date().toISOString().slice(0, 10));
}

export async function distribuirRestanteDaParcela(contaId, parcelaId) {
  const { conta, saldoRestante } = await getSaldoRestanteConta(contaId);
  if (!conta || saldoRestante <= 0) return { plano: [] };

  const parcelas = await listarParcelasAtivas(contaId);
  const parcelaAtual = parcelas.find((item) => item.id === parcelaId);
  const numeroAtual = Number(parcelaAtual?.parcela_numero || 0);
  const proximasParcelas = parcelas.filter((item) => {
    const numero = Number(item.parcela_numero || 0);
    return item.id !== parcelaId && item.status !== 'resolvido' && Number(item.valor_pago || 0) <= 0 && numero > numeroAtual;
  });

  const quantidade = proximasParcelas.length || 1;
  const primeiraData = proximasParcelas[0]?.data_agendada || addMonths(parcelaAtual?.data_agendada || new Date().toISOString().slice(0, 10), 1);
  const plano = buildPlanoAjustado(saldoRestante, quantidade, '');

  return salvarPlanoParcelas(conta, plano, primeiraData);
}

export async function deleteConta(contaId) {
  const [transacoes, lembretes] = await Promise.all([
    db.transacoes
      .where('conta_id')
      .equals(contaId)
      .filter((item) => !item.deleted_at)
      .toArray(),
    db.lembretes
      .where('conta_id')
      .equals(contaId)
      .filter((item) => !item.deleted_at)
      .toArray()
  ]);

  const comprovantes = (
    await Promise.all(
      transacoes.map((transacao) =>
        db.comprovantes
          .where('transacao_id')
          .equals(transacao.id)
          .filter((item) => !item.deleted_at)
          .toArray()
      )
    )
  ).flat();

  await Promise.all([
    ...comprovantes.map((item) => softDeleteLocal(TABLES.comprovantes, item.id)),
    ...transacoes.map((item) => softDeleteLocal(TABLES.transacoes, item.id)),
    ...lembretes.map((item) => softDeleteLocal(TABLES.lembretes, item.id)),
    softDeleteLocal(TABLES.contas, contaId)
  ]);
}

export async function deleteCliente(clienteId) {
  const contas = await db.contas
    .where('cliente_id')
    .equals(clienteId)
    .filter((item) => !item.deleted_at)
    .toArray();

  for (const conta of contas) {
    await deleteConta(conta.id);
  }

  await softDeleteLocal(TABLES.clientes, clienteId);
}
export async function getPendingSyncCount() {
  return db.syncQueue.count();
}

export async function getSyncErrorCount() {
  const tables = [
    db.clientes,
    db.contas,
    db.transacoes,
    db.lembretes,
    db.comprovantes
  ];
  const counts = await Promise.all(
    tables.map((table) => table.where('sync_status').equals('error').count())
  );

  return counts.reduce((total, count) => total + count, 0);
}

