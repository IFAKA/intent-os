function splitDefinitions(body) {
  const definitions = [];
  let start = 0;
  let depth = 0;
  let quote = null;
  for (let index = 0; index < body.length; index += 1) {
    const character = body[index];
    if (quote) {
      if (character === quote && body[index - 1] !== '\\') quote = null;
      continue;
    }
    if (character === "'" || character === '"') { quote = character; continue; }
    if (character === '(') depth += 1;
    if (character === ')') depth -= 1;
    if (character === ',' && depth === 0) {
      definitions.push(body.slice(start, index).trim());
      start = index + 1;
    }
  }
  const last = body.slice(start).trim();
  if (last) definitions.push(last);
  return definitions;
}

function parseSchema(sql) {
  const tables = new Map();
  const pattern = /CREATE TABLE IF NOT EXISTS ([A-Za-z_][A-Za-z0-9_]*) \(([\s\S]*?)\n\);/g;
  for (const match of sql.matchAll(pattern)) {
    const definitions = splitDefinitions(match[2]);
    const columns = new Map(definitions
      .filter((definition) => !/^PRIMARY KEY\s*\(/i.test(definition))
      .map((definition) => [definition.split(/\s+/, 1)[0], definition]));
    tables.set(match[1], { statement: match[0], columns });
  }
  return tables;
}

export function generateMigrationSql(previousSql, nextSql) {
  const previous = parseSchema(previousSql);
  const next = parseSchema(nextSql);
  const statements = [];

  for (const [tableName, oldTable] of previous) {
    const newTable = next.get(tableName);
    if (!newTable) throw new Error(`Destructive schema change: table ${tableName} was removed`);
    for (const [columnName, oldDefinition] of oldTable.columns) {
      const newDefinition = newTable.columns.get(columnName);
      if (!newDefinition) throw new Error(`Destructive schema change: column ${tableName}.${columnName} was removed`);
      if (newDefinition !== oldDefinition) {
        throw new Error(`Unsupported schema change: column ${tableName}.${columnName} was changed`);
      }
    }
  }

  for (const [tableName, newTable] of next) {
    const oldTable = previous.get(tableName);
    if (!oldTable) {
      statements.push(`${newTable.statement};`);
      continue;
    }
    for (const [columnName, definition] of newTable.columns) {
      if (oldTable.columns.has(columnName)) continue;
      if (/\bNOT NULL\b/i.test(definition) && !/\bDEFAULT\b/i.test(definition)) {
        throw new Error(`Unsafe schema change: new column ${tableName}.${columnName} is NOT NULL without a DEFAULT`);
      }
      statements.push(`ALTER TABLE ${tableName} ADD COLUMN ${definition};`);
    }
  }

  return statements.length ? `${statements.join('\n\n')}\n` : '';
}
