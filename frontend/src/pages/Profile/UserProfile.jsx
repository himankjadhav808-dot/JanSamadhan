import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Award, FileText, MapPin, X } from 'lucide-react';
import IssueCard from '../../components/issues/IssueCard';
import api from '../../lib/api';
import Loader from '../../components/Loader';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { applyOptimisticVote, withUserVote, issueId } from '../../lib/issues';

const CATEGORY_STYLES = {
  Roads: 'bg-blue-100 text-blue-800',
  Streetlights: 'bg-amber-100 text-amber-800',
  Sanitation: 'bg-emerald-100 text-emerald-800',
  Water: 'bg-cyan-100 text-cyan-800',
  Parks: 'bg-green-100 text-green-800',
  Traffic: 'bg-red-100 text-red-700',
  Other: 'bg-slate-100 text-slate-700',
};

const STATUS_STYLES = {
  Live: 'bg-brand-50 text-brand-700',
  Pending_Validation: 'bg-amber-50 text-amber-700',
  Solved: 'bg-green-50 text-green-700',
};

export default function UserProfile() {
  const { id } = useParams();
  const { user: currentUser } = useAuth();
  const { t } = useLanguage();
  const [profileData, setProfileData] = useState(null);
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedIssue, setSelectedIssue] = useState(null);

  const isOwnProfile = currentUser?._id === id;

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data } = await api.get(`/users/${id}/profile`);
        setProfileData(data.user);
        // Ensure each issue has proper _id and structure
        const normalizedIssues = (data.activityFeed || []).map(issue => ({
          ...issue,
          _id: issue._id || issue.id,
          upvotes: issue.upvotes || [],
          downvotes: issue.downvotes || [],
        }));
        setIssues(normalizedIssues);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [id]);

  const handleVote = async (id, voteType) => {
    if (!currentUser) {
      return;
    }

    const previous = issues;
    const issueToUpdate = issues.find((issue) => 
      issueId(issue) === String(id)
    );
    
    if (!issueToUpdate) return;

    const actualIssueId = issueId(issueToUpdate);
    const previousVote = issueToUpdate.userVote;
    const previousScore = issueToUpdate.netScore;

    setIssues((current) =>
      current.map((issue) =>
        issueId(issue) === String(id) 
          ? applyOptimisticVote(issue, voteType, currentUser._id)
          : issue
      )
    );

    try {
      const { data } = await api.put(`/issues/${actualIssueId}/vote`, { voteType });
      setIssues((current) =>
        current.map((issue) =>
          issueId(issue) === String(id) 
            ? withUserVote(data.issue, currentUser._id)
            : issue
        )
      );
      if (selectedIssue && issueId(selectedIssue) === String(id)) {
        setSelectedIssue(withUserVote(data.issue, currentUser._id));
      }
    } catch (err) {
      setIssues((current) =>
        current.map((issue) =>
          issueId(issue) === String(id) 
            ? { ...issue, userVote: previousVote, netScore: previousScore }
            : issue
        )
      );
      setError(err.response?.data?.message || 'Vote failed. Please try again.');
    }
  };

  const handleValidate = (id, updatedIssue) => {
    setIssues((current) =>
      current.map((issue) => 
        issueId(issue) === String(id) ? updatedIssue : issue
      )
    );
    if (selectedIssue && issueId(selectedIssue) === String(id)) {
      setSelectedIssue(updatedIssue);
    }
  };

  if (loading) {
    return <Loader text={t.loadingProfile} />;
  }

  if (error || !profileData) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-10 text-center text-red-700">
          <p className="font-medium">{error || 'Profile not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <div className="h-24 w-24 shrink-0 overflow-hidden rounded-full bg-slate-100 sm:h-32 sm:w-32">
            {profileData.avatarUrl ? (
              <img
                src={profileData.avatarUrl}
                alt={profileData.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-brand-100 text-2xl font-bold text-brand-600">
                {profileData.name?.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          <div className="flex-1 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <h1 className="text-2xl font-semibold text-slate-900">{profileData.name}</h1>
              {profileData.publicId && (
                <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                  #{profileData.publicId}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-500 capitalize">{profileData.role}</p>
            {isOwnProfile && (
              <p className="mt-2 text-xs text-slate-400">{t.publicProfileNotice}</p>
            )}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-4 border-t border-slate-100 pt-6">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-xl font-bold text-slate-900">
              <Award className="h-5 w-5 text-brand-600" />
              {profileData.totalPoints}
            </div>
            <p className="mt-1 text-xs text-slate-500">{t.totalPoints}</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-xl font-bold text-slate-900">
              <FileText className="h-5 w-5 text-brand-600" />
              {profileData.role === 'citizen' ? profileData.issuesRaised : profileData.issuesResolved}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {profileData.role === 'citizen' ? t.issuesRaised : t.reportedIssues}
            </p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-xl font-bold text-slate-900">
              <MapPin className="h-5 w-5 text-green-600" />
              {profileData.problemsSolved}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {profileData.role === 'citizen' ? t.problemsSolved : t.issuesRaised}
            </p>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">
          {profileData.role === 'citizen' ? t.reportedIssues : t.issuesRaised}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {issues.length === 0
            ? t.noIssuesReported
            : `${issues.length} ${t.issueReportedCount}`}
        </p>
      </div>

      {issues.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center shadow-card">
          <p className="font-medium text-slate-800">{t.noIssuesReported}</p>
          <p className="mt-1 text-sm text-slate-500">
            {isOwnProfile
              ? profileData.role === 'citizen'
                ? t.noIssuesOwnCitizen
                : t.noIssuesOwnAuthority
              : profileData.role === 'citizen'
                ? t.noIssuesOtherCitizen
                : t.noIssuesOtherAuthority}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {issues.map((issue, index) => (
            <button
              key={issueId(issue) || `issue-${index}`}
              type="button"
              onClick={() => setSelectedIssue(issue)}
              className="group relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-100 transition hover:ring-2 hover:ring-brand-500"
            >
              <img
                src={profileData.role === 'citizen' ? issue.originalImageUrl : issue.resolutionImageUrl || issue.originalImageUrl}
                alt={issue.title || issue.category}
                className="h-full w-full object-cover transition group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 transition group-hover:opacity-100">
                <div className="absolute bottom-2 left-2 right-2">
                  <p className="truncate text-xs font-medium text-white">{issue.title || issue.category}</p>
                  <div className="mt-1 flex items-center gap-1">
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                        CATEGORY_STYLES[issue.category] || CATEGORY_STYLES.Other
                      }`}
                    >
                      {issue.category}
                    </span>
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                        STATUS_STYLES[issue.status] || STATUS_STYLES.Live
                      }`}
                    >
                      {issue.status}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedIssue && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelectedIssue(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
              <h3 className="font-semibold text-slate-900">Issue Details</h3>
              <button
                type="button"
                onClick={() => setSelectedIssue(null)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4">
              <IssueCard
                issue={{
                  ...selectedIssue,
                  resolution: selectedIssue.resolutionImageUrl ? {
                    resolutionImageUrl: selectedIssue.resolutionImageUrl,
                    createdAt: selectedIssue.resolvedAt,
                  } : selectedIssue.resolution,
                  userVote:
                    selectedIssue.upvotes?.some((id) => id === currentUser?._id)
                      ? 'upvote'
                      : selectedIssue.downvotes?.some((id) => id === currentUser?._id)
                        ? 'downvote'
                        : null,
                  netScore:
                    (selectedIssue.upvotes?.length || 0) - (selectedIssue.downvotes?.length || 0),
                }}
                currentUserId={currentUser?._id}
                userRole={currentUser?.role}
                onVote={handleVote}
                onValidate={handleValidate}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
