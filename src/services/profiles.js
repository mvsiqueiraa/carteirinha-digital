import { isSupabaseConfigured, supabase } from '../lib/supabase';

export function normalizeProfile(profile = {}) {
  return {
    nome: profile.nome?.trim() ?? '',
    nome_negocio: profile.nome_negocio?.trim() ?? '',
    telefone: String(profile.telefone || '').replace(/\D/g, '')
  };
}

export async function getProfile(userId) {
  if (!isSupabaseConfigured || !supabase || !userId) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function isPhoneAlreadyUsed(telefone, ignoreUserId = null) {
  if (!isSupabaseConfigured || !supabase) return false;

  const normalizedPhone = String(telefone || '').replace(/\D/g, '');
  if (!normalizedPhone) return false;

  let query = supabase
    .from('profiles')
    .select('id')
    .eq('telefone', normalizedPhone)
    .limit(1);

  if (ignoreUserId) {
    query = query.neq('id', ignoreUserId);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).length > 0;
}

export async function upsertProfile(userId, profile) {
  if (!isSupabaseConfigured || !supabase || !userId) return null;

  const payload = {
    id: userId,
    ...normalizeProfile(profile)
  };

  if (payload.telefone && await isPhoneAlreadyUsed(payload.telefone, userId)) {
    throw new Error('Este telefone ja esta cadastrado em outra conta.');
  }

  const { data, error } = await supabase
    .from('profiles')
    .upsert(payload)
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('Este telefone ja esta cadastrado em outra conta.');
    }

    throw error;
  }

  return data;
}
