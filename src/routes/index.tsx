import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Phone,
  Search,
  Upload,
  Download,
  Star,
  ChevronRight,
  X,
  Check,
  ArrowLeft,
  StickyNote,
  Trash2,
  Tag,
  Plus,
  ArrowUpDown,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: DialerPage,
});

type Contact = {
  id: string;
  name: string;
  number: string;
  phone?: string;
  company?: string;
  numberOfReviews?: number;
  note?: string;
  category?: string;
};

const SEED: Contact[] = [];

const STORAGE_KEY = "rose-dialer:v1";
const UNCATEGORIZED = "Uncategorized";

type Persisted = {
  contacts: Contact[];
  checkedIds: string[];
  categories?: string[];
};

function loadPersisted(): Persisted | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Persisted;
  } catch {
    return null;
  }
}

function useSystemTheme() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.classList.toggle("dark", mq.matches);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function telHref(num: string) {
  return `tel:${num.replace(/[^\d+]/g, "")}`;
}

function truncateName(name: string, max = 13) {
  if (name.length <= max) return name;
  return `${name.slice(0, max)}...`;
}


function DialerPage() {
  useSystemTheme();

  const [contacts, setContacts] = useState<Contact[]>(SEED);
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [tab, setTab] = useState<"all" | "checked">("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"name" | "reviews">("name");

  const [detail, setDetail] = useState<Contact | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [importCategory, setImportCategory] = useState<string>(UNCATEGORIZED);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);

  // hydrate from localStorage after mount
  useEffect(() => {
    const p = loadPersisted();
    if (p) {
      setContacts(p.contacts);
      setCheckedIds(p.checkedIds);
      if (p.categories) setCategories(p.categories);
    }
    setHydrated(true);
  }, []);

  // persist
  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ contacts, checkedIds, categories } satisfies Persisted),
    );
  }, [contacts, checkedIds, categories, hydrated]);

  // Derive all categories present (from list + contact assignments)
  const allCategories = useMemo(() => {
    const set = new Set<string>(categories);
    for (const c of contacts) {
      if (c.category) set.add(c.category);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [categories, contacts]);

  const baseContacts = useMemo(() => {
    return tab === "all"
      ? contacts.filter((c) => !checkedIds.includes(c.id))
      : contacts.filter((c) => checkedIds.includes(c.id));
  }, [contacts, checkedIds, tab]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    counts.set("all", baseContacts.length);
    counts.set(UNCATEGORIZED, baseContacts.filter((c) => !c.category).length);
    for (const c of baseContacts) {
      if (c.category) {
        counts.set(c.category, (counts.get(c.category) ?? 0) + 1);
      }
    }
    return counts;
  }, [baseContacts]);

  const visibleContacts = useMemo(() => {
    const q = query.trim().toLowerCase();
    let base = [...baseContacts];

    if (filterCategory !== "all") {
      if (filterCategory === UNCATEGORIZED) {
        base = base.filter((c) => !c.category);
      } else {
        base = base.filter((c) => c.category === filterCategory);
      }
    }

    const list = q
      ? base.filter(
          (c) => c.name.toLowerCase().includes(q) || c.number.toLowerCase().includes(q),
        )
      : base;

    if (sortBy === "reviews") {
      return [...list].sort(
        (a, b) => (b.numberOfReviews ?? 0) - (a.numberOfReviews ?? 0),
      );
    }
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [baseContacts, query, filterCategory, sortBy]);

  const grouped = useMemo(() => {
    const map = new Map<string, Contact[]>();
    for (const c of visibleContacts) {
      const letter = (c.name[0] ?? "#").toUpperCase();
      const key = /[A-Z]/.test(letter) ? letter : "#";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [visibleContacts]);

  const toggleCheck = (id: string) => {
    setCheckedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };


  const deleteContact = (id: string) => {
    setContacts((prev) => prev.filter((c) => c.id !== id));
    setCheckedIds((prev) => prev.filter((x) => x !== id));
    setDetail((d) => (d && d.id === id ? null : d));
  };

  const updateNote = (id: string, note: string) => {
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, note } : c)));
    setDetail((d) => (d && d.id === id ? { ...d, note } : d));
  };

  const updateCategory = (id: string, category: string) => {
    const cat = category === UNCATEGORIZED ? undefined : category;
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, category: cat } : c)));
    setDetail((d) => (d && d.id === id ? { ...d, category: cat } : d));
  };

  const openImport = () => {
    setImportCategory(UNCATEGORIZED);
    setNewCategoryName("");
    setCreatingCategory(false);
    setImportError(null);
    setImportOpen(true);
  };

  const confirmNewCategory = () => {
    const name = newCategoryName.trim();
    if (!name) return;
    if (!categories.includes(name)) {
      setCategories((prev) => [...prev, name]);
    }
    setImportCategory(name);
    setNewCategoryName("");
    setCreatingCategory(false);
  };

  const handleImport = () => {
    setImportError(null);
    try {
      const parsed = JSON.parse(importText);
      if (!Array.isArray(parsed)) throw new Error("Expected an array of contacts.");

      const normalizeName = (v: string) => v.toLowerCase().trim();
      const normalizeNumber = (v: string) => v.replace(/[^\d+]/g, "");
      const contactKey = (name: string, number: string) =>
        `${normalizeName(name)}|${normalizeNumber(number)}`;

      const seen = new Set<string>();
      for (const c of contacts) {
        seen.add(contactKey(c.name, c.number));
      }

      const assignedCategory =
        importCategory && importCategory !== UNCATEGORIZED ? importCategory : undefined;

      const next: Contact[] = [];
      parsed.forEach((raw, i) => {
        if (!raw || typeof raw !== "object") return;
        const name = String((raw as any).name ?? "").trim();
        const number = String((raw as any).number ?? (raw as any).phone ?? "").trim();
        // Skip contacts without a name or number instead of erroring
        if (!name || !number) return;
        const key = contactKey(name, number);
        if (seen.has(key)) return;
        seen.add(key);
        const rawReviews = (raw as any).numberOfReviews;
        next.push({
          id:
            (raw as any).id?.toString() ??
            `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
          name,
          number,
          phone: (raw as any).phone ? String((raw as any).phone) : undefined,
          company: (raw as any).company ? String((raw as any).company) : undefined,
          numberOfReviews:
            typeof rawReviews === "number" ? rawReviews : undefined,
          note: (raw as any).note ? String((raw as any).note) : undefined,
          category: (raw as any).category
            ? String((raw as any).category)
            : assignedCategory,
        });
      });

      // Register any categories that came in on the contacts themselves.
      const newCats = new Set<string>();
      for (const c of next) {
        if (c.category && !categories.includes(c.category)) newCats.add(c.category);
      }
      if (newCats.size > 0) {
        setCategories((prev) => [...prev, ...newCats]);
      }

      setContacts((prev) => [...prev, ...next]);
      setImportOpen(false);
      setImportText("");
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Invalid JSON.");
    }
  };

  const handleExport = () => {
    const data = contacts.map(({ id: _id, ...rest }) => rest);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "contacts.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col">
        {/* Header */}
        <header className="sticky top-0 z-20 border-b border-[color:var(--hairline)] bg-[color:var(--surface)]/85 backdrop-blur-xl">
          <div className="flex items-center justify-between px-5 pt-5 pb-2">
            <button
              onClick={openImport}
              className="rounded-full p-2 text-[color:var(--pink)] transition hover:bg-[color:var(--pink-soft)] active:scale-95"
              aria-label="Import contacts"
            >
              <Upload className="h-[22px] w-[22px]" strokeWidth={2.2} />
            </button>
            <h1 className="text-[17px] font-semibold tracking-tight">Contacts</h1>
            <button
              onClick={handleExport}
              className="rounded-full p-2 text-[color:var(--pink)] transition hover:bg-[color:var(--pink-soft)] active:scale-95"
              aria-label="Export contacts"
            >
              <Download className="h-[22px] w-[22px]" strokeWidth={2.2} />
            </button>
          </div>

          <div className="px-4 pb-3">
            <div className="flex items-center gap-2 rounded-xl bg-[color:var(--surface-2)] px-3 py-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search"
                className="w-full bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
              />
              {query && (
                <button onClick={() => setQuery("")} aria-label="Clear search">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>

          {/* Category filter */}
          <div className="flex items-center gap-2 px-4 pb-3">
            <Tag className="h-4 w-4 text-muted-foreground" />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="flex-1 rounded-xl bg-[color:var(--surface-2)] px-3 py-2 text-[14px] outline-none focus:ring-2 focus:ring-[color:var(--pink)]"
              aria-label="Filter by category"
            >
              <option value="all">
                All categories ({categoryCounts.get("all") ?? 0})
              </option>
              <option value={UNCATEGORIZED}>
                Uncategorized ({categoryCounts.get(UNCATEGORIZED) ?? 0})
              </option>
              {allCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat} ({categoryCounts.get(cat) ?? 0})
                </option>
              ))}
            </select>
          </div>

          {/* Sort filter */}
          <div className="flex items-center gap-2 px-4 pb-3">
            <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "name" | "reviews")}
              className="flex-1 rounded-xl bg-[color:var(--surface-2)] px-3 py-2 text-[14px] outline-none focus:ring-2 focus:ring-[color:var(--pink)]"
              aria-label="Sort contacts"
            >
              <option value="name">Sort by name</option>
              <option value="reviews">Sort by number of reviews</option>
            </select>
          </div>
        </header>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-[color:var(--hairline)] bg-[color:var(--surface)] px-4 py-2">
          {(
            [
              { id: "all", label: "Contacts", count: contacts.length - checkedIds.length },
              { id: "checked", label: "Checked", count: checkedIds.length },
            ] as const
          ).map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 rounded-xl px-3 py-2 text-[14px] font-semibold transition ${
                  active
                    ? "bg-[color:var(--pink)] text-white shadow-sm"
                    : "text-muted-foreground hover:bg-[color:var(--surface-2)]"
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  {t.id === "checked" && (
                    <Star className="h-3.5 w-3.5" fill={active ? "currentColor" : "none"} />
                  )}
                  {t.label}
                  <span
                    className={`rounded-full px-1.5 text-[11px] ${
                      active
                        ? "bg-white/20 text-white"
                        : "bg-[color:var(--surface-2)] text-muted-foreground"
                    }`}
                  >
                    {t.count}
                  </span>
                </span>
              </button>
            );
          })}
        </div>


        {/* List */}
        <div className="flex-1 overflow-y-auto pb-16">
          {grouped.length === 0 ? (
            <div className="mt-24 text-center text-sm text-muted-foreground">
              {query
                ? "No matches."
                : tab === "checked"
                  ? "No checked contacts yet. Tick a contact in All contacts to move it here."
                  : "No contacts in this view."}
            </div>
          ) : (
            grouped.map(([letter, items]) => (
              <section key={letter}>
                <div className="sticky top-0 z-10 bg-[color:var(--surface-2)]/95 px-5 py-1 text-[13px] font-semibold text-muted-foreground backdrop-blur">
                  {letter}
                </div>
                <ul>
                  {items.map((c) => (
                    <li
                      key={c.id}
                      className="flex items-center gap-3 border-b border-[color:var(--hairline)] px-4 py-2.5 last:border-b-0"
                    >
                      <button
                        onClick={() => toggleCheck(c.id)}
                        className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border transition ${
                          checkedIds.includes(c.id)
                            ? "border-[color:var(--pink)] bg-[color:var(--pink)] text-white"
                            : "border-[color:var(--hairline)] bg-[color:var(--surface)]"
                        }`}
                        aria-label={
                          checkedIds.includes(c.id)
                            ? `Move ${c.name} back to All contacts`
                            : `Check ${c.name}`
                        }
                      >
                        {checkedIds.includes(c.id) && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                      </button>

                      <button
                        onClick={() => setDetail(c)}
                        className="flex flex-1 items-center gap-3 text-left"
                      >
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[color:var(--pink-soft)] text-[13px] font-semibold text-[color:var(--accent-foreground)]">
                          {initials(c.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[16px] font-medium leading-tight">
                            {truncateName(c.name)}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-[13px] text-muted-foreground">
                              {c.number}
                            </span>
                            {c.category && (
                              <span className="shrink-0 rounded-full bg-[color:var(--pink-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[color:var(--accent-foreground)]">
                                {c.category}
                              </span>
                            )}
                          </div>
                        </div>
                        {c.note && (
                          <StickyNote className="h-4 w-4 text-[color:var(--pink)]" />
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </button>

                      <a
                        href={telHref(c.number)}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[color:var(--pink)] text-white shadow-sm transition active:scale-95"
                        aria-label={`Call ${c.name}`}
                      >
                        <Phone className="h-[15px] w-[15px]" fill="currentColor" />
                      </a>

                      <button
                        onClick={() => {
                          if (
                            typeof window === "undefined" ||
                            window.confirm(`Delete ${c.name}?`)
                          ) {
                            deleteContact(c.id);
                          }
                        }}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[color:var(--surface-2)] text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                        aria-label={`Delete ${c.name}`}
                      >
                        <Trash2 className="h-[15px] w-[15px]" />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      </main>

      {/* Detail sheet */}
      {detail && (
        <ContactSheet
          contact={detail}
          categories={allCategories}
          onClose={() => setDetail(null)}
          onNoteChange={(note) => updateNote(detail.id, note)}
          onCategoryChange={(cat) => updateCategory(detail.id, cat)}
        />
      )}

      {/* Import sheet */}
      {importOpen && (
        <Sheet onClose={() => setImportOpen(false)} title="Import contacts">
          <p className="text-[13px] text-muted-foreground">
            Paste a JSON array like{" "}
            <code className="rounded bg-[color:var(--surface-2)] px-1 py-0.5 text-[12px]">
              [{`{ "name": "...", "number": "..." }`}]
            </code>
          </p>

          {/* Category picker */}
          <div className="mt-3">
            <label className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Tag className="h-3.5 w-3.5" />
              Category
            </label>
            {creatingCategory ? (
              <div className="flex gap-2">
                <input
                  autoFocus
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") confirmNewCategory();
                    if (e.key === "Escape") {
                      setCreatingCategory(false);
                      setNewCategoryName("");
                    }
                  }}
                  placeholder="New category name"
                  className="flex-1 rounded-xl border border-[color:var(--hairline)] bg-[color:var(--surface-2)] px-3 py-2 text-[14px] outline-none focus:border-[color:var(--pink)]"
                />
                <button
                  onClick={confirmNewCategory}
                  disabled={!newCategoryName.trim()}
                  className="rounded-xl bg-[color:var(--pink)] px-3 py-2 text-[13px] font-semibold text-white disabled:opacity-40"
                >
                  Add
                </button>
                <button
                  onClick={() => {
                    setCreatingCategory(false);
                    setNewCategoryName("");
                  }}
                  className="rounded-xl bg-[color:var(--surface-2)] px-3 py-2 text-[13px] font-semibold"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <select
                  value={importCategory}
                  onChange={(e) => setImportCategory(e.target.value)}
                  className="flex-1 rounded-xl bg-[color:var(--surface-2)] px-3 py-2 text-[14px] outline-none focus:ring-2 focus:ring-[color:var(--pink)]"
                >
                  <option value={UNCATEGORIZED}>Uncategorized</option>
                  {allCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setCreatingCategory(true)}
                  className="inline-flex items-center gap-1 rounded-xl bg-[color:var(--pink-soft)] px-3 py-2 text-[13px] font-semibold text-[color:var(--accent-foreground)]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  New
                </button>
              </div>
            )}
          </div>

          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={8}
            spellCheck={false}
            className="mt-3 w-full resize-y rounded-xl border border-[color:var(--hairline)] bg-[color:var(--surface-2)] p-3 font-mono text-[13px] outline-none focus:border-[color:var(--pink)]"
            placeholder='[{"name":"Ada Lovelace","number":"+44 20 5555 0100"}]'
          />
          {importError && (
            <p className="mt-2 text-[13px] text-destructive">{importError}</p>
          )}
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setImportOpen(false)}
              className="flex-1 rounded-xl bg-[color:var(--surface-2)] py-3 text-[15px] font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={!importText.trim()}
              className="flex-1 rounded-xl bg-[color:var(--pink)] py-3 text-[15px] font-semibold text-white transition disabled:opacity-40"
            >
              Import
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

function ContactSheet({
  contact,
  categories,
  onClose,
  onNoteChange,
  onCategoryChange,
}: {
  contact: Contact;
  categories: string[];
  onClose: () => void;
  onNoteChange: (note: string) => void;
  onCategoryChange: (category: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="mx-auto w-full max-w-md rounded-t-3xl bg-[color:var(--surface)] pb-6 shadow-2xl sm:rounded-3xl">
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <button
            onClick={onClose}
            className="flex items-center gap-1 text-[color:var(--pink)]"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-[15px]">Contacts</span>
          </button>
          <button onClick={onClose} className="p-1 text-muted-foreground" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col items-center px-6 pt-2 pb-5">
          <div className="grid h-24 w-24 place-items-center rounded-full bg-[color:var(--pink-soft)] text-2xl font-semibold text-[color:var(--accent-foreground)]">
            {initials(contact.name)}
          </div>
          <h2 className="mt-3 text-[22px] font-semibold tracking-tight">{contact.name}</h2>
          <p className="text-[14px] text-muted-foreground">{contact.number}</p>

          <a
            href={telHref(contact.number)}
            className="mt-5 flex items-center gap-2 rounded-full bg-[color:var(--pink)] px-6 py-3 text-[15px] font-semibold text-white shadow-lg shadow-[color:var(--pink)]/30 transition active:scale-95"
          >
            <Phone className="h-4 w-4" fill="currentColor" />
            Call
          </a>
        </div>

        <div className="mx-4 mb-3 rounded-2xl bg-[color:var(--surface-2)] p-4">
          <label className="mb-2 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Tag className="h-3.5 w-3.5" />
            Category
          </label>
          <select
            value={contact.category ?? UNCATEGORIZED}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="w-full rounded-xl bg-[color:var(--surface)] px-3 py-2 text-[14px] outline-none focus:ring-2 focus:ring-[color:var(--pink)]"
          >
            <option value={UNCATEGORIZED}>Uncategorized</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div className="mx-4 rounded-2xl bg-[color:var(--surface-2)] p-4">
          <label className="mb-2 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">
            <StickyNote className="h-3.5 w-3.5" />
            Notes
          </label>
          <textarea
            value={contact.note ?? ""}
            onChange={(e) => onNoteChange(e.target.value)}
            rows={5}
            placeholder="Add a note about this contact…"
            className="w-full resize-none bg-transparent text-[15px] leading-relaxed outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>
    </div>
  );
}

function Sheet({
  children,
  onClose,
  title,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="mx-auto w-full max-w-md rounded-t-3xl bg-[color:var(--surface)] p-5 pb-7 shadow-2xl sm:rounded-3xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[17px] font-semibold">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 text-muted-foreground"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
