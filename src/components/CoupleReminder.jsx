"use client";

import { useEffect } from "react";
import { getCoupleData } from "@/lib/storage";

export default function CoupleReminder() {
  useEffect(() => {
    let active = true;

    async function checkCoupleReminders() {
      try {
        const coupleData = await getCoupleData();
        if (!active) return;

        const today = new Date();
        const dToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        // 1. Check milestone (next 500-day milestone)
        const start = new Date(2022, 7, 4); // Aug 4 2022
        const dStart = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        const diffDays = Math.floor((dToday - dStart) / (1000 * 60 * 60 * 24));
        const currentFiveHundredMultiplier = Math.floor(diffDays / 500) + 1;
        const nextMilestoneDays = currentFiveHundredMultiplier * 500;
        const nextMilestoneDate = new Date(dStart.getTime() + nextMilestoneDays * (1000 * 60 * 60 * 24));
        
        const daysToMilestone = Math.ceil((nextMilestoneDate - dToday) / (1000 * 60 * 60 * 24));

        if (daysToMilestone === 3) {
          const storageKey = `fpa_milestone_reminded_${nextMilestoneDays}`;
          if (localStorage.getItem(storageKey) !== "true") {
            localStorage.setItem(storageKey, "true");
            if ("Notification" in window && Notification.permission === "granted") {
              new Notification("Couple Milestone Reminder", {
                body: `Your ${nextMilestoneDays.toLocaleString()} days together milestone is in 3 days! 💖`,
                icon: "/logo.png"
              });
            }
          }
        }

        // 2. Check anniversary (Aug 4 each year)
        let annivYear = dToday.getFullYear();
        let nextAnniv = new Date(annivYear, 7, 4); // Aug 4 this year
        if (dToday > nextAnniv) {
          annivYear += 1;
          nextAnniv = new Date(annivYear, 7, 4);
        }
        const daysToAnniv = Math.ceil((nextAnniv - dToday) / (1000 * 60 * 60 * 24));
        if (daysToAnniv === 3) {
          const annivNum = annivYear - 2022;
          const storageKey = `fpa_anniv_reminded_${annivYear}`;
          if (localStorage.getItem(storageKey) !== "true") {
            localStorage.setItem(storageKey, "true");
            if ("Notification" in window && Notification.permission === "granted") {
              new Notification("Anniversary Reminder 🎂", {
                body: `Your ${annivNum}${annivNum === 1 ? "st" : annivNum === 2 ? "nd" : annivNum === 3 ? "rd" : "th"} anniversary is in 3 days! (Aug 4) 💕`,
                icon: "/logo.png"
              });
            }
          }
        }

        // 3. Check next period date
        if (coupleData && coupleData.periodStartDate) {
          const pStart = new Date(coupleData.periodStartDate);
          const dPStart = new Date(pStart.getFullYear(), pStart.getMonth(), pStart.getDate());
          const cycleLength = coupleData.cycleLength || 28;
          const daysSincePStart = Math.floor((dToday - dPStart) / (1000 * 60 * 60 * 24));

          const nextPeriodStart = new Date(dPStart.getTime() + cycleLength * (1000 * 60 * 60 * 24));
          let projectedNextStart = new Date(nextPeriodStart);
          if (dToday >= projectedNextStart) {
            const remainingCycles = Math.floor(daysSincePStart / cycleLength) + 1;
            projectedNextStart = new Date(dPStart.getTime() + (remainingCycles * cycleLength) * (1000 * 60 * 60 * 24));
          }

          const daysToPeriod = Math.ceil((projectedNextStart - dToday) / (1000 * 60 * 60 * 24));
          if (daysToPeriod === 3) {
            const dateStr = projectedNextStart.toISOString().split("T")[0];
            const storageKey = `fpa_period_reminded_${dateStr}`;
            if (localStorage.getItem(storageKey) !== "true") {
              localStorage.setItem(storageKey, "true");
              if ("Notification" in window && Notification.permission === "granted") {
                new Notification("Period Cycle Reminder", {
                  body: `Next period cycle is expected in 3 days (on ${projectedNextStart.toLocaleDateString("en-MY", { month: "short", day: "numeric" })}). 🩸`,
                  icon: "/logo.png"
                });
              }
            }
          }
        }
      } catch (err) {
        console.error("Failed to check couple reminders", err);
      }
    }

    checkCoupleReminders();

    return () => {
      active = false;
    };
  }, []);

  return null;
}
