// app.js - simple client for the worker API
const WORKER_BASE = "https://pharmacis-api.ferhathamza17.workers.dev/"; // <-- CHANGE

function authHeaders() {
  const token = localStorage.getItem("token");
  return token ? { "Authorization": "Bearer " + token } : {};
}

async function api(path, opts = {}) {
  const headers = opts.headers || {};
  Object.assign(headers, { "Content-Type": "application/json" }, authHeaders());
  const res = await fetch(WORKER_BASE + path, { ...opts, headers });
  if (res.status === 401) {
    localStorage.removeItem("token");
    window.location.href = "index.html";
    throw new Error("Unauthorized");
  }
  return res.json();
}

/* --- Login page behavior --- */
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("btnLogin");
  if (btn) {
    btn.addEventListener("click", async () => {
      const email = document.getElementById("email").value;
      const password = document.getElementById("password").value;
      try {
        const r = await fetch(WORKER_BASE + "/api/login", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password })
        });
        const j = await r.json();
        if (j.token) {
          localStorage.setItem("token", j.token);
          window.location.href = "dashboard.html";
        } else {
          document.getElementById("msg").innerText = j.error || "Login failed";
        }
      } catch (e) {
        document.getElementById("msg").innerText = e.message;
      }
    });
  }

  // Dashboard logic
  const btnLogout = document.getElementById("btnLogout");
  if (btnLogout) {
    btnLogout.addEventListener("click", async () => {
      await fetch(WORKER_BASE + "/api/logout", { method: "POST", headers: authHeaders() });
      localStorage.removeItem("token");
      window.location.href = "index.html";
    });
    (async function loadDashboard() {
      const d = await api("/api/dashboard");
      document.getElementById("centralCount").innerText = d.central_items;
      document.getElementById("pendingBons").innerText = d.pending_bons;
      const low = d.low_stock || [];
      const ul = document.getElementById("lowStock");
      ul.innerHTML = "";
      low.forEach(it => {
        const li = document.createElement("li");
        li.innerText = `${it.name} — ${it.qty || 0} ${it.unit || ''} (seuil ${it.seuil_min || 0})`;
        ul.appendChild(li);
      });
    })();
  }

  // BC page
  const addItem = document.getElementById("addItem");
  if (addItem) {
    const list = document.getElementById("itemsList");
    async function addRow() {
      const wrapper = document.createElement("div");
      wrapper.className = "flex space-x-2";
      const iid = document.createElement("input"); iid.placeholder = "item_id"; iid.className = "border p-2 rounded";
      const qty = document.createElement("input"); qty.placeholder = "qty"; qty.type = "number"; qty.className = "border p-2 rounded";
      const remove = document.createElement("button"); remove.innerText = "x"; remove.className = "px-2";
      remove.onclick = () => wrapper.remove();
      wrapper.append(iid, qty, remove);
      list.appendChild(wrapper);
    }
    addItem.addEventListener("click", addRow);
    document.getElementById("sendBon").addEventListener("click", async () => {
      const rows = Array.from(list.querySelectorAll("div")).map(div => {
        const inputs = div.querySelectorAll("input");
        return { item_id: parseInt(inputs[0].value), qty: parseInt(inputs[1].value) };
      }).filter(r => r.item_id && r.qty);
      const res = await api("/api/bon", { method: "POST", body: JSON.stringify({ items: rows }) });
      document.getElementById("bcMsg").innerText = res.bonId ? `Bon créé: ${res.bonId}` : JSON.stringify(res);
    });
  }

  // Stock page
  if (document.getElementById("centralTable")) {
    (async function loadCentral() {
      const data = await api("/api/stock/central");
      const tbody = document.querySelector("#centralTable tbody");
      tbody.innerHTML = "";
      data.forEach(r => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td class="p-2 border">${r.name}</td><td class="p-2 border">${r.qty || 0}</td>`;
        tbody.appendChild(tr);
      });
    })();
  }

  // Admin create item
  if (document.getElementById("createItem")) {
    document.getElementById("createItem").addEventListener("click", async () => {
      const name = document.getElementById("newItemName").value;
      const dose = document.getElementById("newItemDose").value;
      const res = await api("/api/items", { method: "POST", body: JSON.stringify({ name, dosage: dose }) });
      document.getElementById("adminMsg").innerText = res.id ? "Created id " + res.id : JSON.stringify(res);
    });
  }

  // Prescriptions
  if (document.getElementById("addPresItem")) {
    const presItems = document.getElementById("presItems");
    document.getElementById("addPresItem").addEventListener("click", () => {
      const div = document.createElement("div"); div.className = "flex space-x-2 mb-2";
      div.innerHTML = `<input placeholder="item_id" class="border p-2 rounded"/><input placeholder="qty" class="border p-2 rounded"/>`;
      presItems.appendChild(div);
    });
    document.getElementById("sendPres").addEventListener("click", async () => {
      const patient = { name: document.getElementById("patientName").value };
      const doctor_name = document.getElementById("doctorName").value;
      const items = Array.from(presItems.querySelectorAll("div")).map(d => {
        const inp = d.querySelectorAll("input");
        return { item_id: parseInt(inp[0].value), qty: parseInt(inp[1].value) };
      }).filter(x => x.item_id && x.qty);
      const res = await api("/api/prescriptions", { method: "POST", body: JSON.stringify({ patient, doctor_name, items }) });
      document.getElementById("presMsg").innerText = res.prescription_id ? "Saved: " + res.prescription_id : JSON.stringify(res);
    });
  }
});