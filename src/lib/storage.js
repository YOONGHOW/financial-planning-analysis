// Database Client API wrapper (replaces localStorage client wrappers with asynchronous API fetches)

export async function getTransactions() {
  try {
    const res = await fetch("/api/transactions");
    if (!res.ok) throw new Error("Failed to fetch transactions");
    return await res.json();
  } catch (e) {
    console.error("getTransactions API call failed", e);
    return [];
  }
}

export async function saveTransaction(transaction) {
  try {
    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(transaction)
    });
    if (!res.ok) throw new Error("Failed to save transaction");
    return await res.json();
  } catch (e) {
    console.error("saveTransaction API call failed", e);
    return { success: false, error: e.message };
  }
}

export async function deleteTransaction(id) {
  try {
    const res = await fetch(`/api/transactions?id=${id}`, {
      method: "DELETE"
    });
    if (!res.ok) throw new Error("Failed to delete transaction");
    return await res.json();
  } catch (e) {
    console.error("deleteTransaction API call failed", e);
    return { success: false, error: e.message };
  }
}

export async function getFixedSpends() {
  try {
    const res = await fetch("/api/fixed");
    if (!res.ok) throw new Error("Failed to fetch fixed spends");
    return await res.json();
  } catch (e) {
    console.error("getFixedSpends API call failed", e);
    return [];
  }
}

export async function saveFixedSpend(item) {
  try {
    const res = await fetch("/api/fixed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item)
    });
    if (!res.ok) throw new Error("Failed to save fixed spend");
    return await res.json();
  } catch (e) {
    console.error("saveFixedSpend API call failed", e);
    return { success: false, error: e.message };
  }
}

export async function deleteFixedSpend(id) {
  try {
    const res = await fetch(`/api/fixed?id=${id}`, {
      method: "DELETE"
    });
    if (!res.ok) throw new Error("Failed to delete fixed spend");
    return await res.json();
  } catch (e) {
    console.error("deleteFixedSpend API call failed", e);
    return { success: false, error: e.message };
  }
}

export async function getSettings() {
  try {
    const res = await fetch("/api/settings");
    if (!res.ok) throw new Error("Failed to fetch settings");
    return await res.json();
  } catch (e) {
    console.error("getSettings API call failed", e);
    return {};
  }
}

export async function saveSetting(key, value) {
  try {
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value })
    });
    if (!res.ok) throw new Error(`Failed to save setting: ${key}`);
    return await res.json();
  } catch (e) {
    console.error("saveSetting API call failed", e);
    return { success: false, error: e.message };
  }
}

export async function getMonthlySalary() {
  const settings = await getSettings();
  return settings.monthly_salary !== undefined ? settings.monthly_salary : 4200.00;
}

export async function saveMonthlySalary(val) {
  return await saveSetting("monthly_salary", val);
}

export async function getGoals() {
  try {
    const res = await fetch("/api/goals");
    if (!res.ok) throw new Error("Failed to fetch goals");
    return await res.json();
  } catch (e) {
    console.error("getGoals API call failed", e);
    return [];
  }
}

export async function saveGoal(goal) {
  try {
    const res = await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(goal)
    });
    if (!res.ok) throw new Error("Failed to save goal");
    return await res.json();
  } catch (e) {
    console.error("saveGoal API call failed", e);
    return { success: false, error: e.message };
  }
}

export async function deleteGoal(id) {
  try {
    const res = await fetch(`/api/goals?id=${id}`, {
      method: "DELETE"
    });
    if (!res.ok) throw new Error("Failed to delete goal");
    return await res.json();
  } catch (e) {
    console.error("deleteGoal API call failed", e);
    return { success: false, error: e.message };
  }
}

export async function getDebts() {
  const settings = await getSettings();
  return settings.debts || [];
}

export async function saveDebts(debts) {
  return await saveSetting("debts", debts);
}

export async function getCoupleData() {
  const settings = await getSettings();
  return settings.coupleData || { periodStartDate: "", cycleLength: 28, periodDuration: 5 };
}

export async function saveCoupleData(data) {
  return await saveSetting("coupleData", data);
}
