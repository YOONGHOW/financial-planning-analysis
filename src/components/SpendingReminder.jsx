"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getTransactions } from "@/lib/storage";

const REMINDER_STORAGE_KEY = "fpa_last_missing_spend_reminder";

function formatLocalDate(date) {
  return date.toLocaleDateString("en-CA");
}

function getYesterdayDateKey() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return formatLocalDate(yesterday);
}

export default function SpendingReminder() {
  const [reminder, setReminder] = useState(null);

  useEffect(() => {
    let active = true;

    async function checkMissingSpend() {
      const yesterdayKey = getYesterdayDateKey();

      if (localStorage.getItem(REMINDER_STORAGE_KEY) === yesterdayKey) {
        return;
      }

      const transactions = await getTransactions();
      if (!active) return;

      const hasYesterdaySpend = transactions.some(
        (transaction) =>
          transaction.type === "spend" && transaction.date === yesterdayKey,
      );

      if (hasYesterdaySpend) {
        return;
      }

      localStorage.setItem(REMINDER_STORAGE_KEY, yesterdayKey);
      setReminder({
        date: yesterdayKey,
        message: "Remember to fill in yesterday's spend.",
      });

      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Financial Planner", {
          body: "Remember to fill in yesterday's spend.",
        });
      }
    }

    checkMissingSpend().catch((error) => {
      console.error("Failed to check spending reminder", error);
    });

    return () => {
      active = false;
    };
  }, []);

  if (!reminder) {
    return null;
  }

  return (
    <div className="toast-container">
      <div className="toast warning reminder-toast">
        <span className="toast-icon">!</span>
        <span>{reminder.message}</span>
        <Link href={`/add?date=${reminder.date}`} className="toast-action">
          Add
        </Link>
        <button
          type="button"
          className="toast-dismiss"
          aria-label="Dismiss reminder"
          onClick={() => setReminder(null)}
        >
          x
        </button>
      </div>
    </div>
  );
}
