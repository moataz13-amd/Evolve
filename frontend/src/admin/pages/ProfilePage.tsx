import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { database } from '../../lib/supabase';
import { PageHeader } from '../components/UI';
export default function ProfilePage() {
  const { admin, session, reload } = useAuth();
  const [name, setName] = useState(admin?.name || '');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  async function save(action: () => Promise<void>) {
    setPending(true);
    setError('');
    setNotice('');
    try {
      await action();
      setNotice('Account updated.');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to update account.');
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <PageHeader title="Your profile" subtitle="EVOLVE team account" />
      <div className="admin-overview-grid">
        <section className="admin-card">
          <h2>Profile</h2>
          <p>
            {session?.user.email} · {admin?.role.replaceAll('_', ' ')}
          </p>
          <form
            className="admin-form"
            onSubmit={(e) => {
              e.preventDefault();
              void save(async () => {
                const { error } = await database().rpc('rename_admin', { p_name: name });
                if (error) throw error;
                reload();
              });
            }}
          >
            <label>
              Name
              <input
                required
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <button className="admin-button admin-primary" disabled={pending}>
              Save name
            </button>
          </form>
        </section>
        <section className="admin-card">
          <h2>Password</h2>
          <form
            className="admin-form"
            onSubmit={(e) => {
              e.preventDefault();
              void save(async () => {
                const { error } = await database().auth.updateUser({ password });
                if (error) throw error;
                setPassword('');
              });
            }}
          >
            <label>
              New password
              <input
                required
                type="password"
                autoComplete="new-password"
                minLength={12}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button className="admin-button admin-primary" disabled={pending}>
              Update password
            </button>
          </form>
        </section>
      </div>
      {notice && (
        <p role="status" className="admin-notice">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="admin-error">
          {error}
        </p>
      )}
    </>
  );
}
