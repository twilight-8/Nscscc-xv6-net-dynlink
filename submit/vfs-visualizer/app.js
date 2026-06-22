const STORE_KEY = "xv6-vfs-folder-demo";

const initialFs = [
  {
    id: crypto.randomUUID(),
    name: "README",
    type: "file",
    content:
      "xv6fs is currently served by the original xv6 filesystem backend.\n\nStage A routes read/write/stat/trunc through a thin VFS wrapper, then forwards back to readi/writei/stati/itrunc.\n",
  },
  {
    id: crypto.randomUUID(),
    name: "hello.txt",
    type: "file",
    content: "Hello from xv6fs.\nThis file is editable in the visual demo.\n",
  },
  {
    id: crypto.randomUUID(),
    name: "bin",
    type: "dir",
    content: "",
  },
  {
    id: crypto.randomUUID(),
    name: "usertests.log",
    type: "file",
    content: "make kernel/kernel: PASS\nusertests -q: ALL TESTS PASSED\n",
  },
];

const state = {
  entries: [],
  selectedId: null,
  dirty: false,
};

const $ = (id) => document.getElementById(id);

function cloneInitialFs() {
  return initialFs.map((entry) => ({ ...entry, id: crypto.randomUUID() }));
}

function loadEntries() {
  const stored = localStorage.getItem(STORE_KEY);
  if (!stored) {
    return cloneInitialFs();
  }

  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : cloneInitialFs();
  } catch {
    return cloneInitialFs();
  }
}

function saveEntries() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state.entries));
}

function selectedEntry() {
  return state.entries.find((entry) => entry.id === state.selectedId) || null;
}

function byteSize(text) {
  return new TextEncoder().encode(text || "").length;
}

function log(message) {
  $("log-line").textContent = message;
}

function setVfsPath(operation) {
  const paths = {
    read: "sys_read -> fileread -> vfs_readi -> ip->ops->read -> readi",
    write: "sys_write -> filewrite -> vfs_writei -> ip->ops->write -> writei",
    stat: "sys_fstat -> filestat -> vfs_stati -> ip->ops->stat -> stati",
    trunc: "sys_open(O_TRUNC) -> vfs_itrunc -> ip->ops->trunc -> itrunc",
  };
  $("vfs-path").textContent = paths[operation] || "select a file";
}

function renderList() {
  const list = $("file-list");
  list.innerHTML = "";

  state.entries
    .slice()
    .sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "dir" ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    })
    .forEach((entry) => {
      const row = document.createElement("button");
      row.className = "file-row";
      if (entry.id === state.selectedId) {
        row.classList.add("active");
      }

      const size = entry.type === "dir" ? "-" : `${byteSize(entry.content)} B`;
      row.innerHTML = `
        <span class="file-name">
          <span class="file-mark">${entry.type === "dir" ? "DIR" : "TXT"}</span>
          <span class="file-label">${entry.name}</span>
        </span>
        <span class="file-type">${entry.type}</span>
        <span class="file-size">${size}</span>
      `;
      row.addEventListener("click", () => selectEntry(entry.id));
      list.appendChild(row);
    });
}

function renderEditor() {
  const entry = selectedEntry();
  const editor = $("editor");
  const dirtyState = $("dirty-state");

  state.dirty = false;
  dirtyState.textContent = "clean";
  dirtyState.classList.remove("dirty");

  if (!entry) {
    $("selected-path").textContent = "No file selected";
    $("selected-meta").textContent = "select a regular file to edit";
    editor.value = "";
    editor.disabled = true;
    setVfsPath("");
    return;
  }

  $("selected-path").textContent = `/${entry.name}`;
  $("selected-meta").textContent =
    entry.type === "dir" ? "directory" : `${byteSize(entry.content)} bytes`;

  if (entry.type === "dir") {
    editor.value = "Directory preview only.\n\nNested directories will be added after mount/path work is ready.";
    editor.disabled = true;
    setVfsPath("stat");
    log(`stat /${entry.name}`);
    return;
  }

  editor.value = entry.content;
  editor.disabled = false;
  setVfsPath("read");
  log(`open /${entry.name}`);
}

