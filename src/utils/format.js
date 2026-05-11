const moneyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL'
});

export const todayIso = () => new Date().toISOString().slice(0, 10);

export function formatMoney(value) {
  return moneyFormatter.format(Number(value || 0));
}

export function formatDate(isoString) {
  if (!isoString || typeof isoString !== 'string') return '';
  const [year, month, day] = isoString.split('-');
  return `${day} - ${month} - ${year}`;
}

export function formatPhone(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 13);
  const withoutCountry = digits.startsWith('55') ? digits.slice(2) : digits;
  if (withoutCountry.length <= 2) return withoutCountry;
  if (withoutCountry.length <= 7) {
    return `(${withoutCountry.slice(0, 2)}) ${withoutCountry.slice(2)}`;
  }
  return `(${withoutCountry.slice(0, 2)}) ${withoutCountry.slice(2, 7)}-${withoutCountry.slice(7, 11)}`;
}

export function formatCurrencyInput(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  return formatMoney(Number(digits) / 100);
}

export function getWhatsAppUrl(cliente, cobranca) {
  const telefone = cliente.telefone?.replace(/\D/g, '');
  const mensagem = cobranca
    ? `Oi, ${cliente.nome}! Passando para lembrar da conta "${cobranca.conta.descricao}". Saldo restante: ${formatMoney(cobranca.saldoRestante)}.`
    : `Oi, ${cliente.nome}! Tudo bem?`;

  return `https://wa.me/${telefone}?text=${encodeURIComponent(mensagem)}`;
}

export function statusStyles(status) {
  const styles = {
    atrasado: 'border-app-red bg-red-50 text-app-red',
    hoje: 'border-app-yellow bg-yellow-50 text-app-yellow',
    pago: 'border-app-green bg-green-50 text-app-green',
    pendente: 'border-app-line bg-white text-app-muted'
  };

  return styles[status] ?? styles.pendente;
}

export function statusLabel(cobranca) {
  if (cobranca.quitada) return 'quitada';
  if (cobranca.status === 'atrasado') return `${cobranca.diasAtraso} dia(s) atrasado`;
  if (cobranca.status === 'hoje') return 'vence hoje';
  return 'em aberto';
}