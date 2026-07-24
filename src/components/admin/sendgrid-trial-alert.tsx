"use client";

import { AlertTriangle, Clock } from "lucide-react";

export function SendGridTrialAlert() {
  const trialEndDateStr = process.env.NEXT_PUBLIC_SENDGRID_TRIAL_END_DATE;
  if (!trialEndDateStr) return null;

  const trialEndDate = new Date(trialEndDateStr);
  const now = new Date();
  const daysRemaining = Math.ceil((trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  // Only show alert if within 7 days or already expired
  if (daysRemaining > 7) return null;

  const isExpired = daysRemaining <= 0;
  const isUrgent = daysRemaining <= 3;

  return (
    <div
      className={`mt-4 rounded-lg border p-3 ${
        isExpired
          ? "border-destructive/50 bg-destructive/10"
          : isUrgent
            ? "border-orange-500/50 bg-orange-500/10"
            : "border-yellow-500/50 bg-yellow-500/10"
      }`}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle
          className={`mt-0.5 h-4 w-4 flex-shrink-0 ${
            isExpired ? "text-destructive" : isUrgent ? "text-orange-600" : "text-yellow-600"
          }`}
          aria-hidden="true"
        />
        <div className="flex-1">
          <p
            className={`text-xs font-semibold ${
              isExpired ? "text-destructive" : isUrgent ? "text-orange-700" : "text-yellow-700"
            }`}
          >
            SendGrid trial {isExpired ? "expired" : "expiring soon"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {isExpired ? (
              <>Your SendGrid free trial expired on {trialEndDate.toLocaleDateString()}. Upgrade immediately to continue sending emails.</>
            ) : (
              <>
                <Clock className="mb-0.5 inline h-3 w-3" /> {daysRemaining} day{daysRemaining !== 1 ? "s" : ""} remaining.{" "}
                <a
                  href="https://app.sendgrid.com/settings/billing/plans"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`font-medium underline ${isUrgent ? "text-orange-700 hover:text-orange-800" : "text-yellow-700 hover:text-yellow-800"}`}
                >
                  Upgrade your plan
                </a>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
