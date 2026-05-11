import { createId, db, saveLocal, updateLocal } from '../db';
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
  const valorParcela = Number((valorNumerico / quantidadeParcelas).toFixed(2));

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
      const isLast = parcelaNumero === quantidadeParcelas;
      const valorPrevisto = isLast
        ? Number((valorNumerico - valorParcela * (quantidadeParcelas - 1)).toFixed(2))
        : valorParcela;

      return saveLocal(TABLES.lembretes, {
        id: createId(),
        cliente_id: clienteId,
        conta_id: conta.id,
        data_agendada: addMonths(dataLembrete, index),
        parcela_numero: parcelaNumero,
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
  valorPago,
  metodo,
  observacao,
  comprovanteDataUrl,
  comprovanteFile
}) {
  const transacao = await saveLocal(TABLES.transacoes, {
    id: createId(),
    conta_id: contaId,
    valor_pago: normalizeMoney(valorPago),
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

  await resolverLembreteSeQuitado(contaId);
  return transacao;
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

  const transacao = await registrarPagamento({
    contaId: cobranca.conta.id,
    valorPago,
    metodo: 'dinheiro',
    observacao: `Parcela ${numeroParcela}/${totalParcelas}`
  });

  await resolverLembrete(lembrete.id);
  await resolverLembreteSeQuitado(cobranca.conta.id);
  return transacao;
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
