import { useCallback, useEffect, useRef, useState, useDeferredValue, memo, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, RefreshCw, X, Loader, Check, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Users, Archive, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import useSWR from 'swr';
import { useLocation, useSearchParams } from 'react-router-dom';

// ─── Fetcher (client-swr-dedup) ──────────────────────────────────────────────
const fetchStudents = async () => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'student')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

// ─── Search Bar ─────────────────────────────────────────────────────────────
const SearchBar = memo(({ value, onChange, inputRef }) => {
  return (
    <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
      <Search
        size={18}
        style={{
          position: 'absolute',
          left: '1rem',
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--text-secondary)',
          opacity: value ? 1 : 0.5,
          pointerEvents: 'none'
        }}
      />
      <input
        ref={inputRef}
        type="text"
        placeholder="Search by name, username, student no..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          padding: '0.65rem 2.5rem 0.65rem 2.8rem',
          background: 'var(--field-bg)',
          border: '1px solid var(--glass-border)',
          borderRadius: '12px',
          fontSize: '0.9rem',
          color: 'var(--text-primary)',
          outline: 'none',
          boxSizing: 'border-box'
        }}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          style={{
            position: 'absolute',
            right: '0.75rem',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex'
          }}
          aria-label="Clear search"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
});

// ─── Main Component ───────────────────────────────────────────────────────────

