import { useState } from 'react';
import { ClipboardList, LockKeyhole } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { isPhoneAlreadyUsed, upsertProfile } from '../../services/profiles';
import { formatPhone } from '../../utils/format';
import { Field, inputClass } from '../dashboard/ui';

export function AuthScreen() {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({
    email: '',
    password: '',
    nome: '',
    nome_negocio: '',
    telefone: ''
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isRegister = mode === 'register';
  const telefoneDigits = form.telefone.replace(/\\D/g, '');
  const canSubmit = form.email.trim().length > 3 && form.password.length >= 6 && (!isRegister || (form.nome.trim().length >= 2 && telefoneDigits.length >= 10));

  async function submit(event) {
    event.preventDefault();
    if (!canSubmit || isSubmitting || !isSupabaseConfigured || !supabase) return;

    setIsSubmitting(true);
    setError('');
    setMessage('');

    try {
      if (isRegister) {
        if (await isPhoneAlreadyUsed(form.telefone)) {
          throw new Error('Este telefone ja esta cadastrado em outra conta.');
        }

        const { data, error: signUpError } = await supabase.auth.signUp({
          email: form.email.trim(),
          password: form.password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              nome: form.nome.trim(),
              nome_negocio: form.nome_negocio.trim()
            }
          }
        });

        if (signUpError) throw signUpError;

        if (data.session && data.user) {
          await upsertProfile(data.user.id, {
            nome: form.nome,
            nome_negocio: form.nome_negocio,
            telefone: form.telefone
          });
          await supabase.auth.signOut();
        }

        setMode('login');
        setForm({
          email: form.email,
          password: '',
          nome: '',
          nome_negocio: '',
          telefone: ''
        });
        setMessage(data.session ? 'Conta criada. Agora entre com sua senha.' : 'Cadastro criado. Confira seu email e depois entre.');
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: form.email.trim(),
        password: form.password
      });

      if (signInError) throw signInError;
      setMessage('Login salvo neste aparelho.');
    } catch (err) {
      setError(err.message || 'Nao foi possivel entrar agora.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isSupabaseConfigured) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-app-paper px-4 text-app-ink">
        <section className="w-full max-w-md rounded-xl border border-app-line bg-white p-5 shadow-note">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-app-coral text-white">
            <ClipboardList size={24} />
          </div>
          <h1 className="text-2xl font-black">Configure o Supabase</h1>
          <p className="mt-2 text-sm font-bold text-app-muted">Para usar login e perfil, preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-app-paper px-4 py-8 text-app-ink">
      <section className="mx-auto max-w-md rounded-xl border border-app-line bg-white p-5 shadow-note">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-app-coral text-white">
            <LockKeyhole size={24} />
          </div>
          <div>
            <p className="text-xs font-black uppercase text-app-muted">Caderninho Digital</p>
            <h1 className="text-2xl font-black">{isRegister ? 'Criar acesso' : 'Entrar'}</h1>
          </div>
        </div>

        <form className="space-y-4" onSubmit={submit}>
          {isRegister ? (
            <>
              <Field label="Seu nome">
                <input className={inputClass} value={form.nome} onChange={(event) => setForm({ ...form, nome: event.target.value })} placeholder="Ex.: Maria Silva" autoFocus />
              </Field>
              <Field label="Nome do comercio">
                <input className={inputClass} value={form.nome_negocio} onChange={(event) => setForm({ ...form, nome_negocio: event.target.value })} placeholder="Ex.: Caderninho da Maria" />
              </Field>
              <Field label="Telefone">
                <input className={inputClass} inputMode="tel" value={formatPhone(form.telefone)} onChange={(event) => setForm({ ...form, telefone: event.target.value })} placeholder="(85) 99999-9999" />
              </Field>
            </>
          ) : null}

          <Field label="Email">
            <input className={inputClass} type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="voce@email.com" autoFocus={!isRegister} />
          </Field>

          <Field label="Senha">
            <input className={inputClass} type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Minimo 6 caracteres" />
          </Field>

          {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-app-red">{error}</p> : null}
          {message ? <p className="rounded-lg bg-green-50 px-3 py-2 text-sm font-bold text-app-green">{message}</p> : null}

          <button className="h-12 w-full rounded-lg bg-app-coral font-black text-white disabled:bg-app-muted" disabled={!canSubmit || isSubmitting} type="submit">
            {isSubmitting ? 'Aguarde...' : isRegister ? 'Criar conta' : 'Entrar'}
          </button>
        </form>

        <button className="mt-4 h-11 w-full rounded-lg border border-app-line bg-white text-sm font-black text-app-coralDark" onClick={() => { setMode(isRegister ? 'login' : 'register'); setError(''); setMessage(''); }} type="button">
          {isRegister ? 'Ja tenho acesso' : 'Criar novo acesso'}
        </button>
      </section>
    </main>
  );
}

