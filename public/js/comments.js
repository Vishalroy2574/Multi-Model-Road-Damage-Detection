(function () {
  function hideModal(trigger) {
    if (!trigger || !window.bootstrap || !bootstrap.Modal) return;
    const modal = trigger.closest(".modal");
    if (!modal) return;
    bootstrap.Modal.getOrCreateInstance(modal).hide();
  }

  function formatDt(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const mo = d.toLocaleString("en", { month: "long" });
    const t = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return d.getDate() + " " + mo + ", " + d.getFullYear() + " @ " + t + " → \n";
  }

  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  async function loadComments(caseId, container) {
    const r = await fetch("/api/reports/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: { caseId: Number(caseId) } }),
      credentials: "same-origin",
    });
    const data = await r.json();
    if (!Array.isArray(data) || data.length === 0) {
      container.innerHTML = '<p class="text-secondary mb-0">No comments yet.</p>';
      return;
    }
    let html = "";
    data.forEach(function (c) {
      const align = c.userType === "U" ? "text-end" : "text-start";
      const bg = c.userType === "U" ? "bg-primary" : "bg-secondary";
      html +=
        '<div class="' +
        align +
        ' mb-2"><div class="d-inline-block ' +
        bg +
        ' text-white rounded p-2 small" style="max-width: 90%; white-space: pre-wrap">' +
        esc(formatDt(c.commentDateTime) + c.commentText) +
        "</div></div>";
    });
    container.innerHTML = html;
  }

  document.addEventListener("show.bs.modal", function (ev) {
    const modal = ev.target;
    const box = modal.querySelector("[id^='comments-']");
    if (!box || !box.dataset.caseId) return;
    loadComments(box.dataset.caseId, box);
  });

  document.addEventListener("click", function (ev) {
    const closeBtn = ev.target && ev.target.closest ? ev.target.closest("[data-modal-close]") : null;
    if (closeBtn) {
      hideModal(closeBtn);
      return;
    }

    const t = ev.target;
    if (!t.classList.contains("comment-submit")) return;
    const caseId = t.getAttribute("data-case-id");
    const userType = t.getAttribute("data-user-type") || "U";
    const ta = document.getElementById("comment-input-" + caseId);
    const text = (ta && ta.value.trim()) || "";
    if (!text) return;
    fetch("/api/submit/report/comment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: { caseId: Number(caseId), commentText: text, userType: userType },
      }),
      credentials: "same-origin",
    })
      .then(function (r) {
        if (!r.ok) throw new Error();
        ta.value = "";
        const box = document.getElementById("comments-" + caseId);
        if (box) loadComments(caseId, box);
      })
      .catch(function () {
        alert("Could not post comment.");
      });
  });
})();
