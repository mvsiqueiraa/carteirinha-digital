import { db } from '../db';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { syncStatuses } from '../db/schema';

const SYNC_TABLES = [
  'clientes',
  'contas',
  'transacoes',
  'lembretes',
  'comprovantes'
];

function stripLocalFields(record) {
  const payload = { ...record };
  delete payload.sync_status;
  return payload;
}

async function pushQueueItem(queueItem) {
  const localTable = db.table(queueItem.table);
  const record = await localTable.get(queueItem.record_id);

  if (!record) {
    await db.syncQueue.delete(queueItem.local_id);
    return;
  }

  const payload = stripLocalFields(record);

  if (queueItem.operation === 'delete') {
    const { error } = await supabase
      .from(queueItem.table)
      .update({
        deleted_at: payload.deleted_at,
        updated_at: payload.updated_at
      })
      .eq('id', queueItem.record_id);

    if (error) throw error;
  } else {
    const { error } = await supabase.from(queueItem.table).upsert(payload);
    if (error) throw error;
  }

  await db.transaction('rw', localTable, db.syncQueue, async () => {
    await localTable.update(queueItem.record_id, {
      sync_status: syncStatuses.synced
    });
    await db.syncQueue.delete(queueItem.local_id);
  });
}

export async function syncPendingChanges() {
  if (!navigator.onLine || !isSupabaseConfigured) {
    return { synced: 0, skipped: true };
  }

  const queue = await db.syncQueue.orderBy('created_at').toArray();
  let synced = 0;

  for (const queueItem of queue) {
    try {
      await pushQueueItem(queueItem);
      synced += 1;
    } catch (error) {
      await db.table(queueItem.table).update(queueItem.record_id, {
        sync_status: syncStatuses.error
      });
      console.error('Erro ao sincronizar item (pulando para o proximo)', queueItem, error);
      continue; // eslint-disable-line no-continue
    }
  }

  return { synced, skipped: false };
}

export async function pullLatestChanges() {
  if (!navigator.onLine || !isSupabaseConfigured) {
    return { pulled: 0, skipped: true };
  }

  let pulled = 0;

  for (const table of SYNC_TABLES) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order('updated_at', { ascending: true });

    if (error) throw error;

    const localTable = db.table(table);

    for (const record of data) {
      if (record.deleted_at) {
        await localTable.delete(record.id);
      } else {
        await localTable.put({ ...record, sync_status: syncStatuses.synced });
      }
    }

    pulled += data.length;
  }

  return { pulled, skipped: false };
}

export function registerOnlineSync(onSynced) {
  async function runSync() {
    const result = await syncPendingChanges();
    onSynced?.(result);
  }

  window.addEventListener('online', runSync);

  if (navigator.onLine) {
    runSync();
  }

  return () => window.removeEventListener('online', runSync);
}
