(function () {
  "use strict";

  // ---------- File reading / parsing ----------
  function readFileAsJSON(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          resolve(JSON.parse(reader.result));
        } catch (error) {
          reject(new Error("Invalid JSON file"));
        }
      };
      reader.onerror = () => reject(new Error("Error reading file"));
      reader.readAsText(file);
    });
  }

  /**
   * Extracts usernames from Instagram export JSON.
   * Returns { usernames, kind } where kind is
   *   'following'  -> top-level `relationships_following`
   *   'followers'  -> top-level `relationships_followers`
   *   'unknown'    -> raw array (Instagram's followers_1.json) or other shapes
   */
  function extractUsernames(data) {
    const usernames = [];
    let kind = "unknown";
    let items = null;

    if (data && typeof data === "object" && !Array.isArray(data)) {
      if (Array.isArray(data.relationships_following)) {
        kind = "following";
        items = data.relationships_following;
      } else if (Array.isArray(data.relationships_followers)) {
        kind = "followers";
        items = data.relationships_followers;
      }
    } else if (Array.isArray(data)) {
      kind = "unknown";
      items = data;
    }

    if (items) {
      items.forEach((item) => {
        if (
          item &&
          Array.isArray(item.string_list_data) &&
          item.string_list_data.length > 0
        ) {
          const value = item.string_list_data[0].value;
          if (typeof value === "string" && value.length > 0) {
            usernames.push(value);
          }
        }
      });
    }

    return { usernames, kind };
  }

  function checkNonFollowers(followingUsernames, followerUsernames) {
    const followerSet = new Set(followerUsernames);
    return followingUsernames
      .filter((username) => !followerSet.has(username))
      .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  }

  // ---------- DOM wiring ----------
  const state = {
    following: { file: null },
    followers: { file: null },
  };

  document.addEventListener("DOMContentLoaded", () => {
    const followingInput = document.getElementById("followingFile");
    const followersInput = document.getElementById("followersFile");
    const processBtn = document.getElementById("processBtn");
    const resultsEl = document.getElementById("results");
    const formError = document.getElementById("formError");

    const dropzones = document.querySelectorAll(".dropzone");
    dropzones.forEach((zone) => wireDropzone(zone));

    followingInput.addEventListener("change", () => {
      handleFileChosen("following", followingInput.files[0] || null);
    });
    followersInput.addEventListener("change", () => {
      handleFileChosen("followers", followersInput.files[0] || null);
    });

    processBtn.addEventListener("click", () =>
      processFiles({ processBtn, resultsEl, formError })
    );

    function handleFileChosen(slot, file) {
      state[slot].file = file;
      const input =
        slot === "following" ? followingInput : followersInput;
      const zone = input.closest(".dropzone");
      clearDropzoneError(zone);
      if (file) {
        setDropzoneSelected(zone, file.name);
      } else {
        setDropzoneEmpty(zone);
      }
      refreshButtonState();
    }

    function refreshButtonState() {
      const ready =
        !!state.following.file &&
        !!state.followers.file &&
        !processBtn.classList.contains("is-loading");
      processBtn.disabled = !ready;
    }

    function wireDropzone(zone) {
      const input = zone.querySelector('input[type="file"]');
      const replaceBtn = zone.querySelector(".dropzone-replace");

      // Clicking "Replace" should re-open file picker without toggling the
      // current selection state off first.
      if (replaceBtn) {
        replaceBtn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          input.value = "";
          input.click();
        });
      }

      ["dragenter", "dragover"].forEach((evt) => {
        zone.addEventListener(evt, (e) => {
          e.preventDefault();
          e.stopPropagation();
          zone.classList.add("is-dragover");
        });
      });
      ["dragleave", "dragend"].forEach((evt) => {
        zone.addEventListener(evt, (e) => {
          e.preventDefault();
          e.stopPropagation();
          zone.classList.remove("is-dragover");
        });
      });
      zone.addEventListener("drop", (e) => {
        e.preventDefault();
        e.stopPropagation();
        zone.classList.remove("is-dragover");
        const files = e.dataTransfer && e.dataTransfer.files;
        if (!files || !files.length) return;
        const file = files[0];
        try {
          // Assign to the underlying input so the `change` handler path stays
          // consistent. DataTransfer is widely supported in modern browsers.
          const dt = new DataTransfer();
          dt.items.add(file);
          input.files = dt.files;
          input.dispatchEvent(new Event("change", { bubbles: true }));
        } catch (_err) {
          // Fallback: bypass the input and drive state directly.
          const slot = zone.getAttribute("data-slot");
          handleFileChosen(slot, file);
        }
      });
    }

    // Initialize disabled state
    refreshButtonState();
  });

  // ---------- Dropzone visual state ----------
  function setDropzoneEmpty(zone) {
    zone.classList.remove("is-selected", "is-error");
    const empty = zone.querySelector(".dropzone-empty");
    const selected = zone.querySelector(".dropzone-selected");
    const errorEl = zone.querySelector(".dropzone-error");
    if (empty) empty.hidden = false;
    if (selected) selected.hidden = true;
    if (errorEl) errorEl.hidden = true;
  }

  function setDropzoneSelected(zone, filename) {
    zone.classList.add("is-selected");
    zone.classList.remove("is-error");
    const empty = zone.querySelector(".dropzone-empty");
    const selected = zone.querySelector(".dropzone-selected");
    const errorEl = zone.querySelector(".dropzone-error");
    const nameEl = zone.querySelector(".dropzone-filename");
    if (empty) empty.hidden = true;
    if (selected) selected.hidden = false;
    if (errorEl) errorEl.hidden = true;
    if (nameEl) {
      nameEl.textContent = filename;
      nameEl.setAttribute("title", filename);
    }
  }

  function setDropzoneError(zone, message) {
    zone.classList.add("is-error");
    zone.classList.remove("is-selected");
    const empty = zone.querySelector(".dropzone-empty");
    const selected = zone.querySelector(".dropzone-selected");
    const errorEl = zone.querySelector(".dropzone-error");
    const msgEl = zone.querySelector(".dropzone-error-text");
    if (empty) empty.hidden = true;
    if (selected) selected.hidden = true;
    if (errorEl) errorEl.hidden = false;
    if (msgEl) msgEl.textContent = message;
  }

  function clearDropzoneError(zone) {
    zone.classList.remove("is-error");
    const errorEl = zone.querySelector(".dropzone-error");
    if (errorEl) errorEl.hidden = true;
  }

  // ---------- Core flow ----------
  async function processFiles({ processBtn, resultsEl, formError }) {
    clearFormError(formError);

    const followingFile = state.following.file;
    const followersFile = state.followers.file;
    if (!followingFile || !followersFile) {
      showFormError(formError, "Please upload both JSON files.");
      return;
    }

    // .zip shortcut check
    const zipFile =
      (followingFile.name && followingFile.name.toLowerCase().endsWith(".zip")
        ? followingFile
        : null) ||
      (followersFile.name && followersFile.name.toLowerCase().endsWith(".zip")
        ? followersFile
        : null);
    if (zipFile) {
      showFormError(
        formError,
        "Looks like you uploaded the zip. Please unzip it first and upload the JSON files inside."
      );
      return;
    }

    setLoading(processBtn, true);
    try {
      const [followingData, followersData] = await Promise.all([
        readFileAsJSON(followingFile),
        readFileAsJSON(followersFile),
      ]);

      const followingExtract = extractUsernames(followingData);
      const followersExtract = extractUsernames(followersData);

      // Swapped-slot detection
      if (
        followingExtract.kind === "followers" ||
        followersExtract.kind === "following"
      ) {
        throw new Error(
          "Looks like you swapped the files. Please check each slot."
        );
      }

      if (
        followingExtract.usernames.length === 0 ||
        followersExtract.usernames.length === 0
      ) {
        throw new Error(
          "We couldn't find any usernames in this file. Is it the right one?"
        );
      }

      const nonFollowers = checkNonFollowers(
        followingExtract.usernames,
        followersExtract.usernames
      );

      renderResults(resultsEl, nonFollowers);
    } catch (error) {
      showFormError(formError, error.message || "Something went wrong.");
      resultsEl.hidden = true;
      resultsEl.innerHTML = "";
    } finally {
      setLoading(processBtn, false);
    }
  }

  function setLoading(btn, isLoading) {
    const label = btn.querySelector(".btn-label");
    if (isLoading) {
      // Lock width to prevent shift from label change
      btn.style.minWidth = btn.offsetWidth + "px";
      btn.classList.add("is-loading");
      btn.disabled = true;
      if (label) label.textContent = "Checking\u2026";
    } else {
      btn.classList.remove("is-loading");
      btn.style.minWidth = "";
      if (label) label.textContent = "Check non-followers";
      // Re-enable only if both files still present
      btn.disabled = !(state.following.file && state.followers.file);
    }
  }

  function showFormError(el, message) {
    if (!el) return;
    el.hidden = false;
    el.textContent = message;
  }

  function clearFormError(el) {
    if (!el) return;
    el.hidden = true;
    el.textContent = "";
  }

  // ---------- Results rendering ----------
  function renderResults(container, nonFollowers) {
    container.innerHTML = "";
    container.hidden = false;
    container.classList.remove("fade-in");
    // Force reflow so animation restarts cleanly
    // eslint-disable-next-line no-unused-expressions
    void container.offsetWidth;
    container.classList.add("fade-in");

    if (nonFollowers.length === 0) {
      const empty = document.createElement("div");
      empty.className = "results-empty";
      empty.innerHTML =
        '<div class="results-empty-icon" aria-hidden="true">\u2728</div>' +
        '<p class="results-empty-title">Everyone you follow follows you back.</p>' +
        '<p class="results-empty-sub">Nothing to worry about here.</p>';
      container.appendChild(empty);
      return;
    }

    const heading = document.createElement("div");
    heading.className = "results-heading";
    const h2 = document.createElement("h2");
    h2.id = "resultsTitle";
    h2.textContent =
      "You follow " +
      nonFollowers.length +
      " account" +
      (nonFollowers.length === 1 ? "" : "s") +
      " that " +
      (nonFollowers.length === 1 ? "doesn't" : "don't") +
      " follow you back.";
    heading.appendChild(h2);

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "copy-btn";
    copyBtn.textContent = "Copy list";
    copyBtn.addEventListener("click", async () => {
      const text = nonFollowers.map((u) => "@" + u).join("\n");
      try {
        await navigator.clipboard.writeText(text);
        const prev = copyBtn.textContent;
        copyBtn.textContent = "Copied!";
        copyBtn.classList.add("copied");
        setTimeout(() => {
          copyBtn.textContent = prev;
          copyBtn.classList.remove("copied");
        }, 2000);
      } catch (_err) {
        copyBtn.textContent = "Copy failed";
        setTimeout(() => {
          copyBtn.textContent = "Copy list";
        }, 2000);
      }
    });
    heading.appendChild(copyBtn);
    container.appendChild(heading);

    const list = document.createElement("ul");
    list.id = "nonFollowersList";
    list.className = "result-list";

    nonFollowers.forEach((username) => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.className = "result-row";
      a.href = "https://www.instagram.com/" + encodeURIComponent(username) + "/";
      a.target = "_blank";
      a.rel = "noopener noreferrer";

      const avatar = document.createElement("span");
      avatar.className = "result-avatar";
      avatar.setAttribute("aria-hidden", "true");
      avatar.textContent = (username.charAt(0) || "?").toUpperCase();

      const handle = document.createElement("span");
      handle.className = "result-handle";
      handle.textContent = "@" + username;

      const extIcon = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg"
      );
      extIcon.setAttribute("class", "result-external");
      extIcon.setAttribute("width", "16");
      extIcon.setAttribute("height", "16");
      extIcon.setAttribute("viewBox", "0 0 24 24");
      extIcon.setAttribute("fill", "none");
      extIcon.setAttribute("stroke", "currentColor");
      extIcon.setAttribute("stroke-width", "2");
      extIcon.setAttribute("stroke-linecap", "round");
      extIcon.setAttribute("stroke-linejoin", "round");
      extIcon.setAttribute("aria-hidden", "true");
      extIcon.innerHTML =
        '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>' +
        '<polyline points="15 3 21 3 21 9"/>' +
        '<line x1="10" y1="14" x2="21" y2="3"/>';

      a.appendChild(avatar);
      a.appendChild(handle);
      a.appendChild(extIcon);
      li.appendChild(a);
      list.appendChild(li);
    });

    container.appendChild(list);
  }

  // Export for potential tests / debugging
  if (typeof window !== "undefined") {
    window.__whoUnfollowed = {
      extractUsernames,
      checkNonFollowers,
    };
  }
})();
