// Ngwg-feature — must-load Ngwg plugin implementing exactly one protocol:
//
//   ngwg-helper-v1 : helper functions exposed to themes as `h.<name>` inside
//                    templates ({{@ formatDate post.date "YYYY"}}), plus an
//                    optional buildData() hook that enriches site.data.
//                    Includes the i18n helper t: {{@ t "key" args… }} renders
//                    the theme's translation for the selected language.
//
// Helpers make common theme tasks trivial: building archive structures,
// tag/category listings, date formatting and excerpts. Complex logic belongs
// in plugins like this one — themes stay declarative.

export function formatDate(date: any, format = "YYYY-MM-DD"): string {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return String(date);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return format
    .replace(/YYYY/g, String(d.getFullYear()))
    .replace(/MM/g, pad(d.getMonth() + 1))
    .replace(/DD/g, pad(d.getDate()))
    .replace(/HH/g, pad(d.getHours()))
    .replace(/mm/g, pad(d.getMinutes()))
    .replace(/ss/g, pad(d.getSeconds()));
}

function parseDate(v: any): Date {
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? new Date(0) : d;
}

/** Group posts into archive sections (by year, newest first). */
export function archives(posts: any[]): { name: string; posts: any[] }[] {
  const groups = new Map<number, any[]>();
  for (const post of posts ?? []) {
    const year = parseDate(post.meta?.date ?? post.date).getFullYear();
    (groups.get(year) ?? groups.set(year, []).get(year)!).push(post);
  }
  return [...groups.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, group]) => ({ name: String(year), posts: group }));
}

/** Tag list with post counts, sorted by count descending. */
export function tagCloud(tags: Record<string, any[]>): { name: string; count: number }[] {
  return Object.entries(tags ?? {})
    .map(([name, posts]) => ({ name, count: posts.length }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** Category list with post counts, sorted by count descending. */
export function categoryTree(categories: Record<string, any[]>): { name: string; count: number }[] {
  return tagCloud(categories);
}

/** Plain-text excerpt of a post (strips tags, truncates at word boundary). */
export function excerpt(post: any, length = 120): string {
  const src = String(post?.html ?? post?.body ?? post?.excerpt ?? "");
  const text = src
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= length) return text;
  return text.slice(0, text.lastIndexOf(" ", length) > 0 ? text.lastIndexOf(" ", length) : length) + "…";
}

/** First N items of an array. */
export function limit(arr: any[], n = 5): any[] {
  return (arr ?? []).slice(0, n);
}

/** Number of items in an array or keys in an object (0 for null/undefined). */
export function size(v: any): number {
  if (v === null || v === undefined) return 0;
  if (Array.isArray(v)) return v.length;
  if (typeof v === "object") return Object.keys(v).length;
  return 0;
}

/** URL-safe slug for tags/categories (mirrors Ngwg-core's slugify). */
export function slugify(s: string): string {
  return (
    String(s)
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "") || "untitled"
  );
}

/** Posts for one tag name. */
export function postsWithTag(site: any, tag: string): any[] {
  return site?.tags?.[tag] ?? [];
}

/** Posts for one category name. */
export function postsInCategory(site: any, category: string): any[] {
  return site?.categories?.[category] ?? [];
}

/**
 * Translate a theme i18n string: `{{@ t "archive.subtitle" site.posts.length }}`.
 * The template deployer binds `this` to the page's root render context,
 * which carries the theme string table as `t` for the selected language.
 * `{0}`, `{1}`, … in the string are replaced by the extra arguments. Dot
 * paths walk nested YAML maps (`{{@ t "nav.home" }}`). A missing key renders
 * as the key itself so gaps are visible instead of silent.
 */
export function t(this: any, key: any, ...args: any[]): string {
  if (typeof key !== "string" || !key) return "";
  let cur = this?.t;
  for (const seg of key.split(".")) {
    if (cur === null || typeof cur !== "object") {
      cur = undefined;
      break;
    }
    cur = cur[seg];
  }
  if (cur === undefined || cur === null) return key;
  let s = typeof cur === "string" ? cur : String(cur);
  args.forEach((a, i) => {
    s = s.split(`{${i}}`).join(a === undefined || a === null ? "" : String(a));
  });
  return s;
}

const helper = {
  name: "feature",
  version: "0.2.0",

  helpers: {
    formatDate,
    archives,
    tagCloud,
    categoryTree,
    excerpt,
    limit,
    size,
    slugify,
    postsWithTag,
    postsInCategory,
    t,
  },

  /** Enrich site.data during pipeline step 7. */
  buildData(_ctx: any, site: any, posts: any[]) {
    const withExcerpt = posts.slice(0, 5).map((p) => ({ ...p, _excerpt: excerpt(p, 160) }));
    return {
      recent: withExcerpt.map((p) => p.meta?.slug ?? p.meta?.title),
      totalPosts: posts.length,
      totalWords: posts.reduce((sum, p) => sum + String(p.body ?? "").split(/\s+/).filter(Boolean).length, 0),
    };
  },
};

export default { helpers: [helper] };
