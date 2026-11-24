import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Trophy, Star, Zap, Award, CheckCircle2, Lock, LoaderCircle } from 'lucide-react';
import api from '../lib/api';

const BADGE_CONFIG = [
  {
    id: 'first_report',
    name: 'First Report',
    desc: 'Submitted your first civic issue',
    icon: Star,
    color: 'text-amber-500',
    bg: 'bg-amber-50',
    points: 10,
  },
  {
    id: 'problem_solver',
    name: 'Problem Solver',
    desc: '5 of your reports were resolved',
    icon: CheckCircle2,
    color: 'text-green-600',
    bg: 'bg-green-50',
    points: 50,
  },
  {
    id: 'community_voice',
    name: 'Community Voice',
    desc: 'Received 25 upvotes on your reports',
    icon: Zap,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    points: 30,
  },
  {
    id: 'civic_champion',
    name: 'Civic Champion',
    desc: '20 issues reported',
    icon: Trophy,
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    points: 100,
  },
  {
    id: 'verified_citizen',
    name: 'Verified Citizen',
    desc: 'Profile fully verified',
    icon: Award,
    color: 'text-cyan-600',
    bg: 'bg-cyan-50',
    points: 20,
  },
  {
    id: 'streak_hero',
    name: 'Streak Hero',
    desc: 'Reported issues 7 days in a row',
    icon: Star,
    color: 'text-rose-600',
    bg: 'bg-rose-50',
    points: 75,
  },
];

const REWARDS = [
  { id: 1, name: 'Priority Support',       cost: 100, desc: 'Your issues are reviewed first by authorities' },
  { id: 2, name: 'Verified Reporter Badge',cost: 200, desc: 'Show a verified badge on all your reports'    },
  { id: 3, name: 'Anonymous Reporting',    cost: 150, desc: 'Submit reports without showing your public ID' },
];

export default function Rewards() {
  const { user } = useAuth();
  const [userStats, setUserStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserStats = async () => {
      if (!user?._id) return;
      
      try {
        setLoading(true);
        const { data } = await api.get(`/users/${user._id}`);
        setUserStats(data.user);
      } catch (err) {
        console.error('Failed to fetch user stats:', err);
        // Fallback to user object from auth context
        setUserStats({
          totalPoints: user?.totalPoints || 0,
          issuesRaised: 0,
          problemsSolved: 0,
          totalUpvotesReceived: 0,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchUserStats();
  }, [user?._id]);

  // Calculate badge states dynamically
  const totalPoints = userStats?.totalPoints || user?.totalPoints || 0;
  const totalReports = userStats?.issuesRaised || 0;
  const resolvedCount = userStats?.problemsSolved || 0;
  const totalUpvotes = userStats?.totalUpvotesReceived || 0;

  const badges = BADGE_CONFIG.map((badge) => {
    let isUnlocked = false;
    
    switch (badge.id) {
      case 'first_report':
        isUnlocked = totalReports >= 1;
        break;
      case 'problem_solver':
        isUnlocked = resolvedCount >= 5;
        break;
      case 'community_voice':
        isUnlocked = totalUpvotes >= 25;
        break;
      case 'civic_champion':
        isUnlocked = totalReports >= 20;
        break;
      case 'verified_citizen':
        isUnlocked = user?.isVerified || false; // Requires verification field in user model
        break;
      case 'streak_hero':
        // Streak calculation would require streak tracking in backend
        isUnlocked = false;
        break;
      default:
        isUnlocked = false;
    }

    return { ...badge, isUnlocked };
  });

  const unlockedBadgesCount = badges.filter((b) => b.isUnlocked).length;
  const nextMilestone = 500;
  const progressPercentage = Math.min(100, Math.max(0, (totalPoints / nextMilestone) * 100));

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <LoaderCircle className="h-8 w-8 animate-spin text-slate-400" />
          <span className="ml-3 text-sm text-slate-500">Loading your rewards...</span>
        </div>
      ) : (
        <>
          {/* Hero banner */}
          <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 p-6 text-white">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-blue-200">Your Civic Impact</p>
                <h1 className="mt-1 text-3xl font-bold">{totalPoints} Points</h1>
                <p className="mt-1 text-sm text-blue-100">
                  {unlockedBadgesCount} badge{unlockedBadgesCount !== 1 ? 's' : ''} earned · Keep reporting to level up!
                </p>
              </div>
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 text-4xl">
                🏆
              </div>
            </div>

            {/* Progress bar to next milestone */}
            <div className="mt-5">
              <div className="mb-1.5 flex justify-between text-xs text-blue-200">
                <span>{totalPoints} pts</span>
                <span>Next milestone: {nextMilestone} pts ({Math.round(progressPercentage)}%)</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full rounded-full bg-white transition-all duration-500 ease-out"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>
          </div>

          {/* Badges */}
          <div>
            <h2 className="mb-3 text-base font-bold text-slate-800">Your Badges</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {badges.map((badge) => {
                const Icon = badge.icon;
                return (
                  <div
                    key={badge.id}
                    className={`relative flex items-start gap-3 rounded-2xl border p-4 transition ${
                      badge.isUnlocked
                        ? 'border-slate-100 bg-white shadow-sm'
                        : 'border-dashed border-slate-200 bg-slate-50 opacity-60'
                    }`}
                  >
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${badge.bg}`}>
                      <Icon className={`h-5 w-5 ${badge.color}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800">{badge.name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{badge.desc}</p>
                      <p className={`mt-1.5 text-[11px] font-semibold ${badge.isUnlocked ? 'text-green-600' : 'text-slate-400'}`}>
                        {badge.isUnlocked ? `+${badge.points} pts earned` : `${badge.points} pts — locked`}
                      </p>
                    </div>
                    {!badge.isUnlocked && (
                      <Lock className="absolute right-3 top-3 h-3.5 w-3.5 text-slate-300" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Redeemable rewards */}
          <div>
            <h2 className="mb-3 text-base font-bold text-slate-800">Redeem Rewards</h2>
            <div className="space-y-3">
              {REWARDS.map((reward) => {
                const canRedeem = totalPoints >= reward.cost;
                return (
                  <div
                    key={reward.id}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
                  >
                    <div>
                      <p className="text-sm font-bold text-slate-800">{reward.name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{reward.desc}</p>
                    </div>
                    <button
                      type="button"
                      disabled={!canRedeem}
                      className={`shrink-0 rounded-xl px-4 py-2 text-xs font-bold transition ${
                        canRedeem
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'cursor-not-allowed bg-slate-100 text-slate-400'
                      }`}
                    >
                      {reward.cost} pts
                    </button>
                  </div>
                );
              })}
            </div>
            {totalPoints < 100 && (
              <p className="mt-3 text-center text-xs text-slate-400">
                Earn more points by reporting issues and getting them resolved.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