const StudentManagement = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const targetStudentId = location.state?.highlightStudentId || searchParams.get('student');
  const { data: students = [], isLoading, mutate } = useSWR('admin-students', fetchStudents);

  // Filters & State
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'archived'
  const [strandFilter, setStrandFilter] = useState('ALL');
  const [highlightedStudentId, setHighlightedStudentId] = useState(null);
  const [approvingId, setApprovingId] = useState(null);
  const [archivingId, setArchivingId] = useState(null);

  // Pagination (Fixes infinite scrolling!)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const searchInputRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Counts for tabs
  const counts = useMemo(() => {
    let nonArchived = 0;
    let archived = 0;
    students.forEach((s) => {
      if (s.status === 'archived') archived++;
      else nonArchived++;
    });
    return {
      all: nonArchived,
      archived: archived
    };
  }, [students]);

  // Available strands for quick filter
  const availableStrands = useMemo(() => {
    const set = new Set();
    students.forEach((s) => {
      if (s.shs_strand) set.add(s.shs_strand);
    });
    return Array.from(set).sort();
  }, [students]);

  // Target student auto-scroll & auto-tab switch
  useEffect(() => {
    if (!targetStudentId || isLoading || !students.some((student) => student.id === targetStudentId)) return undefined;

    const targetStudent = students.find((s) => s.id === targetStudentId);
    if (targetStudent && targetStudent.status === 'archived') {
      setActiveTab('archived');
    } else {
      setActiveTab('all');
    }

    setSearchTerm('');
    setHighlightedStudentId(targetStudentId);
    const scrollTimer = window.setTimeout(() => {
      document.getElementById(`student-${targetStudentId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
    const highlightTimer = window.setTimeout(() => setHighlightedStudentId(null), 4000);

    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(highlightTimer);
    };
  }, [isLoading, location.key, students, targetStudentId]);

  // Approve action
  const handleApprove = useCallback(async (id) => {
    setApprovingId(id);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: 'approved' })
        .eq('id', id);

      if (error) throw error;
      mutate(prev => prev.map(s => (s.id === id ? { ...s, status: 'approved' } : s)), false);
    } catch (err) {
      alert('Error approving student: ' + err.message);
    } finally {
      setApprovingId(null);
    }
  }, [mutate]);

  // Archive action
  const handleArchive = useCallback(async (id) => {
    setArchivingId(id);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: 'archived' })
        .eq('id', id);

      if (error) throw error;
      mutate(prev => prev.map(s => (s.id === id ? { ...s, status: 'archived' } : s)), false);
    } catch (err) {
      alert('Error archiving student: ' + err.message);
    } finally {
      setArchivingId(null);
    }
  }, [mutate]);

  // Unarchive / Restore action
  const handleUnarchive = useCallback(async (id) => {
    setArchivingId(id);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: 'approved' })
        .eq('id', id);

      if (error) throw error;
      mutate(prev => prev.map(s => (s.id === id ? { ...s, status: 'approved' } : s)), false);
    } catch (err) {
      alert('Error unarchiving student: ' + err.message);
    } finally {
      setArchivingId(null);
    }
  }, [mutate]);

  // Filtered dataset
  const filteredStudents = useMemo(() => {
    const lowerQuery = deferredSearchTerm.toLowerCase();
    return students.filter((student) => {
      // Tab filter
      if (activeTab === 'archived') {
        if (student.status !== 'archived') return false;
      } else {
        if (student.status === 'archived') return false;
      }

      // Strand filter
      if (strandFilter !== 'ALL' && student.shs_strand !== strandFilter) return false;

      // Search query
      if (!lowerQuery) return true;
      const fullName = `${student.first_name ?? ''} ${student.last_name ?? ''}`.toLowerCase();
      return fullName.includes(lowerQuery)
        || student.id.toLowerCase().includes(lowerQuery)
        || student.username?.toLowerCase().includes(lowerQuery)
        || student.student_no?.toLowerCase().includes(lowerQuery);
    });
  }, [students, deferredSearchTerm, activeTab, strandFilter]);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [deferredSearchTerm, activeTab, strandFilter, pageSize]);

  // Calculate pagination slice
  const totalItems = filteredStudents.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);

  const paginatedStudents = useMemo(() => {
    const startIndex = (validCurrentPage - 1) * pageSize;
    return filteredStudents.slice(startIndex, startIndex + pageSize);
  }, [filteredStudents, validCurrentPage, pageSize]);

  const startIndex = totalItems === 0 ? 0 : (validCurrentPage - 1) * pageSize + 1;
  const endIndex = Math.min(validCurrentPage * pageSize, totalItems);

  return (
    <div className="admin-page" style={{ maxWidth: '1280px', margin: '0 auto', paddingBottom: '2rem' }}>
      
      {/* Page Header */}
      <header className="page-header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.85rem', fontWeight: 700 }}>Student Management</h1>
          <p style={{ color: 'var(--text-secondary)', margin: '0.35rem 0 0', fontSize: '0.95rem' }}>
            Organized student records and pending approvals.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            onClick={() => mutate()}
            className="refresh-btn"
            title="Refresh list"
            style={{
              padding: '0.65rem',
              borderRadius: '12px',
              border: '1px solid var(--glass-border)',
              background: 'var(--glass-bg)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      {/* Main Glass Control Panel (Tabs + Search + Filters) */}
      <div className="glass-card" style={{ padding: '1.25rem', borderRadius: '18px', marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        
        {/* Top Bar: Tabs & Quick Category */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          
          {/* Segmented Tab Filter */}
          <div style={{
            display: 'inline-flex',
            padding: '4px',
            borderRadius: '12px',
            background: 'var(--field-bg)',
            border: '1px solid var(--glass-border)',
            gap: '4px'
          }}>
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 0.9rem',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'all' ? 'var(--accent-teal)' : 'transparent',
                color: activeTab === 'all' ? 'var(--on-accent)' : 'var(--text-secondary)',
                fontWeight: activeTab === 'all' ? 700 : 500,
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <Users size={15} /> All Students
              <span style={{
                fontSize: '0.75rem',
                padding: '0.1rem 0.45rem',
                borderRadius: '999px',
                background: activeTab === 'all' ? 'rgba(0,0,0,0.15)' : 'var(--glass-border)',
                color: activeTab === 'all' ? 'var(--on-accent)' : 'var(--text-primary)'
              }}>
                {counts.all}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('archived')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 0.9rem',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'archived' ? 'var(--accent-teal)' : 'transparent',
                color: activeTab === 'archived' ? 'var(--on-accent)' : 'var(--text-secondary)',
                fontWeight: activeTab === 'archived' ? 700 : 500,
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <Archive size={15} /> Archived
              <span style={{
                fontSize: '0.75rem',
                padding: '0.1rem 0.45rem',
                borderRadius: '999px',
                background: activeTab === 'archived' ? 'rgba(0,0,0,0.15)' : 'var(--glass-border)',
                color: activeTab === 'archived' ? 'var(--on-accent)' : 'var(--text-primary)'
              }}>
                {counts.archived}
              </span>
            </button>
          </div>

          {/* Strand Quick Filter Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Strand:</span>
            <select
              value={strandFilter}
              onChange={(e) => setStrandFilter(e.target.value)}
              style={{
                padding: '0.45rem 0.75rem',
                borderRadius: '10px',
                border: '1px solid var(--glass-border)',
                background: 'var(--field-bg)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="ALL">All Strands</option>
              {availableStrands.map((strand) => (
                <option key={strand} value={strand}>{strand}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Bottom Bar: Search + Rows per page */}
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <SearchBar value={searchTerm} onChange={setSearchTerm} inputRef={searchInputRef} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Show:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              style={{
                padding: '0.55rem 0.75rem',
                borderRadius: '10px',
                border: '1px solid var(--glass-border)',
                background: 'var(--field-bg)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value={5}>5 / page</option>
              <option value={10}>10 / page</option>
              <option value={20}>20 / page</option>
              <option value={50}>50 / page</option>
            </select>
          </div>
        </div>
      </div>

      {/* Structured Table Container */}
      <div className="data-table-container glass-card" style={{ padding: 0, borderRadius: '18px', overflow: 'hidden' }}>
        <table className="data-table" style={{ margin: 0, width: '100%' }}>
          <thead>
            <tr>
              <th style={{ padding: '1rem 1.25rem' }}>Name</th>
              <th>Username</th>
              <th>Student No.</th>
              <th>Grade</th>
              <th>SHS Strand</th>
              <th>Registered</th>
              <th style={{ textAlign: 'right', paddingRight: '1.25rem' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence mode="popLayout">
              {paginatedStudents.map((student, i) => {
                const isPending = student.status === 'pending';
                const isCurrentApproving = approvingId === student.id;

                return (
                  <motion.tr
                    key={student.id}
                    id={`student-${student.id}`}
                    className={highlightedStudentId === student.id ? 'student-row-highlighted' : ''}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.15, delay: i * 0.015 }}
                    style={{
                      background: isPending ? 'rgba(251, 191, 36, 0.02)' : 'transparent'
                    }}
                  >
                    <td style={{ fontWeight: 600, padding: '1rem 1.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          background: 'rgba(0, 242, 254, 0.1)',
                          color: 'var(--accent-teal)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.85rem',
                          fontWeight: 700,
                          flexShrink: 0
                        }}>
                          {student.first_name ? student.first_name.charAt(0).toUpperCase() : 'S'}
                        </div>
                        <div>
                          <div>{student.first_name} {student.last_name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{student.email || ''}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ color: 'var(--accent-teal)', fontSize: '0.85rem', fontFamily: 'monospace', fontWeight: 600 }}>
                      @{student.username || 'not_set'}
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontFamily: 'monospace' }}>
                      {student.student_no || '—'}
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>
                      {student.grade_level ? `Grade ${student.grade_level}` : '—'}
                    </td>
                    <td>
                      {student.shs_strand ? (
                        <span style={{
                          padding: '0.2rem 0.55rem',
                          borderRadius: '6px',
                          background: 'rgba(0, 242, 254, 0.08)',
                          border: '1px solid rgba(0, 242, 254, 0.2)',
                          color: 'var(--accent-teal)',
                          fontSize: '0.78rem',
                          fontWeight: 600
                        }}>
                          {student.shs_strand}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                          {student.shs_track || '—'}
                        </span>
                      )}
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      {new Date(student.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td style={{ textAlign: 'right', paddingRight: '1.25rem' }}>
                      {activeTab === 'archived' ? (
                        <button
                          type="button"
                          onClick={() => handleUnarchive(student.id)}
                          disabled={archivingId === student.id}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            width: 'fit-content',
                            padding: '0.35rem 0.7rem',
                            borderRadius: '8px',
                            border: '1px solid rgba(0, 242, 254, 0.35)',
                            background: 'rgba(0, 242, 254, 0.12)',
                            color: 'var(--accent-teal)',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            boxSizing: 'border-box',
                            transition: 'all 0.2s ease'
                          }}
                          title="Restore student to active"
                        >
                          {archivingId === student.id ? (
                            <Loader size={13} className="animate-spin" />
                          ) : (
                            <RotateCcw size={13} />
                          )}
                          Unarchive
                        </button>
                      ) : (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          {isPending ? (
                            <button
                              type="button"
                              onClick={() => handleApprove(student.id)}
                              disabled={isCurrentApproving}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                width: 'fit-content',
                                color: '#000',
                                background: 'var(--accent-teal)',
                                border: 'none',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                padding: '0.35rem 0.7rem',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                boxShadow: '0 2px 8px rgba(0, 242, 254, 0.25)',
                                transition: 'all 0.2s ease',
                                whiteSpace: 'nowrap',
                                boxSizing: 'border-box'
                              }}
                            >
                              {isCurrentApproving ? (
                                <Loader size={13} className="animate-spin" />
                              ) : (
                                <Check size={13} />
                              )}
                              Approve
                            </button>
                          ) : null}

                          <button
                            type="button"
                            onClick={() => handleArchive(student.id)}
                            disabled={archivingId === student.id}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              width: 'fit-content',
                              padding: '0.35rem 0.7rem',
                              borderRadius: '8px',
                              border: '1px solid rgba(239, 68, 68, 0.35)',
                              background: 'rgba(239, 68, 68, 0.12)',
                              color: '#ef4444',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                              boxSizing: 'border-box',
                              transition: 'all 0.2s ease'
                            }}
                            title="Archive this student"
                          >
                            {archivingId === student.id ? (
                              <Loader size={13} className="animate-spin" />
                            ) : (
                              <Archive size={13} />
                            )}
                            Archive
                          </button>
                        </div>
                      )}
                    </td>
                  </motion.tr>
                );
              })}
            </AnimatePresence>

            {/* Empty state */}
            {!isLoading && filteredStudents.length === 0 && (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '4.5rem 1rem', color: 'var(--text-secondary)' }}>
                  <Search size={36} style={{ opacity: 0.2, marginBottom: '0.75rem' }} />
                  <p style={{ margin: 0, fontSize: '0.95rem' }}>No student records found matching your criteria.</p>
                </td>
              </tr>
            )}

            {/* Loading state */}
            {isLoading && students.length === 0 && (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '4.5rem 1rem' }}>
                  <Loader className="animate-spin" size={32} color="var(--accent-teal)" style={{ margin: '0 auto' }} />
                  <p style={{ marginTop: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Loading students...</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* ─── Compact Pagination & Footer (Eliminates Scrolling) ───────────────── */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.85rem 1.25rem',
          borderTop: '1px solid var(--glass-border)',
          background: 'var(--glass-bg)',
          fontSize: '0.85rem',
          color: 'var(--text-secondary)',
          flexWrap: 'wrap',
          gap: '0.75rem'
        }}>
          <div>
            Showing <strong style={{ color: 'var(--text-primary)' }}>{startIndex}</strong> – <strong style={{ color: 'var(--text-primary)' }}>{endIndex}</strong> of <strong style={{ color: 'var(--text-primary)' }}>{totalItems}</strong> students
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <button
              type="button"
              onClick={() => setCurrentPage(1)}
              disabled={validCurrentPage <= 1}
              style={{
                padding: '0.35rem 0.5rem',
                borderRadius: '8px',
                border: '1px solid var(--glass-border)',
                background: 'var(--glass-bg)',
                color: validCurrentPage <= 1 ? 'var(--text-secondary)' : 'var(--text-primary)',
                opacity: validCurrentPage <= 1 ? 0.35 : 1,
                cursor: validCurrentPage <= 1 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
              title="First page"
            >
              <ChevronsLeft size={16} />
            </button>

            <button
              type="button"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={validCurrentPage <= 1}
              style={{
                padding: '0.35rem 0.65rem',
                borderRadius: '8px',
                border: '1px solid var(--glass-border)',
                background: 'var(--glass-bg)',
                color: validCurrentPage <= 1 ? 'var(--text-secondary)' : 'var(--text-primary)',
                opacity: validCurrentPage <= 1 ? 0.35 : 1,
                cursor: validCurrentPage <= 1 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.2rem'
              }}
              title="Previous page"
            >
              <ChevronLeft size={16} /> Prev
            </button>

            <span style={{ padding: '0 0.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Page {validCurrentPage} of {totalPages}
            </span>

            <button
              type="button"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={validCurrentPage >= totalPages}
              style={{
                padding: '0.35rem 0.65rem',
                borderRadius: '8px',
                border: '1px solid var(--glass-border)',
                background: 'var(--glass-bg)',
                color: validCurrentPage >= totalPages ? 'var(--text-secondary)' : 'var(--text-primary)',
                opacity: validCurrentPage >= totalPages ? 0.35 : 1,
                cursor: validCurrentPage >= totalPages ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.2rem'
              }}
              title="Next page"
            >
              Next <ChevronRight size={16} />
            </button>

            <button
              type="button"
              onClick={() => setCurrentPage(totalPages)}
              disabled={validCurrentPage >= totalPages}
              style={{
                padding: '0.35rem 0.5rem',
                borderRadius: '8px',
                border: '1px solid var(--glass-border)',
                background: 'var(--glass-bg)',
                color: validCurrentPage >= totalPages ? 'var(--text-secondary)' : 'var(--text-primary)',
                opacity: validCurrentPage >= totalPages ? 0.35 : 1,
                cursor: validCurrentPage >= totalPages ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
              title="Last page"
            >
              <ChevronsRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentManagement;