function selectEntry(id) {
  state.selectedId = id;
  renderList();
  renderEditor();
}

function uniqueName(base) {
  const names = new Set(state.entries.map((entry) => entry.name));
  if (!names.has(base)) {
    return base;
  }

  const dot = base.lastIndexOf(".");
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const ext = dot > 0 ? base.slice(dot) : "";
  let index = 1;
  let candidate = `${stem}-${index}${ext}`;
  while (names.has(candidate)) {
    index += 1;
    candidate = `${stem}-${index}${ext}`;
  }
  return candidate;
}

function createEntry(type) {
  const fallback = type === "dir" ? "newdir" : "newfile.txt";
  const input = prompt(type === "dir" ? "Folder name" : "File name", fallback);
  if (input == null) {
    return;
  }

  const trimmed = input.trim();
  if (!trimmed || trimmed.includes("/")) {
    log("invalid name");
    return;
  }

  const entry = {
    id: crypto.randomUUID(),
    name: uniqueName(trimmed),
    type,
    content: type === "file" ? "" : "",
  };
  state.entries.push(entry);
  state.selectedId = entry.id;
  saveEntries();
  renderList();
  renderEditor();
  setVfsPath(type === "file" ? "write" : "stat");
  log(`create /${entry.name}`);
}

function deleteSelected() {
  const entry = selectedEntry();
  if (!entry) {
    log("nothing selected");
    return;
  }

  if (!confirm(`Delete /${entry.name}?`)) {
    return;
  }

  state.entries = state.entries.filter((item) => item.id !== entry.id);
  state.selectedId = state.entries[0]?.id || null;
  saveEntries();
  renderList();
  renderEditor();
  log(`delete /${entry.name}`);
}

function renameSelected() {
  const entry = selectedEntry();
  if (!entry) {
    log("nothing selected");
    return;
  }

  const input = prompt("New name", entry.name);
  if (input == null) {
    return;
  }

  const trimmed = input.trim();
  if (!trimmed || trimmed.includes("/")) {
    log("invalid name");
    return;
  }

  entry.name = uniqueName(trimmed);
  saveEntries();
  renderList();
  renderEditor();
  log(`rename to /${entry.name}`);
}

function saveSelected() {
  const entry = selectedEntry();
  if (!entry || entry.type !== "file") {
    log("select a file first");
    return;
  }

  entry.content = $("editor").value;
  saveEntries();
  state.dirty = false;
  $("dirty-state").textContent = "clean";
  $("dirty-state").classList.remove("dirty");
  renderList();
  renderEditor();
  setVfsPath("write");
  log(`write /${entry.name}`);
}

function resetDemo() {
  if (!confirm("Reset demo filesystem?")) {
    return;
  }
  localStorage.removeItem(STORE_KEY);
  state.entries = cloneInitialFs();
  state.selectedId = state.entries[0].id;
  saveEntries();
  renderList();
  renderEditor();
  log("reset xv6fs demo state");
}

function bindActions() {
  $("new-file").addEventListener("click", () => createEntry("file"));
  $("new-folder").addEventListener("click", () => createEntry("dir"));
  $("delete").addEventListener("click", deleteSelected);
  $("rename").addEventListener("click", renameSelected);
  $("save").addEventListener("click", saveSelected);
  $("reset").addEventListener("click", resetDemo);

  $("editor").addEventListener("input", () => {
    const entry = selectedEntry();
    if (!entry || entry.type !== "file") {
      return;
    }
    state.dirty = true;
    $("dirty-state").textContent = "modified";
    $("dirty-state").classList.add("dirty");
    setVfsPath("write");
  });
}

function init() {
  state.entries = loadEntries();
  state.selectedId = state.entries[0]?.id || null;
  bindActions();
  renderList();
  renderEditor();
}

init();
