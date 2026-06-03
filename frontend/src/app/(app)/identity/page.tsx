"use client";

import { useState } from "react";
import {
  Shield,
  Plus,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  Star,
  Swords,
  Save,
  Archive,
  Copy,
} from "lucide-react";
import { useT } from "@/lib/i18n";
import {
  useIdentityStatements,
  useCreateIdentityStatement,
  useAffirmIdentity,
  useGenerateAffirmation,
  useUpdateIdentityStatement,
} from "@/lib/hooks";

interface IdentityStatement {
  id: string;
  old_identity: string;
  new_identity: string;
  belief_score: number;
  affirmation_streak: number;
  proof_points: string[];
  daily_affirmation?: string;
}

interface AffirmationPayload {
  affirmation: string;
  proof_reminder: string;
  challenge: string;
}

interface IdentityStatementsResponse {
  statements?: Array<Omit<IdentityStatement, "proof_points"> & { proof_points?: unknown }>;
}

export default function IdentityPage() {
  const t = useT();
  const { data: statements, isLoading } = useIdentityStatements();
  const createStatement = useCreateIdentityStatement();
  const affirmIdentity = useAffirmIdentity();
  const generateAffirmation = useGenerateAffirmation();
  const updateStatement = useUpdateIdentityStatement();

  const [showAffirmation, setShowAffirmation] = useState(false);
  const [affirmationData, setAffirmationData] = useState<AffirmationPayload | null>(null);
  const [selectedStatement, setSelectedStatement] = useState<string | null>(null);

  // New identity form state
  const [showForm, setShowForm] = useState(false);
  const [oldIdentity, setOldIdentity] = useState("");
  const [newIdentity, setNewIdentity] = useState("");
  const [dailyAffirmation, setDailyAffirmation] = useState("");
  const [proofDrafts, setProofDrafts] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<string | null>(null);

  const handleAffirm = async (stmtId: string) => {
    setActionError(null);
    setSelectedStatement(stmtId);
    try {
      await affirmIdentity.mutateAsync(stmtId);
      // Try to generate an AI affirmation
      try {
        const { data } = await generateAffirmation.mutateAsync(stmtId);
        setAffirmationData(data as AffirmationPayload);
      } catch {
        // If AI is not available, show a default affirmation
        setAffirmationData({
          affirmation: "You showed up again today. That's not luck — that's discipline becoming identity.",
          proof_reminder: "Every day you affirm who you're becoming makes the old version weaker.",
          challenge: "Today, when the craving hits, say out loud: 'I don't do that anymore. I am FORGED.'",
        });
      }
      setShowAffirmation(true);
    } catch (error) {
      setActionError("Could not reach server while affirming identity. Check backend connection and try again.");
      console.error("Failed to affirm identity:", error);
    }
  };

  const handleCreateStatement = async () => {
    if (!oldIdentity.trim() || !newIdentity.trim()) return;
    setActionError(null);
    const payload: Record<string, string> = {
      old_identity: oldIdentity.trim(),
      new_identity: newIdentity.trim(),
    };
    if (dailyAffirmation.trim()) {
      payload.daily_affirmation = dailyAffirmation.trim();
    }
    try {
      await createStatement.mutateAsync(payload);
      setOldIdentity("");
      setNewIdentity("");
      setDailyAffirmation("");
      setShowForm(false);
    } catch (error) {
      const detail = (error as { response?: { data?: { detail?: unknown } } }).response?.data?.detail;
      setActionError(
        typeof detail === "string"
          ? detail
          : "Failed to create identity. Run database/012_identity_statement_affirmation.sql in Supabase, then retry."
      );
      console.error("Failed to create identity statement:", error);
    }
  };

  const handleAddProofPoint = async (stmt: IdentityStatement) => {
    setActionError(null);
    const draft = (proofDrafts[stmt.id] || "").trim();
    if (!draft) return;
    const updatedProofs = [...(stmt.proof_points || []), draft];
    try {
      await updateStatement.mutateAsync({
        id: stmt.id,
        data: { proof_points: updatedProofs },
      });
      setProofDrafts((prev) => ({ ...prev, [stmt.id]: "" }));
    } catch {
      setActionError("Failed to save proof point. Please retry in a few seconds.");
    }
  };

  const handleArchiveStatement = async (stmtId: string) => {
    setActionError(null);
    try {
      await updateStatement.mutateAsync({
        id: stmtId,
        data: { is_active: false },
      });
    } catch {
      setActionError("Failed to archive identity. Server may be unreachable.");
    }
  };

  const handleGenerateNow = async (stmtId: string) => {
    setActionError(null);
    try {
      const { data } = await generateAffirmation.mutateAsync(stmtId);
      setAffirmationData(data as AffirmationPayload);
      setShowAffirmation(true);
    } catch {
      setActionError("Could not generate affirmation right now. Please try again.");
    }
  };

  const handleCopyAffirmation = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      setActionError("Clipboard access failed. You can copy manually.");
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-[var(--accent-fire)] border-t-transparent rounded-full animate-spin" />
        <p className="text-[var(--text-secondary)] font-medium animate-pulse">
          {t.identity_loading}
        </p>
      </div>
    );
  }

  // The backend API returns { statements: [...] }
  const identityStatements = ((statements as IdentityStatementsResponse | undefined)?.statements || []).map((stmt) => ({
    ...stmt,
    proof_points: Array.isArray(stmt.proof_points)
      ? stmt.proof_points
      : Object.values(stmt.proof_points || {}).filter(Boolean),
  })) as IdentityStatement[];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-[var(--text-primary)]">
            {t.identity_title}
          </h1>
          <p className="text-[var(--text-secondary)] text-sm mt-1">
            {t.identity_subtitle}
          </p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-fire flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" />
          {t.identity_new}
        </button>
      </div>

      {actionError && (
        <div className="card border border-[var(--accent-danger)]/40 bg-[var(--accent-danger-subtle)]">
          <p className="text-sm text-[var(--text-primary)]">{actionError}</p>
        </div>
      )}

      {/* Big quote */}
      <div className="card-fire p-6 text-center">
        <blockquote className="text-lg md:text-xl font-bold text-[var(--text-primary)] italic leading-relaxed">
          &ldquo;{t.identity_quote}&rdquo;
        </blockquote>
        <cite className="text-sm text-[var(--accent-fire)] mt-2 block">— {t.identity_quote_author}</cite>
      </div>

      {/* New Identity Form */}
      {showForm && (
        <div className="card space-y-4 animate-slide-up">
          <h3 className="font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Shield className="w-5 h-5 text-[var(--accent-fire)]" />
            {t.identity_declare_title}
          </h3>
          <div>
            <label className="block text-xs text-[var(--accent-danger)] uppercase font-bold mb-1">{t.identity_old_label}</label>
            <textarea
              value={oldIdentity}
              onChange={(e) => setOldIdentity(e.target.value)}
              className="input-forge min-h-[60px] resize-none"
              placeholder={t.identity_old_placeholder}
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--accent-success)] uppercase font-bold mb-1">{t.identity_new_label}</label>
            <textarea
              value={newIdentity}
              onChange={(e) => setNewIdentity(e.target.value)}
              className="input-forge min-h-[60px] resize-none"
              placeholder={t.identity_new_placeholder}
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--accent-fire)] uppercase font-bold mb-1">{t.identity_affirmation_label}</label>
            <textarea
              value={dailyAffirmation}
              onChange={(e) => setDailyAffirmation(e.target.value)}
              className="input-forge min-h-[60px] resize-none"
              placeholder={t.identity_affirmation_placeholder}
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleCreateStatement}
              disabled={createStatement.isPending || !oldIdentity.trim() || !newIdentity.trim()}
              className="btn-fire flex-1 disabled:opacity-50"
            >
              {createStatement.isPending ? t.identity_forging : t.identity_forge_cta}
            </button>
            <button onClick={() => setShowForm(false)} className="btn-ghost">{t.cancel}</button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {identityStatements.length === 0 && !showForm && (
        <div className="flex flex-col items-center justify-center min-h-[40vh] text-center space-y-6 animate-fade-in">
          <div className="w-20 h-20 rounded-2xl bg-[var(--bg-secondary)] flex items-center justify-center mb-2">
            <Swords className="w-10 h-10 text-[var(--accent-fire)]" />
          </div>
          <div className="max-w-md space-y-2">
            <h2 className="text-2xl font-black text-[var(--text-primary)]">{t.identity_empty_title}</h2>
            <p className="text-[var(--text-secondary)]">
              {t.identity_empty_desc}
            </p>
          </div>
          <button onClick={() => setShowForm(true)} className="btn-fire px-8 py-4 text-lg flex items-center gap-2">
            <Shield className="w-5 h-5" /> {t.identity_declare_cta}
          </button>
        </div>
      )}

      {/* Identity Statements */}
      <div className="space-y-4">
        {identityStatements.map((stmt, i) => (
          <div key={stmt.id} className="card animate-slide-up" style={{ animationDelay: `${i * 0.1}s` }}>
            {/* Identity Shift Arrow */}
            <div className="space-y-3 mb-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-[var(--accent-danger-subtle)] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-sm">❌</span>
                </div>
                <div>
                  <div className="text-[10px] text-[var(--accent-danger)] uppercase font-bold tracking-wide mb-0.5">{t.identity_old_tag}</div>
                  <p className="text-sm text-[var(--text-secondary)] line-through opacity-60">{stmt.old_identity}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 pl-4">
                <div className="w-0.5 h-6 bg-gradient-to-b from-[var(--accent-danger)] to-[var(--accent-success)]" />
                <ChevronRight className="w-4 h-4 text-[var(--accent-fire)]" />
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-[var(--accent-success-subtle)] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Shield className="w-4 h-4 text-[var(--accent-success)]" />
                </div>
                <div>
                  <div className="text-[10px] text-[var(--accent-success)] uppercase font-bold tracking-wide mb-0.5">{t.identity_new_tag}</div>
                  <p className="text-sm text-[var(--text-primary)] font-semibold">{stmt.new_identity}</p>
                </div>
              </div>
            </div>

            {/* Belief Score */}
            <div className="bg-[var(--bg-elevated)] rounded-xl p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-[var(--text-muted)] uppercase font-bold">{t.identity_belief_score}</span>
                <span className={`text-lg font-black ${
                  (stmt.belief_score || 0) >= 70 ? "text-[var(--accent-success)]" :
                  (stmt.belief_score || 0) >= 40 ? "text-[var(--accent-warning)]" :
                  "text-[var(--accent-danger)]"
                }`}>
                  {stmt.belief_score || 0}%
                </span>
              </div>
              <div className="h-3 bg-[var(--bg-primary)] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{
                    width: `${stmt.belief_score || 0}%`,
                    background: (stmt.belief_score || 0) >= 70 ? "var(--gradient-victory)" :
                      (stmt.belief_score || 0) >= 40 ? "linear-gradient(135deg, #FFD600, #FF8C00)" :
                      "var(--gradient-danger)",
                  }}
                />
              </div>
              <div className="flex items-center justify-between mt-2 text-xs text-[var(--text-muted)]">
                <span>🔥 {stmt.affirmation_streak || 0} {t.identity_affirmation_streak}</span>
                <span>{t.identity_target}: 100%</span>
              </div>
            </div>

            {/* Proof Points */}
            <div className="bg-[var(--bg-elevated)] rounded-xl p-3 mb-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="text-xs text-[var(--text-muted)] uppercase font-bold">{t.identity_daily_affirmation}</div>
                <button
                  onClick={() => handleCopyAffirmation((stmt.daily_affirmation || `I am ${stmt.new_identity}`).trim())}
                  className="btn-ghost px-2 py-1 text-xs flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  {t.copy}
                </button>
              </div>
              <p className="text-sm text-[var(--text-primary)] font-medium">
                {(stmt.daily_affirmation || `I am ${stmt.new_identity}`).trim()}
              </p>
            </div>

            {stmt.proof_points && stmt.proof_points.length > 0 && (
              <div className="mb-4">
                <div className="text-xs text-[var(--text-muted)] uppercase font-bold mb-2 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-[var(--accent-success)]" />
                  {t.identity_proof_data}
                </div>
                <div className="space-y-1.5">
                  {stmt.proof_points.map((proof, j) => (
                    <div key={j} className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                      <Star className="w-3 h-3 text-[var(--accent-ember)] flex-shrink-0" />
                      {proof}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-4 space-y-2">
              <div className="text-xs text-[var(--text-muted)] uppercase font-bold">{t.identity_add_proof}</div>
              <div className="flex gap-2">
                <input
                  value={proofDrafts[stmt.id] || ""}
                  onChange={(e) => setProofDrafts((prev) => ({ ...prev, [stmt.id]: e.target.value }))}
                  className="input-forge flex-1"
                  placeholder={t.identity_proof_placeholder}
                />
                <button
                  onClick={() => handleAddProofPoint(stmt)}
                  disabled={updateStatement.isPending || !(proofDrafts[stmt.id] || "").trim()}
                  className="btn-ghost px-3 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Affirm Button */}
            <button
              onClick={() => handleAffirm(stmt.id)}
              disabled={affirmIdentity.isPending}
              className="btn-success w-full flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Sparkles className="w-5 h-5" />
              {affirmIdentity.isPending && selectedStatement === stmt.id ? t.identity_affirming : t.identity_affirm_cta}
            </button>
            <button
              onClick={() => handleGenerateNow(stmt.id)}
              disabled={generateAffirmation.isPending}
              className="btn-ghost w-full mt-2 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              {generateAffirmation.isPending ? t.identity_generating : t.identity_generate_affirmation}
            </button>
            <button
              onClick={() => handleArchiveStatement(stmt.id)}
              disabled={updateStatement.isPending}
              className="btn-ghost w-full mt-2 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Archive className="w-4 h-4" />
              {t.identity_archive}
            </button>
          </div>
        ))}
      </div>

      {/* Daily Affirmation Modal */}
      {showAffirmation && affirmationData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 animate-fade-in" onClick={() => setShowAffirmation(false)}>
          <div className="card-fire max-w-lg w-full p-8 animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--accent-success)] to-[#00C853] flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-black" />
              </div>
              <h3 className="text-xl font-black text-[var(--text-primary)]">{t.identity_modal_title}</h3>
            </div>

            <div className="space-y-4">
              <div className="bg-[var(--bg-elevated)] rounded-xl p-4">
                <p className="text-[var(--text-primary)] font-bold text-lg leading-relaxed">
                  &ldquo;{affirmationData.affirmation}&rdquo;
                </p>
              </div>

              <div className="bg-[var(--accent-success-subtle)] rounded-xl p-4">
                <div className="text-xs text-[var(--accent-success)] uppercase font-bold mb-1">{t.identity_proof_label}</div>
                <p className="text-sm text-[var(--text-secondary)]">{affirmationData.proof_reminder}</p>
              </div>

              <div className="bg-[var(--accent-fire-subtle)] rounded-xl p-4">
                <div className="text-xs text-[var(--accent-fire)] uppercase font-bold mb-1">{t.identity_challenge_label}</div>
                <p className="text-sm text-[var(--text-secondary)]">{affirmationData.challenge}</p>
              </div>
            </div>

            <button
              onClick={() => setShowAffirmation(false)}
              className="btn-fire w-full mt-6"
            >
              {t.identity_confirm_cta}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
