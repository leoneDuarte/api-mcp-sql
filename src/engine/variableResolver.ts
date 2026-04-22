export function resolveTemplate(template: string, variables: Record<string, unknown>) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, name) => {
    const value = getByPath(variables, String(name));
    if (value === undefined || value === null) return '';
    return String(value);
  });
}

export function resolveObjectTemplates<T>(value: T, variables: Record<string, unknown>): T {
  if (typeof value === 'string') return resolveTemplate(value, variables) as T;
  if (Array.isArray(value)) return value.map((v) => resolveObjectTemplates(v, variables)) as T;
  if (value && typeof value === 'object') {
    const out: any = {};
    for (const [k, v] of Object.entries(value as any)) {
      out[k] = resolveObjectTemplates(v, variables);
    }
    return out;
  }
  return value;
}

function getByPath(obj: Record<string, unknown>, path: string) {
  const parts = path.split('.');
  let current: any = obj;
  for (const part of parts) {
    if (!current || typeof current !== 'object') return undefined;
    current = current[part];
  }
  return current;
}

