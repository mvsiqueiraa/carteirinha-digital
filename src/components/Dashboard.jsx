import { useEffect, useMemo, useRef, useState } from 'react';
import { liveQuery } from 'dexie';
import {
  CalendarDays,
  ClipboardList,
  Home,
  Plus,
  Receipt,
  ReceiptText,
  Search,
  UserPlus,
  Users,
  Wifi,
  WifiOff
} from 'lucide-react';
import { getDashboardData } from '../services/charges';
import {
  ajustarParcelas,
  createCliente,
  createContaComLembrete,
  deleteCliente,
  deleteConta,
  distribuirRestanteDaParcela,
  registrarPagamento,
  updateCliente
} from '../services/mutations';
import { syncPendingChanges } from '../sync/supabaseSync';
import { formatMoney } from '../utils/format';
import { AjustarParcelasForm, ClienteForm, ContaForm, PagamentoForm } from './dashboard/forms';
import {
  ChargeDetail,
  ChargesList,
  ClientDetail,
  ClientsList,
  RemindersList
} from './dashboard/lists';
import { Modal } from './dashboard/ui';

function filterCharges(cobrancas, filter, query) {
  const normalizedQuery = query.trim().toLowerCase();

  return cobrancas.filter((cobranca) => {
    const matchesFilter =
      filter === 'todos' ||
      (filter === 'atrasados' && cobranca.status === 'atrasado') ||
      (filter === 'hoje' && cobranca.status === 'hoje') ||
      (filter === 'abertos' && !cobranca.quitada) ||
      (filter === 'quitados' && cobranca.quitada);

    if (!matchesFilter) return false;
    if (!normalizedQuery) return true;

    const searchable = [
      cobranca.cliente.nome,
      cobranca.cliente.telefone,
      cobranca.cliente.endereco,
      cobranca.conta.descricao,
      cobranca.conta.item_comprado
    ]
      .join(' ')
      .toLowerCase();

    return searchable.includes(normalizedQuery);
  });
}

