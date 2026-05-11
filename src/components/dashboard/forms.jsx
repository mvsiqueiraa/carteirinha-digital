import { useRef, useState } from 'react';
import { FileImage } from 'lucide-react';
import { normalizeMoney } from '../../services/mutations';
import { formatCurrencyInput, formatMoney, formatPhone, todayIso } from '../../utils/format';
import { EmptyState, Field, inputClass, textAreaClass } from './ui';

const parcelaOptions = [1, 2, 3, 4, 5, 6, 10, 12];

function SignaturePad({ value, onChange }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);

  function getPoint(event) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const point = event.touches?.[0] ?? event;
    return { x: point.clientX - rect.left, y: point.clientY - rect.top };
  }

  function begin(event) {
    event.preventDefault();
    const context = canvasRef.current.getContext('2d');
    const point = getPoint(event);
    drawingRef.current = true;
    context.beginPath();
    context.moveTo(point.x, point.y);
  }

  function draw(event) {
    if (!drawingRef.current) return;
    event.preventDefault();
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    const point = getPoint(event);
    context.lineTo(point.x, point.y);
    context.strokeStyle = '#2f211f';
    context.lineWidth = 2.4;
    context.lineCap = 'round';
    context.stroke();
    onChange(canvas.toDataURL('image/png'));
  }

  function clear() {
    const canvas = canvasRef.current;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    onChange('');
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-black text-app-muted">Assinatura</span>
        <button className="text-sm font-black text-app-coralDark" onClick={clear} type="button">Limpar</button>
      </div>
      <canvas
        ref={canvasRef}
        width="640"
        height="220"
        className="h-32 w-full touch-none rounded-lg border border-dashed border-app-line bg-white"
        onMouseDown={begin}
        onMouseMove={draw}
        onMouseUp={() => (drawingRef.current = false)}
        onMouseLeave={() => (drawingRef.current = false)}
        onTouchStart={begin}
        onTouchMove={draw}
        onTouchEnd={() => (drawingRef.current = false)}
      />
      {value ? <p className="mt-1 text-xs font-bold text-app-green">Assinatura capturada</p> : null}
    </div>
  );
}

export function ClienteForm({ initialData, onSubmit }) {
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
        <input
          className={inputClass}
          inputMode="tel"
          value={form.telefone}
          onChange={(event) => setForm({ ...form, telefone: formatPhone(event.target.value) })}
          placeholder="(85) 99999-9999"
        />
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
    </form>
  );
}

export function ContaForm({ clientes, onSubmit, onCreateCliente }) {
  const [form, setForm] = useState({
    clienteId: '',
    itemComprado: '',
    valorTotal: '',
    dataLembrete: todayIso(),
    parcelas: '1'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const valorNumerico = normalizeMoney(form.valorTotal);
  const quantidadeParcelas = Number(form.parcelas || 1);
  const valorParcela = quantidadeParcelas > 0 ? valorNumerico / quantidadeParcelas : valorNumerico;
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
      <EmptyState
        title="Cadastre um cliente primeiro"
        text="A cobranca precisa ficar ligada a uma pessoa para aparecer no caderninho."
        action="Cadastrar cliente"
        onAction={onCreateCliente}
      />
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
        <input
          className={inputClass}
          inputMode="numeric"
          value={form.valorTotal}
          onChange={(event) => setForm({ ...form, valorTotal: formatCurrencyInput(event.target.value) })}
          placeholder="R$ 0,00"
        />
      </Field>

      <Field label="Parcelas">
        <div className="grid grid-cols-4 gap-2">
          {parcelaOptions.map((option) => {
            const selected = quantidadeParcelas === option;
            return (
              <button
                key={option}
                className={`h-11 rounded-lg border text-sm font-black ${selected ? 'border-app-coral bg-app-coral text-white' : 'border-app-line bg-white text-app-muted'}`}
                onClick={() => setForm({ ...form, parcelas: String(option) })}
                type="button"
              >
                {option === 1 ? 'A vista' : `${option}x`}
              </button>
            );
          })}
        </div>
        {valorNumerico > 0 ? (
          <p className="mt-2 rounded-lg bg-app-coralSoft px-3 py-2 text-sm font-black text-app-coralDark">
            {quantidadeParcelas === 1 ? 'Uma cobranca unica' : `${quantidadeParcelas} parcelas de ${formatMoney(valorParcela)}`}
          </p>
        ) : null}
      </Field>

      <Field label="Primeira cobranca">
        <input className={inputClass} type="date" value={form.dataLembrete} onChange={(event) => setForm({ ...form, dataLembrete: event.target.value })} />
      </Field>

      <button className="w-full rounded-lg bg-app-coral py-4 font-black text-white disabled:bg-app-muted" disabled={!canSubmit || isSubmitting} type="submit">
        {isSubmitting ? 'Salvando...' : 'Salvar cobranca'}
      </button>
    </form>
  );
}

export function PagamentoForm({ cobranca, parcela, onSubmit }) {
  const totalParcelas = Number(cobranca.conta.parcelas || cobranca.lembretesDaConta?.length || 1);
  const numeroParcela = Number(parcela?.parcela_numero || 1);
  const valorParcela = parcela ? Math.min(Number(parcela.valor_previsto || cobranca.saldoRestante), cobranca.saldoRestante) : 0;
  const [form, setForm] = useState({
    valorPago: parcela ? formatMoney(valorParcela) : '',
    metodo: 'pix',
    observacao: parcela ? `Parcela ${numeroParcela}/${totalParcelas}` : ''
  });
  const [comprovanteFile, setComprovanteFile] = useState(null);
  const [assinatura, setAssinatura] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const valorDigitado = normalizeMoney(form.valorPago);
  const excedeSaldo = valorDigitado > 0 && valorDigitado > cobranca.saldoRestante;
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
        comprovanteFile: comprovanteFile ?? null,
        comprovanteDataUrl: comprovanteFile ? null : assinatura
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
      </div>

      <Field label="Valor pago">
        <input
          className={`${inputClass} ${excedeSaldo ? 'border-app-red' : ''}`}
          inputMode="numeric"
          value={form.valorPago}
          onChange={(event) => setForm({ ...form, valorPago: formatCurrencyInput(event.target.value) })}
          placeholder="R$ 0,00"
        />
        {excedeSaldo ? (
          <p className="mt-1 text-xs font-bold text-app-red">
            Valor maior que o saldo restante ({formatMoney(cobranca.saldoRestante)}). Corrija antes de salvar.
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
        <label className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-app-line font-black text-app-coralDark">
          <FileImage size={20} /> Anexar comprovante
          <input accept="image/*" className="hidden" type="file" onChange={readFile} />
        </label>
        {comprovanteFile ? <p className="mt-2 text-xs font-bold text-app-green">Comprovante pronto: {comprovanteFile.name}</p> : null}
      </div>

      <SignaturePad value={assinatura} onChange={setAssinatura} />

      <button className="w-full rounded-lg bg-app-coral py-4 font-black text-white disabled:bg-app-muted" disabled={valorInvalido || isSubmitting} type="submit">
        {isSubmitting ? 'Salvando...' : 'Salvar pagamento'}
      </button>
    </form>
  );
}

