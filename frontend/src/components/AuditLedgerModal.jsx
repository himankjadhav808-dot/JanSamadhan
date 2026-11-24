import { useState, useEffect } from 'react';
import { X, Shield, CheckCircle, AlertCircle, Copy, LoaderCircle, ShieldCheck } from 'lucide-react';
import api from '../lib/api';

export default function AuditLedgerModal({ issueId, title, onClose }) {
  const [auditLogs, setAuditLogs] = useState([]);
  const [integrity, setIntegrity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copiedHash, setCopiedHash] = useState(null);

  useEffect(() => {
    const fetchAudit = async () => {
      try {
        setLoading(true);
        const { data } = await api.get(`/issues/${issueId}/audit`);
        setAuditLogs(data.auditLogs || []);
        setIntegrity(data.integrity);
      } catch (err) {
        console.error('Failed to fetch audit logs:', err);
      } finally {
        setLoading(false);
      }
    };

    if (issueId) {
      fetchAudit();
    }
  }, [issueId]);

  const copyHash = (hash) => {
    navigator.clipboard.writeText(hash).catch(() => {});
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const formatDate = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getActionIcon = (action) => {
    if (action.includes('CREATED')) return <Shield className="h-4 w-4 text-blue-500" />;
    if (action.includes('APPROVED')) return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (action.includes('REJECTED')) return <AlertCircle className="h-4 w-4 text-red-500" />;
    if (action.includes('ESCALATED')) return <AlertCircle className="h-4 w-4 text-amber-500" />;
    return <Shield className="h-4 w-4 text-slate-500" />;
  };

  const getActionLabel = (action) => {
    return action
      .split('_')
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ');
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-hidden">
      {/* Backdrop Click to Close */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Responsive Modal / Mobile Drawer Shell */}
      <div className="relative bg-white w-full sm:max-w-lg max-h-[90vh] sm:max-h-[85vh] rounded-t-3xl sm:rounded-3xl flex flex-col shadow-2xl border border-slate-100 z-10 overflow-hidden transition-all animate-in slide-in-from-bottom sm:zoom-in-95">
        
        {/* Mobile Grab Bar / Header (Pinned) */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 flex-shrink-0 bg-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl flex-shrink-0">
              <ShieldCheck className="w-5 h-5"/>
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">Cryptographic Audit Ledger</h3>
              <p className="text-[11px] sm:text-xs text-slate-500 font-medium truncate">{title || `Issue #${String(issueId).slice(-6).toUpperCase()}`}</p>
            </div>
          </div>
          
          {/* X Close Button */}
          <button 
            onClick={onClose} 
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors flex-shrink-0"
            aria-label="Close modal"
          >
            <X className="w-5 h-5"/>
          </button>
        </div>

        {/* Scrollable Body Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3 sm:space-y-4 flex-1 overscroll-contain">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <LoaderCircle className="h-8 w-8 animate-spin text-slate-400" />
              <span className="ml-3 text-sm text-slate-500">Loading audit logs...</span>
            </div>
          ) : (
            <>
              {/* Status Verification Badge */}
              {integrity && (
                <div className={`p-3 sm:p-4 rounded-2xl border flex items-center gap-2.5 text-xs sm:text-sm font-semibold ${
                  integrity.valid
                    ? 'bg-emerald-50 border-emerald-200/80 text-emerald-800'
                    : 'bg-red-50 border-red-200/80 text-red-800'
                }`}>
                  {integrity.valid ? (
                    <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 flex-shrink-0"/>
                  ) : (
                    <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 flex-shrink-0"/>
                  )}
                  <span className="leading-tight">
                    {integrity.valid 
                      ? 'Ledger Verified: Hash chain is intact & mathematically tamper-proof.' 
                      : '⚠️ Ledger Tampered'}
                  </span>
                  {!integrity.valid && integrity.reason && (
                    <p className="mt-1 text-[10px] sm:text-xs text-red-700">{integrity.reason}</p>
                  )}
                </div>
              )}

              {/* Sequential Audit Block List */}
              {auditLogs.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm">
                  No audit logs available for this issue.
                </div>
              ) : (
                <div className="space-y-2.5 sm:space-y-3">
                  {auditLogs.map((block, index) => (
                    <div key={index} className="p-3 sm:p-4 bg-slate-50 border border-slate-200/60 rounded-2xl space-y-2 text-xs">
                      <div className="flex items-center justify-between gap-2 font-bold flex-wrap">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[10px] flex items-center justify-center font-bold flex-shrink-0">
                            {index}
                          </span>
                          {getActionIcon(block.action)}
                          <span className="text-slate-800 font-bold truncate">{getActionLabel(block.action)}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-normal">
                          {formatDate(block.timestamp)}
                        </span>
                      </div>

                      <div className="text-slate-600 font-medium text-[11px] space-y-1 pt-1 border-t border-slate-200/40">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-400 flex-shrink-0">Actor:</span>
                          <span className="font-bold text-slate-800 truncate">{block.actorRole} ({String(block.actorId).slice(-8)})</span>
                        </div>
                        <div className="flex items-center justify-between gap-2 font-mono text-[10px]">
                          <span className="text-slate-400 font-sans flex-shrink-0">Prev Hash:</span>
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-slate-500 truncate max-w-[200px] sm:max-w-[260px]">
                              {block.previousHash === 'GENESIS'
                                ? 'GENESIS'
                                : block.previousHash.slice(0, 16) + '...'}
                            </span>
                            {block.previousHash !== 'GENESIS' && (
                              <button
                                type="button"
                                onClick={() => copyHash(block.previousHash)}
                                className="shrink-0 text-slate-400 hover:text-slate-600"
                                aria-label="Copy hash"
                              >
                                {copiedHash === block.previousHash ? (
                                  <CheckCircle className="h-3 w-3 text-green-500" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2 font-mono text-[10px]">
                          <span className="text-slate-400 font-sans flex-shrink-0">Curr Hash:</span>
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-semibold text-indigo-600 truncate max-w-[200px] sm:max-w-[260px]">
                              {block.currentHash.slice(0, 16) + '...'}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyHash(block.currentHash)}
                              className="shrink-0 text-slate-400 hover:text-slate-600"
                              aria-label="Copy hash"
                            >
                              {copiedHash === block.currentHash ? (
                                <CheckCircle className="h-3 w-3 text-green-500" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer (Pinned Close Button) */}
        <div className="p-3.5 sm:p-4 border-t border-slate-100 bg-white flex-shrink-0">
          <div className="flex items-center justify-between gap-3 sm:gap-4">
            <span className="text-[10px] sm:text-xs text-slate-500 flex-1">
              {auditLogs.length} audit blocks • SHA-256 cryptographic chain
            </span>
            <button
              onClick={onClose}
              className="py-3 sm:py-2.5 px-4 sm:px-6 bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white text-xs font-bold rounded-2xl transition-all shadow-md whitespace-nowrap"
            >
              Close Ledger
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
