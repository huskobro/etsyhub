// Pass 79 — Prompt template + variable substitution servisi.
//
// Domain-bağımsız helper: bir template string'i (ör. `{{subject}} in
// {{style}} style, {{palette}} palette`) ve değişken map'i alır;
// expanded prompt döner.
//
// Tasarım hedefleri (kullanıcı önceliği: API-first omurga + diğer
// uygulamalara taşınabilirlik):
//   - Bridge tarafı dokunmaz (sadece düz string alır; her zaman olduğu gibi)
//   - EtsyHub MJ service prompt'u submit etmeden ÖNCE expand eder
//   - Provider-bağımsız: yarın Recraft/DALL-E gibi başka motorlara da
//     aynı template aktarılabilir (sadece flag suffix'i değişir)
//   - Variables: `{{name}}` syntax (Mustache-uyumlu, JS'de yaygın)
//   - Eksik variable → ValidationError (sessiz "" yerine açık hata)
//   - Strict whitelist: variable adı `[a-zA-Z][a-zA-Z0-9_]*` (regex/script
//     injection riskini sıfırlar)
//   - Unknown variable in `variables`: not silent — flag edilir (debug)
//
// Pass 79 V1 scope:
//   - `expandPromptTemplate(template, variables)` core helper
//   - `extractTemplateVariables(template)` — template'teki tüm değişkenleri çıkar
//     (UI form input'ları için)
//   - Eksik / fazla variable detect
//
// V2+ scope (Pass 80+):
//   - Conditional blocks (`{{#if hasStyle}}...{{/if}}`)
//   - List expansion (`{{#each subjects}}...{{/each}}`) — batch generate
//   - Default values (`{{style|minimalist}}`)

/** Variable adı: harf ile başlar, harf/rakam/underscore içerir. */
const VAR_NAME_REGEX = /^[a-zA-Z][a-zA-Z0-9_]*$/;

/** Template içinde `{{name}}` pattern'i için regex. */
const VAR_PATTERN = /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g;

export type ExpandPromptTemplateOptions = {
  /**
   * Eksik variable durumunda davranış:
   *   - "throw" (default): missing variable → Error
   *   - "leave": placeholder olduğu gibi bırakılır (`{{name}}`)
   *   - "empty": placeholder boş string ile değiştirilir
   */
  onMissing?: "throw" | "leave" | "empty";
};

export type ExpandPromptTemplateResult = {
  /** Expanded prompt — variable'lar değerleriyle değiştirilmiş hâli. */
  expanded: string;
  /** Template'te bulunan ve variables'tan değiştirilen variable adları. */
  usedVariables: string[];
  /** Template'te var ama variables map'inde olmayan değişkenler. */
  missingVariables: string[];
  /** variables map'inde var ama template'te kullanılmamış değişkenler. */
  unusedVariables: string[];
};

/**
 * Template + variables → expanded prompt.
 *
 * @example
 * expandPromptTemplate(
 *   "{{subject}} in {{style}} style, {{palette}} palette",
 *   { subject: "boho mandala", style: "minimalist", palette: "earth tones" },
 * );
 * // → "boho mandala in minimalist style, earth tones palette"
 */
