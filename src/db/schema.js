export const TABLES = {
  clientes: 'clientes',
  contas: 'contas',
  transacoes: 'transacoes',
  lembretes: 'lembretes',
  comprovantes: 'comprovantes',
  syncQueue: 'syncQueue'
};

export const syncFields = {
  id: 'id',
  updatedAt: 'updated_at',
  deletedAt: 'deleted_at',
  syncStatus: 'sync_status'
};

export const syncStatuses = {
  synced: 'synced',
  pending: 'pending',
  error: 'error'
};

export const lembreteStatuses = {
  pendente: 'pendente',
  alertado: 'alertado',
  resolvido: 'resolvido'
};

export const metodosPagamento = {
  pix: 'pix',
  dinheiro: 'dinheiro',
  cartao: 'cartao'
};
