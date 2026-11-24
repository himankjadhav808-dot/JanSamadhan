/**
 * Feed.jsx — Role-contextual feed header banner.
 *
 * Renders a greeting card at the top of the community feed that
 * adapts its copy, colour, and call-to-action to the viewer's role:
 *
 *   citizen     → blue  — prompt to report issues
 *   sub-admin   → emerald — department workload summary
 *   super-admin → purple  — platform-wide admin shortcuts
 *
 * Usage (drop into Dashboard.jsx or any feed page):
 *   import FeedHeader from '../../components/layout/Feed';
 *   <FeedHeader issueCount={issues.length} resolvedCount={resolvedCount} />
 */

import { Link } from 'react-router-dom';
import {
  Plus, LayoutDashboard, Globe,
  ShieldAlert, Building2, User as UserIcon,
  Megaphone,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

// ---------------------------------------------------------------------------
// Role config
// ---------------------------------------------------------------------------
function getRoleConfig(user) {
  const role = user?.role || 'citizen';

  const configs = {
    citizen: {
      icon:        UserIcon,
      accentBg:    'bg-gradient-to-r from-blue-600 to-blue-500',
      cardBg:      'bg-blue-50 border-blue-100',
      textColor:   'text-blue-700',
      labelColor:  'text-blue-500',
      badgeBg:     'bg-blue-600',
      greeting:    `Welcome back, ${user?.name?.split(' ')[0] || 'Citizen'}!`,
      subtitle:    'See what\'s happening in your neighbourhood. Spotted a problem? Report it in seconds.',
      cta: {
        label: 'Report an Issue',
        to:    '/report',
        icon:  Plus,
        cls:   'bg-blue-600 hover:bg-blue-700 text-white',
      },
      secondaryCta: null,
    },
    'sub-admin': {
      icon:        Building2,
      accentBg:    'bg-gradient-to-r from-emerald-600 to-emerald-500',
      cardBg:      'bg-emerald-50 border-emerald-100',
      textColor:   'text-emerald-800',
      labelColor:  'text-emerald-600',
      badgeBg:     'bg-emerald-600',
      greeting:    `${user?.department || 'Department'} Dashboard`,
      subtitle:    'Review and resolve incoming issues assigned to your department.',
      cta: {
        label: 'Open Work Queue',
        to:    '/authority/dashboard',
        icon:  LayoutDashboard,
        cls:   'bg-emerald-600 hover:bg-emerald-700 text-white',
      },
      secondaryCta: {
        label: 'Department Reports',
        to:    '/my-reports',
        cls:   'border border-emerald-300 text-emerald-700 hover:bg-emerald-100',
      },
    },
    'super-admin': {
      icon:        ShieldAlert,
      accentBg:    'bg-gradient-to-r from-purple-700 to-purple-500',
      cardBg:      'bg-purple-50 border-purple-100',
      textColor:   'text-purple-900',
      labelColor:  'text-purple-600',
      badgeBg:     'bg-purple-700',
      greeting:    'Super Admin Overview',
      subtitle:    'Full platform visibility. Manage sub-admins, departments, and issue data.',
      cta: {
        label: 'Global Dashboard',
        to:    '/admin/dashboard',
        icon:  Globe,
        cls:   'bg-purple-700 hover:bg-purple-800 text-white',
      },
      secondaryCta: {
        label: 'All Reports',
        to:    '/my-reports',
        cls:   'border border-purple-300 text-purple-700 hover:bg-purple-100',
      },
    },
  };

  return configs[role] ?? configs.citizen;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function FeedHeader({ issueCount = 0, resolvedCount = 0 }) {
  const { user } = useAuth();
  const cfg      = getRoleConfig(user);
  const RoleIcon = cfg.icon;
  const CtaIcon  = cfg.cta.icon;

  // Resolution rate (only meaningful with data)
  const resolutionRate = issueCount > 0
    ? Math.round((resolvedCount / issueCount) * 100)
    : null;

  return (
    <div className={`mb-5 overflow-hidden rounded-2xl border ${cfg.cardBg}`}>

      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Left — identity + greeting */}
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white ${cfg.badgeBg}`}>
            <RoleIcon className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className={`text-sm font-bold ${cfg.textColor}`}>{cfg.greeting}</h2>
              {/* Role pill */}
              {user && (
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white ${cfg.badgeBg}`}>
                  <Megaphone className="h-2.5 w-2.5" />
                  {user.role === 'citizen'     ? 'Citizen'
                   : user.role === 'sub-admin' ? `${user.department || 'Dept'} Officer`
                   : 'Super Admin'}
                </span>
              )}
            </div>
            <p className={`mt-0.5 text-xs ${cfg.labelColor}`}>{cfg.subtitle}</p>

            {/* Inline stats for sub-admin / super-admin */}
            {user?.role !== 'citizen' && issueCount > 0 && (
              <div className="mt-2 flex flex-wrap gap-3">
                <span className={`text-xs font-semibold ${cfg.textColor}`}>
                  {issueCount} issue{issueCount !== 1 ? 's' : ''} in feed
                </span>
                {resolutionRate !== null && (
                  <span className={`text-xs font-semibold ${cfg.textColor}`}>
                    {resolutionRate}% resolved
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right — CTAs */}
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {cfg.secondaryCta && (
            <Link
              to={cfg.secondaryCta.to}
              className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition ${cfg.secondaryCta.cls}`}
            >
              {cfg.secondaryCta.label}
            </Link>
          )}
          <Link
            to={cfg.cta.to}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold shadow-sm transition ${cfg.cta.cls}`}
          >
            <CtaIcon className="h-3.5 w-3.5" />
            {cfg.cta.label}
          </Link>
        </div>
      </div>
    </div>
  );
}
