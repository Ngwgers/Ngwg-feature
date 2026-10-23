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

import { copyFile, mkdir, readdir, realpath, stat } from "node:fs/promises";
import * as path from "node:path";

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

/**
 * Plain-text excerpt of a post (strips tags, truncates at word boundary).
 * Prefers the author's `<!-- more -->` intro (`excerptHtml`), which is also
 * what listing cards show, so a banner description repeats that passage instead
 * of the opening of the body.
 */
export function excerpt(post: any, length = 120): string {
  const src = String(post?.excerptHtml ?? post?.html ?? post?.body ?? post?.excerpt ?? "");
  const text = src
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= length) return text;
  return text.slice(0, text.lastIndexOf(" ", length) > 0 ? text.lastIndexOf(" ", length) : length) + "…";
}

/**
 * CJK characters and latin words of a post, from its raw markdown: fenced and
 * inline code, raw HTML and link targets are dropped so markup is not counted.
 * `body` and not `html` on purpose — the deployer shortens `html` to the first
 * segment of a long post before the layout renders.
 */
function textUnits(post: any): { cjk: number; latin: number } {
  const text = String(post?.body ?? post ?? "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\]\([^)\s]*\)/g, "]");
  const cjk = (text.match(/[\u3400-\u9fff]/g) || []).length;
  const latin = (text.replace(/[\u3400-\u9fff]/g, " ").match(/[A-Za-z0-9]+/g) || []).length;
  return { cjk, latin };
}

/** Word count of a post: every CJK character plus every latin word. */
export function wordCount(post: any): number {
  const { cjk, latin } = textUnits(post);
  return cjk + latin;
}

/** Reading time in minutes (CJK 400/min, latin 220/min), never below 1. */
export function readingTime(post: any): number {
  const { cjk, latin } = textUnits(post);
  return Math.max(1, Math.round(cjk / 400 + latin / 220));
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

/** True when `child` is `parent` itself or lives below it (lexical check). */
function isWithin(parent: string, child: string): boolean {
  const rel = path.relative(parent, child);
  return rel === "" || (rel !== ".." && !rel.startsWith(".." + path.sep) && !path.isAbsolute(rel));
}

export interface CopyDeclaredFilesOptions {
  /** output directory (the site's public/) */
  publicDir: string;
  /** base directory relative entries are resolved against (default: process.cwd()) */
  cwd?: string;
  log?: { warn(msg: string): void };
}

/**
 * Copy `copy_files` entries (files or directories, relative to the working
 * directory) into the output directory, preserving their relative path.
 * Symbolic links are followed: linked files are copied by value and linked
 * directories are traversed recursively, with an ancestor check that stops
 * link cycles. Missing entries and broken links only produce a warning;
 * the output directory itself is never copied into itself.
 *
 * Returns the number of regular files written.
 */
export async function copyDeclaredFiles(entries: unknown, opts: CopyDeclaredFilesOptions): Promise<number> {
  const warn = (msg: string) => opts.log?.warn(msg);
  if (entries === undefined || entries === null) return 0;
  if (!Array.isArray(entries)) {
    warn(`copy_files must be an array of paths, got ${typeof entries}; ignored`);
    return 0;
  }

  const baseDir = path.resolve(opts.cwd ?? process.cwd());
  const publicDir = path.resolve(opts.publicDir);
  const publicReal = await realpath(publicDir).catch(() => publicDir);
  let copied = 0;

  const copyEntry = async (src: string, dest: string, ancestors: Set<string>): Promise<number> => {
    // never walk into the output directory: `copy_files: ["."]` must not
    // recursively copy public/ into itself
    if (isWithin(publicDir, src)) return 0;
    let info;
    try {
      info = await stat(src);
    } catch (e) {
      warn(`copy_files: cannot read ${src} (${(e as NodeJS.ErrnoException).code ?? (e as Error).message}); skipped`);
      return 0;
    }

    const real = await realpath(src).catch(() => src);
    if (isWithin(publicReal, real) || isWithin(publicDir, real)) return 0;

    if (info.isDirectory()) {
      if (ancestors.has(real)) {
        warn(`copy_files: symlink cycle at ${src}; skipped`);
        return 0;
      }
      ancestors.add(real);
      try {
        await mkdir(dest, { recursive: true });
        let count = 0;
        for (const name of await readdir(src)) {
          count += await copyEntry(path.join(src, name), path.join(dest, name), ancestors);
        }
        return count;
      } finally {
        ancestors.delete(real);
      }
    }
    if (info.isFile()) {
      await mkdir(path.dirname(dest), { recursive: true });
      await copyFile(src, dest);
      return 1;
    }
    warn(`copy_files: ${src} is neither a file nor a directory; skipped`);
    return 0;
  };

  for (const entry of entries) {
    if (typeof entry !== "string" || !entry.trim()) {
      warn(`copy_files: expected a path string, got ${JSON.stringify(entry)}; skipped`);
      continue;
    }
    const src = path.resolve(baseDir, entry);
    let rel: string;
    if (path.isAbsolute(entry)) {
      rel = path.basename(path.normalize(entry));
    } else {
      rel = path.normalize(entry);
      if (rel === "." || rel === ".." || rel.startsWith(".." + path.sep)) {
        warn(`copy_files: ${entry} points outside the working directory; skipped`);
        continue;
      }
    }
    const dest = path.resolve(publicDir, rel);
    if (dest === publicDir || !isWithin(publicDir, dest)) {
      warn(`copy_files: ${entry} would write outside the output directory; skipped`);
      continue;
    }
    copied += await copyEntry(src, dest, new Set());
  }
  return copied;
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
    wordCount,
    readingTime,
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

  /**
   * Copy the files/directories declared in `plugins.feature.option.copy_files`
   * into public/ once the deployers are done (afterDeploy hook).
   */
  async afterDeploy(ctx: any, env: any) {
    const count = await copyDeclaredFiles(ctx?.options?.self?.copy_files, {
      publicDir: env.publicDir,
      cwd: process.cwd(),
      log: ctx.log,
    });
    if (count > 0) ctx.log.info(`copied ${count} file(s) from copy_files`);
  },
};

const option = {
  name: "feature-options",
  version: "0.2.0",
};

export default { helpers: [helper], options: [option] };
