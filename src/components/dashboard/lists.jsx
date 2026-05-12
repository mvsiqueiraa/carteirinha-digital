import {
  CheckCircle2,
  Circle,
  Clock,
  CreditCard,
  FileImage,
  FileText,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Trash2,
  WalletCards
} from 'lucide-react';
import { formatDate, formatMoney, formatPhone, getWhatsAppUrl, statusLabel, statusStyles, todayIso } from '../../utils/format';
import { EmptyState } from './ui';

function getParcelasResumo(cobranca) {
  const total = Number(cobranca.conta.parcelas || cobranca.lembretesDaConta?.length || 1);
  const pagas = (cobranca.lembretesDaConta || []).filter((item) => item.statusVisual === 'paga' || item.status === 'resolvido').length;
  const parciais = (cobranca.lembretesDaConta || []).filter((item) => item.statusVisual === 'parcial').length;
  return { total, pagas, parciais, faltam: Math.max(total - pagas, 0) };
}

function getParcelaStatus(lembrete, today) {
  if (lembrete.statusVisual === 'paga' || lembrete.status === 'resolvido') {
    return { label: 'Paga', className: 'bg-green-100 text-app-green' };
  }

  if (lembrete.statusVisual === 'parcial') {
    return { label: 'Parcial', className: 'bg-app-coralSoft text-app-coralDark' };
  }

  if (lembrete.data_agendada < today) {
    return { label: 'Atrasada', className: 'bg-red-50 text-app-red' };
  }

  if (lembrete.data_agendada === today) {
    return { label: 'Vence hoje', className: 'bg-yellow-50 text-app-yellow' };
  }

  return { label: 'Pendente', className: 'bg-app-paper text-app-muted' };
}