function BottomNav({ activeTab, setActiveTab }) {
  const tabs = [
    ['cobrancas', 'Cobrancas', Home],
    ['clientes', 'Clientes', Users],
    ['lembretes', 'Agenda', CalendarDays]
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-app-line bg-white/95 px-3 py-2 backdrop-blur">
      <div className="mx-auto grid max-w-md grid-cols-3 gap-1">
        {tabs.map(([value, label, Icon]) => {
          const selected = activeTab === value;
          return (
            <button
              key={value}
              className={`flex h-14 flex-col items-center justify-center gap-1 rounded-lg text-xs font-black ${selected ? 'bg-app-coralSoft text-app-coralDark' : 'text-app-muted'}`}
              onClick={() => setActiveTab(value)}
              type="button"
            >
              <Icon size={20} />
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function Dashboard({ isOnline, lastSync, isSupabaseConfigured }) {
  const [data, setData] = useState({
    totalAReceber: 0,
    quantidadeAtrasados: 0,
    cobrancasDoDia: [],
    cobrancas: [],
    clientes: [],
    lembretes: [],
    syncPendentes: 0
  });
  const [activeTab, setActiveTab] = useState('cobrancas');
  const [filter, setFilter] = useState('abertos');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const debounceTimerRef = useRef(null);
  const [modal, setModal] = useState(null);
  const [selectedCharge, setSelectedCharge] = useState(null);
  const [selectedInstallment, setSelectedInstallment] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [toast, setToast] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);

  async function loadDashboard() {
    const dashboardData = await getDashboardData();
    setData(dashboardData);
  }

  useEffect(() => {
    const subscription = liveQuery(() => getDashboardData()).subscribe({
      next: setData,
      error: (error) => console.error('Erro ao carregar dashboard', error)
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = window.setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);

    return () => clearTimeout(debounceTimerRef.current);
  }, [query]);

  useEffect(() => {
    function handleBeforeInstallPrompt(event) {
      event.preventDefault();
      setInstallPrompt(event);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  function showToast(message) {
    setToast(message);
    window.setTimeout(() => setToast(''), 2600);
  }

  async function handleSync() {
    setIsSyncing(true);
    const result = await syncPendingChanges();
    await loadDashboard();
    setIsSyncing(false);
    showToast(result.skipped ? 'Nada para sincronizar agora' : 'Caderninho sincronizado');
  }

  async function handleInstall() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    setInstallPrompt(null);
  }

  function openPayment(cobranca, parcela = undefined) {
    const parcelaAtual = parcela === undefined ? cobranca.lembrete ?? null : parcela;
    setSelectedCharge(cobranca);
    setSelectedInstallment(parcelaAtual);
    setModal('pagamento');
  }

  function closePayment() {
    setModal(null);
    setSelectedInstallment(null);
  }

  const filteredCharges = useMemo(
    () => filterCharges(data.cobrancas, filter, debouncedQuery),
    [data.cobrancas, filter, debouncedQuery]
  );

  const filteredClients = useMemo(() => {
    const normalizedQuery = debouncedQuery.trim().toLowerCase();
    if (!normalizedQuery) return data.clientes;
    return data.clientes.filter((cliente) =>
      [cliente.nome, cliente.telefone, cliente.endereco, cliente.observacoes]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [data.clientes, debouncedQuery]);

  const connectionText = useMemo(() => {
    if (!isOnline) return 'Offline';
    if (isSyncing) return 'Sincronizando';
    if (data.syncPendentes > 0) return `${data.syncPendentes} pendente(s)`;
    if (!isSupabaseConfigured) return 'Online';
    return lastSync ? `Sincronizado ${lastSync}` : 'Online';
  }, [data.syncPendentes, isOnline, isSyncing, isSupabaseConfigured, lastSync]);

  async function saveClient(form) {
    await createCliente(form);
    setModal(null);
    showToast('Cliente salvo');
  }

  async function saveEditedClient(form) {
    await updateCliente(selectedClient.id, form);
    setModal(null);
    setSelectedClient(null);
    showToast('Cliente atualizado');
  }
  async function removeSelectedClient() {
    if (!selectedClient) return;
    const confirmed = window.confirm('Excluir este cliente e todas as cobrancas dele? Essa acao sera sincronizada quando houver internet.');
    if (!confirmed) return;

    await deleteCliente(selectedClient.id);
    setModal(null);
    setSelectedClient(null);
    showToast('Cliente excluido');
  }


  async function saveCharge(form) {
    await createContaComLembrete(form);
    setModal(null);
    setActiveTab('cobrancas');
    showToast('Cobranca salva');
  }

  async function savePayment(form) {
    const result = await registrarPagamento(form);
    const excedente = result?.ajuste?.excedenteAbatido ?? 0;

    setModal(null);
    setSelectedCharge(null);
    setSelectedInstallment(null);

    if (excedente > 0) {
      showToast(`${formatMoney(excedente)} abatidos nas proximas parcelas`);
      return;
    }

    showToast(selectedInstallment ? 'Pagamento da parcela salvo' : 'Pagamento salvo offline');
  }
  async function saveInstallmentAdjustment(form) {
    if (!selectedCharge) return;

    await ajustarParcelas(selectedCharge.conta.id, form);
    setModal(null);
    setSelectedCharge(null);
    setSelectedInstallment(null);
    showToast('Parcelas ajustadas');
  }

  async function distributePartialInstallment(parcela) {
    if (!selectedCharge || !parcela) return;

    await distribuirRestanteDaParcela(selectedCharge.conta.id, parcela.id);
    setModal(null);
    setSelectedCharge(null);
    setSelectedInstallment(null);
    showToast('Restante distribuido nas proximas parcelas');
  }

  async function removeSelectedCharge() {
    if (!selectedCharge) return;
    const confirmed = window.confirm('Excluir esta divida com pagamentos, parcelas e datas de cobranca relacionadas?');
    if (!confirmed) return;

    await deleteConta(selectedCharge.conta.id);
    setModal(null);
    setSelectedCharge(null);
    setSelectedInstallment(null);
    showToast('Divida excluida');
  }

  function showChargeFilter(nextFilter) {
    setActiveTab('cobrancas');
    setFilter(nextFilter);
    setQuery('');
    setDebouncedQuery('');
  }

  const currentTitle = activeTab === 'clientes' ? 'Clientes' : activeTab === 'lembretes' ? 'Agenda' : 'Cobrancas';

  return (
    <main className="min-h-screen bg-app-paper pb-28 text-app-ink">
      <header className="sticky top-0 z-10 border-b border-app-line bg-app-paper/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto max-w-md">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-app-coral text-white">
                <ClipboardList size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-app-muted">Caderninho Digital</p>
                <h1 className="truncate text-xl font-black tracking-normal">{currentTitle}</h1>
              </div>
            </div>
            <button className="flex shrink-0 items-center gap-1 rounded-full border border-app-line bg-white px-2.5 py-2 text-xs font-bold text-app-muted" onClick={handleSync} type="button">
              {isOnline ? <Wifi size={15} /> : <WifiOff size={15} />}
              <span>{connectionText}</span>
            </button>
          </div>

          <div className="mt-3 rounded-lg bg-white px-4 py-3 shadow-note">
            <p className="text-xs font-bold text-app-muted">Total a receber</p>
            <strong className="block text-2xl font-black tracking-normal text-app-coralDark">
              {formatMoney(data.totalAReceber)}
            </strong>
          </div>
        </div>
      </header>

      {!isOnline ? (
        <div className="mx-auto mt-3 max-w-md px-4">
          <div className="rounded-lg border border-app-coralSoft bg-white px-4 py-3 text-sm font-bold text-app-coralDark shadow-note">
            Voce esta offline. Pode continuar cadastrando; tudo fica salvo no aparelho.
          </div>
        </div>
      ) : null}

      {installPrompt ? (
        <div className="mx-auto mt-3 max-w-md px-4">
          <button className="flex w-full items-center justify-between rounded-lg border border-app-line bg-white px-4 py-3 text-left font-black shadow-note" onClick={handleInstall} type="button">
            Instalar app no celular
            <Plus size={18} />
          </button>
        </div>
      ) : null}

      {activeTab === 'cobrancas' ? (
        <section className="mx-auto max-w-md px-4 pt-4 pb-2">
          <button className="flex w-full items-center gap-4 rounded-xl border border-app-line bg-white px-5 py-4 shadow-note transition-transform active:scale-95" onClick={() => setModal('conta')} type="button">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-app-coralSoft text-app-coralDark">
              <Receipt size={24} />
            </div>
            <div className="text-left">
              <p className="font-black text-app-ink">Anotar compra</p>
              <p className="text-xs font-bold text-app-muted">Registre uma venda</p>
            </div>
          </button>
        </section>
      ) : null}

      {activeTab === 'cobrancas' ? (
        <section className="mx-auto grid max-w-md grid-cols-2 gap-3 px-4 py-4">
          <button
            aria-pressed={filter === 'atrasados'}
            className={`rounded-lg border bg-white p-4 text-left shadow-note transition active:scale-95 ${filter === 'atrasados' ? 'border-app-red ring-2 ring-red-100' : 'border-red-100'}`}
            onClick={() => showChargeFilter('atrasados')}
            type="button"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-app-red"><ReceiptText size={22} /></div>
            <p className="text-sm font-bold text-app-red">Atrasados</p>
            <strong className="mt-1 block text-3xl">{data.quantidadeAtrasados}</strong>
            <span className="mt-2 block text-xs font-black text-app-muted">Ver lista</span>
          </button>
          <button
            aria-pressed={filter === 'hoje'}
            className={`rounded-lg border bg-white p-4 text-left shadow-note transition active:scale-95 ${filter === 'hoje' ? 'border-app-yellow ring-2 ring-yellow-100' : 'border-yellow-100'}`}
            onClick={() => showChargeFilter('hoje')}
            type="button"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-50 text-app-yellow"><CalendarDays size={22} /></div>
            <p className="text-sm font-bold text-app-yellow">Para hoje</p>
            <strong className="mt-1 block text-3xl">{data.cobrancasDoDia.length}</strong>
            <span className="mt-2 block text-xs font-black text-app-muted">Ver lista</span>
          </button>
        </section>
      ) : null}

      <section className="mx-auto max-w-md px-4">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-3 text-app-muted" size={20} />
          <input className="h-12 w-full rounded-lg border border-app-line bg-white pl-10 pr-3 font-bold outline-none focus:border-app-coral" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nome, telefone ou descricao" />
        </div>

        {activeTab === 'cobrancas' ? (
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
            {[
              ['atrasados', 'Atrasados'],
              ['hoje', 'Hoje'],
              ['abertos', 'Em aberto'],
              ['quitados', 'Quitados'],
              ['todos', 'Todos']
            ].map(([value, label]) => (
              <button key={value} className={`shrink-0 rounded-full px-4 py-2 text-sm font-black ${filter === value ? 'bg-app-coral text-white' : 'border border-app-line bg-white text-app-muted'}`} onClick={() => setFilter(value)} type="button">
                {label}
              </button>
            ))}
          </div>
        ) : null}

        {activeTab === 'cobrancas' ? (
          <ChargesList
            cobrancas={filteredCharges}
            onCreate={() => setModal('conta')}
            onDetail={(cobranca) => { setSelectedCharge(cobranca); setSelectedInstallment(null); setModal('detalhe-cobranca'); }}
            onPayment={(cobranca) => openPayment(cobranca)}
          />
        ) : null}

        {activeTab === 'clientes' ? (
          <>
            <button className="mb-3 flex w-full items-center gap-3 rounded-xl border border-app-line bg-white px-4 py-3 shadow-note transition-transform active:scale-95" onClick={() => setModal('cliente')} type="button">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-app-coralSoft text-app-coralDark">
                <UserPlus size={20} />
              </div>
              <span className="font-black text-app-ink">Adicionar cliente</span>
            </button>
            <ClientsList
              clientes={filteredClients}
              onCreate={() => setModal('cliente')}
              onEdit={(cliente) => { setSelectedClient(cliente); setModal('editar-cliente'); }}
              onDetail={(cliente) => { setSelectedClient(cliente); setModal('detalhe-cliente'); }}
            />
          </>
        ) : null}

        {activeTab === 'lembretes' ? <RemindersList lembretes={data.lembretes} onPayment={(cobranca) => openPayment(cobranca, cobranca.lembrete)} /> : null}
      </section>

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />

      {toast ? <div className="fixed bottom-24 left-1/2 z-50 w-[calc(100%-32px)] max-w-md -translate-x-1/2 rounded-lg bg-app-ink px-4 py-3 text-center text-sm font-black text-white shadow-soft">{toast}</div> : null}

      {modal === 'cliente' ? <Modal title="Novo cliente" onClose={() => setModal(null)}><ClienteForm onSubmit={saveClient} /></Modal> : null}
      {modal === 'editar-cliente' && selectedClient ? <Modal title="Editar cliente" onClose={() => { setModal(null); setSelectedClient(null); }}><ClienteForm initialData={selectedClient} onSubmit={saveEditedClient} onDelete={removeSelectedClient} /></Modal> : null}
      {modal === 'conta' ? <Modal title="Nova cobranca" onClose={() => setModal(null)}><ContaForm clientes={data.clientes} onSubmit={saveCharge} onCreateCliente={() => setModal('cliente')} /></Modal> : null}
      {modal === 'pagamento' && selectedCharge ? <Modal title={selectedInstallment ? 'Receber parcela' : 'Registrar pagamento'} onClose={closePayment}><PagamentoForm cobranca={selectedCharge} parcela={selectedInstallment} onSubmit={savePayment} /></Modal> : null}
      {modal === 'ajustar-parcelas' && selectedCharge ? <Modal title="Ajustar parcelas" onClose={() => setModal(null)}><AjustarParcelasForm cobranca={selectedCharge} onSubmit={saveInstallmentAdjustment} /></Modal> : null}
      {modal === 'detalhe-cobranca' && selectedCharge ? (
        <Modal title="Detalhes da cobranca" onClose={() => setModal(null)}>
          <ChargeDetail
            cobranca={selectedCharge}
            onPayment={() => openPayment(selectedCharge)}
            onGeneralPayment={() => openPayment(selectedCharge, null)}
            onPayInstallment={(parcela) => openPayment(selectedCharge, parcela)}
            onDistributePartial={distributePartialInstallment}
            onAdjustPlan={() => setModal('ajustar-parcelas')}
            onDelete={removeSelectedCharge}
          />
        </Modal>
      ) : null}
      {modal === 'detalhe-cliente' && selectedClient ? <Modal title="Cliente" onClose={() => setModal(null)}><ClientDetail cliente={selectedClient} /></Modal> : null}
    </main>
  );
}

