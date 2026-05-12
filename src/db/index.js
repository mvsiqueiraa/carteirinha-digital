import Dexie from 'dexie';
import { syncStatuses, TABLES } from './schema';

export const db = new Dexie('caderninho-digital');

const stores = {
  clientes: 'id, nome, telefone, sync_status, created_at, updated_at, deleted_at',
  contas: 'id, cliente_id, data_criacao, sync_status, created_at, updated_at, deleted_at',
  transacoes:
    'id, conta_id, data_pagamento, metodo, sync_status, created_at, updated_at, deleted_at',
  lembretes:
    'id, cliente_id, conta_id, data_agendada, status, sync_status, created_at, updated_at, deleted_at',
  comprovantes: 'id, transacao_id, sync_status, created_at, updated_at, deleted_at',
  syncQueue: '++local_id, table, record_id, operation, created_at'
};

db.version(1).stores(stores);
db.version(2).stores(stores);
db.version(3).stores(stores);

export function nowIso() {
  return new Date().toISOString();
}

export function createId() {
  return crypto.randomUUID();
}

export async function saveLocal(table, record, operation = 'upsert') {
  const currentTime = nowIso();
  const currentUserId = window.localStorage.getItem('caderninho-current-user-id');
  const payload = {
    ...record,
    ...(currentUserId && table !== TABLES.syncQueue ? { user_id: record.user_id ?? currentUserId } : {}),
    created_at: record.created_at ?? currentTime,
    updated_at: record.updated_at ?? currentTime,
    sync_status: syncStatuses.pending
  };

  await db.transaction('rw', db.table(table), db.syncQueue, async () => {
    await db.table(table).put(payload);
    await db.syncQueue.add({
      table,
      record_id: payload.id,
      operation,
      created_at: currentTime
    });
  });

  return payload;
}

export async function updateLocal(table, id, changes, operation = 'upsert') {
  const currentTime = nowIso();
  const currentUserId = window.localStorage.getItem('caderninho-current-user-id');
  const userPatch = currentUserId && table !== TABLES.syncQueue ? { user_id: changes.user_id ?? currentUserId } : {};

  await db.transaction('rw', db.table(table), db.syncQueue, async () => {
    await db.table(table).update(id, {
      ...changes,
      ...userPatch,
      updated_at: currentTime,
      sync_status: syncStatuses.pending
    });
    await db.syncQueue.add({
      table,
      record_id: id,
      operation,
      created_at: currentTime
    });
  });
}

export async function softDeleteLocal(table, id) {
  const currentTime = nowIso();
  const currentUserId = window.localStorage.getItem('caderninho-current-user-id');
  const userPatch = currentUserId && table !== TABLES.syncQueue ? { user_id: currentUserId } : {};

  await db.transaction('rw', db.table(table), db.syncQueue, async () => {
    await db.table(table).update(id, {
      ...userPatch,
      deleted_at: currentTime,
      updated_at: currentTime,
      sync_status: syncStatuses.pending
    });
    await db.syncQueue.add({
      table,
      record_id: id,
      operation: 'delete',
      created_at: currentTime
    });
  });
}

export { TABLES };

