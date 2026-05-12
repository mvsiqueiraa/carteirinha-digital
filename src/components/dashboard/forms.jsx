import { useState } from 'react';
import { Camera, FileImage, Trash2 } from 'lucide-react';
import { normalizeMoney } from '../../services/mutations';
import { formatCurrencyInput, formatDate, formatMoney, formatPhone, todayIso } from '../../utils/format';
import { EmptyState, Field, inputClass, textAreaClass } from './ui';

function addMonths(dateIso, monthsToAdd) {
  const [year, month, day] = dateIso.split('-').map(Number);
  const date = new Date(year, month - 1 + monthsToAdd, day);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function splitMoney(total, parts) {
  if (parts <= 0) return [];
  const base = Number((Number(total || 0) / parts).toFixed(2));
  return Array.from({ length: parts }, (_, index) => {
    const isLast = index === parts - 1;
    return isLast ? Number((Number(total || 0) - base * (parts - 1)).toFixed(2)) : base;
  });
}

export function ClienteForm({ initialData, onSubmit, onDelete }) {
  const [form, setForm] = useState({
    nome: initialData?.nome ?? '',
    telefone: formatPhone(initialData?.telefone ?? ''),
    rua: initialData?.rua ?? '',
    numero_end: initialData?.numero_end ?? '',
    bairro: initialData?.bairro ?? '',
    local_trabalho: initialData?.local_trabalho ?? '',
    observacoes: initialData?.observacoes ?? ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = form.nome.trim().length >= 2 && form.telefone.replace(/\D/g, '').length >= 10;

  async function submit(event) {
    event.preventDefault();
    if (!canSubmit || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmit(form);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div className="rounded-lg border border-app-line bg-white p-3">
        <p className="text-sm font-black text-app-ink">Dados do cliente</p>
        <p className="mt-1 text-xs font-bold text-app-muted">Nome e telefone ficam em destaque para cobrar rapido.</p>
      </div>

      <Field label="Nome">
        <input className={inputClass} value={form.nome} onChange={(event) => setForm({ ...form, nome: event.target.value })} placeholder="Ex.: Maria Silva" autoFocus />
      </Field>

      <Field label="Telefone">
        <input className={inputClass} inputMode="tel" value={form.telefone} onChange={(event) => setForm({ ...form, telefone: formatPhone(event.target.value) })} placeholder="(85) 99999-9999" />
      </Field>

      <div className="grid grid-cols-[1fr_92px] gap-3">
        <Field label="Rua">
          <input className={inputClass} value={form.rua} onChange={(event) => setForm({ ...form, rua: event.target.value })} placeholder="Rua" />
        </Field>
        <Field label="Numero">
          <input className={inputClass} value={form.numero_end} onChange={(event) => setForm({ ...form, numero_end: event.target.value })} placeholder="123" />
        </Field>
      </div>

      <Field label="Bairro">
        <input className={inputClass} value={form.bairro} onChange={(event) => setForm({ ...form, bairro: event.target.value })} placeholder="Bairro" />
      </Field>

      <Field label="Local de trabalho">
        <input className={inputClass} value={form.local_trabalho} onChange={(event) => setForm({ ...form, local_trabalho: event.target.value })} placeholder="Opcional" />
      </Field>

      <Field label="Observacoes">
        <textarea className={textAreaClass} value={form.observacoes} onChange={(event) => setForm({ ...form, observacoes: event.target.value })} placeholder="Referencia, melhor horario, combinados..." />
      </Field>

      <button className="w-full rounded-lg bg-app-coral py-4 font-black text-white disabled:bg-app-muted" disabled={!canSubmit || isSubmitting} type="submit">
        {isSubmitting ? 'Salvando...' : initialData ? 'Atualizar cliente' : 'Salvar cliente'}
      </button>

      {initialData && onDelete ? (
        <button className="flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-red-100 bg-red-50 font-black text-app-red" onClick={onDelete} type="button">
          <Trash2 size={18} /> Excluir cliente
        </button>
      ) : null}
    </form>
  );
}

export function ContaForm({ clientes, onSubmit, onCreateCliente }) {
  const [form, setForm] = useState({
    clienteId: '',
    itemComprado: '',
    valorTotal: '',
    tipoCobranca: 'avista',
    dataLembrete: todayIso(),
    parcelas: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const valorNumerico = normalizeMoney(form.valorTotal);
  const parcelasDigitadas = Number.parseInt(form.parcelas || '2', 10);
  const quantidadeParcelas = form.tipoCobranca === 'parcelado'
    ? Math.min(Math.max(Number.isNaN(parcelasDigitadas) ? 2 : parcelasDigitadas, 2), 24)
    : 1;
  const valoresParcelas = splitMoney(valorNumerico, quantidadeParcelas);
  const canSubmit = Boolean(form.clienteId) && form.itemComprado.trim().length >= 2 && valorNumerico > 0;

  async function submit(event) {
    event.preventDefault();
    if (!canSubmit || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        ...form,
        descricao: form.itemComprado,
        parcelas: quantidadeParcelas
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (clientes.length === 0) {
    return (
      <EmptyState title="Cadastre um cliente primeiro" text="A cobranca precisa ficar ligada a uma pessoa para aparecer no caderninho." action="Cadastrar cliente" onAction={onCreateCliente} />
    );
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <Field label="Cliente">
        <select className={inputClass} value={form.clienteId} onChange={(event) => setForm({ ...form, clienteId: event.target.value })}>
          <option value="">Selecione</option>
          {clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>)}
        </select>
      </Field>

      <Field label="O que foi comprado">
        <input className={inputClass} value={form.itemComprado} onChange={(event) => setForm({ ...form, itemComprado: event.target.value })} placeholder="Ex.: mercadoria, marmita, roupa" autoFocus />
      </Field>

      <Field label="Valor total">
        <input className={inputClass} inputMode="numeric" value={form.valorTotal} onChange={(event) => setForm({ ...form, valorTotal: formatCurrencyInput(event.target.value) })} placeholder="R$ 0,00" />
      </Field>

      {valorNumerico > 0 ? (
        <div>
          <span className="mb-1 block text-sm font-black text-app-muted">Forma de cobranca</span>
          <div className="grid grid-cols-2 gap-2">
            <button className={`h-12 rounded-lg border font-black ${form.tipoCobranca === 'avista' ? 'border-app-coral bg-app-coral text-white' : 'border-app-line bg-white text-app-muted'}`} onClick={() => setForm({ ...form, tipoCobranca: 'avista', parcelas: '' })} type="button">
              A vista
            </button>
            <button className={`h-12 rounded-lg border font-black ${form.tipoCobranca === 'parcelado' ? 'border-app-coral bg-app-coral text-white' : 'border-app-line bg-white text-app-muted'}`} onClick={() => setForm({ ...form, tipoCobranca: 'parcelado', parcelas: form.parcelas || '2' })} type="button">
              Parcelado
            </button>
          </div>
        </div>
      ) : null}

      {valorNumerico > 0 && form.tipoCobranca === 'parcelado' ? (
        <Field label="Quantidade de parcelas">
          <input className={inputClass} inputMode="numeric" max="24" min="2" type="number" value={form.parcelas} onChange={(event) => setForm({ ...form, parcelas: event.target.value.replace(/\D/g, '').slice(0, 2) })} placeholder="2" />
        </Field>
      ) : null}

      <Field label="Primeiro vencimento">
        <input className={inputClass} type="date" value={form.dataLembrete} onChange={(event) => setForm({ ...form, dataLembrete: event.target.value })} />
      </Field>

      {valorNumerico > 0 ? (
        <div className="rounded-lg border border-app-line bg-white p-3">
          <p className="font-black text-app-ink">
            {quantidadeParcelas === 1
              ? `${formatMoney(valorNumerico)} a vista`
              : `${formatMoney(valorNumerico)} em ${quantidadeParcelas}x`}
          </p>
          <p className="mt-1 text-sm font-bold text-app-muted">
            {quantidadeParcelas === 1 ? 'Uma cobranca unica' : `${quantidadeParcelas} parcelas com vencimentos mensais`}
          </p>
          <div className="mt-3 space-y-2">
            {valoresParcelas.map((valor, index) => (
              <div key={`${valor}-${index}`} className="flex items-center justify-between rounded-md bg-app-paper px-3 py-2 text-sm">
                <span className="font-black">Parcela {index + 1}/{quantidadeParcelas}</span>
                <span className="font-bold text-app-muted">{formatDate(addMonths(form.dataLembrete, index))}</span>
                <strong className="text-app-coralDark">{formatMoney(valor)}</strong>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <button className="w-full rounded-lg bg-app-coral py-4 font-black text-white disabled:bg-app-muted" disabled={!canSubmit || isSubmitting} type="submit">
        {isSubmitting ? 'Salvando...' : 'Salvar cobranca'}
      </button>
    </form>
  );
}

export function PagamentoForm({ cobranca, parcela, onSubmit }) {
  const totalParcelas = Number(cobranca.conta.parcelas || cobranca.lembretesDaConta?.length || 1);
  const numeroParcela = Number(parcela?.parcela_numero || 1);
  const saldoParcela = parcela ? Math.min(Number(parcela.saldo_parcela ?? parcela.valor_previsto ?? cobranca.saldoRestante), cobranca.saldoRestante) : 0;
  const [form, setForm] = useState({
    valorPago: parcela ? formatMoney(saldoParcela) : '',
    metodo: 'pix',
    observacao: parcela ? `Parcela ${numeroParcela}/${totalParcelas}` : ''
  });
  const [comprovanteFile, setComprovanteFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const valorDigitado = normalizeMoney(form.valorPago);
  const excedeSaldo = valorDigitado > 0 && valorDigitado > cobranca.saldoRestante;
  const excedeParcela = parcela && valorDigitado > saldoParcela && !excedeSaldo;
  const valorInvalido = valorDigitado <= 0 || excedeSaldo;

  function readFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setComprovanteFile(file);
  }

  async function submit(event) {
    event.preventDefault();
    if (valorInvalido || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        ...form,
        contaId: cobranca.conta.id,
        parcelaId: parcela?.id,
        comprovanteFile: comprovanteFile ?? null,
        comprovanteDataUrl: null
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div className="rounded-lg bg-app-coralSoft p-3">
        <p className="text-sm font-bold text-app-coralDark">Saldo a receber</p>
        <strong className="text-2xl font-black text-app-coralDark">{formatMoney(cobranca.saldoRestante)}</strong>
        {parcela ? <p className="mt-1 text-sm font-black text-app-coralDark">Parcela {numeroParcela}/{totalParcelas}: falta {formatMoney(saldoParcela)}</p> : null}
      </div>

      <Field label="Valor pago">
        <input className={`${inputClass} ${excedeSaldo ? 'border-app-red' : ''}`} inputMode="numeric" value={form.valorPago} onChange={(event) => setForm({ ...form, valorPago: formatCurrencyInput(event.target.value) })} placeholder="R$ 0,00" />
        {excedeSaldo ? (
          <p className="mt-1 text-xs font-bold text-app-red">Valor maior que o saldo restante ({formatMoney(cobranca.saldoRestante)}). Corrija antes de salvar.</p>
        ) : null}
        {excedeParcela ? (
          <p className="mt-1 rounded-md bg-yellow-50 px-2 py-1 text-xs font-black text-app-yellow">
            O excedente sera abatido nas proximas parcelas em ordem.
          </p>
        ) : null}
      </Field>

      <Field label="Metodo">
        <select className={inputClass} value={form.metodo} onChange={(event) => setForm({ ...form, metodo: event.target.value })}>
          <option value="pix">Pix</option>
          <option value="dinheiro">Dinheiro</option>
          <option value="cartao">Cartao</option>
        </select>
      </Field>

      <Field label="Observacao">
        <textarea className={textAreaClass} value={form.observacao} onChange={(event) => setForm({ ...form, observacao: event.target.value })} placeholder="Ex.: pagou metade no pix" />
      </Field>

      <div className="rounded-lg border border-app-line bg-white p-3">
        <p className="mb-2 text-sm font-black text-app-muted">Comprovante</p>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-app-line font-black text-app-coralDark">
            <Camera size={20} /> Tirar foto
            <input accept="image/*" capture="environment" className="hidden" type="file" onChange={readFile} />
          </label>
          <label className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-app-line font-black text-app-coralDark">
            <FileImage size={20} /> Anexar
            <input accept="image/*" className="hidden" type="file" onChange={readFile} />
          </label>
        </div>
        {comprovanteFile ? <p className="mt-2 text-xs font-bold text-app-green">Comprovante pronto: {comprovanteFile.name}</p> : null}
      </div>

      <button className="w-full rounded-lg bg-app-coral py-4 font-black text-white disabled:bg-app-muted" disabled={valorInvalido || isSubmitting} type="submit">
        {isSubmitting ? 'Salvando...' : 'Salvar pagamento'}
      </button>
    </form>
  );
}
function buildPlanoPorValor(total, valorParcela) {
  const saldo = Number(Number(total || 0).toFixed(2));
  const valor = Number(Number(valorParcela || 0).toFixed(2));
  if (saldo <= 0 || valor <= 0) return [];

  const plano = [];
  let restante = saldo;

  while (restante > 0.009 && plano.length < 24) {
    const valorAtual = plano.length === 23 ? restante : Math.min(valor, restante);
    plano.push(Number(valorAtual.toFixed(2)));
    restante = Number((restante - valorAtual).toFixed(2));
  }

  return plano;
}

export function AjustarParcelasForm({ cobranca, onSubmit }) {
  const parcelasAbertas = (cobranca.lembretesDaConta || []).filter((item) => item.statusVisual !== 'paga' && item.status !== 'resolvido');
  const quantidadeInicial = Math.max(parcelasAbertas.filter((item) => Number(item.valor_pago || 0) <= 0).length, 1);
  const [form, setForm] = useState({
    quantidadeParcelas: String(quantidadeInicial),
    valorParcela: '',
    primeiraData: cobranca.lembrete?.data_agendada || todayIso()
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const saldoRestante = Number(cobranca.saldoRestante || 0);
  const valorMensal = normalizeMoney(form.valorParcela);
  const quantidadeDigitada = Number.parseInt(form.quantidadeParcelas || '1', 10);
  const quantidadeParcelas = Math.min(Math.max(Number.isNaN(quantidadeDigitada) ? 1 : quantidadeDigitada, 1), 24);
  const plano = valorMensal > 0 ? buildPlanoPorValor(saldoRestante, valorMensal) : splitMoney(saldoRestante, quantidadeParcelas);
  const canSubmit = saldoRestante > 0 && plano.length > 0 && Boolean(form.primeiraData);

  async function submit(event) {
    event.preventDefault();
    if (!canSubmit || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        quantidadeParcelas: valorMensal > 0 ? plano.length : quantidadeParcelas,
        valorParcela: form.valorParcela,
        primeiraData: form.primeiraData
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div className="rounded-lg bg-app-coralSoft p-3">
        <p className="text-sm font-bold text-app-coralDark">Saldo para reorganizar</p>
        <strong className="text-2xl font-black text-app-coralDark">{formatMoney(saldoRestante)}</strong>
        <p className="mt-1 text-xs font-bold text-app-coralDark">Pagamentos ja feitos ficam preservados no historico.</p>
      </div>

      <Field label="Quantidade de parcelas restantes">
        <input className={inputClass} inputMode="numeric" max="24" min="1" type="number" value={form.quantidadeParcelas} onChange={(event) => setForm({ ...form, quantidadeParcelas: event.target.value.replace(/\D/g, '').slice(0, 2) })} placeholder="2" />
      </Field>

      <Field label="Valor por parcela (opcional)">
        <input className={inputClass} inputMode="numeric" value={form.valorParcela} onChange={(event) => setForm({ ...form, valorParcela: formatCurrencyInput(event.target.value) })} placeholder="Ex.: R$ 150,00" />
        <p className="mt-1 text-xs font-bold text-app-muted">Se preencher este campo, o app calcula quantas parcelas serao necessarias.</p>
      </Field>

      <Field label="Primeiro proximo vencimento">
        <input className={inputClass} type="date" value={form.primeiraData} onChange={(event) => setForm({ ...form, primeiraData: event.target.value })} />
      </Field>

      <div className="rounded-lg border border-app-line bg-white p-3">
        <p className="font-black text-app-ink">Previa do novo plano</p>
        <p className="mt-1 text-sm font-bold text-app-muted">
          {plano.length} parcela(s) para quitar {formatMoney(saldoRestante)}
        </p>
        <div className="mt-3 space-y-2">
          {plano.map((valor, index) => (
            <div key={`${valor}-${index}`} className="flex items-center justify-between rounded-md bg-app-paper px-3 py-2 text-sm">
              <span className="font-black">Parcela {index + 1}/{plano.length}</span>
              <span className="font-bold text-app-muted">{formatDate(addMonths(form.primeiraData, index))}</span>
              <strong className="text-app-coralDark">{formatMoney(valor)}</strong>
            </div>
          ))}
        </div>
      </div>

      <button className="w-full rounded-lg bg-app-coral py-4 font-black text-white disabled:bg-app-muted" disabled={!canSubmit || isSubmitting} type="submit">
        {isSubmitting ? 'Salvando...' : 'Salvar ajuste das parcelas'}
      </button>
    </form>
  );
}