export function expandPromptTemplate(
  template: string,
  variables: Record<string, string>,
  options: ExpandPromptTemplateOptions = {},
): ExpandPromptTemplateResult {
  const onMissing = options.onMissing ?? "throw";

  // Önce template'teki tüm variable adlarını çıkar
  const foundInTemplate = new Set<string>();
  for (const match of template.matchAll(VAR_PATTERN)) {
    const name = match[1];
    if (name) foundInTemplate.add(name);
  }

  // variables map'indeki adları validate et + tip kontrolü
  for (const key of Object.keys(variables)) {
    if (!VAR_NAME_REGEX.test(key)) {
      throw new Error(
        `Geçersiz variable adı: "${key}". Sadece harf+rakam+underscore (harfle başlamalı).`,
      );
    }
    if (typeof variables[key] !== "string") {
      throw new Error(
        `Variable "${key}" string olmalı; aldığı: ${typeof variables[key]}`,
      );
    }
  }

  // Eksik variable check (template'te var, map'te yok)
  const missingVariables: string[] = [];
  for (const name of foundInTemplate) {
    if (!Object.prototype.hasOwnProperty.call(variables, name)) {
      missingVariables.push(name);
    }
  }

  if (missingVariables.length > 0 && onMissing === "throw") {
    throw new Error(
      `Eksik variable'lar: ${missingVariables.join(", ")}. ` +
        `Template'te {{${missingVariables.join("}}, {{")}}} kullanılıyor ama ` +
        `variables map'inde değer yok.`,
    );
  }

  // Substitution
  const usedVariables = new Set<string>();
  const expanded = template.replace(VAR_PATTERN, (match, name: string) => {
    if (Object.prototype.hasOwnProperty.call(variables, name)) {
      usedVariables.add(name);
      return variables[name] ?? "";
    }
    if (onMissing === "empty") {
      return "";
    }
    // "leave": placeholder olduğu gibi
    return match;
  });

  // Unused variables (map'te var, template'te kullanılmamış)
  const unusedVariables: string[] = [];
  for (const key of Object.keys(variables)) {
    if (!foundInTemplate.has(key)) {
      unusedVariables.push(key);
    }
  }

  return {
    expanded,
    usedVariables: Array.from(usedVariables),
    missingVariables,
    unusedVariables,
  };
}

/**
 * Template'ten tüm variable adlarını çıkar (tekrarsız, sıralı).
 * UI form'unda kullanıcıya hangi alanları doldurması gerektiğini göstermek için.
 *
 * @example
 * extractTemplateVariables("{{subject}} in {{style}} style for {{subject}}")
 * // → ["subject", "style"]
 */
export function extractTemplateVariables(template: string): string[] {
  const found = new Set<string>();
  for (const match of template.matchAll(VAR_PATTERN)) {
    const name = match[1];
    if (name) found.add(name);
  }
  return Array.from(found);
}

/**
 * Template ve variables uyumluluğunu validate eder (substitution yapmadan).
 * UI form gönderiminden önce ön-kontrol için.
 */
export type ValidatePromptTemplateResult = {
  valid: boolean;
  errors: string[];
  templateVariables: string[];
};

export function validatePromptTemplate(
  template: string,
  variables: Record<string, string>,
): ValidatePromptTemplateResult {
  const errors: string[] = [];
  const templateVariables = extractTemplateVariables(template);

  // variable name validation
  for (const key of Object.keys(variables)) {
    if (!VAR_NAME_REGEX.test(key)) {
      errors.push(`Geçersiz variable adı: "${key}"`);
    }
    if (typeof variables[key] !== "string") {
      errors.push(`Variable "${key}" string değil: ${typeof variables[key]}`);
    }
  }

  // missing
  for (const name of templateVariables) {
    if (!Object.prototype.hasOwnProperty.call(variables, name)) {
      errors.push(`Eksik variable: "${name}"`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    templateVariables,
  };
}

/**
 * MJ-spesifik convenience wrapper: prompt template'ini MJ flag'leriyle
 * birleştirme yardımcısı. Bridge zaten `--ar`, `--v` gibi flag'leri
 * `MjGenerateParams` field'ları üzerinden ekliyor; bu wrapper template
 * core text'ini expand eder + flag'leri olduğu gibi geçirir.
 *
 * @example
 * buildMjPromptFromTemplate(
 *   "{{subject}} in {{style}} style",
 *   { subject: "boho mandala", style: "minimalist" },
 * );
 * // → { prompt: "boho mandala in minimalist style", ... }
 *
 * Caller buildMJPromptString'e bu prompt'u geçirir; flag'ler
 * MjGenerateParams üzerinden eklenir.
 */
export function buildMjPromptFromTemplate(
  template: string,
  variables: Record<string, string>,
): { prompt: string; usedVariables: string[]; unusedVariables: string[] } {
  const result = expandPromptTemplate(template, variables, {
    onMissing: "throw",
  });
  return {
    prompt: result.expanded,
    usedVariables: result.usedVariables,
    unusedVariables: result.unusedVariables,
  };
}
