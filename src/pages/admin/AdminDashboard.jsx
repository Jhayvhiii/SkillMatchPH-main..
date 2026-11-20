import { motion } from 'framer-motion';
import { Users, Building2, BookOpen, RefreshCw } from 'lucide-react';
import useSWR from 'swr';
import { supabase } from '../../lib/supabase';

// ─── Module-level fetcher (stable reference, async-parallel) ─────────────────
const fetchDashboardData = async () => {
  const [studentsResult, universitiesResult, programsResult] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student'),
    supabase.from('universities').select('id', { count: 'exact', head: true }),
    supabase.from('programs').select('id', { count: 'exact', head: true }),
  ]);

  if (studentsResult.error) throw studentsResult.error;
  if (universitiesResult.error) throw universitiesResult.error;
  if (programsResult.error) throw programsResult.error;

  return {
    totalStudents: studentsResult.count ?? 0,
    totalUniversities: universitiesResult.count ?? 0,
    totalPrograms: programsResult.count ?? 0,
  };
};

// ─── Hoisted static config (rendering-hoist-jsx) ─────────────────────────────
const STAT_CONFIG = [
  { key: 'totalStudents',     label: 'Total Students',     icon: Users,     color: 'var(--accent-teal)'   },
  { key: 'totalUniversities', label: 'Total Universities', icon: Building2, color: 'var(--accent-violet)' },
  { key: 'totalPrograms',     label: 'Total Programs',     icon: BookOpen,  color: '#06b6d4'              },
];

// ─── Stat Card component ─────────────────────────────────────────────────────
const StatCard = ({ label, value, Icon, color, index, loading }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.08 }}
    className="stat-card"
    style={{ position: 'relative', overflow: 'hidden' }}
  >
    {/* Accent glow */}
    <div style={{
      position: 'absolute', top: '-20px', right: '-20px',
      width: '80px', height: '80px', borderRadius: '50%',
      background: color, opacity: 0.06, filter: 'blur(20px)',
      pointerEvents: 'none',
    }} />

    <div style={{ color, marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <Icon size={22} />
    </div>
    <div className="stat-label">{label}</div>
    <div className="stat-value" style={{ color, fontSize: '2.2rem' }}>
      {loading ? (
        <span style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>—</span>
      ) : (
        value ?? 0
      )}
    </div>
  </motion.div>
);

// ─── Main component ───────────────────────────────────────────────────────────
const AdminDashboard = () => {
  const { data, error, isLoading, mutate } = useSWR('admin-dashboard', fetchDashboardData, {
    refreshInterval: 60_000,
  });

  const stats = STAT_CONFIG.map(({ key, label, icon: Icon, color }, i) => ({
    label, Icon, color, index: i,
    value: data ? data[key] : null,
  }));

  return (
    <div className="admin-page">
      <header className="page-header">
        <div>
          <h1 style={{ marginBottom: '0.5rem' }}>Dashboard Overview</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            {error
              ? 'Failed to load data — check your connection.'
              : 'Welcome back, Administrator.'}
          </p>
        </div>

        <button
          onClick={() => mutate()}
          className="refresh-btn"
          title="Refresh dashboard"
          aria-label="Refresh dashboard data"
        >
          <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </header>

      {/* ── Stat cards ── */}
      <div className="stats-grid">
        {stats.map(({ label, Icon, color, index, value }) => (
          <StatCard
            key={label}
            label={label}
            value={value}
            Icon={Icon}
            color={color}
            index={index}
            loading={isLoading}
          />
        ))}
      </div>
    </div>
  );
};

export default AdminDashboard;
