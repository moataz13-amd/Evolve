import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { BrandLogo } from '../../components/BrandLogo';
import { useAuth } from '../../context/AuthContext';
import { database, isConfigured } from '../../lib/supabase';
const schema = z.object({
  email: z.string().email('Enter a valid email.'),
  password: z.string().min(1, 'Enter your password.'),
});
export default function LoginPage() {
  const { admin, session, loading, error: authError } = useAuth();
  const [error, setError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });
  if (admin && !loading) return <Navigate to="/admin" replace />;
  return (
    <div className="admin-login">
      <div className="admin-login-brand">
        <BrandLogo light />
        <span className="admin-eyebrow">EVOLVE / INTERNAL OPERATIONS</span>
        <h1>
          BUILT FOR
          <br />
          THE WORK.
        </h1>
        <p>Your catalog. Your content. Your next move.</p>
      </div>
      <div className="admin-login-panel">
        <span className="admin-eyebrow">TEAM ACCESS</span>
        <h2>Welcome back.</h2>
        <p>Sign in with your EVOLVE team account.</p>
        {authError && (
          <p role="alert" className="admin-error">
            {authError}
          </p>
        )}
        {session && !loading && !admin && (
          <p role="alert" className="admin-error">
            This account has no active team profile. Contact your store administrator.
          </p>
        )}
        {!isConfigured ? (
          <div className="admin-config-message">
            <h3>Connect Supabase to begin.</h3>
            <p>
              Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment, apply the SQL
              migrations, and create your first administrator. No demo admin credentials are
              provided.
            </p>
            <a href="/">Return to the storefront</a>
          </div>
        ) : (
          <form
            className="admin-form"
            onSubmit={handleSubmit(async (values) => {
              setError('');
              const { error } = await database().auth.signInWithPassword(values);
              if (error) setError(error.message);
            })}
          >
            <label>
              Email
              <input type="email" autoComplete="username" {...register('email')} />
              {errors.email && <small className="admin-error">{errors.email.message}</small>}
            </label>
            <label>
              Password
              <input type="password" autoComplete="current-password" {...register('password')} />
              {errors.password && <small className="admin-error">{errors.password.message}</small>}
            </label>
            {error && (
              <p role="alert" className="admin-error">
                {error}
              </p>
            )}
            <button type="submit" className="admin-button admin-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </button>
            <p className="admin-login-note">
              Team accounts are invited by your administrator. There is no public admin
              registration.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
