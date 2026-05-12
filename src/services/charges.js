import { db } from '../db';

function toDateOnly(value) {
  return new Date(`${value}T00:00:00`);
}

function roundMoney(value) {
  return Number(Number(value || 0).toFixed(2));
}

export function getChargeStatus(lembrete, saldoRestante, todayIso) {
  if (saldoRestante <= 0) return 'pago';
  if (!lembrete) return 'pendente';
  if (lembrete.data_agendada < todayIso) return 'atrasado';
  if (lembrete.data_agendada === todayIso) return 'hoje';
  return 'pendente';
}

function buildParcelas(conta, lembretesDaConta, totalPago) {
  const totalParcelas = Number(conta.parcelas || lembretesDaConta.length || 1);
  const valorPadrao = roundMoney(Number(conta.valor_total || 0) / totalParcelas);
  let creditoLegado = totalPago;

  return lembretesDaConta.map((lembrete, index) => {
    const valorOriginal = roundMoney(
      lembrete.valor_original ||
      (Number(lembrete.valor_pago || 0) + Number(lembrete.valor_previsto || 0)) ||
      lembrete.valor_previsto ||
      valorPadrao
    );

    let valorPagoParcela = roundMoney(lembrete.valor_pago || 0);

    if (!lembrete.valor_pago && lembrete.status === 'resolvido') {
      valorPagoParcela = valorOriginal;
    }

    if (valorPagoParcela > 0) {
      creditoLegado = roundMoney(Math.max(creditoLegado - valorPagoParcela, 0));
    } else if (totalPago > 0) {
      const abatimento = Math.min(creditoLegado, valorOriginal);
      valorPagoParcela = roundMoney(abatimento);
      creditoLegado = roundMoney(creditoLegado - abatimento);
    }

    const saldoParcela = Math.max(roundMoney(valorOriginal - valorPagoParcela), 0);
    const estaPaga = saldoParcela <= 0.009 || lembrete.status === 'resolvido';
    const statusVisual = estaPaga
      ? 'paga'
      : valorPagoParcela > 0
        ? 'parcial'
        : 'pendente';

    return {
      ...lembrete,
      parcela_numero: Number(lembrete.parcela_numero || index + 1),
      valor_original: valorOriginal,
      valor_pago: valorPagoParcela,
      valor_previsto: saldoParcela,
      saldo_parcela: saldoParcela,
      statusVisual
    };
  });
}

export async function getDashboardData(todayIso = new Date().toISOString().slice(0, 10)) {
  const [clientes, contas, transacoes, lembretes, comprovantes, syncQueue] =
    await Promise.all([
      db.clientes.toArray(),
      db.contas.toArray(),
      db.transacoes.toArray(),
      db.lembretes.toArray(),
      db.comprovantes.toArray(),
      db.syncQueue.toArray()
    ]);

  const activeClientes = clientes.filter((cliente) => !cliente.deleted_at);
  const activeContas = contas.filter((conta) => !conta.deleted_at);
  const activeTransacoes = transacoes.filter((transacao) => !transacao.deleted_at);
  const activeLembretes = lembretes.filter((lembrete) => !lembrete.deleted_at);
  const activeComprovantes = comprovantes.filter((comprovante) => !comprovante.deleted_at);

  const clientesById = new Map(activeClientes.map((cliente) => [cliente.id, cliente]));
  const transacoesByConta = activeTransacoes.reduce((acc, transacao) => {
    const items = acc.get(transacao.conta_id) ?? [];
    items.push({
      ...transacao,
      comprovante: activeComprovantes.find(
        (comprovante) => comprovante.transacao_id === transacao.id
      )
    });
    acc.set(transacao.conta_id, items);
    return acc;
  }, new Map());

  const cobrancas = activeContas
    .map((conta) => {
      const cliente = clientesById.get(conta.cliente_id);
      const transacoesDaConta = transacoesByConta.get(conta.id) ?? [];
      const valorPago = roundMoney(transacoesDaConta.reduce(
        (total, transacao) => total + Number(transacao.valor_pago || 0),
        0
      ));
      const saldoRestante = Math.max(roundMoney(Number(conta.valor_total) - valorPago), 0);
      const lembretesOriginais = activeLembretes
        .filter((item) => item.conta_id === conta.id)
        .sort((a, b) => {
          const parcelaA = Number(a.parcela_numero || 0);
          const parcelaB = Number(b.parcela_numero || 0);
          if (parcelaA !== parcelaB) return parcelaA - parcelaB;
          return a.data_agendada.localeCompare(b.data_agendada);
        });
      const parcelasDaConta = buildParcelas(conta, lembretesOriginais, valorPago);
      const lembrete = parcelasDaConta.find((item) => item.saldo_parcela > 0.009);

      if (!cliente) return null;

      const status = getChargeStatus(lembrete, saldoRestante, todayIso);
      const diasAtraso =
        status === 'atrasado'
          ? Math.floor((toDateOnly(todayIso) - toDateOnly(lembrete.data_agendada)) / 86400000)
          : 0;

      return {
        conta,
        cliente,
        lembrete,
        parcelasDaConta,
        lembretesDaConta: parcelasDaConta,
        transacoes: transacoesDaConta.sort((a, b) =>
          b.data_pagamento.localeCompare(a.data_pagamento)
        ),
        valorPago,
        saldoRestante,
        status,
        diasAtraso,
        quitada: saldoRestante <= 0
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.status === 'atrasado' && b.status !== 'atrasado') return -1;
      if (a.status !== 'atrasado' && b.status === 'atrasado') return 1;
      const aDate = a.lembrete?.data_agendada ?? '9999-12-31';
      const bDate = b.lembrete?.data_agendada ?? '9999-12-31';
      return aDate.localeCompare(bDate);
    });

  const cobrancasAbertas = cobrancas.filter((item) => item.saldoRestante > 0);
  const totalAReceber = cobrancasAbertas.reduce(
    (total, item) => total + item.saldoRestante,
    0
  );
  const atrasados = cobrancasAbertas.filter((item) => item.status === 'atrasado');
  const cobrancasDoDia = cobrancasAbertas.filter((item) => item.status === 'hoje');
  const clientesComResumo = activeClientes.map((cliente) => {
    const contasCliente = cobrancas.filter((item) => item.cliente.id === cliente.id);
    return {
      ...cliente,
      contas: contasCliente,
      saldoAberto: contasCliente.reduce((total, item) => total + item.saldoRestante, 0)
    };
  });

  return {
    totalAReceber,
    quantidadeAtrasados: atrasados.length,
    cobrancasDoDia,
    cobrancas,
    clientes: clientesComResumo,
    lembretes: cobrancas.filter((item) => item.lembrete && !item.quitada),
    syncPendentes: syncQueue.length
  };
}