function ParcelaSchedule({ cobranca, onPayInstallment, onDistributePartial }) {
  const { total, pagas, parciais, faltam } = getParcelasResumo(cobranca);
  const today = todayIso();
  if (total <= 1) return null;

  return (
    <div className="rounded-lg border border-app-line bg-white p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="font-black">Parcelas</h4>
          <p className="text-sm font-bold text-app-muted">{pagas} pagas, {parciais} parciais, {faltam} faltando</p>
        </div>
        <span className="rounded-full bg-app-coralSoft px-3 py-1 text-sm font-black text-app-coralDark">{pagas}/{total}</span>
      </div>

      <div className="mt-3 space-y-2">
        {cobranca.lembretesDaConta.map((lembrete, index) => {
          const numero = Number(lembrete.parcela_numero || index + 1);
          const paga = lembrete.statusVisual === 'paga' || lembrete.status === 'resolvido';
          const valorOriginal = Number(lembrete.valor_original || cobranca.conta.valor_total / total);
          const valorPago = Number(lembrete.valor_pago || 0);
          const saldoParcela = Number(lembrete.saldo_parcela ?? lembrete.valor_previsto ?? valorOriginal);
          const status = getParcelaStatus(lembrete, today);

          return (
            <div key={lembrete.id} className={`rounded-lg border p-3 ${paga ? 'border-green-100 bg-green-50' : 'border-app-line bg-app-paper'}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  {paga ? <CheckCircle2 className="shrink-0 text-app-green" size={20} /> : <Circle className="shrink-0 text-app-muted" size={20} />}
                  <div className="min-w-0">
                    <p className="font-black">Parcela {numero}/{total}</p>
                    <p className="text-xs font-bold text-app-muted">Vencimento {formatDate(lembrete.data_agendada)}</p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <strong className={paga ? 'block text-app-green' : 'block text-app-coralDark'}>{formatMoney(valorOriginal)}</strong>
                  <span className={`mt-1 inline-block rounded-full px-2 py-1 text-[11px] font-black uppercase ${status.className}`}>{status.label}</span>
                </div>
              </div>

              {valorPago > 0 && !paga ? (
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs font-black">
                  <p className="rounded-md bg-white px-2 py-1 text-app-green">Pago {formatMoney(valorPago)}</p>
                  <p className="rounded-md bg-white px-2 py-1 text-app-coralDark">Falta {formatMoney(saldoParcela)}</p>
                </div>
              ) : null}

              {!paga && !cobranca.quitada ? (
                <div className="mt-3 grid gap-2">
                  <button className="h-10 w-full rounded-lg bg-app-coral text-sm font-black text-white" onClick={() => onPayInstallment?.(lembrete)} type="button">
                    {valorPago > 0 ? 'Receber restante' : 'Receber parcela'}
                  </button>
                  {valorPago > 0 && onDistributePartial ? (
                    <button className="h-10 w-full rounded-lg border border-app-line bg-white text-sm font-black text-app-coralDark" onClick={() => onDistributePartial(lembrete)} type="button">
                      Distribuir restante nas proximas parcelas
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ChargesList({ cobrancas, onCreate, onDetail, onPayment }) {
  if (cobrancas.length === 0) {
    return <EmptyState title="Nenhuma cobranca aqui" text="Crie uma anotacao de venda para acompanhar o saldo e lembrar de cobrar." action="Nova cobranca" onAction={onCreate} />;
  }

  return (
    <div className="space-y-3">
      {cobrancas.map((cobranca) => {
        const { total, pagas } = getParcelasResumo(cobranca);
        const receiveLabel = cobranca.lembrete ? 'Receber parcela' : 'Receber';

        return (
          <article key={cobranca.conta.id} className="notebook-paper rounded-lg border border-app-line p-4 shadow-note">
            <div className="flex items-start justify-between gap-3 border-b border-dashed border-app-line pb-3">
              <button className="min-w-0 text-left" onClick={() => onDetail(cobranca)} type="button">
                <h3 className="truncate text-xl font-black">{cobranca.cliente.nome}</h3>
                <p className="mt-1 text-sm font-semibold text-app-muted">Tel. {formatPhone(cobranca.cliente.telefone)}</p>
              </button>
              <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-black uppercase ${statusStyles(cobranca.status)}`}>{statusLabel(cobranca)}</span>
            </div>

            <button className="mt-3 w-full rounded-md bg-white/70 px-3 py-2 text-left" onClick={() => onDetail(cobranca)} type="button">
              <p className="text-xs font-black uppercase text-app-muted">Comprou</p>
              <p className="mt-1 text-base font-bold">{cobranca.conta.item_comprado || cobranca.conta.descricao}</p>
            </button>

            <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
              <div className="rounded-md bg-white/75 p-2"><dt className="text-xs font-bold text-app-muted">Total</dt><dd className="mt-1 font-black">{formatMoney(cobranca.conta.valor_total)}</dd></div>
              <div className="rounded-md bg-white/75 p-2"><dt className="text-xs font-bold text-app-muted">Pago</dt><dd className="mt-1 font-black text-app-green">{formatMoney(cobranca.valorPago)}</dd></div>
              <div className="rounded-md bg-app-coralSoft p-2"><dt className="text-xs font-bold text-app-coralDark">Saldo</dt><dd className="mt-1 font-black text-app-coralDark">{formatMoney(cobranca.saldoRestante)}</dd></div>
            </dl>

            {total > 1 ? (
              <div className="mt-3 rounded-lg border border-app-line bg-white/80 px-3 py-2 text-sm font-black text-app-muted">
                Parcelas: <span className="text-app-coralDark">{pagas}/{total} pagas</span>
              </div>
            ) : null}

            {cobranca.lembrete?.data_agendada && !cobranca.quitada ? (
              <div className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-app-line border-dashed bg-white py-2">
                <Clock size={16} className="text-app-muted" />
                <p className="text-sm font-bold text-app-muted">
                  Proxima parcela: <span className="font-black text-app-coralDark">{formatDate(cobranca.lembrete.data_agendada)}</span>
                </p>
              </div>
            ) : null}

            <div className="mt-3 grid gap-2">
              <button className="flex h-12 items-center justify-center gap-2 rounded-lg bg-app-coral px-3 font-black text-white disabled:bg-app-muted" onClick={() => onPayment(cobranca)} type="button" disabled={cobranca.quitada}>
                <WalletCards size={20} /> {receiveLabel}
              </button>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <button className="flex h-11 items-center justify-center gap-2 rounded-lg border border-app-line bg-white px-3 text-sm font-black text-app-coralDark" onClick={() => onDetail(cobranca)} type="button">
                  <FileText size={18} /> Ver detalhes da cobranca
                </button>
                <a className="flex h-11 w-12 items-center justify-center rounded-lg border border-app-line bg-white text-app-coralDark" href={getWhatsAppUrl(cobranca.cliente, cobranca)} target="_blank" rel="noreferrer" aria-label="Abrir WhatsApp">
                  <MessageCircle size={21} />
                </a>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function ClientsList({ clientes, onCreate, onDetail, onEdit }) {
  if (clientes.length === 0) {
    return <EmptyState title="Nenhum cliente cadastrado" text="Salve nome, telefone, endereco e observacoes para cobrar mais rapido." action="Cadastrar cliente" onAction={onCreate} />;
  }

  return (
    <div className="space-y-3">
      {clientes.map((cliente) => (
        <article key={cliente.id} className="rounded-lg border border-app-line bg-white p-4 shadow-note">
          <div className="flex items-start justify-between gap-3">
            <button className="min-w-0 text-left" onClick={() => onDetail(cliente)} type="button">
              <h3 className="truncate text-lg font-black">{cliente.nome}</h3>
              <p className="mt-1 flex items-center gap-1 text-sm font-bold text-app-muted"><Phone size={14} /> {formatPhone(cliente.telefone)}</p>
              {cliente.endereco ? <p className="mt-1 flex items-center gap-1 text-sm font-bold text-app-muted"><MapPin size={14} /> {cliente.endereco}</p> : null}
            </button>
            <div className="flex shrink-0 items-center gap-2">
              <button className="flex h-11 w-11 items-center justify-center rounded-lg border border-app-line bg-white text-app-muted" onClick={() => onEdit(cliente)} type="button" aria-label="Editar cliente">
                <Pencil size={17} />
              </button>
              <a className="flex h-11 w-11 items-center justify-center rounded-lg bg-app-coralSoft text-app-coralDark" href={getWhatsAppUrl(cliente)} target="_blank" rel="noreferrer" aria-label="Abrir WhatsApp">
                <MessageCircle size={19} />
              </a>
            </div>
          </div>
          <div className="mt-3 rounded-md bg-app-paper px-3 py-2">
            <p className="text-xs font-black uppercase text-app-muted">Saldo aberto</p>
            <strong className="text-xl font-black text-app-coralDark">{formatMoney(cliente.saldoAberto)}</strong>
          </div>
        </article>
      ))}
    </div>
  );
}

export function RemindersList({ lembretes, onPayment }) {
  if (lembretes.length === 0) {
    return <EmptyState title="Agenda vazia" text="As cobrancas de hoje, atrasadas e proximas aparecem aqui." />;
  }

  const resumo = [
    ['Atrasadas', lembretes.filter((item) => item.status === 'atrasado').length, 'text-app-red'],
    ['Hoje', lembretes.filter((item) => item.status === 'hoje').length, 'text-app-yellow'],
    ['Proximas', lembretes.filter((item) => item.status === 'pendente').length, 'text-app-muted']
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {resumo.map(([label, value, color]) => (
          <div key={label} className="rounded-lg border border-app-line bg-white p-3 text-center shadow-note">
            <strong className={`block text-lg font-black ${color}`}>{value}</strong>
            <span className="text-[11px] font-black uppercase text-app-muted">{label}</span>
          </div>
        ))}
      </div>

      {lembretes.map((cobranca) => {
        const { total } = getParcelasResumo(cobranca);
        const parcela = cobranca.lembrete;
        const numero = parcela?.parcela_numero;
        const saldoParcela = Number(parcela?.saldo_parcela ?? parcela?.valor_previsto ?? cobranca.saldoRestante);

        return (
          <article key={`${cobranca.conta.id}-${parcela?.id || 'agenda'}`} className="rounded-lg border border-app-line bg-white p-4 shadow-note">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-lg font-black">{cobranca.cliente.nome}</h3>
                <p className="truncate text-sm font-bold text-app-muted">{cobranca.conta.item_comprado || cobranca.conta.descricao}</p>
                <p className="mt-2 text-sm font-black text-app-coralDark">
                  {total > 1 && numero ? `Parcela ${numero}/${total} - ` : ''}Vencimento: {formatDate(parcela?.data_agendada)}
                </p>
                <p className="mt-1 text-xs font-bold text-app-muted">Falta receber nesta parcela: {formatMoney(saldoParcela)}</p>
              </div>
              <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-black uppercase ${statusStyles(cobranca.status)}`}>{statusLabel(cobranca)}</span>
            </div>
            <button className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-app-coral font-black text-white" onClick={() => onPayment(cobranca)} type="button">
              <WalletCards size={18} /> Receber parcela
            </button>
          </article>
        );
      })}
    </div>
  );
}
export function ChargeDetail({ cobranca, onPayment, onGeneralPayment, onPayInstallment, onDistributePartial, onAdjustPlan, onDelete }) {
  return (
    <div className="space-y-4">
      <div className="notebook-paper rounded-lg border border-app-line p-4">
        <h3 className="text-xl font-black">{cobranca.cliente.nome}</h3>
        <p className="mt-1 text-sm font-bold text-app-muted">{cobranca.conta.descricao}</p>
        <p className="mt-3 text-sm font-black uppercase text-app-muted">O que comprou</p>
        <p className="font-bold">{cobranca.conta.item_comprado || 'Nao informado'}</p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
          <div className="rounded-md bg-white/75 p-2"><p className="text-xs font-bold text-app-muted">Total</p><strong>{formatMoney(cobranca.conta.valor_total)}</strong></div>
          <div className="rounded-md bg-white/75 p-2"><p className="text-xs font-bold text-app-muted">Pago</p><strong className="text-app-green">{formatMoney(cobranca.valorPago)}</strong></div>
          <div className="rounded-md bg-app-coralSoft p-2"><p className="text-xs font-bold text-app-coralDark">Falta</p><strong className="text-app-coralDark">{formatMoney(cobranca.saldoRestante)}</strong></div>
        </div>
      </div>

      {cobranca.lembrete && !cobranca.quitada ? (
        <div className="rounded-lg border border-app-line bg-white p-3">
          <p className="text-xs font-black uppercase text-app-muted">Proxima parcela</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <div>
              <p className="font-black">Parcela {cobranca.lembrete.parcela_numero}/{cobranca.conta.parcelas || cobranca.lembretesDaConta.length}</p>
              <p className="text-sm font-bold text-app-muted">Vence {formatDate(cobranca.lembrete.data_agendada)}</p>
            </div>
            <strong className="text-lg text-app-coralDark">{formatMoney(cobranca.lembrete.saldo_parcela ?? cobranca.lembrete.valor_previsto)}</strong>
          </div>
        </div>
      ) : null}

      <ParcelaSchedule cobranca={cobranca} onPayInstallment={onPayInstallment} onDistributePartial={onDistributePartial} />

      <div className="grid gap-2">
        {!cobranca.quitada ? (
          <button className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-app-coral font-black text-white" onClick={onPayment} type="button">
            <CreditCard size={20} /> {cobranca.lembrete ? 'Receber proxima parcela' : 'Registrar pagamento'}
          </button>
        ) : null}
        {!cobranca.quitada && onAdjustPlan ? (
          <button className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-app-line bg-white text-sm font-black text-app-coralDark" onClick={onAdjustPlan} type="button">
            <Pencil size={17} /> Ajustar parcelas
          </button>
        ) : null}
        {!cobranca.quitada && cobranca.lembrete && onGeneralPayment ? (
          <button className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-app-line bg-white text-sm font-black text-app-coralDark" onClick={onGeneralPayment} type="button">
            <WalletCards size={18} /> Registrar pagamento avulso
          </button>
        ) : null}
        {onDelete ? (
          <button className="flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-red-100 bg-red-50 font-black text-app-red" onClick={onDelete} type="button">
            <Trash2 size={18} /> Excluir divida
          </button>
        ) : null}
      </div>

      <div>
        <h4 className="mb-2 font-black">Pagamentos</h4>
        {cobranca.transacoes.length === 0 ? <p className="rounded-lg border border-app-line bg-white p-4 text-sm font-bold text-app-muted">Nenhum pagamento registrado.</p> : (
          <div className="space-y-2">
            {cobranca.transacoes.map((transacao) => (
              <div key={transacao.id} className="rounded-lg border border-app-line bg-white p-3">
                <div className="flex items-center justify-between gap-3">
                  <strong className="text-lg text-app-green">{formatMoney(transacao.valor_pago)}</strong>
                  <span className="rounded-full bg-app-paper px-2 py-1 text-xs font-black uppercase text-app-muted">{transacao.metodo}</span>
                </div>
                <p className="mt-1 text-sm font-bold text-app-muted">{formatDate(transacao.data_pagamento)}</p>
                {transacao.observacao ? <p className="mt-2 text-sm font-semibold">{transacao.observacao}</p> : null}
                {transacao.comprovante ? (
                  <details className="group mt-2">
                    <summary className="inline-flex cursor-pointer select-none items-center gap-1 text-sm font-black text-app-coralDark outline-none">
                      <FileImage size={16} /> Ver comprovante
                    </summary>
                    <div className="mt-2 overflow-hidden rounded-lg border border-app-line bg-app-paper">
                      <img src={transacao.comprovante.url_imagem} alt="Comprovante" loading="lazy" className="w-full object-contain" />
                    </div>
                  </details>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function ClientDetail({ cliente }) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-app-line bg-white p-4 shadow-note">
        <h3 className="text-xl font-black">{cliente.nome}</h3>
        <p className="mt-2 flex items-center gap-2 text-sm font-bold text-app-muted"><Phone size={16} /> {formatPhone(cliente.telefone)}</p>
        {cliente.endereco ? <p className="mt-2 flex items-center gap-2 text-sm font-bold text-app-muted"><MapPin size={16} /> {cliente.endereco}</p> : null}
        {cliente.observacoes ? <p className="mt-3 rounded-md bg-app-paper p-3 text-sm font-semibold">{cliente.observacoes}</p> : null}
        <a className="mt-4 flex h-11 items-center justify-center gap-2 rounded-lg bg-app-coral text-sm font-black text-white" href={getWhatsAppUrl(cliente)} target="_blank" rel="noreferrer"><MessageCircle size={18} /> Abrir conversa</a>
      </div>
      <div>
        <h4 className="mb-2 font-black">Contas do cliente</h4>
        {cliente.contas.length === 0 ? <p className="rounded-lg border border-app-line bg-white p-4 text-sm font-bold text-app-muted">Nenhuma conta criada para este cliente.</p> : (
          <div className="space-y-2">
            {cliente.contas.map((cobranca) => {
              const { total, pagas } = getParcelasResumo(cobranca);
              return (
                <div key={cobranca.conta.id} className="rounded-lg border border-app-line bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <strong>{cobranca.conta.descricao}</strong>
                    <span className={`rounded-full border px-2 py-1 text-xs font-black ${statusStyles(cobranca.status)}`}>{statusLabel(cobranca)}</span>
                  </div>
                  <p className="mt-1 text-sm font-bold text-app-muted">Saldo: {formatMoney(cobranca.saldoRestante)}</p>
                  {total > 1 ? <p className="mt-1 text-xs font-black text-app-coralDark">Parcelas: {pagas}/{total} pagas</p> : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

